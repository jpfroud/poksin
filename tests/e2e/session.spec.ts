import { expect, test, type Page } from '@playwright/test';

async function createRoom(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill(name);
  await page.getByRole('button', { name: 'Créer une salle', exact: true }).click();
  await expect(page).toHaveURL(/\/salle\/[\w-]+$/);
  return { roomUrl: page.url(), apiUrl: `/api/rooms/${page.url().split('/').at(-1)}` };
}

async function addTicket(page: Page, title: string, reference: string) {
  await page.getByRole('button', { name: 'Ajouter un ticket', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Titre du ticket' }).fill(title);
  await dialog
    .getByRole('textbox', { name: 'Référence (facultative)', exact: true })
    .fill(reference);
  await dialog.getByRole('button', { name: 'Ajouter à la file', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function revealAndSave(page: Page, value: string, note?: string) {
  await page.getByRole('button', { name: 'Révéler les votes' }).click();
  await page.getByLabel('Estimation retenue').selectOption({ label: value });
  if (note) await page.getByRole('textbox', { name: 'Note (facultative)' }).fill(note);
  await page.getByRole('button', { name: 'Enregistrer l’estimation' }).click();
}

test('deux participants estiment dans les deux modes et enrichissent la file en cours de vote', async ({
  page,
  browser,
}) => {
  const { roomUrl, apiUrl } = await createRoom(page, 'Maëlle');
  const firstTitle = 'Confirmer une invitation';
  const addedTitle = 'Relancer une invitation expirée';
  await addTicket(page, firstTitle, 'POK-10');

  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(roomUrl);
    await guest.getByRole('textbox', { name: 'Votre prénom' }).fill('Noé');
    await guest.getByRole('button', { name: 'Rejoindre la salle' }).click();
    await expect(guest.getByTestId('round-title')).toHaveText(firstTitle);
    await guest.getByRole('button', { name: 'Voter 5', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Voter 5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const state = await (await page.request.get(apiUrl)).json();
    const participant = state.participants.find(
      (person: { name: string }) => person.name === 'Noé',
    );
    expect(participant.voted).toBe(true);
    expect(participant).not.toHaveProperty('vote');
    expect(state.round.phase).toBe('voting');
    await expect(page.getByText('A voté', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Révéler les votes' })).toHaveCount(0);
    const forbidden = await guest.request.post(`${apiUrl}/actions`, {
      data: { type: 'reveal', roundId: state.round.id },
    });
    expect(forbidden.status()).toBe(403);

    await addTicket(page, addedTitle, 'POK-11');
    await expect(guest.getByTestId('round-title')).toHaveText(firstTitle);
    await expect(guest.getByRole('button', { name: 'Voter 5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Libre', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Voter 3', exact: true }).click();
    const note = 'Effort discuté pendant la revue.';
    await revealAndSave(page, '3', note);

    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await expect(guest.getByTestId('round-title')).toHaveText(firstTitle);
    await guest.reload();
    await expect(guest.getByRole('button', { name: 'Voter 5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await revealAndSave(page, '5');
    const settled = await (await guest.request.get(apiUrl)).json();
    const revealed = settled.participants.find((person: { name: string }) => person.name === 'Noé');
    expect(revealed.vote).toBe('5');
    expect(settled.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'free', ticketId: null, estimate: '3', note }),
        expect.objectContaining({ mode: 'tickets', title: firstTitle, estimate: '5' }),
      ]),
    );
    await page.getByRole('button', { name: 'Manche suivante' }).click();
    await expect(guest.getByTestId('round-title')).toHaveText(addedTitle);
  } finally {
    await guestContext.close();
  }
});

test('la salle est accessible sur mobile et le build sert les en-têtes attendus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { roomUrl } = await createRoom(page, 'Sasha');
  const response = await page.goto(roomUrl);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  const add = page.getByRole('button', { name: 'Ajouter un ticket', exact: true });
  await expect(add).toBeVisible();
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Titre du ticket' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();
  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  const vote = page.getByRole('button', { name: 'Voter 3', exact: true });
  await expect(vote).toBeEnabled();
  await vote.focus();
  await page.keyboard.press('Space');
  await expect(vote).toHaveAttribute('aria-pressed', 'true');
  await expect(vote).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('les cartes personnalisées persistent après rechargement', async ({ page }) => {
  const { apiUrl } = await createRoom(page, 'Célia');
  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  await page.getByRole('button', { name: 'Voter 3', exact: true }).click();
  await revealAndSave(page, '3');
  await page.getByRole('button', { name: 'Réglages de la salle', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages de la salle' });
  await settings.getByRole('textbox', { name: 'Nom du jeu' }).fill('Taille des tâches');
  await settings.getByRole('textbox', { name: 'Valeur de la carte 1', exact: true }).fill('Mini');
  await settings.getByLabel('Couleur de la carte 1', { exact: true }).fill('#f4ae22');
  await settings.getByRole('button', { name: 'Enregistrer le jeu' }).click();
  await expect(settings).toBeHidden();

  const state = await (await page.request.get(apiUrl)).json();
  expect(state.deck.name).toBe('Fibonacci');
  expect(state.configuredDeck.name).toBe('Taille des tâches');
  expect(state.configuredDeck.cards[0]).toMatchObject({ label: 'Mini', color: '#f4ae22' });
  await page.reload();
  await page.getByRole('button', { name: 'Réglages de la salle', exact: true }).click();
  await expect(settings.getByRole('textbox', { name: 'Nom du jeu' })).toHaveValue(
    'Taille des tâches',
  );
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await page.getByRole('button', { name: 'Manche suivante' }).click();
  await expect(page.getByRole('button', { name: 'Voter Mini', exact: true })).toBeEnabled();
});
