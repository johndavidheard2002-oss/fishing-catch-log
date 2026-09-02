"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FirstRunSetup } from "@/components/FirstRunSetup";
import { HelpButton, HelpGuide } from "@/components/HelpGuide";
import type { ProviderStatus } from "@/lib/types";

const NAV: {
  href: string;
  label: ReactNode;
  ariaLabel?: string;
  icon: () => ReactNode;
  primary?: boolean;
}[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/plan", label: "Plan", icon: PlanIcon },
  { href: "/log", label: "Log", icon: PlusIcon, primary: true },
  {
    href: "/calendar",
    label: (
      <>
        Calendar
        <span className="block">Log</span>
      </>
    ),
    ariaLabel: "Calendar Log",
    icon: CalendarIcon,
  },
  { href: "/spots", label: (
      <>
        Spots
        <span className="block">Bait</span>
      </>
    ), ariaLabel: "Spots and bait", icon: MapIcon },
  { href: "/backfill", label: "Backfill", icon: PastIcon },
];

function navIsActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/log") return pathname === "/log";
  if (href === "/backfill") {
    return pathname === "/backfill" || pathname.startsWith("/log/scan");
  }
  if (href === "/calendar") {
    return pathname === "/calendar" || pathname === "/history" || pathname.startsWith("/calendar/");
  }
  if (href === "/spots") {
    return pathname === "/spots" || pathname.startsWith("/bait");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navIndex(pathname: string) {
  return NAV.findIndex((item) => navIsActive(item.href, pathname));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    at: number;
    axis: "pending" | "x" | "y";
  } | null>(null);
  const animating = useRef(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const idx = navIndex(pathname);
    if (idx > 0) router.prefetch(NAV[idx - 1].href);
    if (idx >= 0 && idx < NAV.length - 1) router.prefetch(NAV[idx + 1].href);
  }, [pathname, router]);

  useEffect(() => {
    animating.current = false;
    const pane = paneRef.current;
    if (!pane) return;
    pane.style.transition = "none";
    pane.style.transform = "translate3d(0,0,0)";
  }, [pathname]);

  useEffect(() => {
    const root = shellRef.current;
    const pane = paneRef.current;
    if (!root || !pane) return;
    const shell = root;
    const track = pane;

    function setPaneX(x: number, withTransition: boolean) {
      track.style.transition = withTransition
        ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
      track.style.transform = `translate3d(${x}px,0,0)`;
    }

    function rubber(dx: number, idx: number) {
      const atStart = idx <= 0 && dx > 0;
      const atEnd = idx >= NAV.length - 1 && dx < 0;
      if (atStart || atEnd) return dx * 0.28;
      return dx;
    }

    function ignoreTarget(target: EventTarget | null) {
      return Boolean(
        (target as HTMLElement | null)?.closest?.(
          ".leaflet-container, input, textarea, select, [data-no-tab-swipe]",
        ),
      );
    }

    function onStart(e: TouchEvent) {
      if (animating.current || e.touches.length !== 1 || ignoreTarget(e.target)) {
        gesture.current = null;
        return;
      }
      const t = e.touches[0];
      gesture.current = { x: t.clientX, y: t.clientY, at: Date.now(), axis: "pending" };
    }

    function onMove(e: TouchEvent) {
      const g = gesture.current;
      if (!g || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (g.axis === "pending") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        g.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
        if (g.axis === "y") return;
      }
      if (g.axis !== "x") return;
      if (e.cancelable) e.preventDefault();
      const idx = navIndex(pathnameRef.current);
      setPaneX(rubber(dx, idx), false);
    }

    function finish(e: TouchEvent) {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.axis !== "x") {
        setPaneX(0, true);
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - g.x;
      const dt = Math.max(1, Date.now() - g.at);
      const idx = navIndex(pathnameRef.current);
      const width = shell.getBoundingClientRect().width || 360;
      const next = dx < 0 ? idx + 1 : idx - 1;
      const canMove = next >= 0 && next < NAV.length;
      const farEnough = Math.abs(dx) > Math.max(56, width * 0.18);
      const flicked = Math.abs(dx / dt) > 0.42 && Math.abs(dx) > 28;
      if (canMove && (farEnough || flicked) && !prefersReducedMotion()) {
        animating.current = true;
        setPaneX(dx < 0 ? -width : width, true);
        const href = NAV[next].href;
        window.setTimeout(() => router.push(href), 260);
        window.setTimeout(() => {
          if (!animating.current) return;
          animating.current = false;
          setPaneX(0, true);
        }, 900);
        return;
      }
      if (canMove && (farEnough || flicked) && prefersReducedMotion()) {
        setPaneX(0, false);
        router.push(NAV[next].href);
        return;
      }
      setPaneX(0, true);
    }

    shell.addEventListener("touchstart", onStart, { passive: true });
    shell.addEventListener("touchmove", onMove, { passive: false });
    shell.addEventListener("touchend", finish);
    shell.addEventListener("touchcancel", finish);
    return () => {
      shell.removeEventListener("touchstart", onStart);
      shell.removeEventListener("touchmove", onMove);
      shell.removeEventListener("touchend", finish);
      shell.removeEventListener("touchcancel", finish);
    };
  }, [router]);

  const demo =
    status &&
    (status.weather === "demo" ||
      status.forecast === "demo" ||
      status.tides === "demo");

  return (
    <>
    <div className="trout-wash-bg" aria-hidden="true" />
    <div
      ref={shellRef}
      className="relative z-[1] mx-auto flex min-h-full max-w-lg flex-col overflow-x-clip px-4 pb-28 pt-4"
    >
      <div ref={paneRef} className="tab-swipe-pane flex min-h-0 flex-1 flex-col">
        <header className="journal-card mb-4 flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-teal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192.png"
              alt=""
              width={32}
              height={32}
              className="brand-mark"
            />
            <span className="font-display text-2xl tracking-tight">
              Catch Compass
              <span className="ml-2 font-body text-xs font-normal tracking-wide text-ink-muted uppercase">
                Saltwater Logbook
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <HelpButton />
            {demo ? (
              <span className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-muted">
                Demo APIs
              </span>
            ) : null}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
      <nav className="bottom-nav fixed right-0 bottom-0 left-0 z-20 mx-auto max-w-lg rounded-t-2xl" data-no-tab-swipe>
        <ul className="grid grid-cols-6 px-0.5 pt-2">
          {NAV.map((item) => {
            const active = navIsActive(item.href, pathname);
            const Icon = item.icon;
            const tone = item.primary ? "nav-primary" : active ? "nav-active" : "nav-idle";
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-label={item.ariaLabel ?? (typeof item.label === "string" ? item.label : undefined)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] leading-tight ${tone}`}
                >
                  <span className="nav-icon flex h-8 w-8 items-center justify-center rounded-full">
                    <Icon />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    <HelpGuide />
    <FirstRunSetup />
    </>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 14h.01M12 14h.01M15 14h.01M9 17h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function PastIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 9v4l2.5 1.5M9 4h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="8" y="13" width="4" height="4" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
