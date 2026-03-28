import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerOS",
  description: "A career command center for applications, resumes, interviews, learning, and analytics.",
  icons: {
    // The favicon is always the dark-mode mark by default, regardless of OS/browser theme - only the in-app
    // sidebar logo swaps with the in-app theme toggle (see AppShell.tsx). Browser tabs can't react to that toggle
    // anyway since it's just page-level React state, not a page reload.
    icon: [{ url: "/careeros-dark-mode.png", type: "image/png" }],
    shortcut: [{ url: "/careeros-dark-mode.png", type: "image/png" }],
    apple: [{ url: "/careeros-dark-mode.png", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
