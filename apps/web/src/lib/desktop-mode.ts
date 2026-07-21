export function isDesktopAppEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CAREEROS_DESKTOP_APP === "1" || process.env.CAREEROS_DESKTOP_APP === "1";
}

