import { expect, test, type Page } from '@playwright/test';

async function createFreeRoom(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill(name);
  await page.getByRole('button', { name: 'Créer une salle', exact: true }).click();
  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estimation libre' })).toBeVisible();
}

async function joinRoom(page: Page, name: string, spectator = false) {
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill(name);
  if (spectator) await page.getByRole('checkbox', { name: 'Observer la séance' }).check();
  await page.getByRole('button', { name: 'Rejoindre la salle', exact: true }).click();
  await expect(page.getByText('En direct', { exact: true })).toBeVisible();
}

async function openInvitation(page: Page) {
  await page.getByRole('button', { name: 'Inviter', exact: true }).click();
  return page.getByRole('dialog', { name: 'Inviter à la table' });
}

function seat(page: Page, name: string) {
  return page
    .getByRole('region', { name: 'Participants à la table' })
    .getByRole('listitem')
    .filter({ hasText: name });
}

test('une invitation bien formée vers une salle inconnue permet de revenir à l’accueil', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rejoindre une salle', exact: true }).click();
  const join = page.getByRole('dialog', { name: 'Rejoindre une salle' });
  const invitation = new URL(`/salle/${'0'.repeat(24)}`, page.url()).href;
  await join.getByRole('textbox', { name: 'Lien ou code d’invitation' }).fill(invitation);
  await join.getByRole('button', { name: 'Ouvrir la salle' }).click();
  await expect(page).toHaveURL(invitation);
  await expect(page.getByRole('heading', { name: 'Salle introuvable' })).toBeVisible();
  await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
  await expect(page.getByRole('button', { name: 'Créer une salle', exact: true })).toBeVisible();
});

test('l’invitation copiée fonctionne et la révélation attend tous les votants présents', async ({
  page,
  browser,
}) => {
  await createFreeRoom(page, 'Ana');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin,
  });
  const share = await openInvitation(page);
  await expect(share.getByRole('textbox', { name: 'Lien d’invitation' })).toHaveValue(page.url());
  await share.getByRole('button', { name: 'Copier le lien' }).click();
  await expect(share.getByRole('button', { name: 'Lien copié' })).toBeVisible();
  const invitation = await page.evaluate(() => navigator.clipboard.readText());
  expect(invitation).toBe(page.url());
  await share.getByRole('button', { name: 'Fermer' }).click();

  const guestContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(new URL('/', invitation).href);
    await guest.getByRole('button', { name: 'Rejoindre une salle', exact: true }).click();
    const join = guest.getByRole('dialog', { name: 'Rejoindre une salle' });
    const linkField = join.getByRole('textbox', { name: 'Lien ou code d’invitation' });
    await linkField.fill('lien invalide');
    await join.getByRole('button', { name: 'Ouvrir la salle' }).click();
    await expect(join.getByRole('alert')).toHaveText(
      'Ce lien ou ce code d’invitation est invalide.',
    );
    await linkField.fill(invitation);
    await join.getByRole('button', { name: 'Ouvrir la salle' }).click();
    await expect(guest).toHaveURL(invitation);
    await joinRoom(guest, 'Basile');

    const spectator = await spectatorContext.newPage();
    await spectator.goto(invitation);
    await joinRoom(spectator, 'Cléo', true);
    await expect(spectator.getByRole('button', { name: 'Voter 3', exact: true })).toBeDisabled();
    await expect(seat(page, 'Cléo')).toContainText('Observe');
    await expect(page.getByText('0/2 votes', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Réglages de la salle' }).click();
    const settings = page.getByRole('dialog', { name: 'Réglages de la salle' });
    const autoReveal = settings.getByRole('checkbox', {
      name: 'Révéler quand tout le monde a voté',
    });
    await autoReveal.click();
    await expect(autoReveal).toBeChecked();
    await settings.getByRole('button', { name: 'Fermer' }).click();

    await page.getByRole('button', { name: 'Voter 3', exact: true }).click();
    await expect(guest.getByText('1/2 votes', { exact: true })).toBeVisible();
    await expect(seat(guest, 'Ana')).toContainText('A voté');
    await expect(guest.getByText('Vote en cours', { exact: true })).toBeVisible();

    await guest.getByRole('button', { name: 'Voter 5', exact: true }).click();
    for (const participantPage of [page, guest, spectator]) {
      await expect(participantPage.getByText('Votes révélés', { exact: true })).toBeVisible();
      await expect(seat(participantPage, 'Ana')).toContainText('Vote révélé : 3');
      await expect(seat(participantPage, 'Basile')).toContainText('Vote révélé : 5');
      await expect(seat(participantPage, 'Cléo')).toContainText('Observe');
    }
  } finally {
    await Promise.all([guestContext.close(), spectatorContext.close()]);
  }
});

test('l’arrivée après révélation conserve les résultats et les droits propres à chaque siège', async ({
  page,
  browser,
}) => {
  await createFreeRoom(page, 'Damien');
  await page.getByRole('button', { name: 'Voter 8', exact: true }).click();
  await page.getByRole('button', { name: 'Révéler les votes' }).click();

  const share = await openInvitation(page);
  const invitation = await share.getByRole('textbox', { name: 'Lien d’invitation' }).inputValue();
  await share.getByRole('button', { name: 'Fermer' }).click();

  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(invitation);
    await joinRoom(guest, 'Elsa');
    await expect(seat(guest, 'Damien')).toContainText('Vote révélé : 8');
    await expect(guest.getByRole('group', { name: 'Cartes d’estimation' })).toHaveCount(0);
    await expect(guest.getByRole('combobox', { name: 'Estimation retenue' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('En direct', { exact: true })).toBeVisible();
    await expect(seat(page, 'Damien')).toContainText('Damien (vous)');
    await expect(seat(page, 'Damien')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Estimation retenue' }).selectOption('8');
    await page.getByRole('button', { name: 'Enregistrer l’estimation' }).click();
    await expect(guest.getByText('Estimation enregistrée', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Manche suivante' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Manche suivante' })).toBeEnabled();
  } finally {
    await guestContext.close();
  }
});
