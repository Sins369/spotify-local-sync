import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge, buildAuthUrl } from "@/lib/spotify-auth";

describe("spotify-auth", () => {
  it("generates a code verifier of correct length", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });
  it("generates different verifiers each time", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });
  it("generates a valid code challenge from verifier", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBeTruthy();
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    expect(challenge).not.toContain("=");
  });
  it("builds a valid auth URL", async () => {
    const { url, codeVerifier } = await buildAuthUrl("test-client-id", "http://localhost:3000/api/spotify/callback");
    expect(codeVerifier).toBeTruthy();
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://accounts.spotify.com");
    expect(parsed.pathname).toBe("/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/spotify/callback");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
    expect(parsed.searchParams.get("scope")).toContain("user-library-read");
    expect(parsed.searchParams.get("scope")).toContain("user-library-modify");
  });
});
