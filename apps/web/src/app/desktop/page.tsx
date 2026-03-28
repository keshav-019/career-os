"use client";

import { CheckCircle2, Download, Laptop } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DesktopPlatform = "linux" | "unsupported" | "windows";

const PLATFORM_LABEL: Record<DesktopPlatform, string> = {
  windows: "Windows detected",
  linux: "Linux detected",
  unsupported: "Pick your platform on the releases page"
};

function detectDesktopPlatform(): DesktopPlatform {
  const navigatorWithUaData = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const platform = [
    navigatorWithUaData.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (platform.includes("win")) {
    return "windows";
  }

  if (platform.includes("linux") || platform.includes("x11")) {
    return "linux";
  }

  return "unsupported";
}

export default function DesktopSetupPage() {
  const [platform, setPlatform] = useState<DesktopPlatform>("unsupported");
  const downloadHref = useMemo(() => {
    const requestedPlatform = platform === "unsupported" ? "auto" : platform;
    return `/api/desktop/download?platform=${requestedPlatform}`;
  }, [platform]);
  const downloadLabel =
    platform === "windows"
      ? "Download Windows EXE"
      : platform === "linux"
        ? "Download Linux AppImage"
        : "Open Desktop Releases";

  useEffect(() => {
    setPlatform(detectDesktopPlatform());
  }, []);

  return (
    <div className="page-stack">
      <section className="career-card highlight desktop-exclusive-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">CareerOS Desktop</p>
            <h2>Unlock LaTeX Resume Studio and the Coding Arena</h2>
            <p>
              A handful of features need a local compiler and secure on-device execution, so they live in the free
              CareerOS Desktop companion app instead of the browser.
            </p>
          </div>
          <Laptop size={22} />
        </div>

        <div className="desktop-exclusive-benefits">
          <div className="topic-list">
            <div className="desktop-exclusive-row">
              <CheckCircle2 size={15} />
              <p>Resume Studio&apos;s LaTeX mode, with local compile and instant PDF preview.</p>
            </div>
            <div className="desktop-exclusive-row">
              <CheckCircle2 size={15} />
              <p>The Coding Arena&apos;s local compiler stack for C, C++, Java, JavaScript, Python, and Rust.</p>
            </div>
            <div className="desktop-exclusive-row">
              <CheckCircle2 size={15} />
              <p>Everything else - Applications, AI Match, Visual resumes, Interview War Room, and Learning Center - already works on web and mobile.</p>
            </div>
          </div>
        </div>

        <div className="desktop-exclusive-actions">
          <a
            className="primary-button"
            href={downloadHref}
            title="Download the latest installer from CareerOS GitHub Releases."
          >
            <Download size={14} /> {downloadLabel}
          </a>
          <span className="pill">{PLATFORM_LABEL[platform]}</span>
        </div>
      </section>
    </div>
  );
}
