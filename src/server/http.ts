import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClientError } from './errors.js';
import {
  addParticipant,
  applyAction,
  createRoom,
  getParticipant,
  roomView,
  updatePresence,
  type Room,
} from './room.js';
import { RoomStore } from './store.js';
import { parseAction, parseCreate, parseJoin } from './validation.js';

interface ServerOptions {
  databasePath: string;
  clientDirectory?: string;
  secureCookies?: boolean;
  now?: () => number;
}

interface Stream {
  participantId: string;
  pending: string | undefined;
}

const BODY_LIMIT = 16 * 1024;
const SEAT_COOKIE_SECONDS = 365 * 24 * 60 * 60;
const ID = '[a-f0-9]{24}';
const apiRoom = new RegExp(`^/api/rooms/(${ID})(?:/(join|events|actions))?$`);
const roomPage = new RegExp(`^/salle/${ID}/?$`);
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function setHeaders(response: ServerResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function checkOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;
  if (!origin) return;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ClientError(403, 'Origine de la requête interdite.');
  }
  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    parsed.host !== request.headers.host?.toLowerCase()
  ) {
    throw new ClientError(403, 'Origine de la requête interdite.');
  }
}

async function body(request: IncomingMessage): Promise<unknown> {
  checkOrigin(request);
  const type = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json')
    throw new ClientError(415, 'Envoyez votre requête au format JSON.');
  if (Number(request.headers['content-length']) > BODY_LIMIT) {
    throw new ClientError(413, 'Cette requête est trop volumineuse.');
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > BODY_LIMIT) throw new ClientError(413, 'Cette requête est trop volumineuse.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new ClientError(400, 'Le contenu JSON est invalide.');
  }
}

function roomCookie(id: string) {
  return `poksin_${id}`;
}

function getToken(request: IncomingMessage, roomId: string) {
  const prefix = `${roomCookie(roomId)}=`;
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function setToken(response: ServerResponse, roomId: string, token: string, secure: boolean) {
  const attributes = `Path=/api/rooms/${roomId}; HttpOnly; SameSite=Lax; Max-Age=${SEAT_COOKIE_SECONDS}`;
  response.setHeader(
    'Set-Cookie',
    `${roomCookie(roomId)}=${token}; ${attributes}${secure ? '; Secure' : ''}`,
  );
}

function requireSeat(room: Room, token: string | undefined) {
  const participant = getParticipant(room, token);
  if (!participant) throw new ClientError(401, 'Rejoignez cette salle pour y participer.');
  return participant;
}

async function staticPage(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  directory: string,
) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new ClientError(405, 'Cette méthode n’est pas disponible.');
  }
  if (pathname === '/robots.txt') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('User-agent: *\nDisallow: /salle/\nDisallow: /api/\n');
  }
  const index = pathname === '/' || roomPage.test(pathname);
  const asset = /^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname);
  const icon = /^\/(?:favicon|poksin[-_a-zA-Z0-9]*)(?:\.svg|\.ico|\.png)$/.test(pathname);
  const file = index ? 'index.html' : pathname.slice(1);
  const contentType = contentTypes[extname(file)];
  if ((!index && !asset && !icon) || !contentType)
    throw new ClientError(404, 'Cette page est introuvable.');
  try {
    const contents = await readFile(join(directory, file));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': contents.length,
      ...(asset ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (index) throw new ClientError(503, 'La version de l’interface n’est pas encore construite.');
    throw new ClientError(404, 'Ce fichier est introuvable.');
  }
}

export function createPoksinServer({
  databasePath,
  clientDirectory = fileURLToPath(new URL('../client/', import.meta.url)),
  secureCookies = false,
  now = Date.now,
}: ServerOptions) {
  const store = new RoomStore(databasePath);
  const streams = new Map<string, Map<ServerResponse, Stream>>();
  let stopping = false;

  function online(roomId: string) {
    return new Set(
      Array.from(streams.get(roomId)?.values() ?? [], (stream) => stream.participantId),
    );
  }

  function broadcast(room: Room) {
    const viewers = streams.get(room.id);
    if (!viewers) return;
    const present = online(room.id);
    for (const [response, stream] of viewers) {
      if (response.writableEnded) continue;
      const viewer = room.participants.find(
        (participant) => participant.id === stream.participantId,
      );
      if (!viewer) {
        response.end();
        continue;
      }
      const event = `event: room\ndata: ${JSON.stringify(roomView(room, viewer, present))}\n\n`;
      // Keep only the latest unsent snapshot when a client takes longer to read.
      if (response.writableNeedDrain) stream.pending = event;
      else response.write(event);
    }
  }

  function connect(room: Room, participantId: string, response: ServerResponse) {
    const viewers = streams.get(room.id) ?? new Map<ServerResponse, Stream>();
    const stream: Stream = { participantId, pending: undefined };
    viewers.set(response, stream);
    streams.set(room.id, viewers);
    response.on('drain', () => {
      if (stream.pending && !response.writableEnded) {
        response.write(stream.pending);
        stream.pending = undefined;
      }
    });
    response.on('close', () => {
      viewers.delete(response);
      if (!viewers.size) streams.delete(room.id);
      if (stopping || !viewers.size) return;
      try {
        const instant = now();
        const latest = store.read(room.id, instant);
        const present = online(room.id);
        const next = updatePresence(latest, present)
          ? store.modify(room.id, instant, (current) => updatePresence(current, present)).room
          : latest;
        broadcast(next);
      } catch (error) {
        if (!(error instanceof ClientError))
          console.error('Échec du suivi de présence Poksin', error);
      }
    });
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    });
    broadcast(room);
  }

  const heartbeat = setInterval(() => {
    for (const viewers of streams.values()) {
      for (const response of viewers.keys()) {
        if (!response.writableNeedDrain && !response.writableEnded)
          response.write(': présence\n\n');
      }
    }
  }, 20_000).unref();

  function prune() {
    try {
      for (const id of store.prune(now())) {
        const viewers = streams.get(id);
        streams.delete(id);
        for (const response of viewers?.keys() ?? []) response.end();
      }
    } catch (error) {
      console.error('Échec de la purge des salles Poksin', error);
    }
  }
  prune();
  const cleanup = setInterval(prune, 30 * 60 * 1000).unref();

  async function dispatch(request: IncomingMessage, response: ServerResponse) {
    setHeaders(response);
    const url = request.url ?? '/';
    if (!url.startsWith('/') || url.startsWith('//'))
      throw new ClientError(400, 'Adresse de requête invalide.');
    const { pathname } = new URL(url, 'http://localhost');
    const method = request.method;
    if (pathname === '/healthz' && (method === 'GET' || method === 'HEAD'))
      return json(response, 200, { ok: true });
    if (pathname === '/api/rooms' && method === 'POST') {
      const { name, title } = parseCreate(await body(request));
      const { room, seat } = createRoom(name, title);
      store.create(room, now());
      setToken(response, room.id, seat.token, secureCookies);
      return json(response, 201, roomView(room, seat.participant, online(room.id)));
    }
    const match = apiRoom.exec(pathname);
    if (match) {
      const roomId = match[1]!;
      const path = match[2];
      const token = getToken(request, roomId);
      if (method === 'POST' && path === 'join') {
        const details = parseJoin(await body(request));
        const { room, result: seat } = store.modify(roomId, now(), (current) => {
          const known = getParticipant(current, token);
          return known && token ? { participant: known, token } : addParticipant(current, details);
        });
        setToken(response, roomId, seat.token, secureCookies);
        broadcast(room);
        return json(response, 200, roomView(room, seat.participant, online(roomId)));
      }
      if (method === 'POST' && path === 'actions') {
        const action = parseAction(await body(request));
        const instant = now();
        const present = online(roomId);
        const { room, result: participant } = store.modify(roomId, instant, (current) => {
          const actor = requireSeat(current, token);
          present.add(actor.id);
          applyAction(current, actor, action, present, instant);
          return actor;
        });
        setToken(response, roomId, token!, secureCookies);
        broadcast(room);
        return json(response, 200, roomView(room, participant, online(roomId)));
      }
      if (method === 'GET' && (path === undefined || path === 'events')) {
        checkOrigin(request);
        const instant = now();
        const room = store.read(roomId, instant);
        const participant = requireSeat(room, token);
        store.touch(roomId, instant);
        setToken(response, roomId, token!, secureCookies);
        if (path === 'events') return connect(room, participant.id, response);
        return json(response, 200, roomView(room, participant, online(roomId)));
      }
      throw new ClientError(405, 'Cette méthode n’est pas disponible.');
    }
    if (pathname.startsWith('/api/')) throw new ClientError(404, 'Cette adresse est introuvable.');
    return staticPage(request, response, pathname, clientDirectory);
  }

  const server = createServer(
    { requestTimeout: 15_000, headersTimeout: 10_000 },
    (request, response) => {
      void dispatch(request, response).catch((error: unknown) => {
        request.resume();
        if (response.headersSent) return response.end();
        if (error instanceof ClientError)
          return json(response, error.status, { error: error.message });
        console.error('Erreur serveur Poksin', error);
        return json(response, 500, { error: 'Une erreur a interrompu la requête.' });
      });
    },
  );

  let closing: Promise<void> | undefined;
  function close() {
    closing ??= new Promise<void>((resolve, reject) => {
      stopping = true;
      clearInterval(heartbeat);
      clearInterval(cleanup);
      for (const viewers of streams.values()) {
        for (const response of viewers.keys()) response.end();
      }
      streams.clear();
      server.close((error) => {
        try {
          store.close();
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
            reject(error);
          else resolve();
        } catch (failure) {
          reject(failure);
        }
      });
    });
    return closing;
  }

  return { server, close };
}
