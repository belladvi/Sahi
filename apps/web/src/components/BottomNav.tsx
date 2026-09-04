interface Item {
  label: string;
  key: string;
}

const items: Item[] = [
  { label: 'Home', key: 'home' },
  { label: 'Status', key: 'status' },
  { label: 'Profile', key: 'profile' },
];

/**
 * Presentational bottom nav for the app shell. Wired to real routes as
 * screens land in later tickets.
 */
export function BottomNav({ active = 'home' }: { active?: string }) {
  return (
    <nav className="mt-auto flex border-t border-line bg-app">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          className={`flex-1 py-3 text-center text-sm ${
            i.key === active ? 'text-action' : 'text-copy-muted'
          }`}
        >
          {i.label}
        </button>
      ))}
    </nav>
  );
}
