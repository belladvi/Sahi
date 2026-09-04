import { useEffect, useState, type FormEvent } from 'react';
import { APP_NAME, createNoteSchema, type Note } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { BottomNav } from '../components/BottomNav';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadNotes() {
    try {
      const res = await fetch(`${API_BASE}/api/notes`);
      if (res.ok) setNotes((await res.json()) as Note[]);
    } catch {
      /* offline / API down — leave list as-is */
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    const parsed = createNoteSchema.safeParse({ text });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid note');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        setText('');
        await loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title={APP_NAME} />
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <section className="space-y-1">
          <h2 className="text-2xl font-bold leading-tight">
            Your FSSAI licence, <span className="text-action">done for you</span>.
          </h2>
          <p className="text-sm text-copy-muted">
            From “do I even need one?” to a real registration — for Bangalore home bakers.
          </p>
        </section>

        <Surface>
          <h3 className="text-sm font-semibold">Design-system + DB demo (temporary)</h3>
          <p className="mt-1 text-xs text-copy-muted">
            The dark-navy + yellow kit and a live web → API → Neon round-trip. Real screens land
            from ticket 06.
          </p>
          <form onSubmit={addNote} className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a note…"
              aria-label="Note text"
              className="flex-1 rounded-xl bg-app px-3 py-2 text-sm text-copy ring-1 ring-line outline-none placeholder:text-copy-muted"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-action px-4 py-2 text-sm font-semibold text-action-foreground disabled:opacity-50"
            >
              {saving ? '…' : 'Add'}
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
          <ul data-testid="notes" className="mt-3 space-y-1 text-sm text-copy-muted">
            {notes.map((n) => (
              <li key={n.id}>• {n.text}</li>
            ))}
          </ul>
        </Surface>

        <PrimaryAction type="button">Check if I need a licence</PrimaryAction>
      </div>
      <BottomNav active="home" />
    </AppShell>
  );
}
