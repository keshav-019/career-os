"use client";

import {
  AlarmClock,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  CircleUserRound,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Swords,
  Sun,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import {
  PROFILE_CHANGE_EVENT,
  PROFILE_SAVE_REQUEST_EVENT,
  THEME_CHANGE_EVENT,
  readProfileNamePreference,
  readProfilePhotoPreference,
  readThemePreference,
  writeThemePreference
} from "@/lib/preferences";
import { useUserJobs } from "@/lib/firebase/jobs";
import {
  clearLocalAdminSessions,
  readLocalAdminSession,
  type LocalAdminSession
} from "@/lib/local-admin-session";
import { sanitizeExternalUrl } from "@/lib/url-safety";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Command",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/applications", label: "Applications", icon: Briefcase },
      { href: "/resumes", label: "Resume Studio", icon: FileText }
    ]
  },
  {
    title: "Mission Prep",
    items: [
      { href: "/interview-prep", label: "Interview War Room", icon: Swords },
      { href: "/learning", label: "Learning Center", icon: GraduationCap }
    ]
  },
  {
    title: "Insight",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/profile", label: "Profile", icon: CircleUserRound },
      { href: "/settings", label: "Settings", icon: Settings }
    ]
  }
];

type ApplicationPipelineStats = {
  applied: number;
  archived: number;
  interviewing: number;
  offer: number;
  rejected: number;
  saved: number;
};

type ShellUser = Pick<User, "displayName" | "email" | "photoURL"> & {
  isLocalAdmin?: boolean;
};

function summarizeApplicationPipeline(stats: ApplicationPipelineStats): string {
  const inLine = stats.saved + stats.applied + stats.interviewing;
  const closed = stats.rejected + stats.archived;

  if (inLine + stats.offer + closed === 0) {
    return "No applications in line yet. Save your first role to begin tracking.";
  }

  return `${inLine} in line / ${stats.interviewing} interviewing / ${stats.offer} offers / ${closed} closed`;
}

const routeCopy: Record<string, { title: string; subtitle: string; action?: string }> = {
  "/dashboard": {
    title: "Dashboard Overview",
    subtitle: "Real-time intelligence for your career journey.",
    action: "New Application"
  },
  "/applications": {
    title: "Applications",
    subtitle: "9 active / 1 offer pending / last sync 2m ago via Chrome Extension",
    action: "New Application"
  },
  "/jobs": {
    title: "Applications",
    subtitle: "Saved jobs, interviews, offers, and follow-up queue.",
    action: "Add Job"
  },
  "/interview-prep": {
    title: "Interview War Room",
    subtitle: "Zero-AI practice tracks, Firestore-backed attempts, and timed test launches.",
    action: "Start Simulation"
  },
  "/war-room": {
    title: "Interview War Room",
    subtitle: "Job-specific preparation, memory, questions, and follow-ups.",
    action: "Generate Prep"
  },
  "/resumes": {
    title: "Resume Studio",
    subtitle: "Desktop-exclusive workspace for resume creation, editing, and exports."
  },
  "/resumes/new": {
    title: "Resume Studio",
    subtitle: "Open the Desktop app to create or edit resume versions."
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Date-filtered test performance, score trends, and topic-level strengths."
  },
  "/calendar": {
    title: "Calendar",
    subtitle: "Private CareerOS calendar for interviews, prep, and deadlines."
  },
  "/profile": {
    title: "Career Profile",
    subtitle: "Your personal profile, preferences, education, projects, and achievements.",
    action: "Update Profile"
  },
  "/learning": {
    title: "Learning Center",
    subtitle: "AI-tailored learning paths for your top skill gaps.",
    action: "Generate Plan"
  },
  "/test-room": {
    title: "Test Room",
    subtitle: "Immersive timer-based practice in progress."
  },
  "/settings": {
    title: "Settings",
    subtitle: "Security, privacy, preferences, and account controls."
  },
  "/desktop": {
    title: "CareerOS Desktop",
    subtitle: "Desktop helper setup for local LaTeX compile and advanced resume features."
  }
};

function getRouteCopy(pathname: string, pipelineStats: ApplicationPipelineStats) {
  if (pathname.startsWith("/test-room")) {
    return routeCopy["/test-room"] ?? routeCopy["/dashboard"];
  }

  if (pathname === "/applications") {
    const baseCopy = routeCopy[pathname] ?? routeCopy["/dashboard"];
    return {
      ...baseCopy,
      subtitle: summarizeApplicationPipeline(pipelineStats)
    };
  }

  return routeCopy[pathname] ?? routeCopy["/dashboard"];
}

function toLocalAdminShellUser(session: LocalAdminSession): ShellUser {
  return {
    displayName: session.displayName,
    email: session.email,
    photoURL: null,
    isLocalAdmin: true
  };
}

function getUserInitials(user: ShellUser | null, profileNameOverride: string | null) {
  const source = getUserDisplayName(user, profileNameOverride);
  const pieces = source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2);

  return pieces.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CO";
}

function getUserDisplayName(user: ShellUser | null, profileNameOverride: string | null) {
  if (profileNameOverride?.trim()) {
    return profileNameOverride.trim();
  }

  if (user?.displayName?.trim()) {
    return user.displayName.trim();
  }

  const emailPrefix = user?.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!emailPrefix) {
    return "CareerOS User";
  }

  return emailPrefix
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function SidebarNav({
  applicationsInLineCount,
  pathname,
  onNavigate,
  profileNameOverride,
  profilePhotoOverride,
  user,
  onSignOut
}: {
  applicationsInLineCount: number;
  pathname: string;
  onNavigate?: () => void;
  profileNameOverride: string | null;
  profilePhotoOverride: string | null;
  user: ShellUser | null;
  onSignOut: () => Promise<void>;
}) {
  const userName = getUserDisplayName(user, profileNameOverride);
  const userEmail = user?.email ?? "Signed in";
  const userInitials = getUserInitials(user, profileNameOverride);
  const userPhotoUrl = sanitizeExternalUrl(profilePhotoOverride || user?.photoURL || "");

  return (
    <>
      <Link className="career-brand" href="/dashboard" onClick={onNavigate}>
        <span className="career-brand-mark">
          <Sparkles size={17} />
        </span>
        <span>
          <strong>CareerOS</strong>
          <small>v1.0 / PRO</small>
        </span>
      </Link>

      <nav className="career-nav" aria-label="Primary navigation">
        {navSections.map((section) => (
          <section className="career-nav-section" key={section.title}>
            <p>{section.title}</p>
            <div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                const badge = item.href === "/applications" ? String(applicationsInLineCount) : item.badge;

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? "career-nav-item active" : "career-nav-item"}
                    href={item.href}
                    key={item.href}
                    onClick={onNavigate}
                  >
                    <Icon size={17} strokeWidth={1.85} />
                    <span>{item.label}</span>
                    {badge ? <em>{badge}</em> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="career-profile">
        <div className="career-avatar">
          {userPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${userName} profile`} className="career-avatar-image" loading="lazy" src={userPhotoUrl} />
          ) : (
            userInitials
          )}
        </div>
        <div>
          <strong>{userName}</strong>
          <span>{userEmail}</span>
        </div>
        <button aria-label="Sign out" className="profile-signout" onClick={() => void onSignOut()} type="button">
          <LogOut size={14} />
        </button>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { jobs } = useUserJobs();
  const pathname = usePathname();
  const router = useRouter();
  const initialLocalAdminSession = readLocalAdminSession();
  const [mobileMenuState, setMobileMenuState] = useState({ open: false, route: "" });
  const [lightMode, setLightMode] = useState(false);
  const [profileNameOverride, setProfileNameOverride] = useState<string | null>(null);
  const [profilePhotoOverride, setProfilePhotoOverride] = useState<string | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(
    Boolean(initialLocalAdminSession) || !isFirebaseClientConfigured || !auth
  );
  const [currentUser, setCurrentUser] = useState<ShellUser | null>(
    initialLocalAdminSession ? toLocalAdminShellUser(initialLocalAdminSession) : null
  );
  const pipelineStats = useMemo<ApplicationPipelineStats>(() => {
    return jobs.reduce<ApplicationPipelineStats>(
      (stats, job) => {
        if (job.status === "saved") {
          stats.saved += 1;
        } else if (job.status === "applied") {
          stats.applied += 1;
        } else if (job.status === "interviewing") {
          stats.interviewing += 1;
        } else if (job.status === "offer") {
          stats.offer += 1;
        } else if (job.status === "rejected") {
          stats.rejected += 1;
        } else {
          stats.archived += 1;
        }

        return stats;
      },
      { saved: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0, archived: 0 }
    );
  }, [jobs]);
  const applicationsInLineCount = pipelineStats.saved + pipelineStats.applied + pipelineStats.interviewing;
  const copy = useMemo(() => getRouteCopy(pathname, pipelineStats), [pathname, pipelineStats]);
  const isPrimaryActionDisabled =
    copy.action === "Start Simulation" || copy.action === "Generate Plan";
  const isAuthRoute = pathname.startsWith("/login");
  const isTestRoomRoute = pathname.startsWith("/test-room");
  const sidebarOpen = mobileMenuState.open && mobileMenuState.route === pathname;

  useEffect(() => {
    let animationFrameId: number | null = null;

    const onProfilePreferenceChange = () => {
      setProfileNameOverride(readProfileNamePreference());
      setProfilePhotoOverride(readProfilePhotoPreference());
    };

    animationFrameId = window.requestAnimationFrame(onProfilePreferenceChange);
    window.addEventListener(PROFILE_CHANGE_EVENT, onProfilePreferenceChange as EventListener);
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener(PROFILE_CHANGE_EVENT, onProfilePreferenceChange as EventListener);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const applyThemePreference = (preference: string | null) => {
      if (preference === "light") {
        setLightMode(true);
      } else if (preference === "dark") {
        setLightMode(false);
      }
    };

    animationFrameId = window.requestAnimationFrame(() => {
      applyThemePreference(readThemePreference());
    });

    const onThemePreferenceChange = (event: Event) => {
      applyThemePreference((event as CustomEvent<string>).detail ?? null);
    };

    window.addEventListener(THEME_CHANGE_EVENT, onThemePreferenceChange as EventListener);
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener(THEME_CHANGE_EVENT, onThemePreferenceChange as EventListener);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light-theme", lightMode);
  }, [lightMode]);

  useEffect(() => {
    const localAdminSession = readLocalAdminSession();
    if (localAdminSession) {
      return;
    }

    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const refreshedLocalAdminSession = readLocalAdminSession();
      if (refreshedLocalAdminSession) {
        setCurrentUser(toLocalAdminShellUser(refreshedLocalAdminSession));
        setIsAuthResolved(true);
        return;
      }

      setCurrentUser(user);
      setIsAuthResolved(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isFirebaseClientConfigured || !isAuthResolved) {
      return;
    }

    if (!currentUser && !isAuthRoute) {
      router.replace("/login");
      return;
    }

    if (currentUser && isAuthRoute) {
      router.replace("/dashboard");
    }
  }, [currentUser, isAuthResolved, isAuthRoute, router]);

  const handleSignOut = async () => {
    clearLocalAdminSessions();
    await fetch("/api/learning/admin/session", {
      method: "DELETE"
    }).catch(() => {
      // Ignore local admin cookie cleanup failures during sign-out.
    });

    if (auth?.currentUser) {
      await signOut(auth);
    }

    setCurrentUser(null);
    router.replace("/login");
  };

  const toggleSidebar = () => {
    setMobileMenuState((state) =>
      state.open && state.route === pathname
        ? { open: false, route: pathname }
        : { open: true, route: pathname }
    );
  };

  const closeSidebar = () => {
    setMobileMenuState({ open: false, route: pathname });
  };

  const toggleTheme = () => {
    setLightMode((current) => {
      const next = !current;
      writeThemePreference(next ? "light" : "dark");
      return next;
    });
  };

  const handlePrimaryAction = () => {
    if (!copy.action) {
      return;
    }

    if (copy.action === "Start Simulation" || copy.action === "Generate Plan") {
      return;
    }

    if (copy.action === "Update Profile") {
      window.dispatchEvent(new Event(PROFILE_SAVE_REQUEST_EVENT));
    }
  };

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (isFirebaseClientConfigured && (!isAuthResolved || !currentUser)) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-card">
          <Sparkles size={18} />
          <p>Checking your session...</p>
        </div>
      </div>
    );
  }

  if (isTestRoomRoute) {
    return <div className="test-room-immersive-shell">{children}</div>;
  }

  return (
    <div className="career-shell">
      <button
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={sidebarOpen}
        className="mobile-menu-button"
        onClick={toggleSidebar}
        type="button"
      >
        {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      <aside className="career-sidebar">
        <SidebarNav
          applicationsInLineCount={applicationsInLineCount}
          pathname={pathname}
          profileNameOverride={profileNameOverride}
          profilePhotoOverride={profilePhotoOverride}
          user={currentUser}
          onSignOut={handleSignOut}
        />
      </aside>

      <div
        className={sidebarOpen ? "sidebar-scrim open" : "sidebar-scrim"}
        onClick={closeSidebar}
      />

      <aside className={sidebarOpen ? "mobile-sidebar open" : "mobile-sidebar"}>
        <SidebarNav
          applicationsInLineCount={applicationsInLineCount}
          pathname={pathname}
          onNavigate={closeSidebar}
          profileNameOverride={profileNameOverride}
          profilePhotoOverride={profilePhotoOverride}
          user={currentUser}
          onSignOut={handleSignOut}
        />
      </aside>

      <main className="career-main">
        <header className="career-topbar">
          <div className="topbar-copy">
            <p className="eyebrow">CareerOS</p>
            <h1>{copy.title}</h1>
            <span>{copy.subtitle}</span>
          </div>

          <div className="topbar-actions">
            <label className="career-search">
              <Search size={16} />
              <input placeholder="Search jobs, resumes, notes..." />
            </label>

            <button
              aria-label="Toggle color theme"
              className="icon-button"
              onClick={toggleTheme}
              type="button"
            >
              {lightMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {copy.action ? (
              <span className={isPrimaryActionDisabled ? "instant-tooltip-wrap" : undefined}>
                <button
                  aria-disabled={isPrimaryActionDisabled}
                  className="primary-button"
                  disabled={isPrimaryActionDisabled}
                  onClick={handlePrimaryAction}
                  type="button"
                >
                  {pathname.includes("interview") || pathname.includes("war-room") ? (
                    <Swords size={16} />
                  ) : pathname.includes("learning") ? (
                    <BookOpen size={16} />
                  ) : pathname.includes("calendar") ? (
                    <AlarmClock size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {copy.action}
                </button>
                {isPrimaryActionDisabled ? (
                  <span className="instant-tooltip" role="status">
                    This feature is still in development.
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </header>

        <div className="career-content">{children}</div>
      </main>
    </div>
  );
}
