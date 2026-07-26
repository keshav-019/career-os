"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

type ExtensionDownloadButtonProps = {
  browser: "chrome" | "firefox";
  className?: string;
  fileName: string;
  label: string;
};

type DownloadState = "idle" | "loading" | "success" | "error";

export function ExtensionDownloadButton({
  browser,
  className = "primary-button",
  fileName,
  label
}: ExtensionDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>("idle");
  const [message, setMessage] = useState("");

  const startDownload = async () => {
    setState("loading");
    setMessage(`Preparing ${browser === "chrome" ? "Chrome ZIP" : "Firefox XPI"}...`);

    try {
      const response = await fetch(`/api/extension/download?browser=${browser}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Package request failed with ${response.status}.`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Generated package was empty.");
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setState("success");
      setMessage(`${fileName} downloaded.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not download extension package.");
    }
  };

  return (
    <span className="extension-download-control">
      <button
        className={className}
        disabled={state === "loading"}
        onClick={() => void startDownload()}
        type="button"
      >
        {state === "loading" ? <Loader2 className="spin-icon" size={15} /> : <Download size={15} />}
        {state === "loading" ? "Preparing..." : label}
      </button>
      {message ? (
        <span aria-live="polite" className={`extension-download-status ${state}`}>
          {message}
        </span>
      ) : null}
    </span>
  );
}
