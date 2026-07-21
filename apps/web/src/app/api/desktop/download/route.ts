import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DesktopPlatform = "linux" | "unsupported" | "windows";

type GitHubRelease = {
  assets?: Array<{
    browser_download_url?: string;
    name?: string;
  }>;
};

const DEFAULT_GITHUB_REPO = "keshav-019/career-os";

function getGitHubRepo(): string {
  const repo =
    process.env.CAREEROS_GITHUB_REPO ||
    process.env.NEXT_PUBLIC_CAREEROS_GITHUB_REPO ||
    process.env.GITHUB_REPOSITORY ||
    DEFAULT_GITHUB_REPO;

  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : DEFAULT_GITHUB_REPO;
}

function releaseFallbackUrl(repo: string): string {
  return `https://github.com/${repo}/releases/latest`;
}

function normalizePlatform(value: string | null): DesktopPlatform {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("win")) {
    return "windows";
  }

  if (normalized.includes("linux") || normalized.includes("x11")) {
    return "linux";
  }

  return "unsupported";
}

function detectPlatform(request: Request): DesktopPlatform {
  const url = new URL(request.url);
  const explicitPlatform = url.searchParams.get("platform");
  if (explicitPlatform && explicitPlatform !== "auto") {
    return normalizePlatform(explicitPlatform);
  }

  return normalizePlatform(request.headers.get("user-agent"));
}

function isInstallerAsset(assetName: string, platform: DesktopPlatform): boolean {
  const normalized = assetName.toLowerCase();
  if (normalized.includes("blockmap") || normalized.endsWith(".yml") || normalized.endsWith(".yaml")) {
    return false;
  }

  if (platform === "windows") {
    return normalized.endsWith(".exe");
  }

  if (platform === "linux") {
    return normalized.endsWith(".appimage");
  }

  return false;
}

async function getLatestRelease(repo: string): Promise<GitHubRelease> {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "CareerOS"
    },
    next: {
      revalidate: 300
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed with status ${response.status}.`);
  }

  return (await response.json()) as GitHubRelease;
}

export async function GET(request: Request) {
  const repo = getGitHubRepo();
  const platform = detectPlatform(request);

  if (platform === "unsupported") {
    return NextResponse.redirect(releaseFallbackUrl(repo), { status: 302 });
  }

  try {
    const release = await getLatestRelease(repo);
    const asset = release.assets?.find((releaseAsset) =>
      isInstallerAsset(releaseAsset.name || "", platform)
    );
    const downloadUrl = asset?.browser_download_url;

    if (downloadUrl) {
      return NextResponse.redirect(downloadUrl, { status: 302 });
    }
  } catch {
    return NextResponse.redirect(releaseFallbackUrl(repo), { status: 302 });
  }

  return NextResponse.redirect(releaseFallbackUrl(repo), { status: 302 });
}
