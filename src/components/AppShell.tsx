"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  { href: "/backfill", label: "Backfill", icon: PastIcon },
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
  { href: "/spots", label: "Spots", icon: MapIcon },
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
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ProviderStatus | null>(null);

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

  const demo =
    status &&
    (status.weather === "demo" ||
      status.forecast === "demo" ||
      status.tides === "demo");

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 pb-28 pt-4">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <Link href="/" className="font-display text-2xl tracking-tight text-teal">
          Catch Compass
          <span className="ml-2 font-body text-xs font-normal tracking-wide text-ink-muted uppercase">
            Automatic Logbook
          </span>
        </Link>
        {demo ? (
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-muted">
            Demo APIs
          </span>
        ) : null}
      </header>
      <main className="flex-1">{children}</main>
      <nav className="bottom-nav journal-card fixed right-0 bottom-0 left-0 z-20 mx-auto max-w-lg rounded-t-2xl">
        <ul className="grid grid-cols-6 px-0.5 pt-2">
          {NAV.map((item) => {
            const active = navIsActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-label={item.ariaLabel ?? (typeof item.label === "string" ? item.label : undefined)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] leading-tight ${
                    item.primary
                      ? "text-copper"
                      : active
                        ? "text-teal"
                        : "text-ink-muted"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      item.primary ? "bg-copper text-white" : active ? "bg-paper-deep" : ""
                    }`}
                  >
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
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 14h.01M12 14h.01M15 14h.01M9 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PastIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9v4l2.5 1.5M9 4h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="8" y="13" width="4" height="4" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
