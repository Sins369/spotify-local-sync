import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import fs from "fs";
import path from "path";

interface FileSample {
  relativePath: string;
  parts: string[];
  filename: string;
}

export async function GET() {
  const sourcePath = getSetting("music_source_path");
  if (!sourcePath) {
    return NextResponse.json({ error: "Music source path not configured" }, { status: 400 });
  }

  try {
    const samples = collectSamples(sourcePath, 50);
    if (samples.length === 0) {
      return NextResponse.json({ error: "No audio files found in source directory" }, { status: 404 });
    }

    const analysis = analyzeStructure(samples);

    return NextResponse.json({
      detected_template: analysis.template,
      depth: analysis.depth,
      samples: samples.slice(0, 10).map((s) => s.relativePath),
      pattern_description: analysis.description,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Detection failed" },
      { status: 500 }
    );
  }
}

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".aiff", ".aif", ".wma",
]);

function collectSamples(rootPath: string, maxSamples: number): FileSample[] {
  const samples: FileSample[] = [];
  walkForSamples(rootPath, rootPath, samples, maxSamples);
  return samples;
}

function walkForSamples(dir: string, root: string, samples: FileSample[], max: number): void {
  if (samples.length >= max) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (samples.length >= max) return;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkForSamples(fullPath, root, samples, max);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        const relativePath = path.relative(root, fullPath);
        const parts = relativePath.split(path.sep);
        samples.push({
          relativePath,
          parts,
          filename: entry.name,
        });
      }
    }
  }
}

interface AnalysisResult {
  template: string;
  depth: number;
  description: string;
}

function analyzeStructure(samples: FileSample[]): AnalysisResult {
  const depths = samples.map((s) => s.parts.length);
  const mostCommonDepth = mode(depths);

  const filenamePatterns = samples.map((s) => detectFilenamePattern(s.filename));
  const commonFilenamePattern = mode(filenamePatterns);

  if (mostCommonDepth === 1) {
    return {
      template: `${commonFilenamePattern}.{ext}`,
      depth: 1,
      description: "Flat structure — all files in one folder",
    };
  }

  if (mostCommonDepth === 2) {
    return {
      template: `{AlbumArtist}/${commonFilenamePattern}.{ext}`,
      depth: 2,
      description: "Artist / Track",
    };
  }

  if (mostCommonDepth === 3) {
    const topLevel = samples
      .filter((s) => s.parts.length >= 3)
      .map((s) => s.parts[0]);
    const secondLevel = samples
      .filter((s) => s.parts.length >= 3)
      .map((s) => s.parts[1]);

    const topLevelIsGenre = looksLikeGenres(topLevel, samples);

    if (topLevelIsGenre) {
      return {
        template: `{Genre}/{AlbumArtist}/${commonFilenamePattern}.{ext}`,
        depth: 3,
        description: "Genre / Artist / Track",
      };
    }

    const hasYearInAlbum = secondLevel.some((name) => /\(\d{4}\)|\b\d{4}\b/.test(name));

    if (hasYearInAlbum) {
      return {
        template: `{AlbumArtist}/{Album} ({Year})/${commonFilenamePattern}.{ext}`,
        depth: 3,
        description: "Artist / Album (Year) / Track",
      };
    }

    return {
      template: `{AlbumArtist}/{Album}/${commonFilenamePattern}.{ext}`,
      depth: 3,
      description: "Artist / Album / Track",
    };
  }

  if (mostCommonDepth >= 4) {
    const topLevel = samples
      .filter((s) => s.parts.length >= 4)
      .map((s) => s.parts[0]);
    const topLevelIsGenre = looksLikeGenres(topLevel, samples);

    if (topLevelIsGenre) {
      const thirdLevel = samples
        .filter((s) => s.parts.length >= 4)
        .map((s) => s.parts[2]);
      const hasYearInAlbum = thirdLevel.some((name) => /\(\d{4}\)|\b\d{4}\b/.test(name));

      if (hasYearInAlbum) {
        return {
          template: `{Genre}/{AlbumArtist}/{Album} ({Year})/${commonFilenamePattern}.{ext}`,
          depth: mostCommonDepth,
          description: "Genre / Artist / Album (Year) / Track",
        };
      }

      return {
        template: `{Genre}/{AlbumArtist}/{Album}/${commonFilenamePattern}.{ext}`,
        depth: mostCommonDepth,
        description: "Genre / Artist / Album / Track",
      };
    }

    return {
      template: `{AlbumArtist}/{Album}/{DiscNo}-${commonFilenamePattern}.{ext}`,
      depth: mostCommonDepth,
      description: "Artist / Album / Disc-Track (deep structure)",
    };
  }

  return {
    template: `{AlbumArtist}/{Album}/${commonFilenamePattern}.{ext}`,
    depth: mostCommonDepth,
    description: "Artist / Album / Track (default)",
  };
}

function detectFilenamePattern(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, "");

  // "Title by Artist"
  if (/^.+ by .+$/i.test(name)) {
    return "{Title} by {Artist}";
  }

  // "01 - Title" or "01. Title"
  if (/^\d{1,3}\s*[-–—.]\s*.+/.test(name)) {
    return "{TrackNo} - {Title}";
  }

  // "01 Title"
  if (/^\d{1,3}\s+.+/.test(name)) {
    return "{TrackNo} {Title}";
  }

  // "Artist - Title"
  if (/^[^-]+ - .+/.test(name) && !/^\d/.test(name)) {
    return "{Artist} - {Title}";
  }

  return "{TrackNo} {Title}";
}

function looksLikeGenres(folderNames: string[], samples: FileSample[]): boolean {
  const topLevelUnique = [...new Set(folderNames.map((n) => n.toLowerCase().trim()))];

  if (samples.length < 2) return false;

  const secondLevelNames = new Set(
    samples
      .filter((s) => s.parts.length >= 3)
      .map((s) => s.parts[1].toLowerCase().trim())
  );

  const topLevelAppearsAsChild = topLevelUnique.filter((n) => secondLevelNames.has(n));
  if (topLevelAppearsAsChild.length > topLevelUnique.length * 0.3) {
    return false;
  }

  const uniqueTopLevel = topLevelUnique.length;
  const uniqueSecondLevel = secondLevelNames.size;
  if (uniqueSecondLevel > uniqueTopLevel * 2) {
    return true;
  }

  return false;
}

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  let maxCount = 0;
  let maxVal = arr[0];
  for (const [val, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxVal = val;
    }
  }
  return maxVal;
}
