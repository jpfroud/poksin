import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function checkAccessibility(page: Page, screen: string) {
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) })),
    screen,
  ).toEqual([]);
}

test('un code mal formé reste modifiable et une salle inconnue ramène à l’accueil', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rejoindre une salle', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rejoindre une salle' });
  const input = dialog.getByRole('textbox', { name: 'Lien ou code d’invitation' });
  const open = dialog.getByRole('button', { name: 'Ouvrir la salle' });
  for (const malformed of ['abc123', '/salle/000000000000000000000000/suite']) {
    await input.fill(malformed);
    await open.click();
    await expect(dialog.getByRole('alert')).toContainText(
      'Ce lien ou ce code d’invitation est invalide.',
    );
    await expect(input).toHaveValue(malformed);
  }
  await input.fill('000000000000000000000000');
  await open.click();
  await expect(page.getByRole('heading', { name: 'Salle introuvable' })).toBeVisible();

  const badLink = await page.goto('/salle/abc123');
  expect(badLink?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Salle introuvable' })).toBeVisible();
  await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
  await expect(page.getByRole('button', { name: 'Créer une salle', exact: true })).toBeVisible();
});

test('accessibilité automatisée de l’accueil, du vote, du résultat et de l’invitation', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await checkAccessibility(page, 'Accueil');
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill('Ariane');
  await page.getByRole('button', { name: 'Créer une salle', exact: true }).click();
  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  await expect(page.getByTestId('round-title')).toHaveText('Estimation libre');
  await checkAccessibility(page, 'Vote');
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Inviter', exact: true }).click();
  await expect(dialog).toHaveCSS('opacity', '1');
  await checkAccessibility(page, 'Dialogue d’invitation');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Réglages de la salle', exact: true }).click();
  await expect(dialog).toHaveCSS('opacity', '1');
  await checkAccessibility(page, 'Réglages des cartes');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Voter 3', exact: true }).click();
  await page.getByRole('button', { name: 'Révéler les votes' }).click();
  await expect(page.getByLabel('Estimation retenue')).toBeVisible();
  await checkAccessibility(page, 'Vote révélé');

  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const invitation = await guest.newPage();
    await invitation.goto(page.url());
    await expect(invitation.getByRole('heading', { name: 'Rejoindre la salle' })).toBeVisible();
    await checkAccessibility(invitation, 'Invitation sur mobile');
  } finally {
    await guest.close();
  }
});

test('le brouillon d’estimation libre survit à une parenthèse en mode Tickets', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Votre prénom' }).fill('Diane');
  await page.getByRole('button', { name: 'Créer une salle', exact: true }).click();
  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  await page.getByRole('button', { name: 'Voter 3', exact: true }).click();
  await page.getByRole('button', { name: 'Révéler les votes' }).click();
  const estimate = page.getByLabel('Estimation retenue');
  const note = page.getByRole('textbox', { name: 'Note (facultative)' });
  await estimate.selectOption('3');
  await note.fill('Reprendre ce sujet avec le reste de l’équipe.');
  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await expect(estimate).toHaveCount(0);
  const add = page.getByRole('button', { name: 'Ajouter un ticket', exact: true });
  await add.click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un ticket' });
  await dialog.getByRole('textbox', { name: 'Titre du ticket' }).fill('Documenter le parcours');
  await dialog.getByRole('button', { name: 'Ajouter à la file' }).click();
  await expect(page.getByTestId('round-title')).toHaveText('Documenter le parcours');

  await page.getByRole('button', { name: 'Libre', exact: true }).click();
  await expect(estimate).toHaveValue('3');
  await expect(note).toHaveValue('Reprendre ce sujet avec le reste de l’équipe.');
  await page.getByRole('button', { name: 'Enregistrer l’estimation' }).click();
  await expect(
    page.getByRole('complementary').getByText('Reprendre ce sujet avec le reste de l’équipe.'),
  ).toBeVisible();
});
