import type { SoulseekResult } from "@/types";

let slskClient: any = null;

export async function connectSoulseek(username: string, password: string): Promise<void> {
  const slsk = await import("slsk-client");
  return new Promise((resolve, reject) => {
    slsk.default.connect({ user: username, pass: password }, (err: Error | null, client: any) => {
      if (err) return reject(err);
      slskClient = client;
      resolve();
    });
  });
}

export function isConnected(): boolean {
  return slskClient !== null;
}

export async function disconnectSoulseek(): Promise<void> {
  if (slskClient) { slskClient.destroy(); slskClient = null; }
}

export async function searchSoulseek(query: string): Promise<SoulseekResult[]> {
  if (!slskClient) throw new Error("Soulseek not connected");
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(results), 15000);
    const results: SoulseekResult[] = [];
    slskClient.search({ req: query, timeout: 15000 }, (err: Error | null, rawResults: any[]) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      for (const r of rawResults || []) {
        for (const file of r.files || []) {
          const ext = file.file?.split(".").pop()?.toLowerCase() ?? "";
          if (!["mp3", "flac", "m4a", "ogg", "opus", "wav"].includes(ext)) continue;
          results.push({
            username: r.user, file: file.file, size: file.size ?? 0,
            bitrate: file.attrs?.bitrate ?? null, format: ext,
            speed: r.speed ?? null, queueLength: r.queueLength ?? null,
          });
        }
      }
      results.sort((a, b) => {
        const formatOrder: Record<string, number> = { flac: 0, wav: 1, m4a: 2, mp3: 3, ogg: 4, opus: 5 };
        const fa = formatOrder[a.format] ?? 99;
        const fb = formatOrder[b.format] ?? 99;
        if (fa !== fb) return fa - fb;
        return (b.bitrate ?? 0) - (a.bitrate ?? 0);
      });
      resolve(results);
    });
  });
}

export async function downloadFromSoulseek(username: string, file: string, destPath: string): Promise<void> {
  if (!slskClient) throw new Error("Soulseek not connected");
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  return new Promise((resolve, reject) => {
    slskClient.download({ file: { user: username, file } }, (err: Error | null, data: Buffer) => {
      if (err) return reject(err);
      fs.writeFileSync(destPath, data);
      resolve();
    });
  });
}
