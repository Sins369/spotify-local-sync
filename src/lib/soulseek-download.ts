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

    function settle(err?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      activeProgress.delete(downloadId);
      activeStreams.delete(downloadId);
      if (err) reject(err);
      else resolve();
    }

    function resetTimeout() {
      clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(() => {
        settle(new Error("Download timed out — no data received for 30 seconds"));
      }, 30000);
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

    const writeStream = fs.createWriteStream(destPath);

    writeStream.on("error", (err) => {
      settle(new Error("Write error: " + err.message));
    });

    client.downloadStream(
      { file: { user: username, file } },
      (err: Error | null, readStream: NodeJS.ReadableStream) => {
        if (err) {
          settle(err);
          return;
        }

        activeStreams.set(downloadId, {
          destroy: () => {
            try { (readStream as any).destroy?.(); } catch {}
            try { writeStream.close(); } catch {}
            try { fs.unlinkSync(destPath); } catch {}
          },
        });

        readStream.on("data", (chunk: Buffer) => {
          resetTimeout();
          bytesReceived += chunk.length;
          writeStream.write(chunk);

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

        readStream.on("end", () => {
          writeStream.end(() => {
            progress.bytesReceived = bytesReceived;
            progress.percent = 100;
            activeProgress.set(downloadId, { ...progress });
            onProgress?.({ ...progress });
            settle();
          });
        });

        readStream.on("error", (err: Error) => {
          try { writeStream.close(); } catch {}
          try { fs.unlinkSync(destPath); } catch {}
          settle(err);
        });
      }
    );
  });
}
