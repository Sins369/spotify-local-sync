import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const accessToken = getSetting("spotify_access_token");
    const expiresAt = getSetting("spotify_token_expires_at");
    const refreshToken = getSetting("spotify_refresh_token");

    const connected = !!(accessToken && refreshToken);
    const expired = expiresAt ? Date.now() > Number(expiresAt) : true;

    return NextResponse.json({ connected, expired });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    );
  }
}
