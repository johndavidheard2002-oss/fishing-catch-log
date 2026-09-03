import { APP_DISPLAY_NAME } from "@/lib/brand";

export function JournalUnavailable({ title }: { title: string }) {
  return (
    <div className="page-intro space-y-3">
      <h1 className="font-display text-3xl text-teal">{title}</h1>
      <p className="on-wash-chip text-sm">
        {APP_DISPLAY_NAME} could not open the journal just now. Home, Log, and Spots still work from
        this phone. If you are setting up the host, open <span className="font-semibold">/api/health</span>{" "}
        — that response has no secrets.
      </p>
    </div>
  );
}
