import type { ReactNode } from 'react';

/**
 * Mobile-first app frame: warm canvas behind, dark navy app column centred.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-canvas">
      <div className="flex min-h-dvh w-full max-w-md flex-col bg-app text-copy">{children}</div>
    </div>
  );
}
