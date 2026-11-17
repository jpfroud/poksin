import { createHash, randomBytes } from 'node:crypto';
import { ClientError } from './errors.js';

export type Mode = 'tickets' | 'free';
type Role = 'host' | 'participant';
type Phase = 'voting' | 'revealed' | 'saved';

export interface Card {
  id: string;
  label: string;
  color: string;
}

export interface Deck {
  name: string;
  cards: Card[];
}

interface Participant {
  id: string;
  name: string;
  role: Role;
  color: string;
  spectator: boolean;
  tokenHash: string;
}

interface Round {
  id: string;
  phase: Phase;
  votes: Record<string, string>;
  estimate: string | null;
  note: string;
  deck?: Deck;
}

interface Ticket {
  id: string;
  title: string;
  reference: string;
  description: string;
  estimate: string | null;
  round: Round;
}

interface Estimate {
  id: string;
  mode: Mode;
  ticketId: string | null;
  title: string;
  estimate: string;
  note: string;
  at: string;
}

export interface Room {
  id: string;
  title: string;
  mode: Mode;
  participants: Participant[];
  tickets: Ticket[];
  currentTicketId: string | null;
  waitingRound: Round;
  freeRound: Round;
  deck: Deck;
  history: Estimate[];
  autoReveal: boolean;
}

interface Seat {
  participant: Participant;
  token: string;
}

export type Action =
  | { type: 'vote'; roundId: string; cardId: string | null }
  | { type: 'reveal' | 'reset' | 'next'; roundId: string }
  | { type: 'save'; roundId: string; estimate: string; note: string }
  | { type: 'add-ticket'; title: string; reference: string; description: string }
  | { type: 'select-ticket'; ticketId: string }
  | { type: 'mode'; mode: Mode }
  | { type: 'set-deck'; deck: Deck }
  | { type: 'set-auto-reveal' | 'set-spectator'; enabled: boolean };

const colors = ['#a95c3d', '#7059a0', '#417565', '#a45577', '#805989', '#547994'];
const defaultDeck: Deck = {
  name: 'Fibonacci',
  cards: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'].map((label, index) => ({
    id: `card-${index}`,
    label,
    color: colors[index % colors.length]!,
  })),
};

function id(bytes = 12) {
  return randomBytes(bytes).toString('hex');
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function newRound(): Round {
  return { id: id(), phase: 'voting', votes: {}, estimate: null, note: '' };
}

export function createRoom(name: string, title: string) {
  const room: Room = {
    id: id(),
    title,
    mode: 'tickets',
    participants: [],
    tickets: [],
    currentTicketId: null,
    waitingRound: newRound(),
    freeRound: newRound(),
    deck: defaultDeck,
    history: [],
    autoReveal: false,
  };
  return { room, seat: addParticipant(room, { name }, 'host') };
}

export function addParticipant(
  room: Room,
  details: { name: string; color?: string | undefined; spectator?: boolean | undefined },
  role: Role = 'participant',
): Seat {
  if (room.participants.length >= 100) {
    throw new ClientError(409, 'Cette salle a atteint sa capacité de 100 personnes.');
  }
  const token = id(32);
  const participant: Participant = {
    id: id(),
    name: details.name,
    role,
    color: details.color ?? colors[room.participants.length % colors.length]!,
    spectator: details.spectator ?? false,
    tokenHash: hashToken(token),
  };
  room.participants.push(participant);
  return { participant, token };
}

export function getParticipant(room: Room, token: string | undefined) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return undefined;
  const hash = hashToken(token);
  return room.participants.find((participant) => participant.tokenHash === hash);
}

function getActive(room: Room) {
  const ticket =
    room.mode === 'tickets'
      ? room.tickets.find((item) => item.id === room.currentTicketId)
      : undefined;
  const round = room.mode === 'free' ? room.freeRound : (ticket?.round ?? room.waitingRound);
  return { ticket, round, deck: round.deck ?? room.deck };
}

export function roomView(room: Room, viewer: Participant, online: ReadonlySet<string>) {
  const { ticket, round, deck } = getActive(room);
  return {
    id: room.id,
    title: room.title,
    mode: room.mode,
    me: { id: viewer.id, name: viewer.name, role: viewer.role, spectator: viewer.spectator },
    participants: room.participants.map(({ id, name, color, spectator }) => ({
      id,
      name,
      color,
      spectator,
      online: online.has(id),
      voted: Object.hasOwn(round.votes, id),
      ...(round.phase === 'voting'
        ? {}
        : { vote: deck.cards.find((card) => card.id === round.votes[id])?.label ?? null }),
    })),
    deck,
    configuredDeck: room.deck,
    tickets: room.tickets.map(({ id, title, reference, description, estimate }) => ({
      id,
      title,
      reference,
      description,
      estimate,
    })),
    round: {
      id: round.id,
      ticketId: ticket?.id ?? null,
      phase: round.phase,
      estimate: round.estimate,
      note: round.note,
      myVote: round.votes[viewer.id] ?? null,
    },
    history: room.history,
    autoReveal: room.autoReveal,
  };
}

function requireHost(participant: Participant) {
  if (participant.role !== 'host') {
    throw new ClientError(403, 'Cette action est réservée à l’animateur.');
  }
}

function revealWhenReady(room: Room, round: Round, online: ReadonlySet<string>) {
  if (!room.autoReveal || round.phase !== 'voting') return;
  const voters = room.participants.filter(({ id, spectator }) => online.has(id) && !spectator);
  if (voters.length && voters.every(({ id }) => Object.hasOwn(round.votes, id))) {
    round.phase = 'revealed';
  }
}

export function updatePresence(room: Room, online: ReadonlySet<string>) {
  const { round } = getActive(room);
  const before = round.phase;
  revealWhenReady(room, round, online);
  return round.phase !== before;
}

export function applyAction(
  room: Room,
  actor: Participant,
  action: Action,
  online: ReadonlySet<string>,
  now: number,
) {
  const { ticket, round, deck } = getActive(room);
  if (action.type !== 'vote' && action.type !== 'set-spectator') requireHost(actor);
  if ('roundId' in action && action.roundId !== round.id) {
    throw new ClientError(409, 'La manche a changé. Réessayez depuis la manche actuelle.');
  }
  if ('roundId' in action && room.mode === 'tickets' && !ticket) {
    throw new ClientError(
      409,
      'Ajoutez un ticket ou passez en mode Libre avant de lancer un vote.',
    );
  }

  switch (action.type) {
    case 'add-ticket': {
      if (room.tickets.length >= 250)
        throw new ClientError(409, 'Cette salle contient déjà 250 tickets.');
      const added: Ticket = {
        id: id(),
        title: action.title,
        reference: action.reference,
        description: action.description,
        estimate: null,
        round: newRound(),
      };
      room.tickets.push(added);
      room.currentTicketId ??= added.id;
      break;
    }
    case 'select-ticket':
      if (!room.tickets.some(({ id }) => id === action.ticketId)) {
        throw new ClientError(404, 'Ce ticket est introuvable.');
      }
      room.currentTicketId = action.ticketId;
      break;
    case 'mode':
      room.mode = action.mode;
      break;
    case 'set-deck':
      if (Object.keys(round.votes).length && round.phase === 'voting') {
        throw new ClientError(
          409,
          'Terminez ou relancez la manche avant de modifier le jeu de cartes.',
        );
      }
      room.deck = action.deck;
      if (round.phase === 'voting') delete round.deck;
      break;
    case 'set-auto-reveal':
      room.autoReveal = action.enabled;
      break;
    case 'set-spectator':
      actor.spectator = action.enabled;
      if (actor.spectator) {
        for (const item of [room.freeRound, ...room.tickets.map(({ round }) => round)]) {
          if (item.phase === 'voting') delete item.votes[actor.id];
        }
      }
      break;
    case 'vote':
      if (actor.spectator)
        throw new ClientError(403, 'Passez en mode votant pour choisir une carte.');
      if (round.phase !== 'voting') throw new ClientError(409, 'Le vote de cette manche est clos.');
      if (action.cardId === null) {
        delete round.votes[actor.id];
      } else {
        if (!deck.cards.some(({ id }) => id === action.cardId)) {
          throw new ClientError(400, 'Cette carte n’appartient pas au jeu de cette manche.');
        }
        round.deck ??= deck;
        round.votes[actor.id] = action.cardId;
      }
      break;
    case 'reveal':
      if (round.phase !== 'voting') throw new ClientError(409, 'Cette manche est déjà révélée.');
      round.deck ??= deck;
      round.phase = 'revealed';
      break;
    case 'reset':
      if (ticket) ticket.round = newRound();
      else room.freeRound = newRound();
      break;
    case 'save': {
      if (round.phase !== 'revealed')
        throw new ClientError(409, 'Révélez les votes avant d’enregistrer.');
      if (room.history.length >= 500) {
        throw new ClientError(
          409,
          'Cette salle contient déjà 500 estimations. Créez une autre salle pour continuer.',
        );
      }
      round.phase = 'saved';
      round.estimate = action.estimate;
      round.note = action.note;
      if (ticket) ticket.estimate = action.estimate;
      room.history.push({
        id: round.id,
        mode: room.mode,
        ticketId: ticket?.id ?? null,
        title:
          ticket?.title ??
          `Manche libre ${room.history.filter(({ mode }) => mode === 'free').length + 1}`,
        estimate: action.estimate,
        note: action.note,
        at: new Date(now).toISOString(),
      });
      break;
    }
    case 'next': {
      if (round.phase !== 'saved') {
        throw new ClientError(
          409,
          'Enregistrez l’estimation avant de passer à la manche suivante.',
        );
      }
      if (ticket) {
        const current = room.tickets.indexOf(ticket);
        const queue = [...room.tickets.slice(current + 1), ...room.tickets.slice(0, current)];
        room.currentTicketId = queue.find(({ estimate }) => estimate === null)?.id ?? null;
        room.waitingRound = newRound();
      } else {
        room.freeRound = newRound();
      }
      break;
    }
  }

  const current = getActive(room).round;
  revealWhenReady(room, current, online);
}
