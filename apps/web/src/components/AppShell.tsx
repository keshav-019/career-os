"use client";

import {
  AlarmClock,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
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
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/applications", label: "Applications", icon: Briefcase, badge: "24" },
      { href: "/resumes", label: "Resume Studio", icon: FileText }
    ]
  },
  {
    title: "Mission Prep",
    items: [
      { href: "/interview-prep", label: "Interview War Room", icon: Swords },
      { href: "/mock-tests", label: "Mock Tests", icon: FlaskConical },
      { href: "/learning", label: "Learning Center", icon: GraduationCap }
    ]
  },
  {
    title: "Insight",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/notifications", label: "Notifications", icon: Bell, badge: "3" },
      { href: "/integrations", label: "Integrations", icon: PanelLeftClose },
      { href: "/settings", label: "Settings", icon: Settings }
    ]
  }
];

const routeCopy: Record<string, { title: string; subtitle: string; action?: string }> = {
  "/": {
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
    subtitle: "OrbitWorks / Senior Product Engineer / next round queued.",
    action: "Start Simulation"
  },
  "/war-room": {
    title: "Interview War Room",
    subtitle: "Job-specific preparation, memory, questions, and follow-ups.",
    action: "Generate Prep"
  },
  "/resumes": {
    title: "Resume Studio",
    subtitle: "Visual editor / ATS scoring / version history.",
    action: "New Resume"
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Response rates, source performance, and career funnel health."
  },
  "/calendar": {
    title: "Calendar",
    subtitle: "Interview, follow-up, prep, and deadline reminders.",
    action: "Add Event"
  },
  "/notifications": {
    title: "Notifications",
    subtitle: "Priority career signals grouped by urgency."
  },
  "/learning": {
    title: "Learning Center",
    subtitle: "AI-tailored learning paths for your top skill gaps.",
    action: "Generate Plan"
  },
  "/mock-tests": {
    title: "Mock Tests",
    subtitle: "Practice sessions, scoring, and weak-topic drills.",
    action: "Start Mock"
  },
  "/integrations": {
    title: "Integrations",
    subtitle: "Chrome, Gmail, Calendar, Firebase, and mobile notification hooks."
  },
  "/settings": {
    title: "Settings",
    subtitle: "Profile, preferences, privacy, and automation controls."
  }
};

function getRouteCopy(pathname: string) {
  return routeCopy[pathname] ?? routeCopy["/"];
}

function getUserInitials(user: User | null) {
  const source = user?.displayName ?? user?.email ?? "CareerOS";
  const pieces = source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2);

  return pieces.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CO";
}

function SidebarNav({
  pathname,
  onNavigate,
  user,
  onSignOut
}: {
  pathname: string;
  onNavigate?: () => void;
  user: User | null;
  onSignOut: () => Promise<void>;
}) {
  const userName = user?.displayName ?? "CareerOS User";
  const userEmail = user?.email ?? "Signed in";
  const userInitials = getUserInitials(user);

  return (
    <>
      <Link className="career-brand" href="/" onClick={onNavigate}>
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
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

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
                    {item.badge ? <em>{item.badge}</em> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="career-profile">
        <div className="career-avatar">{userInitials}</div>
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
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuState, setMobileMenuState] = useState({ open: false, route: "" });
  const [lightMode, setLightMode] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(!isFirebaseClientConfigured || !auth);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const copy = useMemo(() => getRouteCopy(pathname), [pathname]);
  const isAuthRoute = pathname.startsWith("/login");
  const sidebarOpen = mobileMenuState.open && mobileMenuState.route === pathname;

  useEffect(() => {
    document.documentElement.classList.toggle("light-theme", lightMode);
  }, [lightMode]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
      router.replace("/");
    }
  }, [currentUser, isAuthResolved, isAuthRoute, router]);

  const handleSignOut = async () => {
    if (!auth) {
      return;
    }

    await signOut(auth);
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
        <SidebarNav pathname={pathname} user={currentUser} onSignOut={handleSignOut} />
      </aside>

      <div
        className={sidebarOpen ? "sidebar-scrim open" : "sidebar-scrim"}
        onClick={closeSidebar}
      />

      <aside className={sidebarOpen ? "mobile-sidebar open" : "mobile-sidebar"}>
        <SidebarNav
          pathname={pathname}
          onNavigate={closeSidebar}
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
              onClick={() => setLightMode((value) => !value)}
              type="button"
            >
              {lightMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button aria-label="Notifications" className="icon-button notification-button" type="button">
              <Bell size={17} />
              <span className="notification-dot" />
            </button>

            {copy.action ? (
              <button className="primary-button" type="button">
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
            ) : null}
          </div>
        </header>

        <div className="career-content">{children}</div>
      </main>
    </div>
  );
}
