import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Busy state: shows a spinner, marks aria-busy and blocks re-entry while an
   * async action runs. The label stays visible ("Checking status…"). */
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  primary: 'bg-action text-action-foreground hover:brightness-105',
  ghost: 'bg-transparent text-copy ring-1 ring-line hover:bg-app-raised',
};

export function PrimaryAction({
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}: Props) {
  // A truly-disabled button is muted; a busy button keeps its brand colour and
  // shows a spinner (so it reads as "working", not "unavailable").
  const mutedWhenDisabled =
    disabled && !loading
      ? ' disabled:bg-app-raised disabled:text-copy-muted disabled:ring-1 disabled:ring-line disabled:hover:brightness-100'
      : '';

  return (
    <button
      aria-busy={loading}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold transition duration-[var(--dur-base)] ease-[var(--ease-standard)] active:scale-[0.99] disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]}${mutedWhenDisabled} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
