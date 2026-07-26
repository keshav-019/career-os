import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerOS",
  description: "A career command center for applications, resumes, interviews, learning, and analytics.",
  verification: {
    google: "vP4YTtwACHxzj41UdbZX3dlzZCi1frv5Ah0-Td1-BtI"
  },
  icons: {
    // The favicon is always the dark-mode mark by default, regardless of OS/browser theme - only the in-app
    // sidebar logo swaps with the in-app theme toggle (see AppShell.tsx). Browser tabs can't react to that toggle
    // anyway since it's just page-level React state, not a page reload.
    icon: [{ url: "/careeros-dark-mode.png", type: "image/png" }],
    shortcut: [{ url: "/careeros-dark-mode.png", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CareerOS"
  }
};

// Separate from `metadata` per Next.js's App Router convention (themeColor moved here in Next 14+).
export const viewport: Viewport = {
  themeColor: "#101114"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
