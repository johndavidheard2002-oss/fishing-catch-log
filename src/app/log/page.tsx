import { CatchForm } from "@/components/CatchForm";

export default function LogPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">Log a catch</h1>
        <p className="text-sm text-ink-muted">
          Photo first. Species, weather, and place fill in when they can — everything stays
          editable.
        </p>
      </div>
      <CatchForm mode="create" />
    </div>
  );
}
