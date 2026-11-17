import { useState, type FormEvent } from 'react';
import { createRoom, errorMessage, joinRoom } from './api';
import { Icon } from './icons';
import { readRoomId, roomPath, type RoomView } from './model';
import { Dialog, ErrorNotice, Logo } from './ui';

function IllustratedDeck() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-dots" />
      <span className="art-orbit" />
      <span className="art-star art-star-large">✦</span>
      <span className="art-star art-star-small">✦</span>
      <span className="art-sparkle">✧</span>
      <div className="hero-card hero-card-one">
        <span>03</span>
        <strong>3</strong>
        <span>✦</span>
      </div>
      <div className="hero-card hero-card-two">
        <span>08</span>
        <strong>8</strong>
        <span>✦</span>
      </div>
      <div className="hero-card hero-card-three">
        <span>05</span>
        <strong>5</strong>
        <span>✦</span>
      </div>
      <span className="art-ring" />
    </div>
  );
}

export function Home({ onEnter }: { onEnter: (room: RoomView) => void }) {
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    if (!name) {
      setError('Saisissez votre prénom.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      onEnter(await createRoom(name, String(fields.get('title') ?? '').trim()));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entry-page">
      <header className="entry-header">
        <Logo />
        <button type="button" className="button button-outline" onClick={() => setJoining(true)}>
          <Icon name="link" size={17} /> Rejoindre une salle
        </button>
      </header>
      <main className="entry-main">
        <section className="hero-content" aria-labelledby="home-title">
          <p className="eyebrow">
            <span /> Planning poker
          </p>
          <h1 id="home-title">
            Estimez ensemble,
            <br />
            <em>une carte à la fois.</em>
          </h1>
          <p className="hero-description">
            Ouvrez une salle, partagez le lien et estimez vos tickets en équipe. En quelques
            secondes, sans compte.
          </p>
          <form onSubmit={handleCreate} className="create-form">
            <div className="create-fields">
              <label>
                Votre prénom
                <input
                  name="name"
                  autoComplete="given-name"
                  placeholder="Camille"
                  required
                  maxLength={40}
                />
              </label>
              <label>
                Nom de la salle <span className="quiet">(facultatif)</span>
                <input name="title" placeholder="Planning de l’équipe" maxLength={80} />
              </label>
            </div>
            <ErrorNotice message={error} />
            <button type="submit" className="button button-primary hero-create" disabled={busy}>
              <span>{busy ? 'Création de la salle…' : 'Créer une salle'}</span>
              <Icon name="arrow" />
            </button>
          </form>
        </section>
        <IllustratedDeck />
      </main>
      <div className="entry-benefits" aria-label="Fonctionnement">
        <div>
          <span className="benefit-icon benefit-mint">
            <Icon name="link" />
          </span>
          <span>Une invitation par lien</span>
        </div>
        <div>
          <span className="benefit-icon benefit-purple">
            <Icon name="lock" />
          </span>
          <span>Des votes privés jusqu’à la révélation</span>
        </div>
        <div>
          <span className="benefit-icon benefit-gold">
            <Icon name="cards" />
          </span>
          <span>Des cartes à personnaliser</span>
        </div>
      </div>
      {joining && <JoinLink onClose={() => setJoining(false)} />}
    </div>
  );
}

function JoinLink({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState('');

  function openInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = readRoomId(String(new FormData(event.currentTarget).get('invitation') ?? ''));
    if (!id) {
      setError('Ce lien ou ce code d’invitation est invalide.');
      return;
    }
    window.location.assign(roomPath(id));
  }

  return (
    <Dialog title="Rejoindre une salle" onClose={onClose}>
      <form className="dialog-form" onSubmit={openInvitation}>
        <label>
          Lien ou code d’invitation
          <input name="invitation" required placeholder="Collez le lien reçu" />
        </label>
        <ErrorNotice message={error} />
        <button className="button button-primary" type="submit">
          Ouvrir la salle
          <Icon name="arrow" size={17} />
        </button>
      </form>
    </Dialog>
  );
}

export function Join({ id, onEnter }: { id: string; onEnter: (room: RoomView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    if (!name) {
      setError('Saisissez votre prénom.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      onEnter(await joinRoom(id, name, fields.get('spectator') === 'on'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entry-page guest-page">
      <header className="entry-header">
        <Logo />
      </header>
      <main className="guest-main">
        <IllustratedDeck />
        <section className="guest-card">
          <span className="benefit-icon benefit-purple">
            <Icon name="users" />
          </span>
          <h1>Rejoindre la salle</h1>
          <p>Choisissez le prénom qui s’affichera à la table.</p>
          <form className="dialog-form" onSubmit={handleJoin}>
            <label>
              Votre prénom
              <input
                name="name"
                autoComplete="given-name"
                placeholder="Camille"
                required
                maxLength={40}
              />
            </label>
            <label className="checkbox-label">
              <input name="spectator" type="checkbox" /> Observer la séance
            </label>
            <ErrorNotice message={error} />
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Connexion…' : 'Rejoindre la salle'}
              <Icon name="arrow" size={17} />
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
