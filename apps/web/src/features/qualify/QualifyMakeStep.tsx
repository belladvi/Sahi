/**
 * QualifyMakeStep.tsx — premium "What do you make?" eligibility step (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind CSS, Motion.
 *
 *   install once →  npm i motion   (import path: "motion/react")
 *
 * Premium 3D / motion set:
 *   - Pointer/touch SPOTLIGHT over the chip cluster + subtle 3D TILT toward
 *     the pointer (feels like a lit, physical surface).
 *   - Chips FLIP IN with a spring overshoot, staggered.
 *   - SELF-DRAWING SVG checkmark (pathLength) on select.
 *   - GOLD SPARK BURST from the tap point + glowing active border.
 *   - COUNT-UP ticker on the "N selected" line.
 *   - MAGNETIC, shimmering CTA (nudges toward the cursor on desktop).
 *
 * SAFE TO ADD (won't break existing code):
 *   - Self-contained; no external component dependency (plain <button> CTA to
 *     match this project's existing buttons — shadcn/ui is not used here).
 *   - No router coupling — wire onNext/onBack to your React Router 7 flow.
 *   - Selection logic is plain React state, so the step fully works even
 *     without Motion. Every effect is gated by useReducedMotion.
 *   - onNext receives MakeOption[] (custom entries keep their label;
 *     custom ids are prefixed "custom:").
 *
 * USAGE:
 *   <QualifyMakeStep step={1} totalSteps={4}
 *     onBack={() => navigate(-1)}
 *     onNext={(selected) => { save(selected); navigate("/qualify/2"); }} />
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring,
  type Variants,
} from "motion/react";
import SideScrollbar from "./SideScrollbar";

export interface MakeOption { id: string; label: string; custom?: boolean; }

export interface QualifyMakeStepProps {
  question?: string;
  hint?: string;
  options?: MakeOption[];
  initialSelected?: string[];
  step?: number;
  totalSteps?: number;
  onNext?: (selected: MakeOption[]) => void;
  onBack?: () => void;
}

const DEFAULT_OPTIONS: MakeOption[] = [
  { id: "cakes", label: "Cakes" }, { id: "cookies", label: "Cookies" },
  { id: "brownies", label: "Brownies" }, { id: "chocolates", label: "Chocolates" },
  { id: "tiffin", label: "Tiffin / meals" }, { id: "pickles", label: "Pickles" },
  { id: "snacks", label: "Snacks" },
];

const containerV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const itemV: Variants = {
  hidden: { opacity: 0, rotateX: -70, y: 16 },
  show: { opacity: 1, rotateX: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 18 } },
};

/* count-up number */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current, t0 = performance.now(), dur = 300;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setDisplay(Math.round(start + (value - start) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

/* single chip: draw-in check + tap scale */
function Chip({
  option, selected, reduce, onClick, onRemove,
}: {
  option: MakeOption; selected: boolean; reduce: boolean | null;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove?: () => void;
}) {
  return (
    <motion.button
      type="button" role="checkbox" aria-checked={selected} onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.93 }}
      animate={reduce ? undefined : {
        boxShadow: selected
          ? "0 10px 24px -8px rgba(242,183,5,0.5), 0 0 0 1px rgba(242,183,5,0.45)"
          : "0 0 0 0 rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.3 }}
      className={[
        "relative flex items-center rounded-3xl border px-4 py-2.5 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b705]/60",
        selected ? "border-[#f2b705] bg-[#f2b705]/[0.15] text-white"
                 : "border-[#2f4457] bg-[#0e1c29] text-[#cdd9e3] hover:border-[#3d566b]",
      ].join(" ")}
    >
      <AnimatePresence initial={false}>
        {selected && (
          <motion.svg
            viewBox="0 0 18 15" className="mr-1.5 h-[15px] overflow-visible"
            initial={reduce ? false : { width: 0, opacity: 0 }}
            animate={{ width: 17, opacity: 1 }}
            exit={reduce ? undefined : { width: 0, opacity: 0, marginRight: 0 }}
            transition={{ duration: 0.2 }} aria-hidden
          >
            <motion.path
              d="M2 8 L7 13 L16 2" fill="none" stroke="#f2b705" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {option.label}

      {option.custom && (
        <span role="button" aria-label={`Remove ${option.label}`}
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="ml-1.5 text-[15px] leading-none text-[#f2b705]/85">×</span>
      )}
    </motion.button>
  );
}

type Burst = { id: number; x: number; y: number; parts: { tx: number; ty: number }[] };

export default function QualifyMakeStep({
  question = "What do you make?", hint = "Select all that apply.",
  options = DEFAULT_OPTIONS, initialSelected = [],
  step = 1, totalSteps = 4, onNext, onBack,
}: QualifyMakeStepProps) {
  const reduce = useReducedMotion();
  const [custom, setCustom] = useState<MakeOption[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);

  const clusterRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // The AppShell <main> scroll container is shared across steps; reset it to the
  // top on mount so the step always opens at its heading (e.g. returning here
  // from step 2). Matches step 2's behaviour.
  useLayoutEffect(() => {
    const scroller = sectionRef.current?.closest("main");
    if (scroller) scroller.scrollTop = 0;
  }, []);

  // spotlight + tilt (springs)
  const rx = useSpring(0, { stiffness: 150, damping: 15 });
  const ry = useSpring(0, { stiffness: 150, damping: 15 });
  const sx = useMotionValue(-999);
  const sy = useMotionValue(-999);
  const spotOpacity = useSpring(0, { stiffness: 200, damping: 25 });
  // magnetic CTA
  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });

  const all = [...options, ...custom];
  const count = selected.length;
  const canProceed = count > 0;

  const spawnBurst = (clientX: number, clientY: number) => {
    if (reduce || !clusterRef.current) return;
    const b = clusterRef.current.getBoundingClientRect();
    const parts = Array.from({ length: 7 }, () => {
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 22;
      return { tx: Math.cos(a) * d, ty: Math.sin(a) * d };
    });
    const id = burstId.current++;
    setBursts((p) => [...p, { id, x: clientX - b.left, y: clientY - b.top, parts }]);
    setTimeout(() => setBursts((p) => p.filter((x) => x.id !== id)), 550);
  };

  const toggle = (id: string, e: React.MouseEvent) => {
    const wasSel = selected.includes(id);
    if (!wasSel) spawnBurst(e.clientX, e.clientY);
    if (navigator.vibrate) { try { navigator.vibrate(9); } catch { /* no-op */ } }
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const addCustom = () => {
    const label = draft.trim(); if (!label) return;
    const id = `custom:${label.toLowerCase()}`;
    if (!all.some((o) => o.id === id)) {
      setCustom((c) => [...c, { id, label, custom: true }]);
      setSelected((s) => [...s, id]);
    }
    setDraft("");
  };
  const removeCustom = (id: string) => {
    setCustom((c) => c.filter((o) => o.id !== id));
    setSelected((s) => s.filter((x) => x !== id));
  };

  const onStageMove = (e: React.PointerEvent) => {
    if (reduce || !clusterRef.current) return;
    const b = clusterRef.current.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    sx.set(x); sy.set(y); spotOpacity.set(1);
    rx.set((y / b.height - 0.5) * -6);
    ry.set((x / b.width - 0.5) * 8);
  };
  const onStageLeave = () => { spotOpacity.set(0); rx.set(0); ry.set(0); };

  const onFootMove = (e: React.PointerEvent) => {
    if (reduce || !canProceed || !footRef.current) return;
    const b = footRef.current.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.08);
    my.set((e.clientY - b.top - b.height / 2) * 0.15);
  };
  const onFootLeave = () => { mx.set(0); my.set(0); };

  return (
    <section ref={sectionRef} className="relative flex min-h-[calc(100%_+_88px)] shrink-0 flex-col overflow-hidden bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* journey rail — self-contained fixed overlay; renders null unless the step scrolls */}
      <SideScrollbar scrollRef={sectionRef} />
      {/* header */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-2.5 text-[15px] font-medium text-[#e6edf3] hover:opacity-80">
          <span aria-hidden>←</span> Do you qualify?
        </button>
        <span className="text-xs font-medium tracking-wide text-[#f2b705]">STEP {step} / {totalSteps}</span>
      </div>

      {/* progress */}
      <div className="my-5 flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span key={i} className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#22384a]">
            {i < step && (
              <motion.span className="block h-full w-full origin-left"
                style={{ background: "linear-gradient(90deg,#f2b705,#ffd85c)" }}
                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }} />
            )}
          </span>
        ))}
      </div>

      <h1 data-waypoint="Categories" className="mb-1.5 font-['Fraunces_Variable',_Georgia,_serif] text-2xl font-medium">{question}</h1>
      <p className="mb-4 min-h-[18px] text-[13px] text-[#8397a8]">
        {canProceed ? <span className="font-medium text-[#f2b705]"><CountUp value={count} /> selected</span> : hint}
      </p>

      {/* chips: spotlight + tilt stage */}
      <div style={{ perspective: 900 }} onPointerMove={onStageMove} onPointerLeave={onStageLeave}>
        <motion.div
          ref={clusterRef} variants={reduce ? undefined : containerV}
          initial={reduce ? false : "hidden"} animate={reduce ? false : "show"}
          style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
          className="relative flex flex-wrap gap-2.5 rounded-2xl p-1.5"
          role="group" aria-label={question}
        >
          {/* spotlight */}
          {!reduce && (
            <motion.div aria-hidden
              className="pointer-events-none absolute -ml-[100px] -mt-[100px] h-[200px] w-[200px] rounded-full"
              style={{ x: sx, y: sy, opacity: spotOpacity, mixBlendMode: "screen",
                background: "radial-gradient(circle, rgba(242,183,5,0.22), rgba(242,183,5,0) 60%)" }} />
          )}
          {/* spark bursts */}
          {bursts.map((burst) => (
            <span key={burst.id} className="pointer-events-none absolute" style={{ left: burst.x, top: burst.y }}>
              {burst.parts.map((p, i) => (
                <motion.span key={i}
                  className="absolute h-[5px] w-[5px] rounded-full"
                  style={{ background: "#ffd85c" }}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{ x: p.tx, y: p.ty, scale: 0.2, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }} />
              ))}
            </span>
          ))}

          {all.map((opt) => (
            <motion.div key={opt.id} variants={reduce ? undefined : itemV} style={{ transformStyle: "preserve-3d" }}>
              <Chip option={opt} selected={selected.includes(opt.id)} reduce={reduce}
                onClick={(e) => toggle(opt.id, e)}
                onRemove={opt.custom ? () => removeCustom(opt.id) : undefined} />
            </motion.div>
          ))}

          <motion.div variants={reduce ? undefined : itemV}>
            <button type="button" onClick={() => setAdding((a) => !a)}
              className="flex items-center gap-1.5 rounded-3xl border border-dashed border-[#3d566b] bg-[#0e1c29] px-4 py-2.5 text-sm text-[#9fb0c0] hover:border-[#f2b705]/60">
              <span aria-hidden>＋</span> Add your own
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* add-your-own input */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.26 }}
            className="mt-3 flex gap-2 overflow-hidden">
            <input autoFocus value={draft} maxLength={30}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Type what you make…"
              className="h-11 flex-1 rounded-xl border border-[#2f4457] bg-[#0e1c29] px-3.5 text-sm text-white outline-none focus:border-[#f2b705]" />
            <button type="button" onClick={addCustom}
              className="h-11 rounded-xl bg-[#f2b705] px-4 text-sm font-semibold text-[#0b1622] active:scale-[.97]">Add</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* sticky magnetic CTA */}
      <div ref={footRef} data-waypoint="Next" onPointerMove={onFootMove} onPointerLeave={onFootLeave}
        className="sticky bottom-0 mt-auto bg-gradient-to-b from-transparent via-[#0b1622]/80 to-[#0b1622] pb-5 pt-6">
        <motion.div style={{ x: mx, y: my }}>
          <button
            type="button"
            onClick={() => canProceed && onNext?.(all.filter((o) => selected.includes(o.id)))}
            disabled={!canProceed}
            className={[
              "relative h-auto w-full overflow-hidden rounded-xl py-4 text-[15px] font-semibold transition-colors",
              canProceed
                ? "bg-gradient-to-r from-[#f2b705] to-[#ffcf3d] text-[#0b1622] hover:brightness-105 active:scale-[.985]"
                : "cursor-not-allowed bg-[#182838] text-[#5f7387] hover:bg-[#182838]",
            ].join(" ")}
          >
            Next
            {canProceed && !reduce && (
              <motion.span aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/45 blur-[2px]"
                initial={{ x: "-170%" }} animate={{ x: "360%" }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
            )}
          </button>
        </motion.div>
      </div>
    </section>
  );
}
