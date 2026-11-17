const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join, resolve } = require('node:path');
const { test } = require('node:test');

const project = resolve(__dirname, '..');
const codexHook = join(project, '.codex', 'hooks', 'gstack.cjs');
const requiredHookPath = join(project, '.claude', 'hooks', 'check-gstack.cjs');

for (const prompt of ['Conçois la salle de vote.', 'Corrige le bug lors de la révélation.']) {
  test(`Codex injecte le rappel GStack pour « ${prompt} »`, () => {
    const result = spawnSync(process.execPath, [codexHook], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt, cwd: project }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const { hookSpecificOutput } = JSON.parse(result.stdout);
    assert.equal(hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(hookSpecificOutput.additionalContext, /routage GStack à chaque demande/);
    assert.ok(!result.stdout.includes(prompt));
  });
}

test('Codex signale une préparation manquante au démarrage', () => {
  const simulateUnpreparedClone = `
    const fs = require('node:fs');
    const originalRead = fs.readFileSync;
    fs.readFileSync = (candidate, ...options) => {
      if (typeof candidate === 'string' && candidate.endsWith('prepared.json')) {
        throw new Error('Préparation absente dans cet essai');
      }
      return originalRead(candidate, ...options);
    };
    require(process.argv[1]);
  `;
  const result = spawnSync(process.execPath, ['-e', simulateUnpreparedClone, codexHook], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: project }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.match(response.systemMessage, /Préparation GStack incomplète/);
  assert.equal(response.hookSpecificOutput.hookEventName, 'SessionStart');
});

test('le garde-fou GStack produit un refus quand chaque installation manque', () => {
  const simulateMissingRoots = `
    const fs = require('node:fs');
    const originalStat = fs.statSync;
    fs.statSync = (candidate, ...options) => {
      if (require('node:path').basename(candidate) === 'bin') {
        throw new Error('GStack absent dans cet essai');
      }
      return originalStat(candidate, ...options);
    };
    require(process.argv[1]);
  `;
  const result = spawnSync(process.execPath, ['-e', simulateMissingRoots, requiredHookPath], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
});
