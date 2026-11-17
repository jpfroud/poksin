import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ClientError } from './errors.js';
import type { Room } from './room.js';

export const INACTIVITY_MILLISECONDS = 90 * 24 * 60 * 60 * 1000;

export class RoomStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version;
    if (version === 0) {
      this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          active_at INTEGER NOT NULL,
          state TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS rooms_active_at ON rooms(active_at);
        PRAGMA user_version = 1;
        COMMIT;
      `);
    } else if (version !== 1) {
      this.db.close();
      throw new Error('Version de la base de données Poksin incompatible.');
    }
  }

  create(room: Room, now: number) {
    this.db
      .prepare('INSERT INTO rooms (id, active_at, state) VALUES (?, ?, ?)')
      .run(room.id, now, JSON.stringify(room));
  }

  read(id: string, now: number): Room {
    const row = this.db
      .prepare('SELECT state FROM rooms WHERE id = ? AND active_at > ?')
      .get(id, now - INACTIVITY_MILLISECONDS);
    if (typeof row?.state !== 'string')
      throw new ClientError(404, 'Cette salle est introuvable ou a expiré.');
    return JSON.parse(row.state) as Room;
  }

  touch(id: string, now: number) {
    this.db.prepare('UPDATE rooms SET active_at = MAX(active_at, ?) WHERE id = ?').run(now, id);
  }

  modify<T>(id: string, now: number, mutate: (room: Room) => T) {
    // Read and write the snapshot under one transaction so even another opener of the DB
    // cannot replace a more recent vote or ticket with an older copy of the room.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const room = this.read(id, now);
      const result = mutate(room);
      this.db
        .prepare('UPDATE rooms SET state = ?, active_at = MAX(active_at, ?) WHERE id = ?')
        .run(JSON.stringify(room), now, id);
      this.db.exec('COMMIT');
      return { room, result };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  prune(now: number) {
    return this.db
      .prepare('DELETE FROM rooms WHERE active_at <= ? RETURNING id')
      .all(now - INACTIVITY_MILLISECONDS)
      .map((row) => String(row.id));
  }

  close() {
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.db.close();
  }
}
