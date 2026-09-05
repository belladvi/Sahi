import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: 'bg-action text-action-foreground hover:brightness-105',
  ghost: 'bg-transparent text-copy ring-1 ring-line hover:bg-app-raised',
};

export function PrimaryAction({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`w-full rounded-2xl px-5 py-3.5 text-base font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-app-raised disabled:text-copy-muted disabled:ring-1 disabled:ring-line disabled:hover:brightness-100 disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
