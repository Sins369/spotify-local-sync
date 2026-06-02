import { NextResponse } from "next/server";
import { cancelBulk } from "@/lib/bulk-downloader";

export async function POST() {
  cancelBulk();
  return NextResponse.json({ cancelled: true });
}
