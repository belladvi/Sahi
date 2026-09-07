/**
 * SalesStep.tsx — Step 3 "Roughly, how much do you sell a year?" (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Micro-interactions are IDENTICAL to Step 2 (CookLocationStep):
 *   - Gold spark burst + self-drawing checkmark + glow-lift + ripple on select.
 *   - Progress: the just-completed 3rd segment fills, glows, and sweeps.
 *   - Magnetic, shimmering CTA in the approved gradient (#f4ba12 → #ffce3b).
 *   Single-select. New "I'm just starting out" option for pre-revenue bakers.
 *
 * SAFE TO ADD (won't break existing flows):
 *   - Self-contained; only external import is the shadcn Button.
 *   - No router coupling — wire onSubmit/onBack to your flow.
 *   - Selection is plain React state; works fully without Motion; all motion
 *     gated by useReducedMotion.
 *
 * USAGE:
 *   <SalesStep step={3} totalSteps={4}
 *     onBack={() => navigate(-1)}
 *     onSubmit={(choice) => { saveAnswers({ sales: choice }); navigate("/qualify/result"); }} />
 */

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring, type Variants } from "motion/react";
import JourneyRail from "../../components/JourneyRail";
// This repo has no shadcn `Button` and no `@/` path alias (the other steps use a
// plain <button>), so `Button` is a bare native button element — used exactly
// like the shadcn Button (className/onClick/disabled/children).
const Button = "button" as const;

export interface SalesOption { id: string; label: string; desc?: string; }

export interface SalesStepProps {
  question?: string;
  hint?: string;
  options?: SalesOption[];
  initialSelectedId?: string;
  ctaLabel?: string;
  step?: number;
  totalSteps?: number;
  onSubmit?: (choice: SalesOption) => void;
  onBack?: () => void;
}

const Icon = ({ name }: { name: string }) => {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    sprout: <><path d="M12 22v-8" {...p} /><path d="M12 14c0-3.3 2.2-5 5-5 0 3.3-2.2 5-5 5Z" {...p} /><path d="M12 14c0-3.3-2.2-5-5-5 0 3.3 2.2 5 5 5Z" {...p} /></>,
    coins: <><ellipse cx="12" cy="6.5" rx="7" ry="3" {...p} /><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" {...p} /><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" {...p} /></>,
    trend: <><polyline points="3 17 9 11 13 15 21 7" {...p} /><polyline points="15 7 21 7 21 13" {...p} /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>{paths[name] ?? paths.coins}</svg>;
};
const ICONS = ["sprout", "coins", "trend"];

const DEFAULT_OPTIONS: SalesOption[] = [
  { id: "starting", label: "I'm just starting out" },
  { id: "under", label: "Under ₹1.5 crore a year" },
];

const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rowV: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] } } };

/* one option row — owns its ripple + spark (same as Step 2) */
function OptionRow({
  option, index, selected, reduce, onSelect,
}: {
  option: SalesOption; index: number; selected: boolean; reduce: boolean | null; onSelect: () => void;
}) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; s: number }[]>([]);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; parts: { tx: number; ty: number }[] } | null>(null);
  let rid = 0;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    if (!reduce) {
      setRipples((r) => [...r, { id: rid++, x, y, s: Math.max(b.width, b.height) }]);
      if (!selected) {
        const parts = Array.from({ length: 7 }, () => {
          const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 22;
          return { tx: Math.cos(a) * d, ty: Math.sin(a) * d };
        });
        setSparks({ id: Date.now(), x, y, parts });
      }
    }
    if (navigator.vibrate) { try { navigator.vibrate(9); } catch { /* no-op */ } }
    onSelect();
  };

  return (
    <motion.button
      type="button" role="radio" aria-checked={selected} onClick={handleClick}
      variants={reduce ? undefined : rowV}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      animate={reduce ? undefined : { boxShadow: selected ? "0 12px 26px -10px rgba(242,183,5,0.5)" : "0 0 0 0 rgba(0,0,0,0)" }}
      transition={{ duration: 0.3 }}
      className={[
        "relative flex items-center gap-3 overflow-hidden rounded-[15px] border px-4 py-[15px] text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b705]/50",
        selected ? "border-[#f2b705] bg-[#f2b705]/[0.09]" : "border-[#26394b] bg-[#0e1c29] hover:border-[#38516a]",
      ].join(" ")}
    >
      <span className={["relative z-[2] flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl transition-colors",
        selected ? "bg-[#f2b705]/[0.16] text-[#f2b705]" : "bg-[#132534] text-[#9fb6c9]"].join(" ")}>
        <Icon name={ICONS[index] ?? "coins"} />
      </span>

      <span className="relative z-[2] flex-1">
        <span className="block text-[15px] font-medium text-white">{option.label}</span>
        {option.desc && <span className="mt-0.5 block text-[12px] text-[#7d8ea0]">{option.desc}</span>}
      </span>

      <span className={["relative z-[2] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-[#f4ba12] bg-[#f4ba12]" : "border-[#35506a] bg-transparent"].join(" ")}>
        {selected && (
          <motion.svg viewBox="0 0 18 15" width="14" height="12" className="overflow-visible" aria-hidden>
            <motion.path d="M2 8 L7 13 L16 2" fill="none" stroke="#0b1622" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }} />
          </motion.svg>
        )}
      </span>

      {ripples.map((r) => (
        <motion.span key={r.id} initial={{ scale: 0, opacity: 0.35 }} animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          onAnimationComplete={() => setRipples((p) => p.filter((x) => x.id !== r.id))}
          className="pointer-events-none absolute z-[1] rounded-full bg-[#f2b705]/30"
          style={{ left: r.x - r.s / 2, top: r.y - r.s / 2, width: r.s, height: r.s }} />
      ))}
      {sparks && (
        <span key={sparks.id} className="pointer-events-none absolute z-[3]" style={{ left: sparks.x, top: sparks.y }}
          onAnimationEnd={() => setSparks(null)}>
          {sparks.parts.map((p, i) => (
            <motion.span key={i} className="absolute h-[5px] w-[5px] rounded-full" style={{ background: "#ffd85c" }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }} animate={{ x: p.tx, y: p.ty, scale: 0.2, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }} />
          ))}
        </span>
      )}
    </motion.button>
  );
}

export default function SalesStep({
  question = "Roughly, how much do you sell a year?",
  hint = "A rough estimate is fine.",
  options = DEFAULT_OPTIONS,
  initialSelectedId,
  ctaLabel = "See my result",
  step = 3,
  totalSteps = 4,
  onSubmit,
  onBack,
}: SalesStepProps) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // The AppShell <main> scroll container is shared across steps; reset it to the
  // top on mount so this step always opens at its heading (matches steps 1-2).
  useLayoutEffect(() => {
    const scroller = sectionRef.current?.closest("main");
    if (scroller) scroller.scrollTop = 0;
  }, []);

  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId);
  const selected = options.find((o) => o.id === selectedId);
  const canProceed = !!selected;

  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const onFootMove = (e: React.PointerEvent) => {
    if (reduce || !canProceed) return;
    const b = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.06);
    my.set((e.clientY - b.top - b.height / 2) * 0.12);
  };
  const onFootLeave = () => { mx.set(0); my.set(0); };

  return (
    // Sized to exactly the scroll frame (min-h-full) so the step fits on one
    // screen with the CTA reachable — no forced overrun, no scroll to continue.
    // Matches steps 1-2. shrink-0 stops the flex parent from compressing it below
    // one screen.
    <section ref={sectionRef} className="relative flex min-h-full shrink-0 flex-col overflow-hidden bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* journey rail — step-driven overlay; always visible, animates on step change */}
      <JourneyRail step={step} totalSteps={totalSteps} />
      {/* header */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-2.5 text-[15px] font-medium text-[#e6edf3] hover:opacity-80">
          <span aria-hidden>←</span> Do you qualify?
        </button>
        <span className="text-xs font-medium tracking-wide text-[#f2b705]">STEP {step} / {totalSteps}</span>
      </div>

      {/* progress — last filled segment fills, glows, sweeps */}
      <div className="my-5 flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }).map((_, i) => {
          const filled = i < step, isLast = i === step - 1;
          return (
            <span key={i} className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#22384a]"
              style={isLast && !reduce ? { boxShadow: "0 0 10px rgba(242,183,5,.55)" } : undefined}>
              {filled && (
                <motion.span className="absolute inset-0 origin-left" style={{ background: "linear-gradient(90deg,#f2b705,#ffd85c)" }}
                  initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.18, ease: [0.2, 0.7, 0.2, 1] }} />
              )}
              {isLast && !reduce && (
                <motion.span aria-hidden className="absolute top-0 h-full w-[45%]"
                  style={{ background: "linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent)" }}
                  initial={{ x: "-120%" }} animate={{ x: "320%" }}
                  transition={{ duration: 1.8, delay: 0.85, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
              )}
            </span>
          );
        })}
      </div>

      <h1 data-waypoint="Sales" className="mb-1.5 font-['Fraunces_Variable',_Georgia,_serif] text-[23px] font-medium leading-tight">{question}</h1>
      <p className="mb-4 text-[13px] text-[#8397a8]">{hint}</p>

      {/* options */}
      <motion.div role="radiogroup" aria-label={question}
        variants={reduce ? undefined : listV} initial={reduce ? false : "hidden"} animate={reduce ? false : "show"}
        className="flex flex-col gap-2.5">
        {options.map((opt, i) => (
          <OptionRow key={opt.id} option={opt} index={i} selected={opt.id === selectedId} reduce={reduce}
            onSelect={() => setSelectedId(opt.id)} />
        ))}
      </motion.div>

      {/* sticky magnetic CTA */}
      <div data-waypoint="Next" onPointerMove={onFootMove} onPointerLeave={onFootLeave}
        className="sticky bottom-0 mt-auto bg-gradient-to-b from-transparent via-[#0b1622]/80 to-[#0b1622] pb-5 pt-6">
        <motion.div style={{ x: mx, y: my }}>
          <Button onClick={() => selected && onSubmit?.(selected)} disabled={!canProceed}
            className={[
              "relative h-auto w-full overflow-hidden rounded-xl py-4 text-[15px] font-semibold transition-colors",
              canProceed
                ? "bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] text-[#0b1622] hover:brightness-105 active:scale-[.985]"
                : "cursor-not-allowed bg-[#182838] text-[#5f7387] hover:bg-[#182838]",
            ].join(" ")}>
            {ctaLabel}
            {canProceed && !reduce && (
              <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/45 blur-[2px]"
                initial={{ x: "-170%" }} animate={{ x: "360%" }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
            )}
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
