"use client";

import { noteHeadline } from "@/lib/notes";
import type { CalendarNote, CalendarNoteInput } from "@/lib/types";
import { useState } from "react";

const TARGET_CHIPS = [
  "Redfish",
  "Speckled Trout",
  "Snook",
  "Flounder",
  "Tarpon",
  "Mahi-mahi",
];

export function DayNotes({
  day,
  notes,
  onCreate,
  onUpdate,
  onDelete,
}: {
  day: string;
  notes: CalendarNote[];
  onCreate: (input: CalendarNoteInput) => void | Promise<void>;
  onUpdate: (id: string, input: CalendarNoteInput) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-teal">Planned trips</h3>
        {adding ? null : (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-teal"
          >
            Add note
          </button>
        )}
      </div>
      {notes.length === 0 && !adding ? (
        <p className="text-sm text-ink-muted">
          No photo needed. Add a note for this day — place, species, whatever you want to remember.
        </p>
      ) : null}
      {notes.map((note) =>
        editingId === note.id ? (
          <NoteForm
            key={note.id}
            day={day}
            initial={note}
            submitLabel="Save"
            onCancel={() => setEditingId(null)}
            onSubmit={async (input) => {
              await onUpdate(note.id, input);
              setEditingId(null);
            }}
          />
        ) : (
          <article key={note.id} className="journal-card rounded-2xl px-3 py-2">
            <p className="font-semibold">{noteHeadline(note)}</p>
            {note.placeName && note.title ? (
              <p className="text-sm text-ink-muted">{note.placeName}</p>
            ) : null}
            {note.speciesTargets.length ? (
              <p className="mt-1 flex flex-wrap gap-1">
                {note.speciesTargets.map((species) => (
                  <span
                    key={species}
                    className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper"
                  >
                    {species}
                  </span>
                ))}
              </p>
            ) : null}
            {note.notes ? <p className="mt-1 whitespace-pre-wrap text-sm">{note.notes}</p> : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setEditingId(note.id);
                }}
                className="text-xs font-semibold text-teal"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                className="text-xs font-semibold text-copper"
              >
                Delete
              </button>
            </div>
          </article>
        ),
      )}
      {adding ? (
        <NoteForm
          day={day}
          submitLabel="Save plan"
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            await onCreate(input);
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

function NoteForm({
  day,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  day: string;
  initial?: CalendarNote;
  submitLabel: string;
  onSubmit: (input: CalendarNoteInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [placeName, setPlaceName] = useState(initial?.placeName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [speciesTargets, setSpeciesTargets] = useState<string[]>(initial?.speciesTargets ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSpecies(name: string) {
    setSpeciesTargets((current) =>
      current.includes(name) ? current.filter((s) => s !== name) : [...current, name],
    );
  }

  return (
    <form
      className="journal-card space-y-2 rounded-2xl p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const input: CalendarNoteInput = {
          day,
          title: title.trim() || null,
          notes: notes.trim() || null,
          placeName: placeName.trim() || null,
          speciesTargets,
        };
        if (!input.title && !input.notes && !input.placeName && !speciesTargets.length) {
          setError("Add a title, note, place, or species.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await onSubmit(input);
        } catch {
          setError("Could not save that plan.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional) — Dawn flood"
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
      />
      <input
        value={placeName}
        onChange={(e) => setPlaceName(e.target.value)}
        placeholder="Place (optional)"
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes — tide, wind, what you want to try"
        rows={3}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {TARGET_CHIPS.map((name) => {
          const on = speciesTargets.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleSpecies(name)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                on ? "bg-copper text-white" : "border border-line bg-card text-ink-muted"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-copper">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
