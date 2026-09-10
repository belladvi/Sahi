/**
 * VerifyCodeStep.tsx — passwordless "Verify code" screen (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Ported from the case-study mockup `sahi_verify_otp.html`. Self-contained and
 * additive: no router, auth, storage or shared-component coupling. The only
 * external import is the shadcn Button — this repo has no shadcn `Button` and no
 * `@/` path alias (the other steps use a plain <button>), so `Button` is a bare
 * native button element, used exactly like the shadcn Button.
 *
 * Interactions (all motion gated by useReducedMotion / prefers-reduced-motion):
 *   - Six OTP cells: typing auto-advances, Backspace steps back, Arrow keys move,
 *     paste fills all cells, and OS one-time-code autofill spreads across cells.
 *   - Active cell shows a gold caret + focus glow; a filled cell pops with a gold
 *     border; the sixth digit triggers a staggered completion wave + haptic.
 *   - `error` shakes the row red. The resend timer counts down then enables Resend.
 *   - CTA enables only at 6 digits, with glow pulse + shimmer + magnetic pull +
 *     tap ripple, and shows "Verifying…" while onVerify is in flight.
 *
 * USAGE:
 *   <VerifyCodeStep
 *     destination="+91 98765 43210"
 *     error={otpFailed}
 *     onChangeContact={() => navigate(-1)}
 *     onResend={() => resendOtp()}
 *     onVerify={(code) => verifyOtp(code)}
 *     onBack={() => navigate(-1)} />
 *
 * `demo` (dev/preview only — never in production) shows the "code pre-filled"
 * banner and fills a preview code when no `prefillCode` is supplied. In the real
 * app the server's demo code is passed via `prefillCode`. Server-side OTP
 * validation always runs regardless of any client-side check here.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'motion/react';

const Button = 'button' as const;

const LEN = 6;

export interface VerifyCodeStepProps {
  /** Where the code was sent — e.g. "+91 98765 43210" or an email address. */
  destination: string;
  /** Set true to shake the cells red on a wrong/expired code. */
  error?: boolean;
  /** Optional message shown under the cells (wrong code, conflict, network…). */
  errorMessage?: string | null;
  /** Dev/preview only — never true in production. Shows the demo banner and, if
   *  no `prefillCode` is given, fills a preview code so the screen can be demoed
   *  without a server. */
  demo?: boolean;
  /** A code to pre-fill into the cells (the server's demo code, when present). */
  prefillCode?: string;
  onChangeContact?: () => void;
  onResend?: () => void;
  onVerify?: (code: string) => void | Promise<void>;
  onBack?: () => void;
}

const PREVIEW_CODE = '135790';
const RESEND_SECONDS = 30;

function toCells(raw: string | undefined): string[] {
  const digits = (raw ?? '').replace(/\D/g, '').slice(0, LEN).split('');
  return Array.from({ length: LEN }, (_, i) => digits[i] ?? '');
}

export default function VerifyCodeStep({
  destination,
  error = false,
  errorMessage = null,
  demo = false,
  prefillCode,
  onChangeContact,
  onResend,
  onVerify,
  onBack,
}: VerifyCodeStepProps) {
  const reduce = useReducedMotion();

  const initial = useMemo(() => {
    if (prefillCode && prefillCode.replace(/\D/g, '').length) return toCells(prefillCode);
    if (demo) return toCells(PREVIEW_CODE);
    return toCells('');
  }, [prefillCode, demo]);

  const [cells, setCells] = useState<string[]>(initial);
  const [popped, setPopped] = useState<number | null>(null);
  const [waving, setWaving] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [secs, setSecs] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const code = cells.join('');
  const full = cells.every((c) => c !== '');

  // If a prefilled code arrives (server demo code fetched after mount), adopt it.
  useEffect(() => {
    if (prefillCode && prefillCode.replace(/\D/g, '').length) setCells(toCells(prefillCode));
  }, [prefillCode]);

  // Wrong-code shake: fire whenever `error` flips true.
  useEffect(() => {
    if (!error) return;
    if (reduce) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 420);
    return () => clearTimeout(t);
  }, [error, reduce]);

  // Focus the first empty cell on mount (or the CTA is already reachable).
  useEffect(() => {
    const firstEmpty = cells.findIndex((c) => !c);
    const idx = firstEmpty === -1 ? LEN - 1 : firstEmpty;
    inputs.current[idx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend countdown.
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  // Completion wave + haptic when all six land.
  const wasFull = useRef(false);
  useEffect(() => {
    if (full && !wasFull.current) {
      wasFull.current = true;
      if (!reduce) {
        setWaving(true);
        const t = setTimeout(() => setWaving(false), 60 * (LEN - 1) + 520);
        if (navigator.vibrate) {
          try {
            navigator.vibrate([8, 40, 8]);
          } catch {
            /* haptics unsupported — no-op */
          }
        }
        return () => clearTimeout(t);
      }
    }
    if (!full) wasFull.current = false;
  }, [full, reduce]);

  const focusCell = (i: number) => inputs.current[Math.max(0, Math.min(LEN - 1, i))]?.focus();

  const pop = (i: number) => {
    if (reduce) return;
    setPopped(i);
    setTimeout(() => {
      if (mounted.current) setPopped((p) => (p === i ? null : p));
    }, 320);
  };

  const spread = (str: string, start: number) => {
    const chars = str.replace(/\D/g, '').slice(0, LEN - start).split('');
    if (!chars.length) return;
    setCells((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => {
        next[start + k] = c;
      });
      return next;
    });
    const landed = Math.min(start + chars.length, LEN) - 1;
    focusCell(Math.min(landed + 1, LEN - 1));
    pop(landed);
  };

  const handleChange = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (only.length <= 1) {
      setCells((prev) => {
        const next = [...prev];
        next[i] = only;
        return next;
      });
      if (only) {
        pop(i);
        if (i < LEN - 1) focusCell(i + 1);
      }
    } else {
      // Multi-char: OS one-time-code autofill or a paste dropped into one cell.
      spread(only, i);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !cells[i] && i > 0) {
      focusCell(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === 'ArrowRight' && i < LEN - 1) {
      e.preventDefault();
      focusCell(i + 1);
    }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    spread(e.clipboardData.getData('text') ?? '', i);
  };

  // Resend.
  const doResend = () => {
    onResend?.();
    setSecs(RESEND_SECONDS);
  };

  // CTA: magnetic pull + ripple, and an internal "Verifying…" busy state.
  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; s: number }[]>([]);
  const ripId = useRef(0);
  const canSubmit = full && !verifying;

  const onFootMove = (e: React.PointerEvent) => {
    if (reduce || !canSubmit) return;
    const b = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.05);
    my.set((e.clientY - b.top - b.height / 2) * 0.12);
  };
  const onFootLeave = () => {
    mx.set(0);
    my.set(0);
  };
  const onBtnDown = (e: React.PointerEvent) => {
    if (reduce || !canSubmit) return;
    const b = e.currentTarget.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    setRipples((r) => [...r, { id: ripId.current++, x: e.clientX - b.left, y: e.clientY - b.top, s: size }]);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(11);
      } catch {
        /* no-op */
      }
    }
  };

  const submit = async () => {
    if (!full || verifying) return;
    setVerifying(true);
    try {
      await onVerify?.(code);
    } finally {
      // On success the parent navigates and unmounts us; guard the setState.
      if (mounted.current) setVerifying(false);
    }
  };

  const resendReady = secs <= 0;

  return (
    <section className="flex min-h-full flex-col overflow-hidden bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* Scoped keyframes for the cell pop/wave/shake — media-gated for reduce. */}
      <style>{`
        @keyframes vcs-pop{0%{transform:scale(1)}45%{transform:scale(1.12)}100%{transform:scale(1)}}
        @keyframes vcs-wave{0%,100%{box-shadow:0 0 0 0 rgba(242,183,5,0);transform:translateY(0)}40%{box-shadow:0 0 0 3px rgba(242,183,5,.45),0 0 18px rgba(242,183,5,.65);transform:translateY(-4px)}}
        @keyframes vcs-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
        @keyframes vcs-shine{0%{transform:translateX(-170%)}55%,100%{transform:translateX(340%)}}
        .vcs-pop{animation:vcs-pop .32s cubic-bezier(.34,1.6,.5,1)}
        .vcs-wave{animation:vcs-wave .5s ease}
        .vcs-shake{animation:vcs-shake .4s ease}
        .vcs-shine{animation:vcs-shine 2.6s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.vcs-pop,.vcs-wave,.vcs-shake,.vcs-shine{animation:none!important}}
      `}</style>

      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[#1a2a39] pb-4 text-[17px] font-semibold">
        <button type="button" onClick={onBack} aria-label="Back" className="text-[#e6edf3] hover:opacity-80">
          ←
        </button>
        Create your account
      </div>

      {/* body */}
      <p className="my-[18px] text-sm leading-relaxed text-[#93a3b3]">
        Enter the 6-digit code we sent to <b className="font-semibold text-white">{destination}</b>.
        <button
          type="button"
          onClick={onChangeContact}
          className="ml-1 font-medium text-[#f4ba12] hover:underline"
        >
          Change
        </button>
      </p>

      {/* cells */}
      <div className={`flex gap-[9px] ${shaking ? 'vcs-shake' : ''}`}>
        {cells.map((c, i) => (
          <div key={i} className="h-14 flex-1">
            <input
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={c}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => e.currentTarget.select()}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={i === 0 ? LEN : 1}
              aria-label={`Digit ${i + 1} of ${LEN}`}
              className={[
                'h-full w-full rounded-xl border bg-[#0e1c29] text-center text-[22px] font-semibold text-white outline-none transition-[border-color,background,box-shadow,transform] duration-200 [caret-color:#f4ba12]',
                'focus:border-[#f4ba12] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.15),0_0_16px_rgba(242,183,5,0.28)]',
                c && !error ? 'border-[rgba(242,183,5,0.5)] bg-[rgba(242,183,5,0.08)]' : 'border-[#2b3f52]',
                error ? '!border-[#e5484d]' : '',
                popped === i ? 'vcs-pop' : '',
                waving ? 'vcs-wave' : '',
              ].join(' ')}
              style={waving ? { animationDelay: `${i * 60}ms` } : undefined}
            />
          </div>
        ))}
      </div>

      {errorMessage && (
        <p role="alert" className="mt-2.5 text-[13px] text-[#f87171]">
          {errorMessage}
        </p>
      )}

      {/* demo banner (dev/preview, or when a code was pre-filled) */}
      {(demo || (!!prefillCode && prefillCode.replace(/\D/g, '').length > 0)) && (
        <div className="mt-3.5 flex items-center gap-2 rounded-[10px] border border-[#22384a] bg-[#101f2d] px-3 py-[9px] text-xs text-[#8397a8]">
          <span aria-hidden>🧪</span>
          Demo mode — code pre-filled, no SMS or email sent.
        </div>
      )}

      {/* resend */}
      <p className="mt-4 text-[13px] text-[#8397a8]">
        Didn’t get it?{' '}
        {resendReady ? (
          <button type="button" onClick={doResend} className="font-semibold text-[#f4ba12] hover:underline">
            Resend code
          </button>
        ) : (
          <b className="font-medium text-[#4f6070]">
            Resend code in 0:{secs < 10 ? `0${secs}` : secs}
          </b>
        )}
      </p>

      {/* footer / CTA */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-b from-transparent via-[#0b1622]/80 to-[#0b1622] pb-5 pt-[18px]">
        <div onPointerMove={onFootMove} onPointerLeave={onFootLeave}>
          <motion.div
            className="rounded-[13px]"
            style={reduce ? undefined : { x: mx, y: my }}
            animate={
              reduce
                ? undefined
                : canSubmit
                  ? {
                      boxShadow: [
                        '0 6px 20px -8px rgba(242,183,5,0.5)',
                        '0 9px 30px -6px rgba(242,183,5,0.85)',
                        '0 6px 20px -8px rgba(242,183,5,0.5)',
                      ],
                    }
                  : { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Button
              type="button"
              onClick={submit}
              onPointerDown={onBtnDown}
              disabled={!full}
              aria-busy={verifying || undefined}
              className={[
                'relative w-full overflow-hidden rounded-[13px] py-4 text-[15px] font-semibold transition-colors',
                full
                  ? 'bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] text-[#0b1622] hover:brightness-105 active:scale-[.985]'
                  : 'cursor-not-allowed bg-[#182838] text-[#5f7387]',
                verifying ? 'cursor-wait opacity-90' : '',
              ].join(' ')}
            >
              {verifying ? 'Verifying…' : 'Verify & continue to payment'}
              {canSubmit && !reduce && (
                <span
                  aria-hidden
                  className="vcs-shine pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.55),transparent)]"
                />
              )}
              {ripples.map((r) => (
                <motion.span
                  key={r.id}
                  aria-hidden
                  className="pointer-events-none absolute rounded-full bg-white/50"
                  initial={{ scale: 0, opacity: 0.5 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  onAnimationComplete={() => setRipples((p) => p.filter((x) => x.id !== r.id))}
                  style={{ left: r.x - r.s / 2, top: r.y - r.s / 2, width: r.s, height: r.s }}
                />
              ))}
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
