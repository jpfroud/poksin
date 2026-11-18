import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/bricolage-grotesque';
import './style.css';
import { ApiError, errorMessage, loadRoom, roomApi, sendAction } from './api';
import { Home, Join } from './Entrance';
import { Icon } from './icons';
import { readRoomId, roomPath, type RoomAction, type RoomView } from './model';
import { Room } from './Room';
import { Logo } from './ui';
import { appBase, appPath } from './paths';

type Screen = 'home' | 'loading' | 'join' | 'room' | 'missing' | 'error';

function App() {
  const [id, setId] = useState(() => readRoomId(window.location.pathname));
  const [screen, setScreen] = useState<Screen>(() =>
    id
      ? 'loading'
      : [appBase, appPath('/')].includes(window.location.pathname)
        ? 'home'
        : 'missing',
  );
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [failure, setFailure] = useState('');
  const live = useRef(false);

  function enter(view: RoomView) {
    setId(view.id);
    setRoom(view);
    setScreen('room');
    window.history.replaceState(null, '', roomPath(view.id));
  }

  useEffect(() => {
    if (!id || screen !== 'loading') return;
    const request = new AbortController();
    void loadRoom(id, request.signal)
      .then((view) => {
        if (request.signal.aborted) return;
        setRoom(view);
        setScreen('room');
      })
      .catch((caught: unknown) => {
        if (request.signal.aborted) return;
        if (caught instanceof ApiError && caught.status === 401) setScreen('join');
        else if (caught instanceof ApiError && caught.status === 404) setScreen('missing');
        else {
          setFailure(errorMessage(caught));
          setScreen('error');
        }
      });
    return () => request.abort();
  }, [screen, id]);

  useEffect(() => {
    if (!id || screen !== 'room') return;
    const exchange = new AbortController();
    const stream = new EventSource(roomApi(id, '/events'));
    stream.addEventListener('room', (event: MessageEvent<string>) => {
      if (exchange.signal.aborted) return;
      try {
        const view = JSON.parse(event.data) as RoomView;
        if (view.id === id) {
          live.current = true;
          setConnected(true);
          setRoom(view);
        }
      } catch {
        // The next complete snapshot can replace a malformed event.
      }
    });
    stream.onerror = () => {
      live.current = false;
      setConnected(false);
      void loadRoom(id, exchange.signal)
        .then((view) => {
          if (!exchange.signal.aborted && !live.current) setRoom(view);
        })
        .catch((caught: unknown) => {
          if (exchange.signal.aborted || !(caught instanceof ApiError)) return;
          if (caught.status === 401) setScreen('join');
          if (caught.status === 404) setScreen('missing');
        });
    };
    return () => {
      exchange.abort();
      live.current = false;
      stream.close();
    };
  }, [screen, id]);

  async function dispatch(action: RoomAction) {
    if (!id) return;
    const view = await sendAction(id, action);
    if (!live.current) setRoom(view);
  }

  if (screen === 'home') return <Home onEnter={enter} />;
  if (screen === 'join' && id) return <Join id={id} onEnter={enter} />;
  if (screen === 'room' && room)
    return <Room room={room} connected={connected} onAction={dispatch} />;

  return (
    <div className="entry-page">
      <header className="entry-header">
        <Logo />
      </header>
      <main className="entry-message">
        {screen === 'loading' && <p role="status">Ouverture de la salle…</p>}
        {screen === 'missing' && (
          <>
            <h1>Salle introuvable</h1>
            <p>Vérifiez le lien d’invitation. Une salle expire après 90 jours sans activité.</p>
          </>
        )}
        {screen === 'error' && (
          <>
            <h1>Connexion interrompue</h1>
            <p>{failure}</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setScreen('loading')}
            >
              <Icon name="refresh" size={17} /> Réessayer
            </button>
          </>
        )}
        {screen === 'missing' && (
          <a className="button button-outline" href={appPath('/')}>
            <Icon name="back" size={17} /> Revenir à l’accueil
          </a>
        )}
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
