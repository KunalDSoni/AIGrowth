import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredObject {
  id: string;
  key: string;
  contentType: string;
  url: string;
  bytes: number;
  createdAt: string;
}

export interface ObjectStore {
  put(input: { key?: string; body: string | Buffer; contentType: string }): Promise<StoredObject>;
  get(id: string): Promise<{ body: Buffer; contentType: string; meta: StoredObject } | null>;
}

export class FileObjectStore implements ObjectStore {
  constructor(private readonly dir = join(process.cwd(), ".data", "reports")) {}

  async put(input: { key?: string; body: string | Buffer; contentType: string }): Promise<StoredObject> {
    await mkdir(this.dir, { recursive: true });
    const id = input.key?.replace(/[^a-zA-Z0-9._-]/g, "_") || randomUUID();
    const ext = input.contentType.includes("pdf") ? "pdf" : input.contentType.includes("html") ? "html" : "bin";
    const filename = id.includes(".") ? id : `${id}.${ext}`;
    const abs = join(this.dir, filename);
    const body = typeof input.body === "string" ? Buffer.from(input.body, "utf8") : input.body;
    await writeFile(abs, body);
    const meta: StoredObject = {
      id: filename.replace(/\.[^.]+$/, ""),
      key: filename,
      contentType: input.contentType,
      url: `/api/reports/${filename.replace(/\.[^.]+$/, "")}`,
      bytes: body.byteLength,
      createdAt: new Date().toISOString(),
    };
    await writeFile(join(this.dir, `${meta.id}.meta.json`), JSON.stringify(meta, null, 2), "utf8");
    return meta;
  }

  async get(id: string) {
    try {
      const meta = JSON.parse(await readFile(join(this.dir, `${id}.meta.json`), "utf8")) as StoredObject;
      const body = await readFile(join(this.dir, meta.key));
      return { body, contentType: meta.contentType, meta };
    } catch {
      return null;
    }
  }
}

/** S3/Supabase placeholder for later wiring. */
export class RemoteObjectStore implements ObjectStore {
  async put(): Promise<StoredObject> {
    throw new Error("RemoteObjectStore is not configured. Set S3/Supabase credentials to enable cloud report storage.");
  }
  async get(): Promise<null> {
    return null;
  }
}

export function getObjectStore(env: Record<string, string | undefined> = process.env): ObjectStore {
  if (env.OPENGROWTH_OBJECT_STORE === "remote") return new RemoteObjectStore();
  return new FileObjectStore();
}
