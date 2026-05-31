"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Settings {
  spotify_connected: boolean;
  music_source: string;
  backup_dest: string;
  trash_folder: string;
  file_template: string;
  soulseek_username: string;
  soulseek_password: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    spotify_connected: false,
    music_source: "",
    backup_dest: "",
    trash_folder: "",
    file_template: "",
    soulseek_username: "",
    soulseek_password: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
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
      // Save failed
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
      // Auth failed
    }
  }

  function updateField(field: keyof Settings, value: string) {
    setSettings((prev) => ({ ...prev, [field]: value }));
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Spotify Connection</CardTitle>
          <CardDescription>
            Connect your Spotify account to sync liked songs
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Badge variant={settings.spotify_connected ? "default" : "secondary"}>
            {settings.spotify_connected ? "Connected" : "Not Connected"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSpotifyConnect}
          >
            {settings.spotify_connected ? "Reconnect" : "Connect"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paths</CardTitle>
          <CardDescription>
            Configure music source, backup, and trash directories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="music_source">Music Source Directory</Label>
            <Input
              id="music_source"
              value={settings.music_source}
              onChange={(e) => updateField("music_source", e.target.value)}
              placeholder="/path/to/music"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="backup_dest">Backup Destination</Label>
            <Input
              id="backup_dest"
              value={settings.backup_dest}
              onChange={(e) => updateField("backup_dest", e.target.value)}
              placeholder="/path/to/backup"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trash_folder">Trash Folder</Label>
            <Input
              id="trash_folder"
              value={settings.trash_folder}
              onChange={(e) => updateField("trash_folder", e.target.value)}
              placeholder="/path/to/trash"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file_template">File Template</Label>
            <Input
              id="file_template"
              value={settings.file_template}
              onChange={(e) => updateField("file_template", e.target.value)}
              placeholder="{artist}/{album}/{track} - {title}"
            />
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
            <Label htmlFor="slsk_user">Username</Label>
            <Input
              id="slsk_user"
              value={settings.soulseek_username}
              onChange={(e) =>
                updateField("soulseek_username", e.target.value)
              }
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slsk_pass">Password</Label>
            <Input
              id="slsk_pass"
              type="password"
              value={settings.soulseek_password}
              onChange={(e) =>
                updateField("soulseek_password", e.target.value)
              }
              placeholder="password"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
