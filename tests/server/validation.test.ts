import { describe, expect, it } from 'vitest';
import { parseAction, parseCreate, parseJoin } from '../../src/server/validation.js';

describe('Validation des données transmises', () => {
  it('normalise les données de participation et ne prend pas le rôle fourni', () => {
    expect(parseCreate({ name: ' Léa ', title: ' Sprint ' })).toEqual({
      name: 'Léa',
      title: 'Sprint',
    });
    expect(parseJoin({ name: ' Rémi ', spectator: true, color: '#123ABC', role: 'host' })).toEqual({
      name: 'Rémi',
      spectator: true,
      color: '#123ABC',
    });
    expect(() => parseCreate([])).toThrow('objet JSON');
    expect(() => parseCreate({ name: 'x'.repeat(41) })).toThrow('limité à 40');
    expect(() => parseJoin({ name: 'Rémi', color: 'rebeccapurple' })).toThrow('hexadécimal');
    expect(() => parseJoin({ name: 'Rémi', spectator: 'true' })).toThrow('réglage');
  });

  it('valide les nouvelles manches et le choix d’une carte', () => {
    expect(parseAction({ type: 'vote', roundId: 'abc', cardId: null })).toEqual({
      type: 'vote',
      roundId: 'abc',
      cardId: null,
    });
    expect(parseAction({ type: 'select-ticket', ticketId: 'abc' })).toEqual({
      type: 'select-ticket',
      ticketId: 'abc',
    });
    expect(() => parseAction({ type: 'mode', mode: 'inconnu' })).toThrow('mode est inconnu');
    expect(() => parseAction({ type: 'mettre-à-jour' })).toThrow('action est inconnue');
    expect(() =>
      parseAction({ type: 'save', roundId: 'abc', estimate: '5', note: 'a\0b' }),
    ).toThrow('caractère invalide');
  });

  it('valide le nom, la taille, les couleurs et les identifiants des jeux personnalisés', () => {
    const cards = [
      { id: 'xs', label: 'XS', color: '#112233' },
      { id: 'xl', label: 'XL', color: '#332211' },
    ];
    const custom = (value: unknown) =>
      parseAction({ type: 'set-deck', deck: { name: ' Tailles ', cards: value } });
    expect(custom(cards)).toEqual({ type: 'set-deck', deck: { name: 'Tailles', cards } });
    expect(() => custom(cards.slice(0, 1))).toThrow('2 et 24 cartes');
    expect(() => custom([...cards, { ...cards[0], label: 'S' }])).toThrow('identifiant unique');
    expect(() => custom([...cards, { ...cards[0], id: 'sans espace' }])).toThrow(
      'identifiant d’une carte est invalide',
    );
  });
});
