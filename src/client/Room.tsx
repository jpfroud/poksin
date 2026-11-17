import { useRef, useState, type FormEvent } from 'react';
import { errorMessage } from './api';
import { Icon } from './icons';
import type { RoomAction, RoomView, Ticket } from './model';
import { SettingsDialog, ShareDialog, TicketDialog } from './RoomDialogs';
import { colorStyle, ErrorNotice, Logo } from './ui';

type Dispatch = (action: RoomAction) => Promise<void>;
type Participant = RoomView['participants'][number];
type EstimateDraft = { estimate: string; note: string };
type ResultForm = { draft: EstimateDraft; update: (patch: Partial<EstimateDraft>) => void };
const emptyDraft = { estimate: '', note: '' };

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0] ?? '')
    .join('')
    .toLocaleUpperCase('fr');
}

function Seat({
  participant,
  isMe,
  revealed,
}: {
  participant: Participant;
  isMe: boolean;
  revealed: boolean;
}) {
  const vote = revealed ? participant.vote : null;
  let status = participant.voted ? 'A voté' : 'En attente';
  if (!participant.online) status = 'Hors ligne';
  if (participant.spectator) status = 'Observe';

  return (
    <li
      className={`seat ${participant.online ? '' : 'seat-offline'}`}
      data-testid={`participant-${participant.id}`}
    >
      <div className="seat-top">
        <span className="avatar" style={colorStyle(participant.color)} aria-hidden="true">
          {initials(participant.name)}
        </span>
        <span
          className={`seat-card ${vote != null ? 'seat-card-revealed' : participant.voted ? 'seat-card-ready' : ''}`}
          aria-hidden="true"
        >
          {vote != null ? (
            vote
          ) : participant.voted ? (
            <Icon name="check" size={15} />
          ) : (
            <span>···</span>
          )}
        </span>
      </div>
      <span className="seat-name" title={participant.name}>
        {participant.name}
        {isMe && <span className="seat-you"> (vous)</span>}
      </span>
      <span className="seat-status">{vote == null ? status : `Vote révélé : ${vote}`}</span>
    </li>
  );
}

function RoundResult({
  room,
  busy,
  onAction,
  resultForm,
}: {
  room: RoomView;
  busy: boolean;
  onAction: Dispatch;
  resultForm: ResultForm;
}) {
  const { round } = room;
  const isHost = room.me.role === 'host';
  const { estimate, note } = resultForm.draft;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (estimate) void onAction({ type: 'save', roundId: round.id, estimate, note: note.trim() });
  }

  if (round.phase === 'saved') {
    return (
      <div className="result-row">
        <span className="result-estimate">{round.estimate}</span>
        <div className="result-message">
          <strong>Estimation enregistrée</strong>
          {round.note && <p>{round.note}</p>}
        </div>
        {isHost && (
          <button
            className="button button-primary"
            type="button"
            disabled={busy}
            onClick={() => void onAction({ type: 'next', roundId: round.id })}
          >
            Manche suivante <Icon name="arrow" size={17} />
          </button>
        )}
      </div>
    );
  }

  if (!isHost)
    return (
      <p className="voting-hint">
        <Icon name="eye" size={17} /> Les votes sont révélés. Discutez de l’estimation à retenir.
      </p>
    );

  return (
    <form className="estimate-form" onSubmit={save}>
      <div className="estimate-fields">
        <label>
          Estimation retenue
          <select
            required
            value={estimate}
            onChange={(event) => resultForm.update({ estimate: event.target.value })}
          >
            <option value="">Choisir une valeur</option>
            {room.deck.cards.map((card) => (
              <option value={card.label} key={card.id}>
                {card.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note <span className="quiet">(facultative)</span>
          <input
            value={note}
            maxLength={1000}
            onChange={(event) => resultForm.update({ note: event.target.value })}
            placeholder="Un point à retenir…"
          />
        </label>
      </div>
      <div className="round-actions">
        <button
          className="button button-outline"
          type="button"
          disabled={busy}
          onClick={() => void onAction({ type: 'reset', roundId: round.id })}
        >
          <Icon name="refresh" size={17} /> Relancer le vote
        </button>
        <button className="button button-primary" type="submit" disabled={busy}>
          <Icon name="check" size={17} /> Enregistrer l’estimation
        </button>
      </div>
    </form>
  );
}

function VoteBoard({
  room,
  activeTicket,
  busy,
  onAction,
  resultForm,
}: {
  room: RoomView;
  activeTicket?: Ticket;
  busy: boolean;
  onAction: Dispatch;
  resultForm: ResultForm;
}) {
  const { round } = room;
  const isHost = room.me.role === 'host';
  const hasSubject = room.mode === 'free' || activeTicket !== undefined;
  const canVote = hasSubject && round.phase === 'voting' && !room.me.spectator;
  const voters = room.participants.filter(
    (participant) => participant.online && !participant.spectator,
  );
  const haveVoted = voters.filter((participant) => participant.voted).length;
  const anyVote = room.participants.some((participant) => participant.voted);
  const title =
    room.mode === 'free' ? 'Estimation libre' : (activeTicket?.title ?? 'Aucun ticket en cours');
  const subtitle =
    room.mode === 'free'
      ? 'Présentez votre sujet à l’oral, puis choisissez une carte.'
      : activeTicket?.description ||
        (activeTicket ? '' : 'Ajoutez un ticket à la file pour commencer.');
  const stage =
    round.phase === 'saved'
      ? 'Manche terminée'
      : round.phase === 'revealed'
        ? 'Votes révélés'
        : hasSubject
          ? 'Vote en cours'
          : 'Prêt à jouer';

  return (
    <section className="vote-board" aria-labelledby="round-title">
      <div className="board-header">
        <div className="board-topic">
          <p className="board-kicker">
            <Icon name={room.mode === 'tickets' ? 'ticket' : 'talk'} size={16} />{' '}
            {activeTicket?.reference || (room.mode === 'free' ? 'Mode libre' : 'Ticket en cours')}
          </p>
          <h2 id="round-title" data-testid="round-title">
            {title}
          </h2>
          {subtitle && <p className="board-description">{subtitle}</p>}
        </div>
        <span className={`stage-pill stage-${round.phase}`}>
          <i />
          {stage}
        </span>
      </div>

      <section className="table-surface" aria-label="Participants à la table">
        <div className="table-pattern" aria-hidden="true" />
        <span className="table-star" aria-hidden="true">
          ✧
        </span>
        <div className="table-topline">
          <span>
            <Icon name="users" size={18} /> À la table
          </span>
          <span>
            {haveVoted}/{voters.length} {voters.length === 1 ? 'vote' : 'votes'}
          </span>
        </div>
        <ul className="seat-list">
          {room.participants.map((participant) => (
            <Seat
              key={participant.id}
              participant={participant}
              isMe={participant.id === room.me.id}
              revealed={round.phase !== 'voting'}
            />
          ))}
        </ul>
      </section>

      {round.phase === 'voting' ? (
        <section className="voting-area" aria-labelledby="voting-title">
          <div className="voting-heading">
            <h3 id="voting-title">Votre estimation</h3>
            <span className="deck-label">
              <Icon name="cards" size={17} /> {room.deck.name}
            </span>
          </div>
          <div className="cards" role="group" aria-label="Cartes d’estimation">
            {room.deck.cards.map((card) => {
              const chosen = round.myVote === card.id;
              return (
                <button
                  className="vote-card"
                  key={card.id}
                  type="button"
                  style={colorStyle(card.color)}
                  aria-pressed={chosen}
                  aria-label={`Voter ${card.label}`}
                  data-testid={`vote-for-${card.id}`}
                  disabled={!canVote}
                  aria-disabled={busy || undefined}
                  onClick={() =>
                    void onAction({
                      type: 'vote',
                      roundId: round.id,
                      cardId: chosen ? null : card.id,
                    })
                  }
                >
                  <span className="vote-corner" aria-hidden="true">
                    ✦
                  </span>
                  <strong>{card.label}</strong>
                  <span className="vote-corner" aria-hidden="true">
                    ✦
                  </span>
                </button>
              );
            })}
          </div>
          <div className="round-actions voting-actions">
            <p className="voting-hint">
              <Icon name="lock" size={17} />{' '}
              {room.me.spectator
                ? 'Vous observez cette manche.'
                : 'Votre vote reste privé jusqu’à la révélation.'}
            </p>
            {isHost && (
              <button
                type="button"
                className="button button-primary"
                disabled={busy || !hasSubject || !anyVote}
                onClick={() => void onAction({ type: 'reveal', roundId: round.id })}
              >
                <Icon name="eye" size={19} /> Révéler les votes
              </button>
            )}
          </div>
        </section>
      ) : (
        <RoundResult room={room} busy={busy} onAction={onAction} resultForm={resultForm} />
      )}
    </section>
  );
}

function TicketRail({
  room,
  activeTicket,
  busy,
  openTicket,
  onAction,
}: {
  room: RoomView;
  activeTicket?: Ticket;
  busy: boolean;
  openTicket: () => void;
  onAction: Dispatch;
}) {
  const isHost = room.me.role === 'host';
  const completed = room.tickets.filter((ticket) => ticket.estimate !== null).length;
  return (
    <aside className="room-rail">
      <section className="rail-section ticket-rail" aria-labelledby="queue-title">
        <div className="rail-title">
          <span className="rail-icon">
            <Icon name="ticket" size={19} />
          </span>
          <div>
            <h2 id="queue-title">File de tickets</h2>
            <p>
              {completed} / {room.tickets.length} estimés
            </p>
          </div>
        </div>
        {isHost && (
          <button type="button" className="button button-add rail-add" onClick={openTicket}>
            <Icon name="plus" size={18} /> Ajouter un ticket
          </button>
        )}
        {room.tickets.length ? (
          <ol className="ticket-list">
            {room.tickets.map((ticket) => {
              const current = ticket.id === activeTicket?.id;
              const payload = (
                <>
                  <span className="ticket-row-text">
                    {ticket.reference && <span>{ticket.reference}</span>}
                    <strong>{ticket.title}</strong>
                  </span>
                  {ticket.estimate !== null && (
                    <span className="ticket-estimate">{ticket.estimate}</span>
                  )}
                </>
              );
              return (
                <li key={ticket.id} className={current ? 'current-ticket' : ''}>
                  {isHost && room.mode === 'tickets' && !current ? (
                    <button
                      type="button"
                      className="ticket-row"
                      disabled={busy}
                      onClick={() => void onAction({ type: 'select-ticket', ticketId: ticket.id })}
                    >
                      {payload}
                    </button>
                  ) : (
                    <div className="ticket-row" aria-current={current ? 'step' : undefined}>
                      {payload}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rail-empty">
            {isHost
              ? 'Les tickets ajoutés apparaîtront ici.'
              : 'L’animateur n’a pas encore ajouté de ticket.'}
          </p>
        )}
      </section>
      <section className="rail-section history-rail" aria-labelledby="history-title">
        <div className="rail-title">
          <span className="rail-icon">
            <Icon name="history" size={19} />
          </span>
          <div>
            <h2 id="history-title">Historique</h2>
            <p>
              {room.history.length} {room.history.length === 1 ? 'estimation' : 'estimations'}
            </p>
          </div>
        </div>
        {room.history.length ? (
          <ul className="history-list">
            {[...room.history].reverse().map((entry) => (
              <li key={entry.id}>
                <span className="ticket-estimate">{entry.estimate}</span>
                <div>
                  <strong>{entry.title || 'Estimation libre'}</strong>
                  {entry.note && <p>{entry.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rail-empty">Vos estimations enregistrées apparaîtront ici.</p>
        )}
      </section>
    </aside>
  );
}

export function Room({
  room,
  connected,
  onAction,
}: {
  room: RoomView;
  connected: boolean;
  onAction: Dispatch;
}) {
  const [dialog, setDialog] = useState<'ticket' | 'settings' | 'share' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, EstimateDraft>>({});
  const pendingAction = useRef(false);
  const isHost = room.me.role === 'host';
  const activeTicket =
    room.mode === 'tickets'
      ? room.tickets.find((ticket) => ticket.id === room.round.ticketId)
      : undefined;

  async function run(action: RoomAction) {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setBusy(true);
    setError('');
    try {
      await onAction(action);
      if (action.type === 'save' || action.type === 'reset') {
        setDrafts((current) => {
          if (!(action.roundId in current)) return current;
          const next = { ...current };
          delete next[action.roundId];
          return next;
        });
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      pendingAction.current = false;
      setBusy(false);
    }
  }

  function updateDraft(patch: Partial<EstimateDraft>) {
    const { id } = room.round;
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft), ...patch } }));
  }

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-header-inner">
          <Logo />
          <div className="room-header-actions">
            <span
              className={`connection-status ${connected ? 'connection-ready' : ''}`}
              role="status"
            >
              <i /> {connected ? 'En direct' : 'Connexion…'}
            </span>
            <button
              type="button"
              className="button button-outline share-button"
              onClick={() => setDialog('share')}
            >
              <Icon name="link" size={17} /> Inviter
            </button>
            <button
              type="button"
              className="icon-button button-outline"
              aria-label="Réglages de la salle"
              onClick={() => setDialog('settings')}
            >
              <Icon name="gear" size={20} />
            </button>
          </div>
        </div>
      </header>
      <main className="room-main">
        <div className="room-intro">
          <div>
            <p className="room-kicker">Salle d’estimation</p>
            <h1>{room.title}</h1>
          </div>
          <div className="room-controls">
            <div className="mode-switch" role="group" aria-label="Mode d’estimation">
              <button
                type="button"
                aria-pressed={room.mode === 'tickets'}
                disabled={!isHost}
                aria-disabled={busy || undefined}
                onClick={() => void run({ type: 'mode', mode: 'tickets' })}
              >
                <Icon name="ticket" size={17} /> Tickets
              </button>
              <button
                type="button"
                aria-pressed={room.mode === 'free'}
                disabled={!isHost}
                aria-disabled={busy || undefined}
                onClick={() => void run({ type: 'mode', mode: 'free' })}
              >
                <Icon name="talk" size={17} /> Libre
              </button>
            </div>
            {isHost && (
              <button
                type="button"
                className="button button-add mobile-add"
                onClick={() => setDialog('ticket')}
              >
                <Icon name="plus" size={18} /> Ajouter un ticket
              </button>
            )}
          </div>
        </div>
        <ErrorNotice message={error} />
        <div className="room-columns">
          <VoteBoard
            room={room}
            activeTicket={activeTicket}
            busy={busy}
            onAction={run}
            resultForm={{ draft: drafts[room.round.id] ?? emptyDraft, update: updateDraft }}
          />
          <TicketRail
            room={room}
            activeTicket={activeTicket}
            busy={busy}
            onAction={run}
            openTicket={() => setDialog('ticket')}
          />
        </div>
      </main>
      {dialog === 'ticket' && <TicketDialog onAction={onAction} onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        <SettingsDialog room={room} onAction={onAction} onClose={() => setDialog(null)} />
      )}
      {dialog === 'share' && <ShareDialog roomId={room.id} onClose={() => setDialog(null)} />}
    </div>
  );
}
