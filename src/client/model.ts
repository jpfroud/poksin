export type Mode = 'tickets' | 'free';

export type Card = { id: string; label: string; color: string };
export type Deck = { name: string; cards: Card[] };
export type Ticket = {
  id: string;
  title: string;
  reference: string;
  description: string;
  estimate: string | null;
};

export type RoomView = {
  id: string;
  title: string;
  mode: Mode;
  me: { id: string; name: string; role: 'host' | 'participant'; spectator: boolean };
  participants: {
    id: string;
    name: string;
    color: string;
    online: boolean;
    voted: boolean;
    spectator: boolean;
    vote?: string | null;
  }[];
  deck: Deck;
  configuredDeck: Deck;
  tickets: Ticket[];
  round: {
    id: string;
    ticketId: string | null;
    phase: 'voting' | 'revealed' | 'saved';
    estimate: string | null;
    note: string;
    myVote: string | null;
  };
  history: {
    id: string;
    mode: Mode;
    ticketId: string | null;
    title: string;
    estimate: string;
    note: string;
    at: string;
  }[];
  autoReveal: boolean;
};

export type RoomAction =
  | { type: 'vote'; roundId: string; cardId: string | null }
  | { type: 'reveal' | 'reset' | 'next'; roundId: string }
  | { type: 'save'; roundId: string; estimate: string; note?: string }
  | { type: 'add-ticket'; title: string; reference?: string; description?: string }
  | { type: 'select-ticket'; ticketId: string }
  | { type: 'mode'; mode: Mode }
  | { type: 'set-deck'; deck: Deck }
  | { type: 'set-auto-reveal' | 'set-spectator'; enabled: boolean };

export const roomPath = (id: string) => `/salle/${encodeURIComponent(id)}`;

export function readRoomId(value: string): string | null {
  const clean = value.trim();
  const path = clean.match(/(?:^|\/)salle\/([a-zA-Z0-9_-]{6,80})(?:[/?#]|$)/);
  if (path) return path[1];
  return /^[a-zA-Z0-9_-]{6,80}$/.test(clean) ? clean : null;
}

const palette = ['#e1cff8', '#b9e6d1', '#f6dfa0', '#eac6d7', '#cfd8fd'];

function makeDeck(name: string, labels: string[]): Deck {
  return {
    name,
    cards: labels.map((label, index) => ({
      id: `card-${index + 1}`,
      label,
      color: palette[index % palette.length],
    })),
  };
}

export const presets = [
  makeDeck('Fibonacci', ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?']),
  makeDeck('Fibonacci modifié', ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?']),
  makeDeck('Tailles de T-shirt', ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?']),
  makeDeck('Puissances de deux', ['0', '1', '2', '4', '8', '16', '32', '64', '?']),
];
