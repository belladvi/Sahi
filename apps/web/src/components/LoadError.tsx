import { PrimaryAction } from './ui/PrimaryAction';

/**
 * Shared, branded "couldn't load" block (R1). Shown in place of a screen's
 * content when its initial data load fails or times out, with a Retry that
 * re-runs the load. Optional Home for a way out. No animation, so it is safe
 * under reduced-motion.
 */
export function LoadError({
  onRetry,
  onHome,
  title = 'Couldn’t load this',
  message = 'Something went wrong loading this page. Please check your connection and try again.',
}: {
  onRetry: () => void;
  onHome?: () => void;
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-app-raised text-2xl ring-1 ring-line" aria-hidden="true">
        ⚠️
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-copy">{title}</h2>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-copy-muted">{message}</p>
      </div>
      <div className="mt-2 w-full max-w-xs space-y-3">
        <PrimaryAction type="button" onClick={onRetry}>
          Try again
        </PrimaryAction>
        {onHome && (
          <PrimaryAction type="button" variant="ghost" onClick={onHome}>
            Go home
          </PrimaryAction>
        )}
      </div>
    </div>
  );
}
