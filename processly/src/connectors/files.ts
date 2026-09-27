import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '../db.js';

export interface FileRef { id: string; name: string; mime: string; size: number; folder: string | null }

/** Files live on local disk under FILES_DIR; metadata in the `files` table. */
export class FileStore {
  constructor(private db: Db, private dir: string) {}

  async save(data: Buffer, name: string, mime: string, opts: { folder?: string; meta?: object; runId?: string } = {}): Promise<FileRef> {
    const id = crypto.randomUUID();
    const safe = name.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'file';
    const rel = path.join(new Date().toISOString().slice(0, 7), `${id}-${safe}`);
    await fs.mkdir(path.join(this.dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(this.dir, rel), data);
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    await this.db.query(
      `INSERT INTO files (id, name, mime, size, sha256, path, folder, meta, run_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, mime, data.length, sha256, rel, opts.folder ?? null, JSON.stringify(opts.meta ?? {}), opts.runId ?? null]);
    return { id, name, mime, size: data.length, folder: opts.folder ?? null };
  }

  async get(id: string) {
    const { rows } = await this.db.query(`SELECT * FROM files WHERE id = $1`, [id]);
    if (!rows.length) throw new Error(`file ${id} not found`);
    const row = rows[0];
    return { ref: { id: row.id, name: row.name, mime: row.mime, size: Number(row.size), folder: row.folder } as FileRef, data: await fs.readFile(path.join(this.dir, row.path)), sha256: row.sha256 as string };
  }

  /** Files a document under a folder with a consistent name (metadata only; bytes stay put). */
  async file(id: string, folder: string, name?: string): Promise<FileRef> {
    const { rows } = await this.db.query(
      `UPDATE files SET folder = $2, name = coalesce($3, name) WHERE id = $1 RETURNING *`, [id, folder, name ?? null]);
    if (!rows.length) throw new Error(`file ${id} not found`);
    const r = rows[0];
    return { id: r.id, name: r.name, mime: r.mime, size: Number(r.size), folder: r.folder };
  }

  async isDuplicate(id: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT EXISTS (SELECT 1 FROM files f2, files f WHERE f.id = $1 AND f2.sha256 = f.sha256 AND f2.id <> f.id) AS dup`, [id]);
    return rows[0].dup;
  }
}
