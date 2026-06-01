import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST() {
  try {
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select folder'; $dialog.ShowNewFolderButton = $true; if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath } else { '' }`;

    const result = execSync(`powershell -Command "${psCommand}"`, {
      encoding: "utf-8",
      timeout: 60000,
    }).trim();

    if (!result) {
      return NextResponse.json({ path: null });
    }

    return NextResponse.json({ path: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to open folder picker",
      },
      { status: 500 },
    );
  }
}
