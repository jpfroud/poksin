import { ClientError } from './errors.js';
import type { Action, Deck, Mode } from './room.js';

type Input = Record<string, unknown>;

function record(value: unknown): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ClientError(400, 'Le contenu doit être un objet JSON.');
  }
  return value as Input;
}

function text(input: Input, key: string, label: string, limit: number, optional = false) {
  const value = input[key];
  if (value === undefined && optional) return '';
  if (typeof value !== 'string') throw new ClientError(400, `${label} est requis.`);
  const trimmed = value.trim();
  if (!trimmed && !optional) throw new ClientError(400, `${label} est requis.`);
  if (trimmed.length > limit)
    throw new ClientError(400, `${label} est limité à ${limit} caractères.`);
  if (trimmed.includes('\0'))
    throw new ClientError(400, `${label} contient un caractère invalide.`);
  return trimmed;
}

function flag(value: unknown) {
  if (typeof value !== 'boolean')
    throw new ClientError(400, 'Ce réglage doit être activé ou désactivé.');
  return value;
}

function color(value: unknown) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new ClientError(400, 'La couleur doit utiliser le format hexadécimal à six chiffres.');
  }
  return value;
}

function mode(value: unknown): Mode {
  if (value !== 'free' && value !== 'tickets') throw new ClientError(400, 'Ce mode est inconnu.');
  return value;
}

function deck(value: unknown): Deck {
  const input = record(value);
  const name = text(input, 'name', 'Le nom du jeu', 48);
  if (!Array.isArray(input.cards) || input.cards.length < 2 || input.cards.length > 24) {
    throw new ClientError(400, 'Ajoutez entre 2 et 24 cartes à votre jeu.');
  }
  // Card identifiers are opaque keys for votes. The visible label is stored separately.
  const cards = (input.cards as unknown[]).map((entry) => {
    const card = record(entry);
    if (typeof card.id !== 'string' || !/^[\w-]{1,32}$/.test(card.id)) {
      throw new ClientError(400, 'L’identifiant d’une carte est invalide.');
    }
    return {
      id: card.id,
      label: text(card, 'label', 'La valeur de la carte', 24),
      color: color(card.color),
    };
  });
  if (new Set(cards.map(({ id }) => id)).size !== cards.length) {
    throw new ClientError(400, 'Chaque carte doit avoir un identifiant unique.');
  }
  return { name, cards };
}

export function parseCreate(value: unknown) {
  const input = record(value);
  const name = text(input, 'name', 'Votre prénom', 40);
  return {
    name,
    title: text(input, 'title', 'Le nom de la salle', 80, true) || `Salle de ${name}`,
  };
}

export function parseJoin(value: unknown) {
  const input = record(value);
  return {
    name: text(input, 'name', 'Votre prénom', 40),
    spectator: input.spectator === undefined ? false : flag(input.spectator),
    color: input.color === undefined ? undefined : color(input.color),
  };
}

export function parseAction(value: unknown): Action {
  const input = record(value);
  switch (input.type) {
    case 'vote':
      return {
        type: input.type,
        roundId: text(input, 'roundId', 'La manche', 32),
        cardId: input.cardId === null ? null : text(input, 'cardId', 'La carte', 32),
      };
    case 'save':
      return {
        type: input.type,
        roundId: text(input, 'roundId', 'La manche', 32),
        estimate: text(input, 'estimate', 'L’estimation', 24),
        note: text(input, 'note', 'La note', 1000, true),
      };
    case 'reveal':
    case 'reset':
    case 'next':
      return { type: input.type, roundId: text(input, 'roundId', 'La manche', 32) };
    case 'add-ticket':
      return {
        type: input.type,
        title: text(input, 'title', 'Le titre du ticket', 140),
        reference: text(input, 'reference', 'La référence', 48, true),
        description: text(input, 'description', 'La description', 2000, true),
      };
    case 'select-ticket':
      return { type: input.type, ticketId: text(input, 'ticketId', 'Le ticket', 32) };
    case 'mode':
      return { type: input.type, mode: mode(input.mode) };
    case 'set-deck':
      return { type: input.type, deck: deck(input.deck) };
    case 'set-auto-reveal':
    case 'set-spectator':
      return { type: input.type, enabled: flag(input.enabled) };
    default:
      throw new ClientError(400, 'Cette action est inconnue.');
  }
}
