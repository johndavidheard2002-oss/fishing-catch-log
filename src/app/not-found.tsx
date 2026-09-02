import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-intro space-y-2">
      <h1 className="font-display text-3xl text-teal">Page not in the journal</h1>
      <p className="text-ink-muted">That catch or route is gone.</p>
      <Link href="/calendar" className="inline-block text-sm font-semibold text-teal">
        Back to Calendar Log
      </Link>
    </div>
  );
}
