const SPOTIFY_API = "https://api.spotify.com/v1";
const PAGE_DELAY_MS = 200;
const DEFAULT_RETRIES = 3;

type SpotifyHeaders = Record<string, string>;

interface PaginatedResponse<T> {
  items: T[];
  next: string | null;
  total: number;
}

interface SpotifySearchResponse {
  tracks: PaginatedResponse<SpotifyTrackResult>;
}

export interface SpotifyTrackResult {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  external_ids?: { isrc?: string };
}

export interface SavedTrackItem {
  added_at: string;
  track: SpotifyTrackResult;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SpotifyClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  getHeaders(): SpotifyHeaders {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async fetchWithRetry(
    url: string,
    options: RequestInit,
    fetchFn: typeof fetch = globalThis.fetch,
    retries: number = DEFAULT_RETRIES
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetchFn(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, attempt);
        if (attempt < retries) {
          await delay(waitSeconds * 1000);
          continue;
        }
      }

      if (!response.ok && attempt < retries) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }

      return response;
    }

    // Final attempt — just return whatever we get
    return fetchFn(url, options);
  }

  async getAllSavedTracks(
    fetchFn: typeof fetch = globalThis.fetch
  ): Promise<SavedTrackItem[]> {
    const allItems: SavedTrackItem[] = [];
    let url: string | null = `${SPOTIFY_API}/me/tracks?limit=50&offset=0`;

    while (url) {
      const response = await this.fetchWithRetry(
        url,
        { method: "GET", headers: this.getHeaders() },
        fetchFn
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch saved tracks: ${response.status}`
        );
      }

      const data: PaginatedResponse<SavedTrackItem> = await response.json();
      allItems.push(...data.items);
      url = data.next;

      if (url) {
        await delay(PAGE_DELAY_MS);
      }
    }

    return allItems;
  }

  async searchTrack(
    query: string,
    fetchFn: typeof fetch = globalThis.fetch
  ): Promise<SpotifyTrackResult[]> {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "10",
    });

    const response = await this.fetchWithRetry(
      `${SPOTIFY_API}/search?${params.toString()}`,
      { method: "GET", headers: this.getHeaders() },
      fetchFn
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data: SpotifySearchResponse = await response.json();
    return data.tracks.items;
  }

  async searchByIsrc(
    isrc: string,
    fetchFn: typeof fetch = globalThis.fetch
  ): Promise<SpotifyTrackResult[]> {
    return this.searchTrack(`isrc:${isrc}`, fetchFn);
  }

  async likeTracks(
    uris: string[],
    fetchFn: typeof fetch = globalThis.fetch
  ): Promise<void> {
    // Batch into groups of 50
    for (let i = 0; i < uris.length; i += 50) {
      const batch = uris.slice(i, i + 50);
      // Extract IDs from URIs (spotify:track:ID -> ID) or use as-is if already IDs
      const ids = batch.map((uri) =>
        uri.startsWith("spotify:track:") ? uri.replace("spotify:track:", "") : uri
      );

      const response = await this.fetchWithRetry(
        `${SPOTIFY_API}/me/tracks`,
        {
          method: "PUT",
          headers: this.getHeaders(),
          body: JSON.stringify({ ids }),
        },
        fetchFn
      );

      if (!response.ok) {
        throw new Error(`Failed to like tracks: ${response.status}`);
      }

      if (i + 50 < uris.length) {
        await delay(PAGE_DELAY_MS);
      }
    }
  }

  async getArtistGenres(
    artistIds: string[],
    fetchFn: typeof fetch = globalThis.fetch
  ): Promise<Map<string, string[]>> {
    const genreMap = new Map<string, string[]>();
    for (let i = 0; i < artistIds.length; i += 50) {
      const batch = artistIds.slice(i, i + 50);
      const params = new URLSearchParams({ ids: batch.join(",") });
      const response = await this.fetchWithRetry(
        `${SPOTIFY_API}/artists?${params.toString()}`,
        { method: "GET", headers: this.getHeaders() },
        fetchFn
      );
      if (response.ok) {
        const data = await response.json();
        for (const artist of data.artists ?? []) {
          if (artist?.id && artist.genres?.length > 0) {
            genreMap.set(artist.id, artist.genres);
          }
        }
      }
      if (i + 50 < artistIds.length) await delay(PAGE_DELAY_MS);
    }
    return genreMap;
  }

  async checkSaved(
    ids: string[],
    fetchFn: typeof fetch = globalThis.fetch
  ): Promise<boolean[]> {
    const params = new URLSearchParams({ ids: ids.join(",") });

    const response = await this.fetchWithRetry(
      `${SPOTIFY_API}/me/tracks/contains?${params.toString()}`,
      { method: "GET", headers: this.getHeaders() },
      fetchFn
    );

    if (!response.ok) {
      throw new Error(`Check saved failed: ${response.status}`);
    }

    return response.json();
  }
}
