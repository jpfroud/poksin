const configuration = document.querySelector<HTMLMetaElement>('meta[name="poksin-base"]');

export const appBase = (configuration?.content ?? '/').replace(/\/$/, '');
export const publicBase = configuration?.dataset.publicBase ?? '';
export const appPath = (path: string) => `${appBase}${path}`;
