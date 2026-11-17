import { resolve } from 'node:path';
import { createPoksinServer } from './http.js';

const database = process.env.POKSIN_DB || 'data/poksin.sqlite';
const port = Number(process.env.PORT ?? '3000');
const host = process.env.HOST || '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error('Variable PORT invalide.');

const app = createPoksinServer({
  databasePath: database === ':memory:' ? database : resolve(database),
  secureCookies: process.env.POKSIN_SECURE_COOKIES === '1',
});

app.server.on('error', (error: Error) => {
  console.error('Impossible de démarrer Poksin', error);
  shutdown(1);
});
app.server.listen(port, host, () => {
  console.log(`Poksin écoute sur ${host}:${port}`);
});

function shutdown(exitCode: number) {
  process.exitCode = exitCode;
  void app.close().catch((error) => {
    console.error('Impossible de terminer proprement Poksin', error);
    process.exitCode = 1;
  });
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
