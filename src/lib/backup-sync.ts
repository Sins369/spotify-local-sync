import fs from "fs";
import path from "path";
import { eventBus } from "./event-bus";
import { getDb } from "./db";

export interface FileChange {
  src: string;
  dest: string;
  reason: "new" | "modified";
}

export interface ChangeResult {
  toCopy: FileChange[];
  upToDate: number;
}

export interface BackupSyncResult {
  copied: number;
  errors: number;
  upToDate: number;
}

export async function detectChanges(
  sourceFiles: string[],
  sourceRoot: string,
  destRoot: string
): Promise<ChangeResult> {
  const toCopy: FileChange[] = [];
  let upToDate = 0;

  for (let i = 0; i < sourceFiles.length; i++) {
    const srcFile = sourceFiles[i];
    const relativePath = path.relative(sourceRoot, srcFile);
    const destFile = path.join(destRoot, relativePath);

    try {
      const destStat = await fs.promises.stat(destFile);
      const srcStat = await fs.promises.stat(srcFile);

      if (
        srcStat.size !== destStat.size ||
        Math.abs(srcStat.mtimeMs - destStat.mtimeMs) > 1000
      ) {
        toCopy.push({ src: srcFile, dest: destFile, reason: "modified" });
      } else {
        upToDate++;
      }
    } catch {
      toCopy.push({ src: srcFile, dest: destFile, reason: "new" });
    }

    if (i % 50 === 0) await yieldEvent();
  }

  return { toCopy, upToDate };
}

const globalForBackup = globalThis as unknown as { __backupCancelled: boolean; __backupRunning: boolean };

export function cancelBackup() {
  globalForBackup.__backupCancelled = true;
}

export function isBackupRunning(): boolean {
  return !!globalForBackup.__backupRunning;
}

function yieldEvent(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export async function copyFile(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  await fs.promises.copyFile(src, dest);

  const srcStat = await fs.promises.stat(src);
  await fs.promises.utimes(dest, srcStat.atime, srcStat.mtime);
}

export async function runBackupSync(
  sourceFiles: string[],
  sourceRoot: string,
  destRoot: string
): Promise<BackupSyncResult> {
  globalForBackup.__backupCancelled = false;
  globalForBackup.__backupRunning = true;

  const startTime = Date.now();
  const changes = await detectChanges(sourceFiles, sourceRoot, destRoot);
  let copied = 0;
  let newFiles = 0;
  let errors = 0;

  for (const change of changes.toCopy) {
    if (globalForBackup.__backupCancelled) {
      logBackupHistory(copied, newFiles, errors, "cancelled", Date.now() - startTime);
      eventBus.emit("backup:complete", {
        copied,
        errors,
        upToDate: changes.upToDate,
        cancelled: true,
      });
      globalForBackup.__backupRunning = false;
      return { copied, errors, upToDate: changes.upToDate };
    }

    try {
      await copyFile(change.src, change.dest);
      copied++;
      if (change.reason === "new") newFiles++;
      eventBus.emit("backup:progress", {
        file: change.src,
        reason: change.reason,
        copied,
        total: changes.toCopy.length,
      });
    } catch (err) {
      errors++;
      eventBus.emit("backup:error", {
        file: change.src,
        error: err,
      });
    }

    if (copied % 5 === 0) await yieldEvent();
  }

  logBackupHistory(copied, newFiles, errors, errors > 0 ? "partial" : "complete", Date.now() - startTime);

  eventBus.emit("backup:complete", {
    copied,
    errors,
    upToDate: changes.upToDate,
  });

  globalForBackup.__backupRunning = false;
  return { copied, errors, upToDate: changes.upToDate };
}

function logBackupHistory(filesSynced: number, filesNew: number, filesFailed: number, status: string, durationMs: number) {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO backup_history (files_synced, files_new, files_failed, status, duration_ms) VALUES (?, ?, ?, ?, ?)"
    ).run(filesSynced, filesNew, filesFailed, status, durationMs);
  } catch {}
}
