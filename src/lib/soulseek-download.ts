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
    function cleanup() {
      try {
        if (fs.existsSync(destPath)) {
          const stat = fs.statSync(destPath);
          if (stat.size === 0 || bytesReceived === 0) {
            fs.unlinkSync(destPath);
            cleanEmptyParents(path.dirname(destPath));
          }
        }
      } catch {}
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
          : "User not responding — retrying with another source";
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

    activeStreams.set(downloadId, { destroy: () => cleanup() });

    try {
      client.download(
        { file: { user: username, file }, path: destPath },
        (err: Error | null, result: unknown) => {
          if (err) {
            settle(err);
            return;
          }
          hasReceivedData = true;
          clearTimeout(timeoutTimer);

          const buf = result && typeof result === "object" && "buffer" in result
            ? (result as { buffer: Buffer }).buffer
            : (Buffer.isBuffer(result) ? result : null);

          bytesReceived = buf?.length ?? expectedSize;
          progress.bytesReceived = bytesReceived;
          progress.percent = 100;
          progress.speed = bytesReceived > 0 ? Math.round(bytesReceived / ((Date.now() - startedAt) / 1000)) : 0;
          activeProgress.set(downloadId, { ...progress });
          onProgress?.({ ...progress });

          if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            settle();
          } else if (buf && buf.length > 0) {
            fs.writeFile(destPath, buf, (writeErr) => {
              if (writeErr) settle(new Error("Write error: " + writeErr.message));
              else settle();
            });
          } else {
            settle(new Error("Download completed but no data received"));
          }
        }
      );
    } catch (e) {
      settle(e instanceof Error ? e : new Error(String(e)));
    }
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
