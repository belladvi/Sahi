interface Props {
  title: string;
  onBack?: () => void;
}

export function AppHeader({ title, onBack }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-line px-5 py-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="text-xl leading-none text-copy-muted hover:text-copy"
        >
          &larr;
        </button>
      )}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
