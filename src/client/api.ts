import type { RoomAction, RoomView } from './model';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const roomApi = (id: string, suffix = '') => `/api/rooms/${encodeURIComponent(id)}${suffix}`;

async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<RoomView> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...(signal ? { signal } : {}),
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('La connexion a été interrompue. Réessayez dans un instant.', { cause: error });
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Cette action est indisponible pour le moment.';
    throw new ApiError(response.status, message);
  }
  if (!data || typeof data !== 'object' || !('id' in data)) {
    throw new Error('La salle est indisponible pour le moment.');
  }
  return data as RoomView;
}

export const loadRoom = (id: string, signal?: AbortSignal) =>
  request(roomApi(id), undefined, signal);
export const createRoom = (name: string, title: string) =>
  request('/api/rooms', { name, ...(title ? { title } : {}) });
export const joinRoom = (id: string, name: string, spectator: boolean) =>
  request(roomApi(id, '/join'), { name, spectator });
export const sendAction = (id: string, action: RoomAction) =>
  request(roomApi(id, '/actions'), action);

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Une erreur est survenue. Réessayez dans un instant.';
}
