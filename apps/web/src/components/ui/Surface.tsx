import type { HTMLAttributes } from 'react';

export function Surface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl bg-app-raised p-4 ring-1 ring-line ${className}`}
      {...props}
    />
  );
}
