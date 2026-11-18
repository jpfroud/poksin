const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const root = resolve(__dirname, '..');
const image = `docker.io/example/poksin@sha256:${'a'.repeat(64)}`;
test('le manifeste de release conserve le digest vérifié et la configuration publique optionnelle', () => {
  const rendered = spawnSync(process.execPath, ['scripts/render-openshift.mjs', image], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(rendered.status, 0, rendered.stderr);
  const base = rendered.stdout;
  assert.equal((base.match(/^\s+image:/gm) ?? []).length, 1);
  assert.ok(base.includes(`image: ${image}`));
  assert.match(
    base,
    /name: POKSIN_PUBLIC_URL\s+valueFrom:\s+configMapKeyRef:\s+name: poksin-config\s+key: POKSIN_PUBLIC_URL\s+optional: true/,
  );
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.ok(workflow.includes('node scripts/render-openshift.mjs "$IMAGE"'));
  assert.ok(workflow.includes('cmp "$archived/poksin-openshift.yaml" "$manifest"'));
  assert.ok(workflow.includes('gh release create "$GITHUB_REF_NAME" "$manifest"'));
});

test('le manifeste de release refuse une image mutable ou une référence invalide', () => {
  for (const unpinned of [
    'docker.io/example/poksin:latest',
    'docker.io/example/poksin@sha256:bad',
  ]) {
    const rejected = spawnSync(process.execPath, ['scripts/render-openshift.mjs', unpinned], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(rejected.status, 2);
    assert.equal(rejected.stdout, '');
  }
});
