"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MissingOnSpotifyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sync");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-[#94A3B8]">Redirecting to Sync...</p>
    </div>
  );
}
