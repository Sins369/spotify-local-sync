import { NextResponse } from "next/server";
import { connectSoulseek } from "@/lib/soulseek-client";
import { getSetting } from "@/lib/settings";

export async function POST() {
  try {
    const username = getSetting("soulseek_username");
    const password = getSetting("soulseek_password");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Soulseek credentials not configured" },
        { status: 400 }
      );
    }

    await connectSoulseek(username, password);

    return NextResponse.json({ success: true, connected: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
