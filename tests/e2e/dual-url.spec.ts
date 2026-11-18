import { expect, test } from '@playwright/test';

const publicBase = 'http://127.0.0.1:4184/poksin';

test('une salle synchronise les deux adresses et reprend son flux après rechargement', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill('Nora');
  await page.getByRole('button', { name: 'Créer une salle', exact: true }).click();
  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  const roomId = page.url().split('/').at(-1)!;
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    const failures: string[] = [];
    guest.on('pageerror', (error) => failures.push(error.message));
    guest.on('response', (response) => {
      if (response.status() >= 400) failures.push(response.url());
    });
    // The initial unauthenticated API read legitimately asks this browser to join.
    await guest.goto(`${publicBase}/salle/${roomId}`);
    await guest.getByRole('textbox', { name: 'Votre prénom' }).fill('Éli');
    await guest.getByRole('button', { name: 'Rejoindre la salle', exact: true }).click();
    await expect(guest.getByText('En direct', { exact: true })).toBeVisible();
    failures.splice(0);
    await guest.getByRole('button', { name: 'Voter 5', exact: true }).click();
    await expect(page.getByText('A voté', { exact: true })).toBeVisible();
    await guest.reload();
    await expect(guest.getByText('En direct', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Voter 5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const cookies = await guestContext.cookies();
    expect(cookies.find((cookie) => cookie.name === `poksin_${roomId}`)?.path).toBe(
      `/poksin/api/rooms/${roomId}`,
    );
    await guest.getByRole('button', { name: 'Inviter', exact: true }).click();
    await expect(guest.getByRole('textbox', { name: 'Lien d’invitation' })).toHaveValue(
      `${publicBase}/salle/${roomId}`,
    );
    await guest.getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.getByRole('button', { name: 'Révéler les votes', exact: true }).click();
    await expect(guest.getByText('Votes révélés', { exact: true })).toBeVisible();
    expect(failures).toEqual([]);
  } finally {
    await guestContext.close();
  }
});

test('l’accueil préfixé crée une salle, partage les invitations et conserve ses ressources', async ({
  page,
}) => {
  const failedAssets: string[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      /\.(?:js|css|woff2|png)$/.test(url.pathname) &&
      (!url.pathname.startsWith('/poksin/') || response.status() !== 200)
    )
      failedAssets.push(response.url());
  });
  await page.goto(publicBase);
  await expect(page.getByRole('link', { name: 'Poksin, accueil' })).toHaveAttribute(
    'href',
    '/poksin/',
  );
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill('Ana');
  await page.getByRole('button', { name: 'Créer une salle', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${publicBase}/salle/[a-f0-9]{24}$`));
  const roomUrl = page.url();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Réglages de la salle' })).toBeVisible();
  await page.getByRole('link', { name: 'Poksin, accueil' }).click();
  await page.getByRole('button', { name: 'Rejoindre une salle', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Lien ou code d’invitation' })
    .fill(roomUrl.replace(publicBase, 'http://127.0.0.1:4183'));
  await page.getByRole('button', { name: 'Ouvrir la salle', exact: true }).click();
  await expect(page).toHaveURL(roomUrl);
  expect(failedAssets).toEqual([]);
  await page.goto(`${publicBase}/salle/invalid`);
  await expect(page.getByRole('heading', { name: 'Salle introuvable' })).toBeVisible();
  await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
  await expect(page).toHaveURL(`${publicBase}/`);
});
