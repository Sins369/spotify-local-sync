"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, FolderOpen, RefreshCw, Trash2, AlertTriangle, Loader2, Unplug, Eye, EyeOff } from "lucide-react";
import { renderPath } from "@/lib/file-organizer";

/* ── Types ─────────────────────────────────────────────────────── */

interface Settings {
  music_source_path: string;
  download_path: string;
  backup_dest_path: string;
  trash_path: string;
  file_template: string;
  soulseek_username: string;
  soulseek_password: string;
  max_concurrent_downloads: string;
  soulseek_share_library: string;
}

type SettingsKey = keyof Settings;

/* ── Constants ─────────────────────────────────────────────────── */

const DEFAULT_TEMPLATE = "{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}";

const SAMPLE_TRACK = {
  album_artist: "Pink Floyd",
  artist: "Pink Floyd",
  album: "The Dark Side of the Moon",
  track_no: 3,
  disc_no: 1,
  title: "Time",
  year: 1973,
  genre: "Progressive Rock",
  ext: "flac",
};

const TEMPLATE_VARS = [
  "{AlbumArtist}",
  "{Artist}",
  "{Album}",
  "{Title}",
  "{TrackNo}",
  "{DiscNo}",
  "{Year}",
  "{Genre}",
  "{ext}",
];

const PATH_FIELDS: { key: SettingsKey; label: string }[] = [
  { key: "music_source_path", label: "Music Source" },
  { key: "download_path", label: "Download Location" },
  { key: "backup_dest_path", label: "Backup Destination" },
  { key: "trash_path", label: "Trash Folder" },
];

/* ── Styles ────────────────────────────────────────────────────── */

const sectionLabel =
  "text-[10px] uppercase font-bold tracking-[1.5px] text-[#5a5a6e] mb-3 select-none";

const inputBase =
  "w-full bg-[#141420] border border-[rgba(255,255,255,0.06)] text-[#e0e0e8] font-mono text-xs px-3 py-2 rounded outline-none focus:border-[#34d399] transition-colors";

const btnBase =
  "bg-[#24243a] text-[#e0e0e8] text-xs px-3 py-2 rounded cursor-pointer transition-colors hover:bg-[#34d399] hover:text-[#12121c] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0";

const btnDanger =
  "bg-[#e0556620] text-[#e05566] text-xs px-3 py-2 rounded cursor-pointer transition-colors hover:bg-[#e05566] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5";

const btnCleanup =
  "bg-[#24243a] text-[#e0e0e8] text-xs px-3 py-2 rounded cursor-pointer transition-colors hover:bg-[#f59e0b] hover:text-[#12121c] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5";

/* ── Page ──────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    music_source_path: "",
    download_path: "",
    backup_dest_path: "",
    trash_path: "",
    file_template: DEFAULT_TEMPLATE,
    soulseek_username: "",
    soulseek_password: "",
    max_concurrent_downloads: "1",
    soulseek_share_library: "false",
  });
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [templatePreview, setTemplatePreview] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* cleanup state */
  const [cleanupStats, setCleanupStats] = useState<{
    stale_records: number;
    empty_folders: number;
  } | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  /* danger zone confirmation */
  const [confirmAction, setConfirmAction] = useState<"reset_db" | "disconnect" | null>(null);

  /* ── Fetch on mount ──────────────────────────────────────────── */

  const fetchCleanupStats = useCallback(async () => {
    try {
      const res = await fetch("/api/cleanup");
      if (res.ok) setCleanupStats(await res.json());
    } catch {
      /* fetch failed */
    } finally {
      setCleanupLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSpotifyStatus();
    fetchCleanupStats();
  }, [fetchCleanupStats]);

  /* ── Template preview ────────────────────────────────────────── */

  useEffect(() => {
    const template = settings.file_template || DEFAULT_TEMPLATE;
    try {
      setTemplatePreview(renderPath(template, SAMPLE_TRACK));
    } catch {
      setTemplatePreview("Invalid template");
    }
  }, [settings.file_template]);

  /* ── Data fetching ───────────────────────────────────────────── */

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({
          ...prev,
          music_source_path: data.music_source_path || "",
          download_path: data.download_path || "",
          backup_dest_path: data.backup_dest_path || "",
          trash_path: data.trash_path || "",
          file_template: data.file_template || DEFAULT_TEMPLATE,
          soulseek_username: data.soulseek_username || "",
          soulseek_password: data.soulseek_password || "",
          max_concurrent_downloads: data.max_concurrent_downloads || "1",
          soulseek_share_library: data.soulseek_share_library || "false",
        }));
      }
    } catch {
      /* fetch failed */
    } finally {
      setLoading(false);
    }
  }

  async function fetchSpotifyStatus() {
    try {
      const res = await fetch("/api/spotify/status");
      if (res.ok) {
        const data = await res.json();
        setSpotifyConnected(data.connected);
      }
    } catch {
      /* fetch failed */
    }
  }

  /* ── Auto-save on blur ───────────────────────────────────────── */

  async function saveSetting(key: string, value: string) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch {
      /* save failed */
    }
  }

  /* ── Field helpers ───────────────────────────────────────────── */

  function updateField(field: SettingsKey, value: string) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  /* ── Browse folder ───────────────────────────────────────────── */

  async function handleBrowse(field: SettingsKey) {
    try {
      const res = await fetch("/api/folder-picker", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.path) {
          updateField(field, data.path);
          await saveSetting(field, data.path);
        }
      }
    } catch {
      /* browse failed */
    }
  }

  /* ── Detect template ─────────────────────────────────────────── */

  async function handleDetectTemplate() {
    setDetecting(true);
    try {
      const res = await fetch("/api/detect-template");
      if (res.ok) {
        const data = await res.json();
        updateField("file_template", data.detected_template);
        await saveSetting("file_template", data.detected_template);
      }
    } catch {
      /* detection failed */
    } finally {
      setDetecting(false);
    }
  }

  /* ── Spotify connect ─────────────────────────────────────────── */

  async function handleSpotifyConnect() {
    try {
      const res = await fetch("/api/spotify/auth");
      if (res.ok) {
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      }
    } catch {
      /* auth failed */
    }
  }

  /* ── Cleanup ─────────────────────────────────────────────────── */

  async function handleCleanup() {
    setCleaning(true);
    try {
      const res = await fetch("/api/cleanup", { method: "POST" });
      if (res.ok) await fetchCleanupStats();
    } catch {
      /* cleanup failed */
    } finally {
      setCleaning(false);
    }
  }

  /* ── Danger zone actions ─────────────────────────────────────── */

  async function handleResetDb() {
    try {
      await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_db" }),
      });
      window.location.reload();
    } catch {
      /* reset failed */
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleDisconnectSpotify() {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_access_token: "",
          spotify_refresh_token: "",
          spotify_token_expires_at: "",
        }),
      });
      setSpotifyConnected(false);
    } catch {
      /* disconnect failed */
    } finally {
      setConfirmAction(null);
    }
  }

  /* ── Saved indicator ─────────────────────────────────────────── */

  function SavedBadge({ field }: { field: string }) {
    if (savedKey !== field) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-[#34d399] ml-2">
        <Check className="w-3 h-3" /> Saved
      </span>
    );
  }

  /* ── Loading state ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#5a5a6e] pt-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* ── Left Column ──────────────────────────────────────── */}
      <div className="flex-1 space-y-8">
        {/* Spotify Connection */}
        <section>
          <h3 className={sectionLabel}>SPOTIFY CONNECTION</h3>
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded ${
                spotifyConnected
                  ? "bg-[#34d39920] text-[#34d399]"
                  : "bg-[#e0556620] text-[#e05566]"
              }`}
            >
              {spotifyConnected ? "CONNECTED" : "NOT CONNECTED"}
            </span>
            <button className={btnBase} onClick={handleSpotifyConnect}>
              {spotifyConnected ? "Reconnect" : "Connect"}
            </button>
          </div>
        </section>

        {/* Paths */}
        <section>
          <h3 className={sectionLabel}>PATHS</h3>
          <div className="space-y-4">
            {PATH_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-[#5a5a6e] mb-1">
                  {label}
                  <SavedBadge field={key} />
                </label>
                <div className="flex gap-2">
                  <input
                    className={inputBase}
                    value={settings[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    onBlur={() => saveSetting(key, settings[key])}
                    placeholder="No folder selected"
                  />
                  <button
                    className={btnBase}
                    onClick={() => handleBrowse(key)}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Browse
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Right Column ─────────────────────────────────────── */}
      <div className="flex-1 space-y-8">
        {/* File Template */}
        <section>
          <h3 className={sectionLabel}>FILE TEMPLATE</h3>
          <div>
            <label className="block text-xs text-[#5a5a6e] mb-1">
              Organization Template
              <SavedBadge field="file_template" />
            </label>
            <div className="flex gap-2">
              <input
                className={inputBase}
                value={settings.file_template}
                onChange={(e) => updateField("file_template", e.target.value)}
                onBlur={() => saveSetting("file_template", settings.file_template)}
                placeholder={DEFAULT_TEMPLATE}
              />
              <button
                className={btnBase}
                onClick={handleDetectTemplate}
                disabled={detecting || !settings.music_source_path}
              >
                {detecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Detect
              </button>
            </div>
            <p className="mt-2 font-mono text-[13px] text-[#34d399]">
              {templatePreview}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TEMPLATE_VARS.map((v) => (
                <span
                  key={v}
                  className="bg-[#24243a] text-[#8888a0] rounded-sm px-1.5 py-0.5 text-[10px] font-mono select-all"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Soulseek */}
        <section>
          <h3 className={sectionLabel}>SOULSEEK</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#5a5a6e] mb-1">
                Username
                <SavedBadge field="soulseek_username" />
              </label>
              <input
                className={inputBase}
                value={settings.soulseek_username}
                onChange={(e) => updateField("soulseek_username", e.target.value)}
                onBlur={() => saveSetting("soulseek_username", settings.soulseek_username)}
                placeholder="username"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5a5a6e] mb-1">
                Password
                <SavedBadge field="soulseek_password" />
              </label>
              <div className="relative">
                <input
                  className={inputBase + " pr-9"}
                  type={showPassword ? "text" : "password"}
                  value={settings.soulseek_password}
                  onChange={(e) => updateField("soulseek_password", e.target.value)}
                  onBlur={() => saveSetting("soulseek_password", settings.soulseek_password)}
                  placeholder="password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5a5a6e] hover:text-[#8888a0] transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#5a5a6e] mb-1">
                Max Concurrent Downloads
                <SavedBadge field="max_concurrent_downloads" />
              </label>
              <input
                className={inputBase + " w-20"}
                type="number"
                min={1}
                max={5}
                value={settings.max_concurrent_downloads}
                onChange={(e) => updateField("max_concurrent_downloads", e.target.value)}
                onBlur={() =>
                  saveSetting("max_concurrent_downloads", settings.max_concurrent_downloads)
                }
              />
            </div>
            <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
              <label className="flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => {
                    const newVal = settings.soulseek_share_library === "true" ? "false" : "true";
                    updateField("soulseek_share_library", newVal);
                    saveSetting("soulseek_share_library", newVal);
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    settings.soulseek_share_library === "true" ? "bg-[#34d399]" : "bg-[#24243a]"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.soulseek_share_library === "true" ? "translate-x-4" : ""
                  }`} />
                </button>
                <div>
                  <span className="text-[13px] text-[#e0e0e8]">Share music library</span>
                  <p className="text-[11px] text-[#5a5a6e] mt-0.5">
                    Share your music folder with Soulseek users. Many users block downloads from non-sharers.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Cleanup */}
        <section>
          <h3 className={sectionLabel}>CLEANUP</h3>
          <div className="space-y-3">
            {cleanupLoading ? (
              <p className="text-xs text-[#5a5a6e]">Checking...</p>
            ) : cleanupStats ? (
              <p className="text-xs text-[#8888a0]">
                {cleanupStats.stale_records} stale record{cleanupStats.stale_records !== 1 ? "s" : ""}{" "}
                &middot; {cleanupStats.empty_folders} empty folder{cleanupStats.empty_folders !== 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-xs text-[#5a5a6e]">Unable to fetch stats</p>
            )}
            <button
              className={btnCleanup}
              onClick={handleCleanup}
              disabled={cleaning}
            >
              {cleaning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {cleaning ? "Running..." : "Run Cleanup"}
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h3 className={sectionLabel}>DANGER ZONE</h3>
          <div className="border border-[#e05566] rounded p-4 space-y-3">
            {/* Reset Database */}
            {confirmAction === "reset_db" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#e05566]">Are you sure?</span>
                <button className={btnDanger} onClick={handleResetDb}>
                  Confirm
                </button>
                <button
                  className={btnBase}
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={btnDanger}
                onClick={() => setConfirmAction("reset_db")}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Reset Database
              </button>
            )}

            {/* Disconnect Spotify */}
            {confirmAction === "disconnect" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#e05566]">Are you sure?</span>
                <button className={btnDanger} onClick={handleDisconnectSpotify}>
                  Confirm
                </button>
                <button
                  className={btnBase}
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={btnDanger}
                onClick={() => setConfirmAction("disconnect")}
              >
                <Unplug className="w-3.5 h-3.5" />
                Disconnect Spotify
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
