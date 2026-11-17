import { readFile } from 'node:fs/promises';

const [image] = process.argv.slice(2);
const pinnedImage =
  /^(?:[a-z0-9][a-z0-9.-]*(?::[0-9]+)?\/)?(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)+poksin@sha256:[a-f0-9]{64}$/;
if (process.argv.length !== 3 || !pinnedImage.test(image ?? '')) {
  console.error('Usage : node scripts/render-openshift.mjs registre/espace/poksin@sha256:<digest>');
  process.exitCode = 2;
} else {
  const template = await readFile(new URL('../k8s/openshift/poksin.yaml', import.meta.url), 'utf8');
  const marker = 'image: poksin-release-image';
  if (template.split(marker).length !== 2)
    throw new Error('Image de release attendue une seule fois.');
  process.stdout.write(template.replace(marker, `image: ${image}`));
}
