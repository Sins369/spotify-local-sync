"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderPicker } from "@/components/settings/folder-picker";
import { renderPath } from "@/lib/file-organizer";

interface Settings {
  music_source_path: string;
  download_path: string;
  backup_dest_path: string;
  trash_path: string;
  file_template: string;
  soulseek_username: string;
  soulseek_password: string;
}

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

type PickerField = "music_source_path" | "download_path" | "backup_dest_path" | "trash_path" | null;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    music_source_path: "",
    download_path: "",
    backup_dest_path: "",
    trash_path: "",
    file_template: DEFAULT_TEMPLATE,
    soulseek_username: "",
    soulseek_password: "",
  });
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>(null);
  const [templatePreview, setTemplatePreview] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectedInfo, setDetectedInfo] = useState<{
    description: string;
    samples: string[];
  } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchSpotifyStatus();
  }, []);

  useEffect(() => {
    const template = settings.file_template || DEFAULT_TEMPLATE;
    try {
      const preview = renderPath(template, SAMPLE_TRACK);
      setTemplatePreview(preview);
    } catch {
      setTemplatePreview("Invalid template");
    }
  }, [settings.file_template]);

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
        }));
      }
    } catch {
      // fetch failed
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
      // fetch failed
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } catch {
      // save failed
    } finally {
      setSaving(false);
    }
  }

  async function handleSpotifyConnect() {
    try {
      const res = await fetch("/api/spotify/auth");
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch {
      // auth failed
    }
  }

  function updateField(field: keyof Settings, value: string) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function handleFolderSelect(path: string) {
    if (pickerField) {
      updateField(pickerField, path);
    }
    setPickerField(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Spotify Connection</CardTitle>
          <CardDescription>
            Connect your Spotify account to sync liked songs
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Badge variant={spotifyConnected ? "default" : "secondary"}>
            {spotifyConnected ? "Connected" : "Not Connected"}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleSpotifyConnect}>
            {spotifyConnected ? "Reconnect" : "Connect"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paths</CardTitle>
          <CardDescription>
            Click Browse to navigate and select folders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Music Source Directory</Label>
            <div className="flex gap-2">
              <Input
                value={settings.music_source_path}
                onChange={(e) => updateField("music_source_path", e.target.value)}
                placeholder="Click Browse to select..."
                readOnly
              />
              <Button
                variant="outline"
                onClick={() => setPickerField("music_source_path")}
              >
                Browse
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Download Location</Label>
            <div className="flex gap-2">
              <Input
                value={settings.download_path}
                onChange={(e) => updateField("download_path", e.target.value)}
                placeholder="Click Browse to select..."
                readOnly
              />
              <Button
                variant="outline"
                onClick={() => setPickerField("download_path")}
              >
                Browse
              </Button>
            </div>
            <p className="text-[10px] text-[#64748B]">Where Soulseek downloads are saved</p>
          </div>
          <div className="space-y-2">
            <Label>Backup Destination</Label>
            <div className="flex gap-2">
              <Input
                value={settings.backup_dest_path}
                onChange={(e) => updateField("backup_dest_path", e.target.value)}
                placeholder="Click Browse to select..."
                readOnly
              />
              <Button
                variant="outline"
                onClick={() => setPickerField("backup_dest_path")}
              >
                Browse
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Trash Folder</Label>
            <div className="flex gap-2">
              <Input
                value={settings.trash_path}
                onChange={(e) => updateField("trash_path", e.target.value)}
                placeholder="Click Browse to select..."
                readOnly
              />
              <Button
                variant="outline"
                onClick={() => setPickerField("trash_path")}
              >
                Browse
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>File Organization Template</Label>
            <div className="flex gap-2">
              <Input
                value={settings.file_template}
                onChange={(e) => updateField("file_template", e.target.value)}
                placeholder={DEFAULT_TEMPLATE}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  setDetecting(true);
                  setDetectedInfo(null);
                  try {
                    const res = await fetch("/api/detect-template");
                    if (res.ok) {
                      const data = await res.json();
                      updateField("file_template", data.detected_template);
                      setDetectedInfo({
                        description: data.pattern_description,
                        samples: data.samples,
                      });
                    }
                  } catch {
                    // detection failed
                  } finally {
                    setDetecting(false);
                  }
                }}
                disabled={detecting || !settings.music_source_path}
              >
                {detecting ? "Detecting..." : "Detect"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Variables: {"{AlbumArtist}"}, {"{Artist}"}, {"{Album}"}, {"{Title}"}, {"{Genre}"}, {"{TrackNo}"}, {"{DiscNo}"}, {"{Year}"}, {"{ext}"}
            </p>
            {detectedInfo && (
              <div className="text-xs border rounded px-3 py-2 space-y-1">
                <p className="font-medium text-green-500">Detected: {detectedInfo.description}</p>
                <p className="text-muted-foreground">Sample files from your library:</p>
                {detectedInfo.samples.map((s, i) => (
                  <p key={i} className="font-mono text-muted-foreground truncate">{s}</p>
                ))}
              </div>
            )}
            <div className="text-xs bg-muted rounded px-3 py-2 font-mono">
              <span className="text-muted-foreground">Preview: </span>
              {settings.backup_dest_path ? `${settings.backup_dest_path}\\` : ""}
              {templatePreview}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soulseek</CardTitle>
          <CardDescription>
            Soulseek credentials for searching and downloading
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={settings.soulseek_username}
              onChange={(e) => updateField("soulseek_username", e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={settings.soulseek_password}
              onChange={(e) => updateField("soulseek_password", e.target.value)}
              placeholder="password"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>

      <CleanupSection />

      <FolderPicker
        open={pickerField !== null}
        onClose={() => setPickerField(null)}
        onSelect={handleFolderSelect}
        currentPath={pickerField ? settings[pickerField] : undefined}
      />
    </div>
  );
}

function CleanupSection() {
  const [status, setStatus] = useState<{ stale_records: number; empty_folders: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<{ stale_records_removed: number; empty_folders_removed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cleanup");
      if (res.ok) setStatus(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function runCleanup() {
    setCleaning(true);
    setResult(null);
    try {
      const res = await fetch("/api/cleanup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        await fetchStatus();
      }
    } catch {} finally {
      setCleaning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Cleanup
        </CardTitle>
        <CardDescription>
          Remove stale database records and empty folders from your music library
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking...</p>
        ) : status && (status.stale_records > 0 || status.empty_folders > 0) ? (
          <div className="space-y-2">
            {status.stale_records > 0 && (
              <p className="text-sm text-yellow-500">
                {status.stale_records} stale record{status.stale_records !== 1 ? "s" : ""} (files no longer exist on disk)
              </p>
            )}
            {status.empty_folders > 0 && (
              <p className="text-sm text-yellow-500">
                {status.empty_folders} empty folder{status.empty_folders !== 1 ? "s" : ""} in music library
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-green-500">Everything is clean</p>
        )}

        {result && (
          <p className="text-sm text-green-500">
            Removed {result.stale_records_removed} stale record{result.stale_records_removed !== 1 ? "s" : ""} and {result.empty_folders_removed} empty folder{result.empty_folders_removed !== 1 ? "s" : ""}
          </p>
        )}

        <Button
          variant="outline"
          onClick={runCleanup}
          disabled={cleaning}
          className="gap-2"
        >
          {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {cleaning ? "Cleaning..." : "Run Cleanup"}
        </Button>
      </CardContent>
    </Card>
  );
}
