import crypto from "crypto";

/**
 * Generates a cryptographically random code verifier for PKCE.
 * 64 random bytes -> base64url, sliced to 128 characters.
 */
export function generateCodeVerifier(): string {
  return crypto
    .randomBytes(64)
    .toString("base64url")
    .slice(0, 128);
}

/**
 * Generates a code challenge from a code verifier using SHA-256.
 * Returns the base64url-encoded hash (no padding).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64url");
}

/**
 * Builds a Spotify authorization URL using PKCE flow.
 * Returns the URL and the code verifier (to be stored for the token exchange).
 */
export async function buildAuthUrl(
  clientId: string,
  redirectUri: string
): Promise<{ url: string; codeVerifier: string }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: "user-library-read user-library-modify",
  });

  const url = `https://accounts.spotify.com/authorize?${params.toString()}`;

  return { url, codeVerifier };
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 * Uses PKCE (no client secret required).
 */
export async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Refreshes an access token using a refresh token.
 * Uses PKCE (no client secret required).
 */
export async function refreshAccessToken(
  clientId: string,
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${error}`);
  }

  return response.json();
}
