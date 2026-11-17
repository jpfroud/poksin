const { accessSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const project = resolve(__dirname, '..');
const source = join(project, '.agents', 'skills', 'gstack');
const stamp = join(project, '.cache', 'gstack', 'prepared.json');
const { tag, commit } = require('../tooling/gstack/source.json');
const bunVersion = require('../tooling/gstack/package.json').dependencies.bun;

function missingGstack() {
  try {
    const prepared = JSON.parse(readFileSync(stamp, 'utf8'));
    if (prepared.commit !== commit || prepared.bunVersion !== bunVersion) {
      return `Préparation périmée. Attendu GStack ${tag} avec Bun ${bunVersion}.`;
    }
    verifyInstallation();
    return null;
  } catch (error) {
    return `Préparation GStack incomplète (${error.message}).`;
  }
}

function verifyInstallation() {
  // The bootstrap clones the locked tag in detached HEAD mode.
  const head = readFileSync(join(source, '.git', 'HEAD'), 'utf8').trim();
  if (head !== commit) throw new Error(`GStack doit correspondre à ${tag}`);

  const browse = process.platform === 'win32' ? 'browse.exe' : 'browse';
  const bun = process.platform === 'win32' ? 'bun.exe' : 'bun';
  accessSync(join(source, 'browse', 'dist', browse));
  accessSync(join(project, 'tooling', 'gstack', 'node_modules', 'bun', 'bin', bun));
  accessSync(join(source, 'bin', 'gstack-skill-start'));
  const skills = ['gstack', 'office-hours', 'plan-eng-review', 'design-consultation', 'review', 'qa', 'qa-only', 'ship'];
  for (const skill of skills) {
    const directory = skill === 'gstack' ? skill : `gstack-${skill}`;
    accessSync(join(source, '..', directory, 'SKILL.md'));
  }
}

if (require.main === module) {
  if (process.argv.includes('--record')) {
    verifyInstallation();
    writeFileSync(stamp, `${JSON.stringify({ commit, bunVersion })}\n`);
  } else {
    const problem = missingGstack();
    if (!process.argv.includes('--quiet')) {
      if (problem) console.error(`${problem} Consultez docs/gstack.md.`);
      else console.log(`GStack ${tag} préparé. Skills de projet présents.`);
    }
    process.exitCode = problem ? 1 : 0;
  }
}

module.exports = { missingGstack };
