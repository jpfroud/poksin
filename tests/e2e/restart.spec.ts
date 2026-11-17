import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const host = '127.0.0.1';

async function findPort() {
  const probe = createServer();
  return new Promise<number>((ready, fail) => {
    probe.once('error', fail);
    probe.listen(0, host, () => {
      const { port } = probe.address() as AddressInfo;
      probe.close((error) => (error ? fail(error) : ready(port)));
    });
  });
}

async function stopServer(server: ChildProcess | undefined) {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return;

  const exited = once(server, 'exit', { signal: AbortSignal.timeout(5_000) });
  server.kill('SIGKILL');
  await exited;
}

async function startServer(port: number, database: string) {
  const server = spawn(process.execPath, [resolve('dist/server/main.js')], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      POKSIN_DB: database,
      POKSIN_SECURE_COOKIES: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let output = '';
  server.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
  server.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
  server.on('error', (error) => (output += error.message));

  try {
    await expect.poll(() => output).toContain(`Poksin écoute sur ${host}:${port}`);
    return server;
  } catch (error) {
    await stopServer(server);
    throw error;
  }
}

test('le navigateur reprend une manche et retrouve les droits après l’arrêt du serveur', async ({
  page,
}, testInfo) => {
  const port = await findPort();
  const database = testInfo.outputPath('restart.sqlite');
  const activeTicket = 'Confirmer le délai';
  const queuedTicket = 'Préparer le compte rendu';
  let server: ChildProcess | undefined;

  try {
    server = await startServer(port, database);
    await page.goto(`http://${host}:${port}`);
    await page.getByRole('textbox', { name: 'Votre prénom' }).fill('Morgan');
    const [initialStream] = await Promise.all([
      page.waitForRequest((request) => new URL(request.url()).pathname.endsWith('/events')),
      page.getByRole('button', { name: 'Créer une salle', exact: true }).click(),
    ]);
    await expect(page).toHaveURL(/\/salle\/[\w-]+$/);

    for (const title of [activeTicket, queuedTicket]) {
      await page.getByRole('button', { name: 'Ajouter un ticket', exact: true }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox', { name: 'Titre du ticket' }).fill(title);
      await dialog.getByRole('button', { name: 'Ajouter à la file', exact: true }).click();
      await expect(dialog).toBeHidden();
    }

    const vote = page.getByRole('button', { name: 'Voter 5', exact: true });
    await vote.click();
    await expect(vote).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('En direct', { exact: true })).toBeVisible();

    await Promise.all([
      page.waitForEvent('requestfailed', {
        predicate: (request) => request.url() === initialStream.url() && request !== initialStream,
        timeout: 8_000,
      }),
      expect(page.getByText('Connexion…', { exact: true })).toBeVisible(),
      stopServer(server),
    ]);
    server = await startServer(port, database);

    await expect(page.getByText('En direct', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('round-title')).toHaveText(activeTicket);
    await expect(vote).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Révéler les votes' }).click();
    await page.getByLabel('Estimation retenue').selectOption({ label: '5' });
    await page.getByRole('button', { name: 'Enregistrer l’estimation' }).click();
    await page.getByRole('button', { name: 'Manche suivante' }).click();
    await expect(page.getByTestId('round-title')).toHaveText(queuedTicket);
  } finally {
    await stopServer(server);
    await Promise.all(
      ['', '-wal', '-shm', '-journal'].map((suffix) => rm(database + suffix, { force: true })),
    );
  }
});
