import { useEffect, useState, type FormEvent } from 'react';
import { APP_NAME, createNoteSchema, type Note } from '@sahi/shared';

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
    // Validate with the SAME schema the server uses.
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
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>{APP_NAME}</h1>
      <p>FSSAI registration for Bangalore home bakers — walking skeleton.</p>

      <section
        style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}
      >
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Database connectivity demo (temporary)</h2>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>
          Proves web → API → Neon Postgres round-trips using one shared Zod schema. This block is
          replaced by the real screens starting at ticket 06.
        </p>
        <form onSubmit={addNote} style={{ display: 'flex', gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a note…"
            aria-label="Note text"
            style={{ flex: 1, padding: 8 }}
          />
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
        {error && (
          <p role="alert" style={{ color: '#c00', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}
        <ul data-testid="notes">
          {notes.map((n) => (
            <li key={n.id}>{n.text}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
