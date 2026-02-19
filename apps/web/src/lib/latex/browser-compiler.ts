"use client";

import { compileLatexWithDesktopHelper } from "@/lib/latex/desktop-helper-compiler";

export type BrowserLatexEngine = "desktop-helper";

export async function compileLatexWithBrowserEngines(sourceCode: string): Promise<{
  dataUri: string;
  engine: BrowserLatexEngine;
}> {
  const desktopDataUri = await compileLatexWithDesktopHelper(sourceCode);
  return {
    dataUri: desktopDataUri,
    engine: "desktop-helper"
  };
}
