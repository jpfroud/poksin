import { readFile } from 'node:fs/promises';

const [image] = process.argv.slice(2);
const pinnedImage =
  /^(?:[a-z0-9][a-z0-9.-]*(?::[0-9]+)?\/)?(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)+poksin@sha256:[a-f0-9]{64}$/;
if (process.argv.length !== 3 || !pinnedImage.test(image ?? '')) {
  console.error('Usage : node scripts/render-openshift.mjs registre/espace/poksin@sha256:<digest>');
  process.exitCode = 2;
} else {
  const template = await readFile(new URL('../k8s/openshift/poksin.yaml', import.meta.url), 'utf8');
  const imageField = /^([ \t]+image: )(\S+)(?=\r?$)/gm;
  const fields = [...template.matchAll(imageField)];
  if (fields.length !== 1 || !pinnedImage.test(fields[0][2])) {
    throw new Error('Le manifeste doit contenir une seule image épinglée par digest.');
  }
  process.stdout.write(template.replace(imageField, (_, prefix) => prefix + image));
}
