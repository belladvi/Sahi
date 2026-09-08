/**
 * WhatYouNeedStep.tsx — pre-account "What you'll need" screen (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Shows the document checklist before the account wall.
 * Micro-interactions:
 *   - Card + rows stagger in; each numbered gold badge SPRINGS in; the PAN
 *     note fades up after.
 *   - "Create an account" CTA: glow pulse + nudging arrow + tap ripple +
 *     shimmer + magnetic pull.
 *   All motion gated by useReducedMotion.
 *
 * SAFE TO ADD: self-contained; only external import is the shadcn Button;
 * no router coupling (wire onCreateAccount / onBack). Pure presentation +
 * one CTA callback.
 *
 * USAGE:
 *   <WhatYouNeedStep
 *     reason="own your kitchen"           // from qualify step 2
 *     onBack={() => navigate(-1)}
 *     onCreateAccount={() => navigate("/signup")} />
 */

import { useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import JourneyRail, { FUNNEL_TOTAL_STEPS } from "../../components/JourneyRail";
// This repo has no shadcn `Button` and no `@/` path alias (the other steps use a
// plain <button>), so `Button` is a bare native button element — used exactly
// like the shadcn Button (className/onClick/onPointerDown/children).
const Button = "button" as const;

export interface NeededDoc {
  label: string;
  desc?: string;
  note?: string;
}

export interface WhatYouNeedStepProps {
  title?: string;
  /** Journey-rail position (1-based) — defaults to the last pre-account step. */
  step?: number;
  totalSteps?: number;
  reason?: string;
  licenceName?: string;
  documents?: NeededDoc[];
  ctaLabel?: string;
  microcopy?: string;
  onCreateAccount?: () => void;
  onBack?: () => void;
}

const DEFAULT_DOCS: NeededDoc[] = [
  { label: "Passport-size photo" },
  { label: "Aadhaar", desc: "Identity proof" },
  { label: "PAN", desc: "Business identity", note: "PAN counts as your business identity, as required by the food authority." },
];

export default function WhatYouNeedStep({
  title = "What you'll need",
  step = FUNNEL_TOTAL_STEPS,
  totalSteps = FUNNEL_TOTAL_STEPS,
  reason = "own your kitchen",
  licenceName = "FSSAI Basic Registration",
  documents = DEFAULT_DOCS,
  ctaLabel = "Create an account",
  microcopy = "Takes about 30 seconds.",
  onCreateAccount,
  onBack,
}: WhatYouNeedStepProps) {
  const reduce = useReducedMotion();
  const count = documents.length;

  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; s: number }[]>([]);
  const ripId = useRef(0);

  const onFootMove = (e: React.PointerEvent) => {
    if (reduce) return;
    const b = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.05);
    my.set((e.clientY - b.top - b.height / 2) * 0.12);
  };
  const onFootLeave = () => { mx.set(0); my.set(0); };
  const onBtnDown = (e: React.PointerEvent) => {
    if (reduce) return;
    const b = e.currentTarget.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    setRipples((r) => [...r, { id: ripId.current++, x: e.clientX - b.left, y: e.clientY - b.top, s: size }]);
    if (navigator.vibrate) { try { navigator.vibrate(11); } catch { /* no-op */ } }
  };

  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } });

  return (
    <section className="relative flex min-h-full flex-col bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* journey rail — same funnel-wide rail as the qualify + kitchen steps */}
      <JourneyRail step={step} totalSteps={totalSteps} />
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[#1a2a39] pb-4 text-[17px] font-semibold">
        <button type="button" onClick={onBack} aria-label="Back" className="text-[#e6edf3] hover:opacity-80">←</button>
        <h1 className="text-[17px] font-semibold">{title}</h1>
      </div>

      {/* intro */}
      <motion.p className="mt-[18px] text-sm leading-relaxed text-[#93a3b3]" {...rise(0.05)}>
        Because you {reason}, you'll need just <b className="font-semibold text-white">{count} documents</b>. Keep them handy — you'll upload them after creating your account.
      </motion.p>

      {/* document card */}
      <motion.div className="mt-[18px] rounded-2xl border border-[#22384a] bg-[#101f2d] px-4 pb-2 pt-4" {...rise(0.15)}>
        {documents.map((d, i) => (
          <div key={d.label}>
            <div className="flex items-center gap-3 py-3">
              <motion.span
                className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-[#f4ba12] text-[13px] font-bold text-[#0b1622]"
                initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }}
                transition={reduce ? { duration: 0 } : { delay: 0.35 + i * 0.14, type: "spring", stiffness: 380, damping: 14 }}>
                {i + 1}
              </motion.span>
              <span className="text-[15px] leading-snug">
                <span className="font-medium text-white">{d.label}</span>
                {d.desc && <span className="text-[13px] text-[#7d8ea0]"> — {d.desc}</span>}
              </span>
            </div>
            {d.note && (
              <motion.div className="relative ml-[39px] mb-2 overflow-hidden rounded-r-lg bg-[#f2b705]/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-[#a7b6c4]"
                initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.35 + count * 0.14 + 0.12 }}>
                <motion.span aria-hidden className="absolute left-0 top-0 h-full w-[2px] origin-top bg-[#f4ba12]"
                  initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ duration: 0.42, delay: 0.35 + count * 0.14 + 0.22, ease: "easeOut" }} />
                <div className="flex items-start gap-2">
                  <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f4ba12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden
                    initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }}
                    transition={reduce ? { duration: 0 } : { delay: 0.35 + count * 0.14 + 0.26, type: "spring", stiffness: 400, damping: 12 }}>
                    <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" />
                  </motion.svg>
                  <span>{d.note}</span>
                </div>
              </motion.div>
            )}
          </div>
        ))}
      </motion.div>

      {/* footer note */}
      <motion.p className="mt-4 text-[12.5px] leading-relaxed text-[#8397a8]" {...rise(0.5)}>
        That's the full official list for {licenceName}. Create an account next so we can save your progress — <b className="font-semibold text-[#cdd9e3]">no payment yet</b>.
      </motion.p>

      {/* CTA */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-b from-transparent via-[#0b1622]/80 to-[#0b1622] pb-5 pt-5" onPointerMove={onFootMove} onPointerLeave={onFootLeave}>
        <motion.div className="rounded-xl" style={reduce ? undefined : { x: mx, y: my }}
          animate={reduce ? undefined : { boxShadow: ["0 6px 20px -8px rgba(242,183,5,0.5)", "0 9px 30px -6px rgba(242,183,5,0.85)", "0 6px 20px -8px rgba(242,183,5,0.5)"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
          <Button
            onClick={onCreateAccount} onPointerDown={onBtnDown}
            className="relative flex h-auto w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] py-4 text-[15px] font-semibold text-[#0b1622] hover:brightness-105 active:scale-[.985]">
            {ctaLabel}
            <motion.span aria-hidden className="inline-flex" animate={reduce ? undefined : { x: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 1 }}>→</motion.span>
            {!reduce && (
              <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/50 blur-[2px]"
                initial={{ x: "-170%" }} animate={{ x: "360%" }}
                transition={{ duration: 2.8, delay: 1, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
            )}
            {ripples.map((r) => (
              <motion.span key={r.id} aria-hidden className="pointer-events-none absolute rounded-full bg-white/50"
                initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                onAnimationComplete={() => setRipples((p) => p.filter((x) => x.id !== r.id))}
                style={{ left: r.x - r.s / 2, top: r.y - r.s / 2, width: r.s, height: r.s }} />
            ))}
          </Button>
        </motion.div>
        <p className="mt-2.5 text-center text-xs text-[#6f8091]">{microcopy}</p>
      </div>
    </section>
  );
}
