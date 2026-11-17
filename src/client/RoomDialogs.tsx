import { useState, type FormEvent } from 'react';
import { errorMessage } from './api';
import { Icon } from './icons';
import { presets, type Card, type Deck, type RoomAction, type RoomView } from './model';
import { colorStyle, Dialog, ErrorNotice } from './ui';

type Dispatch = (action: RoomAction) => Promise<void>;

export function TicketDialog({ onAction, onClose }: { onAction: Dispatch; onClose: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get('title') ?? '').trim();
    if (!title) {
      setError('Saisissez le titre du ticket.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onAction({
        type: 'add-ticket',
        title,
        reference: String(fields.get('reference') ?? '').trim(),
        description: String(fields.get('description') ?? '').trim(),
      });
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Ajouter un ticket"
      subtitle="Ajoutez-le à la file pendant que la séance continue."
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={submit}>
        <label>
          Titre du ticket
          <input
            name="title"
            data-dialog-focus
            required
            maxLength={140}
            placeholder="Ex. Rendre la recherche plus rapide"
          />
        </label>
        <label>
          Référence <span className="quiet">(facultative)</span>
          <input name="reference" maxLength={48} placeholder="Ex. PROJ-42" />
        </label>
        <label>
          Description <span className="quiet">(facultative)</span>
          <textarea name="description" maxLength={2000} rows={3} />
        </label>
        <ErrorNotice message={error} />
        <div className="dialog-actions">
          <button type="button" className="button button-outline" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            <Icon name="plus" size={18} /> Ajouter à la file
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function CardSettings({
  card,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  card: Card;
  index: number;
  onChange: (card: Card) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="card-settings-row">
      <span className="settings-card-preview" style={colorStyle(card.color)} aria-hidden="true">
        {card.label || '—'}
      </span>
      <label className="card-label-field">
        Valeur de la carte {index + 1}
        <input
          required
          maxLength={24}
          value={card.label}
          onChange={(event) => onChange({ ...card, label: event.target.value })}
        />
      </label>
      <label className="color-label">
        Couleur <span className="sr-only">de la carte {index + 1}</span>
        <input
          type="color"
          value={card.color}
          onChange={(event) => onChange({ ...card, color: event.target.value })}
        />
      </label>
      <button
        className="icon-button"
        type="button"
        aria-label={`Retirer la carte ${index + 1}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

export function SettingsDialog({
  room,
  onAction,
  onClose,
}: {
  room: RoomView;
  onAction: Dispatch;
  onClose: () => void;
}) {
  const [deck, setDeck] = useState<Deck>(room.configuredDeck);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isHost = room.me.role === 'host';

  async function apply(action: RoomAction, close = false) {
    setError('');
    setBusy(true);
    try {
      await onAction(action);
      if (close) onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = {
      name: deck.name.trim(),
      cards: deck.cards.map((card) => ({ ...card, label: card.label.trim() })),
    };
    if (!trimmed.name || trimmed.cards.some((card) => !card.label)) {
      setError('Saisissez le nom du jeu et la valeur de chaque carte.');
      return;
    }
    void apply({ type: 'set-deck', deck: trimmed }, true);
  }

  function addCard() {
    const id = `card-${Date.now().toString(36)}-${deck.cards.length}`;
    setDeck((current) => ({
      ...current,
      cards: [...current.cards, { id, color: '#e1cff8', label: '' }],
    }));
  }

  return (
    <Dialog title="Réglages de la salle" className="settings-dialog" onClose={onClose}>
      <div className="settings-toggles">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={room.me.spectator}
            disabled={busy}
            onChange={(event) =>
              void apply({ type: 'set-spectator', enabled: event.target.checked })
            }
          />{' '}
          Observer la séance
        </label>
        {isHost && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={room.autoReveal}
              disabled={busy}
              onChange={(event) =>
                void apply({ type: 'set-auto-reveal', enabled: event.target.checked })
              }
            />{' '}
            Révéler quand tout le monde a voté
          </label>
        )}
      </div>
      {!isHost && <ErrorNotice message={error} />}
      {isHost && (
        <form className="dialog-form deck-settings" onSubmit={save}>
          <section className="presets" aria-labelledby="deck-presets">
            <h3 id="deck-presets">Jeux de cartes</h3>
            <div className="preset-list">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="button button-outline"
                  type="button"
                  onClick={() => setDeck(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </section>
          <label>
            Nom du jeu
            <input
              required
              value={deck.name}
              maxLength={48}
              onChange={(event) => setDeck({ ...deck, name: event.target.value })}
            />
          </label>
          <div className="card-settings-list">
            {deck.cards.map((card, index) => (
              <CardSettings
                key={card.id}
                card={card}
                index={index}
                canRemove={deck.cards.length > 2}
                onChange={(updated) =>
                  setDeck({
                    ...deck,
                    cards: deck.cards.map((item) => (item.id === card.id ? updated : item)),
                  })
                }
                onRemove={() =>
                  setDeck({ ...deck, cards: deck.cards.filter((item) => item.id !== card.id) })
                }
              />
            ))}
          </div>
          <button
            className="button button-outline"
            type="button"
            disabled={deck.cards.length >= 24}
            onClick={addCard}
          >
            <Icon name="plus" size={17} /> Ajouter une carte
          </button>
          <ErrorNotice message={error} />
          <div className="dialog-actions">
            <button type="button" className="button button-outline" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="button button-primary" disabled={busy}>
              Enregistrer le jeu
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function ShareDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = new URL(`/salle/${encodeURIComponent(roomId)}`, window.location.origin).href;

  async function copy() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      title="Inviter à la table"
      subtitle="Toute personne disposant du lien peut rejoindre la salle."
      onClose={onClose}
    >
      <div className="dialog-form">
        <label>
          Lien d’invitation
          <input
            type="url"
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void copy()}
          disabled={!navigator.clipboard}
        >
          <Icon name={copied ? 'check' : 'link'} size={19} />{' '}
          {copied ? 'Lien copié' : 'Copier le lien'}
        </button>
        <span className="sr-only" role="status">
          {copied ? 'Lien copié' : ''}
        </span>
      </div>
    </Dialog>
  );
}
