import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPoksinServer } from '../../src/server/http.js';
import type { roomView } from '../../src/server/room.js';
import { INACTIVITY_MILLISECONDS } from '../../src/server/store.js';

type View = ReturnType<typeof roomView>;
type Options = Parameters<typeof createPoksinServer>[0];
const apps: Array<ReturnType<typeof createPoksinServer>> = [];
const directories: string[] = [];

async function fixtureDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'poksin-server-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  for (const app of apps.splice(0).reverse()) await app.close();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function start(options: Partial<Options> = {}) {
  const app = createPoksinServer({ databasePath: ':memory:', ...options });
  apps.push(app);
  const listening = once(app.server, 'listening');
  app.server.listen(0, '127.0.0.1');
  await listening;
  const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: url,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  const read = (path: string, cookie?: string) =>
    fetch(`${url}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { app, url, post, read };
}

async function view(response: Response, status = 200): Promise<View> {
  expect(response.status).toBe(status);
  return response.json() as Promise<View>;
}

function cookie(response: Response) {
  const value = response.headers.get('set-cookie')?.split(';')[0];
  if (!value) throw new Error('Réponse sans cookie de salle.');
  return value;
}

async function stream(url: string, seat: string) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const response = await fetch(url, { headers: { Cookie: seat }, signal: controller.signal });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  if (!response.body) throw new Error('Réponse SSE sans flux.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  async function next(): Promise<View> {
    for (;;) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Le flux SSE s’est fermé prématurément.');
        buffer += decoder.decode(chunk.value, { stream: true });
        continue;
      }
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (event.startsWith('event: room\ndata: ')) return JSON.parse(event.slice(18)) as View;
    }
  }
  return { next, abort };
}

describe('Serveur Poksin', () => {
  it('diffuse la présence et masque les votes des autres jusqu’à la révélation', async () => {
    const { url, post, read } = await start();
    const made = await post('/api/rooms', { name: 'Nora' });
    const host = cookie(made);
    const room = await view(made, 201);
    const path = `/api/rooms/${room.id}`;
    expect((await read(path)).status).toBe(401);
    const joined = await post(`${path}/join`, { name: 'Éli', role: 'host' });
    const guest = cookie(joined);
    expect((await view(joined)).me.role).toBe('participant');
    const hostStream = await stream(`${url}${path}/events`, host);
    const guestStream = await stream(`${url}${path}/events`, guest);
    try {
      const solo = await hostStream.next();
      expect(solo.participants.map((person) => person.online)).toEqual([true, false]);
      expect((await hostStream.next()).participants.map((person) => person.online)).toEqual([
        true,
        true,
      ]);
      expect((await guestStream.next()).me.name).toBe('Éli');
      const ticket = await view(
        await post(
          `${path}/actions`,
          { type: 'add-ticket', title: 'Tester le partage de lien' },
          host,
        ),
      );
      const roundId = ticket.round.id;
      await hostStream.next();
      await guestStream.next();
      const action = { type: 'vote', roundId, cardId: 'card-5' };
      expect((await view(await post(`${path}/actions`, action, guest))).round.myVote).toBe(
        'card-5',
      );
      const masked = await hostStream.next();
      expect(masked.participants[1]).toMatchObject({ name: 'Éli', voted: true });
      expect(masked.participants[1]).not.toHaveProperty('vote');
      expect(masked.round.myVote).toBeNull();
      expect((await guestStream.next()).round.myVote).toBe('card-5');
      expect((await post(`${path}/actions`, { type: 'reveal', roundId }, guest)).status).toBe(403);

      await view(await post(`${path}/actions`, { type: 'reveal', roundId }, host));
      const revealed = await hostStream.next();
      expect(revealed.round.phase).toBe('revealed');
      expect(revealed.participants[1]?.vote).toBe('8');
      expect(revealed.participants[1]).not.toHaveProperty('tokenHash');
      expect((await view(await read(path, guest))).participants[1]?.vote).toBe('8');
      guestStream.abort();
      expect((await hostStream.next()).participants[1]?.online).toBe(false);
    } finally {
      guestStream.abort();
      hostStream.abort();
    }
  });

  it('conserve un cookie de place et la manche active après redémarrage', async () => {
    const databasePath = join(await fixtureDirectory(), 'poksin.sqlite');
    const first = await start({ databasePath });
    const made = await first.post('/api/rooms', { title: 'Architecture', name: 'Léa' });
    const host = cookie(made);
    const room = await view(made, 201);
    const path = `/api/rooms/${room.id}`;
    const free = await view(
      await first.post(`${path}/actions`, { type: 'mode', mode: 'free' }, host),
    );
    await view(
      await first.post(
        `${path}/actions`,
        { type: 'vote', roundId: free.round.id, cardId: 'card-2' },
        host,
      ),
    );
    await first.app.close();

    const second = await start({ databasePath });
    const restored = await view(await second.read(path, host));
    expect(restored.me).toEqual(room.me);
    expect(restored.title).toBe('Architecture');
    expect(restored.mode).toBe('free');
    expect(restored.round).toMatchObject({ id: free.round.id, myVote: 'card-2', phase: 'voting' });
    const rejoined = await view(await second.post(`${path}/join`, { name: 'Autre nom' }, host));
    expect(rejoined.me).toEqual(room.me);
    expect(rejoined.participants).toHaveLength(1);
  });

  it('conserve le flux de présence quand les descriptions agrandissent les données', async () => {
    const { url, post } = await start();
    const made = await post('/api/rooms', { name: 'Marin' });
    const host = cookie(made);
    const path = `/api/rooms/${(await view(made, 201)).id}`;

    for (let index = 1; index <= 10; index++) {
      await view(
        await post(
          `${path}/actions`,
          {
            type: 'add-ticket',
            title: `Sujet ${index}`,
            description: 'Une description détaillée. '.repeat(73),
          },
          host,
        ),
      );
    }

    const hostStream = await stream(`${url}${path}/events`, host);
    try {
      const initial = await hostStream.next();
      expect(JSON.stringify(initial).length).toBeGreaterThan(16_384);
      expect(initial.tickets).toHaveLength(10);
      await view(
        await post(`${path}/actions`, { type: 'add-ticket', title: 'Sujet supplémentaire' }, host),
      );
      expect((await hostStream.next()).tickets).toHaveLength(11);
    } finally {
      hostStream.abort();
    }
  });

  it('refuse une origine tierce et sert le navigateur avec des en-têtes sûrs', async () => {
    const clientDirectory = await fixtureDirectory();
    await writeFile(join(clientDirectory, 'index.html'), '<h1>Poksin</h1>');
    const { url, post, read } = await start({ clientDirectory, secureCookies: true });
    const made = await post('/api/rooms', { name: 'Léa' });
    const seat = made.headers.get('set-cookie');
    const room = await view(made, 201);
    expect(seat).toContain(`Path=/api/rooms/${room.id}`);
    expect(seat).toContain('HttpOnly; SameSite=Lax; Max-Age=31536000; Secure');
    const forged = await fetch(`${url}/api/rooms/${room.id}/actions`, {
      method: 'POST',
      headers: {
        Origin: 'https://ailleurs.example',
        Cookie: cookie(made),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'mode', mode: 'free' }),
    });
    expect(forged.status).toBe(403);
    const html = await read(`/salle/${room.id}`);
    expect(html.status).toBe(200);
    expect(html.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(html.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await html.text()).toBe('<h1>Poksin</h1>');
    expect((await post('/api/rooms', { name: ' ' })).status).toBe(400);
    expect((await post('/api/rooms', { name: 'x'.repeat(17000) })).status).toBe(413);
    expect((await read('/assets/introuvable.css')).status).toBe(404);
  });

  it('fait expirer une salle inactive et ignore les accès anonymes', async () => {
    let current = 1;
    const { post, read } = await start({ now: () => current });
    const made = await post('/api/rooms', { name: 'Marin' });
    const seat = cookie(made);
    const path = `/api/rooms/${(await view(made, 201)).id}`;
    current = INACTIVITY_MILLISECONDS;
    expect((await read(path)).status).toBe(401);
    current += 1;
    expect((await read(path, seat)).status).toBe(404);
  });
});
