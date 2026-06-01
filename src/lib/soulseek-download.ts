import fs from "fs";
import path from "path";
import { getClient } from "./soulseek-client";

export interface DownloadProgress {
  downloadId: number;
  bytesReceived: number;
  totalSize: number;
  percent: number;
  speed: number;
  startedAt: number;
}

const activeProgress = new Map<number, DownloadProgress>();
const activeStreams = new Map<number, { destroy: () => void }>();

export function getActiveProgress(): Map<number, DownloadProgress> {
  return activeProgress;
}

export function cancelDownload(downloadId: number): boolean {
  const stream = activeStreams.get(downloadId);
  if (stream) {
    stream.destroy();
    activeStreams.delete(downloadId);
    activeProgress.delete(downloadId);
    return true;
  }
  return false;
}

export async function streamDownload(
  downloadId: number,
  username: string,
  file: string,
  destPath: string,
  expectedSize: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("Soulseek not connected");

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let bytesReceived = 0;
    let lastProgressUpdate = 0;
    let timeoutTimer: ReturnType<typeof setTimeout>;
    let settled = false;
    let writeStream: fs.WriteStream | null = null;
    let readStream: NodeJS.ReadableStream | null = null;

    function cleanup() {
      try { if (readStream) (readStream as any).destroy?.(); } catch {}
      if (writeStream) {
        const ws = writeStream;
        ws.on("close", () => {
          try {
            if (fs.existsSync(destPath)) {
              const stat = fs.statSync(destPath);
              if (stat.size === 0 || bytesReceived === 0) {
                fs.unlinkSync(destPath);
                cleanEmptyParents(path.dirname(destPath));
              }
            }
          } catch {}
        });
        try { ws.destroy(); } catch {}
      }
    }

    function settle(err?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      activeProgress.delete(downloadId);
      activeStreams.delete(downloadId);
      if (err) {
        cleanup();
        reject(err);
      } else {
        resolve();
      }
    }

    const initialTimeout = 60000;
    const dataTimeout = 60000;
    let hasReceivedData = false;

    function resetTimeout() {
      clearTimeout(timeoutTimer);
      const timeout = hasReceivedData ? dataTimeout : initialTimeout;
      timeoutTimer = setTimeout(() => {
        const msg = hasReceivedData
          ? "Download stalled — no data for 60s"
          : "User not responding — try enabling sharing in Settings";
        settle(new Error(msg));
      }, timeout);
    }

    resetTimeout();

    const progress: DownloadProgress = {
      downloadId,
      bytesReceived: 0,
      totalSize: expectedSize,
      percent: 0,
      speed: 0,
      startedAt,
    };
    activeProgress.set(downloadId, progress);

    writeStream = fs.createWriteStream(destPath);

    writeStream.on("error", (err) => {
      settle(new Error("Write error: " + err.message));
    });

    client.downloadStream(
      { file: { user: username, file } },
      (err: Error | null, rs: NodeJS.ReadableStream) => {
        if (err) {
          settle(err);
          return;
        }

        readStream = rs;

        activeStreams.set(downloadId, {
          destroy: () => {
            cleanup();
          },
        });

        rs.on("data", (chunk: Buffer) => {
          hasReceivedData = true;
          resetTimeout();
          bytesReceived += chunk.length;
          writeStream!.write(chunk);

          const now = Date.now();
          if (now - lastProgressUpdate > 200) {
            const elapsed = (now - startedAt) / 1000;
            progress.bytesReceived = bytesReceived;
            progress.percent = expectedSize > 0
              ? Math.min(Math.round((bytesReceived / expectedSize) * 100), 100)
              : 0;
            progress.speed = elapsed > 0 ? Math.round(bytesReceived / elapsed) : 0;
            activeProgress.set(downloadId, { ...progress });
            onProgress?.({ ...progress });
            lastProgressUpdate = now;
          }
        });

        rs.on("end", () => {
          writeStream!.end(() => {
            progress.bytesReceived = bytesReceived;
            progress.percent = 100;
            activeProgress.set(downloadId, { ...progress });
            onProgress?.({ ...progress });
            settle();
          });
        });

        rs.on("error", (streamErr: Error) => {
          settle(streamErr);
        });
      }
    );
  });
}

function cleanEmptyParents(dir: string) {
  try {
    const entries = fs.readdirSync(dir);
    if (entries.length > 0) return;
    fs.rmdirSync(dir);
    cleanEmptyParents(path.dirname(dir));
  } catch {}
}
