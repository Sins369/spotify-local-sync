import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpotifyClient } from "@/lib/spotify-client";

describe("SpotifyClient", () => {
  let client: SpotifyClient;
  beforeEach(() => {
    client = new SpotifyClient("test-access-token");
  });

  it("constructs with access token", () => {
    expect(client).toBeDefined();
  });

  it("builds correct headers", () => {
    const headers = client.getHeaders();
    expect(headers.Authorization).toBe("Bearer test-access-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("paginates through results", async () => {
    const pages = [
      { items: [{ id: "1" }, { id: "2" }], next: "page2", total: 4 },
      { items: [{ id: "3" }, { id: "4" }], next: null, total: 4 },
    ];
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      const page = pages[callCount++];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(page),
        headers: new Headers(),
      });
    });
    global.fetch = mockFetch;
    const results = await client.getAllSavedTracks(mockFetch as typeof fetch);
    expect(results).toHaveLength(4);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
