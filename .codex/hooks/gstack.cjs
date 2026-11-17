const { readFileSync } = require('node:fs');
const { missingGstack } = require('../../scripts/gstack-status.cjs');

const { hook_event_name: event } = JSON.parse(readFileSync(0, 'utf8'));
const routing = [
  'Poksin exige le routage GStack à chaque demande, y compris en français.',
  'Utilise réellement le skill gstack pour router la demande, puis invoque et annonce le skill pertinent indiqué dans AGENTS.md.',
  'Une demande simple peut recevoir une réponse directe si aucun skill ne correspond.',
].join(' ');

if (event === 'UserPromptSubmit') {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: routing },
  }));
} else if (event === 'SessionStart') {
  const problem = missingGstack();
  const preparation = problem ? `${problem} Prépare GStack avec la commande de docs/gstack.md avant de développer.` : '';
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: `${routing} ${preparation}`.trim() },
    ...(problem ? { systemMessage: preparation } : {}),
  }));
} else {
  console.error(`Événement Codex inattendu : ${event}.`);
  process.exitCode = 1;
}
