import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  applyAction,
  createRoom,
  roomView,
  updatePresence,
  type Action,
} from '../../src/server/room.js';
import { INACTIVITY_MILLISECONDS, RoomStore } from '../../src/server/store.js';

const now = Date.parse('2026-11-17T08:00:00.000Z');

function setup() {
  const { room, seat } = createRoom('Nora', 'Sprint Atlas');
  const host = seat.participant;
  const guest = addParticipant(room, { name: 'Éli' }).participant;
  const online = new Set([host.id, guest.id]);
  const act = (action: Action) => applyAction(room, host, action, online, now);
  const view = () => roomView(room, host, online);
  const add = (title: string) => act({ type: 'add-ticket', title, reference: '', description: '' });
  return { room, host, guest, online, act, view, add };
}

describe('Manches et tickets', () => {
  it('conserve les votes, les tickets et les deux manches lors des bascules', () => {
    const { add, act, guest, online, room, view } = setup();
    expect(() => act({ type: 'vote', roundId: view().round.id, cardId: 'card-2' })).toThrow(
      'Ajoutez un ticket',
    );
    add('Créer une carte');
    const original = view().round;
    act({ type: 'vote', roundId: original.id, cardId: 'card-2' });
    applyAction(room, guest, { type: 'vote', roundId: original.id, cardId: 'card-4' }, online, now);
    add('Exporter un résultat');
    expect(view().round).toMatchObject({ id: original.id, myVote: 'card-2' });
    expect(view().participants[1]).toMatchObject({ name: 'Éli', voted: true });
    expect(view().participants[1]).not.toHaveProperty('vote');

    act({ type: 'mode', mode: 'free' });
    const libre = view().round.id;
    act({ type: 'vote', roundId: libre, cardId: 'card-4' });
    act({ type: 'reveal', roundId: libre });
    act({ type: 'save', roundId: libre, estimate: '5', note: 'À décomposer' });
    expect(view().history).toEqual([
      {
        id: libre,
        mode: 'free',
        ticketId: null,
        title: 'Manche libre 1',
        estimate: '5',
        note: 'À décomposer',
        at: new Date(now).toISOString(),
      },
    ]);

    act({ type: 'mode', mode: 'tickets' });
    expect(view().round).toMatchObject({ id: original.id, myVote: 'card-2' });
    expect(view().tickets.map((ticket) => ticket.title)).toEqual([
      'Créer une carte',
      'Exporter un résultat',
    ]);
    act({ type: 'reveal', roundId: original.id });
    expect(view().participants.map((participant) => participant.vote)).toEqual(['2', '5']);
    act({ type: 'save', roundId: original.id, estimate: '3', note: '' });
    act({ type: 'next', roundId: original.id });
    expect(view().round.ticketId).toBe(view().tickets[1]?.id);
    expect(view().tickets[0]?.estimate).toBe('3');
    expect(() => act({ type: 'reset', roundId: original.id })).toThrow('La manche a changé');
  });

  it('garde un jeu de cartes par manche commencée après une modification', () => {
    const { add, act, view } = setup();
    add('Créer le planning');
    const ticketRound = view().round.id;
    act({ type: 'vote', roundId: ticketRound, cardId: 'card-2' });
    const deck = {
      name: 'Mailles',
      cards: [
        { id: 'xs', label: 'XS', color: '#506080' },
        { id: 'xl', label: 'XL', color: '#405060' },
      ],
    };
    expect(() => act({ type: 'set-deck', deck })).toThrow('Terminez ou relancez');
    act({ type: 'mode', mode: 'free' });
    act({ type: 'set-deck', deck });
    expect(view().deck).toEqual(deck);
    act({ type: 'mode', mode: 'tickets' });
    expect(view().deck.name).toBe('Fibonacci');
    act({ type: 'reveal', roundId: ticketRound });
    expect(view().participants[0]?.vote).toBe('2');
    expect(view().deck.name).toBe('Fibonacci');
    expect(view().configuredDeck).toEqual(deck);
    act({ type: 'reset', roundId: ticketRound });
    expect(view().deck).toEqual(deck);
    expect(view().round.myVote).toBeNull();
    expect(() => act({ type: 'vote', roundId: view().round.id, cardId: 'card-2' })).toThrow(
      'n’appartient pas',
    );
  });

  it('révèle après les votants présents et exclut les spectateurs', () => {
    const { add, act, guest, online, room, view } = setup();
    add('Voter');
    const roundId = view().round.id;
    act({ type: 'set-auto-reveal', enabled: true });
    act({ type: 'vote', roundId, cardId: 'card-4' });
    expect(view().round.phase).toBe('voting');
    online.delete(guest.id);
    expect(updatePresence(room, online)).toBe(true);
    expect(view().round.phase).toBe('revealed');
    act({ type: 'reset', roundId });
    online.add(guest.id);
    applyAction(room, guest, { type: 'set-spectator', enabled: true }, online, now);
    expect(() =>
      applyAction(
        room,
        guest,
        { type: 'vote', roundId: view().round.id, cardId: 'card-1' },
        online,
        now,
      ),
    ).toThrow('mode votant');
    act({ type: 'vote', roundId: view().round.id, cardId: 'card-2' });
    expect(view().round.phase).toBe('revealed');
  });
});

describe('Conservation des salles', () => {
  it('expire 90 jours après l’activité et supprime la donnée périmée', () => {
    const store = new RoomStore(':memory:');
    try {
      const { room } = createRoom('Nora', 'Sprint Atlas');
      store.create(room, now);
      const beforeExpiry = now + INACTIVITY_MILLISECONDS - 1;
      expect(store.read(room.id, beforeExpiry).id).toBe(room.id);
      store.touch(room.id, beforeExpiry);
      expect(store.read(room.id, beforeExpiry + INACTIVITY_MILLISECONDS - 1).id).toBe(room.id);
      expect(() => store.read(room.id, beforeExpiry + INACTIVITY_MILLISECONDS)).toThrow('a expiré');
      expect(store.prune(beforeExpiry + INACTIVITY_MILLISECONDS)).toEqual([room.id]);
      expect(() => store.read(room.id, now)).toThrow('a expiré');
    } finally {
      store.close();
    }
  });

  it('annule toute mutation quand l’action échoue', () => {
    const store = new RoomStore(':memory:');
    try {
      const { room } = createRoom('Nora', 'Sprint Atlas');
      store.create(room, now);
      expect(() =>
        store.modify(room.id, now, (active) => {
          active.title = 'Interrompu';
          throw new Error('Écriture refusée');
        }),
      ).toThrow('Écriture refusée');
      expect(store.read(room.id, now).title).toBe('Sprint Atlas');
    } finally {
      store.close();
    }
  });
});
