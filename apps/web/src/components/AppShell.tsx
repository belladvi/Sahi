import type { ReactNode } from 'react';

/**
 * Mobile-first app frame.
 *
 * On a phone (< sm) it fills the screen edge-to-edge. On a larger screen it
 * renders inside a centred phone-device bezel (~390×844) so the mobile app
 * reads as an app instead of a tall ribbon stretched down a desktop window.
 * Content scrolls inside the frame, not the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-canvas sm:items-center sm:p-6">
      <div className="relative h-dvh w-full max-w-md overflow-hidden bg-app sm:h-[844px] sm:max-h-[calc(100dvh-3rem)] sm:w-[390px] sm:rounded-[2.75rem] sm:border-[10px] sm:border-black sm:shadow-2xl sm:ring-1 sm:ring-white/10">
        {/* Notch — desktop bezel only */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-black sm:block" />
        <div className="flex h-full flex-col overflow-y-auto text-copy">{children}</div>
      </div>
    </div>
  );
}
