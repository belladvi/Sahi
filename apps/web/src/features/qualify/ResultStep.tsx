/**
 * ResultStep.tsx — Step 4 eligibility result "You qualify" (Sahi PWA), hero build.
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Lit stage (aurora + grid + vignette) · depth-layered credential with foil
 * sheen, pointer tilt, idle float · seal stamp with rays + shockwave + flash +
 * gravity confetti + haptic · rolling count-up price with a settle pop + border
 * glow · staggered "what happens next" checklist with drawing checks (the
 * filing line links to FoSCoS – FSSAI) · magnetic shimmering CTA with a
 * nudging arrow. All motion gated by useReducedMotion → static fallback.
 *
 * SAFE TO ADD: self-contained; only external import is the shadcn Button;
 * no router coupling; pure presentation.
 *
 * USAGE:
 *   <ResultStep priceAllIn={599} govtFee={100} helpFee={499}
 *     onBack={() => navigate(-1)} onContinue={() => navigate("/register")} />
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
// This repo has no shadcn `Button` and no `@/` path alias (the other steps use a
// plain <button>), so `Button` is a bare native button element — used exactly
// like the shadcn Button (className/onClick/children).
const Button = "button" as const;

export interface ResultStepProps {
  headline?: string;
  subhead?: string;
  credentialTitle?: string;
  priceAllIn?: number;
  govtFee?: number;
  helpFee?: number;
  steps?: ReactNode[];
  ctaLabel?: string;
  microcopy?: string;
  onContinue?: () => void;
  onBack?: () => void;
}

const CONFETTI_COLORS = ["#f4ba12", "#ffce3b", "#ffffff", "#ffd85c", "#e6a700"];
const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* rolling number; fires onDone when it lands */
function CountUp({ value, delay = 0, reduce, onDone }: { value: number; delay?: number; reduce: boolean | null; onDone?: () => void }) {
  const [n, setN] = useState(reduce ? value : 0);
  // Hold onDone in a ref so the animation effect doesn't depend on its (inline,
  // per-render) identity — otherwise every parent re-render restarts the count-up.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (reduce) { setN(value); onDoneRef.current?.(); return; }
    let raf = 0, t0 = 0;
    const start = window.setTimeout(() => {
      const tick = (t: number) => {
        if (!t0) t0 = t;
        const k = Math.min(1, (t - t0) / 650);
        setN(Math.round(k * value));
        if (k < 1) raf = requestAnimationFrame(tick);
        else onDoneRef.current?.();
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { window.clearTimeout(start); cancelAnimationFrame(raf); };
  }, [value, delay, reduce]);
  return <>{rupee(n)}</>;
}

const DEFAULT_STEPS: ReactNode[] = [
  "We prepare all the paperwork",
  <>
    We file it with{" "}
    <a href="https://foscos.fssai.gov.in/" target="_blank" rel="noopener noreferrer"
      className="font-medium text-[#f4ba12] underline underline-offset-2 hover:opacity-80">
      FoSCoS – FSSAI
    </a>{" "}
    for you
  </>,
  "Your licence lands in your inbox",
];

export default function ResultStep({
  headline = "You qualify.",
  subhead = "You need an FSSAI Basic Registration — and we'll do the whole thing for you.",
  credentialTitle = "Basic Registration",
  priceAllIn = 599,
  govtFee = 100,
  helpFee = 499,
  steps = DEFAULT_STEPS,
  ctaLabel = "Start my registration",
  microcopy = "We'll guide you the whole way.",
  onContinue,
  onBack,
}: ResultStepProps) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // The AppShell <main> scroll container is shared across steps; reset it to the
  // top on mount so this step opens at its heading (matches steps 1-3).
  useLayoutEffect(() => {
    const scroller = sectionRef.current?.closest("main");
    if (scroller) scroller.scrollTop = 0;
  }, []);

  const rx = useSpring(0, { stiffness: 150, damping: 15 });
  const ry = useSpring(0, { stiffness: 150, damping: 15 });
  const foilX = useSpring(-30, { stiffness: 200, damping: 20 });
  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const [confetti, setConfetti] = useState<{ id: number; tx: number; ty: number; r: number; w: number; h: number; color: string; delay: number; dur: number }[]>([]);
  const [shownSteps, setShownSteps] = useState(0);
  const [priceSettled, setPriceSettled] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reduce) { setShownSteps(steps.length); return; }
    setConfetti(Array.from({ length: 26 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 80;
      return { id: i, tx: Math.cos(a) * d, ty: 160 + Math.random() * 120, r: Math.random() * 720 - 360, w: 4 + Math.random() * 3, h: 7 + Math.random() * 6, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!, delay: 0.55 + Math.random() * 0.12, dur: 1.1 + Math.random() * 0.5 };
    }));
    if (navigator.vibrate) timers.current.push(window.setTimeout(() => { try { navigator.vibrate(14); } catch { /* no-op */ } }, 560));
    steps.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => {
        setShownSteps((s) => Math.max(s, i + 1));
        if (navigator.vibrate) { try { navigator.vibrate(5); } catch { /* no-op */ } }
      }, 1150 + i * 220));
    });
    timers.current.push(window.setTimeout(() => setConfetti([]), 2200));
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [reduce, steps]);

  const onStageMove = (e: React.PointerEvent) => {
    if (reduce) return;
    const b = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
    rx.set(py * -12); ry.set(px * 16); foilX.set(px * 80);
  };
  const onStageLeave = () => { rx.set(0); ry.set(0); foilX.set(-30); };
  const onFootMove = (e: React.PointerEvent) => {
    if (reduce) return;
    const b = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.06); my.set((e.clientY - b.top - b.height / 2) * 0.12);
  };
  const onFootLeave = () => { mx.set(0); my.set(0); };
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } });

  return (
    <section ref={sectionRef} className="relative flex min-h-full flex-col overflow-hidden bg-[#0a1420] px-[18px] pb-6 pt-[18px] text-white">
      {!reduce && (
        <>
          <motion.div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-64 w-64 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(242,183,5,.20),rgba(242,183,5,0) 62%)" }}
            animate={{ x: [0, -20, 0], y: [0, 18, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div aria-hidden className="pointer-events-none absolute -left-12 bottom-10 h-60 w-60 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(90,140,255,.10),rgba(90,140,255,0) 65%)" }}
            animate={{ x: [0, 24, 0], y: [0, -16, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }} />
        </>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(#16283a 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 38%,transparent 40%,rgba(6,14,22,.6))" }} />

      <div className="relative z-[2] flex flex-1 flex-col">
        <button type="button" onClick={onBack} className="flex items-center gap-2.5 text-[15px] font-medium text-[#e6edf3] hover:opacity-80">
          <span aria-hidden>←</span> Do you qualify?
        </button>

        <div className="my-4 flex gap-1.5" role="progressbar" aria-valuenow={4} aria-valuemin={1} aria-valuemax={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#22384a]" style={i === 3 && !reduce ? { boxShadow: "0 0 10px rgba(242,183,5,.55)" } : undefined}>
              <motion.span className="absolute inset-0 origin-left" style={{ background: "linear-gradient(90deg,#f2b705,#ffd85c)" }}
                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.05 + i * 0.08, ease: [0.2, 0.7, 0.2, 1] }} />
            </span>
          ))}
        </div>

        <motion.h1 className="mb-1 font-['Fraunces_Variable',_Georgia,_serif] text-[30px] font-medium" {...rise(0.45)}>{headline}</motion.h1>
        <motion.p className="mb-4 text-[13.5px] leading-relaxed text-[#93a3b3]" {...rise(0.56)}>{subhead}</motion.p>

        {/* credential */}
        <div className="relative mb-5 flex justify-center [perspective:1000px]" onPointerMove={onStageMove} onPointerLeave={onStageLeave}>
          <motion.div className="relative" animate={reduce ? undefined : { y: [0, -9, 0] }} transition={{ duration: 6, delay: 1.2, repeat: Infinity, ease: "easeInOut" }}>
            <motion.div aria-hidden className="absolute -inset-[18px] rounded-3xl" style={{ background: "radial-gradient(circle,rgba(242,183,5,.22),transparent 68%)" }}
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} />
            <motion.div className="relative h-[158px] w-[244px] overflow-hidden rounded-2xl border-[0.5px] border-[#3a4b5c]"
              style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", background: "linear-gradient(155deg,#17293b,#0e2030)", boxShadow: "0 28px 55px -18px rgba(0,0,0,.75)" }}
              initial={reduce ? false : { opacity: 0, y: 24, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.75, delay: 0.25, ease: [0.2, 0.9, 0.3, 1] }}>
              {!reduce && (
                <motion.div aria-hidden className="absolute left-1/2 top-[34px] -ml-[60px] h-[120px] w-[120px]"
                  style={{ background: "conic-gradient(from 0deg,transparent 0 8deg,rgba(255,224,138,.28) 8deg 12deg,transparent 12deg 30deg,rgba(255,224,138,.22) 30deg 34deg,transparent 34deg 60deg,rgba(255,224,138,.28) 60deg 64deg,transparent 64deg 90deg,rgba(255,224,138,.22) 90deg 94deg,transparent 94deg 120deg,rgba(255,224,138,.28) 120deg 124deg,transparent 124deg 180deg)" }}
                  initial={{ opacity: 0, scale: 0.6, rotate: 0 }} animate={{ opacity: 0.5, scale: 1, rotate: 40 }} transition={{ duration: 1, delay: 0.55, ease: "easeOut" }} />
              )}
              {!reduce && (
                <motion.div aria-hidden className="absolute inset-0" style={{ x: foilX, mixBlendMode: "screen", background: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,.16) 46%,rgba(242,183,5,.18) 52%,transparent 66%)" }} />
              )}
              {!reduce && (
                <motion.div aria-hidden className="absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 0.5, delay: 0.55, times: [0, 0.3, 1] }} />
              )}
              <div className="relative z-[3] flex justify-between px-3.5 pt-3 text-[9px] tracking-[1.4px] text-[#8aa0b4]"><span>FSSAI · GOVT OF INDIA</span><span className="text-[#f4ba12]">✓</span></div>
              {!reduce && (
                <motion.span aria-hidden className="absolute left-1/2 top-[44px] -ml-[29px] h-[58px] w-[58px] rounded-full border-2 border-[#f4ba12]"
                  initial={{ scale: 0.5, opacity: 0.85 }} animate={{ scale: 2.1, opacity: 0 }} transition={{ duration: 0.7, delay: 0.58, ease: "easeOut" }} />
              )}
              <motion.span className="absolute left-1/2 top-[44px] -ml-[29px] z-[4] flex h-[58px] w-[58px] items-center justify-center rounded-full text-[23px] text-[#4a3402]"
                style={{ background: "radial-gradient(circle at 35% 30%,#ffe08a,#f4ba12 55%,#a97c04)", boxShadow: "0 5px 14px rgba(0,0,0,.5), inset 0 0 0 3px rgba(255,255,255,.3)" }}
                initial={reduce ? false : { scale: 1.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.55, delay: 0.55, type: "spring", stiffness: 260, damping: 12 }}>✓</motion.span>
              <div className="absolute inset-x-0 bottom-[15px] z-[3] text-center">
                <motion.div className="font-['Fraunces_Variable',_Georgia,_serif] text-sm tracking-[3px]" {...rise(0.85)}>APPROVED</motion.div>
                <motion.div className="mt-[3px] text-[10px] text-[#8aa0b4]" {...rise(0.92)}>{credentialTitle}</motion.div>
              </div>
            </motion.div>

            {confetti.map((c) => (
              <motion.span key={c.id} aria-hidden className="pointer-events-none absolute z-10 rounded-[1px]"
                style={{ left: "50%", top: 72, width: c.w, height: c.h, background: c.color }}
                initial={{ x: "-50%", y: "-50%", rotate: 0, opacity: 1 }}
                animate={{ x: ["-50%", `calc(-50% + ${c.tx * 0.4}px)`, `calc(-50% + ${c.tx}px)`], y: ["-50%", "calc(-50% - 22px)", `calc(-50% + ${c.ty}px)`], rotate: [0, 90, c.r], opacity: [1, 1, 0] }}
                transition={{ duration: c.dur, delay: c.delay, times: [0, 0.2, 1], ease: ["easeOut", "easeIn"] }} />
            ))}
          </motion.div>
        </div>

        {/* honest price — reveal sheen + settle glow/pop */}
        <motion.div {...rise(0.95)}>
          <motion.div className="relative overflow-hidden rounded-[15px] border bg-[#0e1c29] px-4 py-[14px]"
            style={{ borderColor: "#24384a" }}
            animate={reduce ? undefined : {
              borderColor: priceSettled ? "rgba(242,183,5,.5)" : "#24384a",
              boxShadow: priceSettled ? "0 0 0 1px rgba(242,183,5,.45), 0 12px 28px -12px rgba(242,183,5,.4)" : "0 0 0 0 rgba(0,0,0,0)",
            }}
            transition={{ duration: 0.45 }}>
            {!reduce && (
              <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                initial={{ x: "-200%" }} animate={{ x: "260%" }} transition={{ duration: 1.1, delay: 1.0, ease: "easeInOut" }} />
            )}
            <div className="text-[11px] uppercase tracking-[1.3px] text-[#7d8ea0]">The honest price</div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="font-['Fraunces_Variable',_Georgia,_serif] text-[22px] font-medium text-white">
                <motion.span className="inline-block text-[#f4ba12]"
                  animate={reduce ? undefined : priceSettled ? { scale: [1, 1.14, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}>
                  <CountUp value={priceAllIn} delay={900} reduce={reduce} onDone={() => setPriceSettled(true)} />
                </motion.span> all-in
              </span>
              <span className="text-xs text-[#8397a8]">{rupee(govtFee)} govt + {rupee(helpFee)} our help</span>
            </div>
          </motion.div>
        </motion.div>

        {/* what happens next */}
        <div className="mt-3.5 flex flex-col gap-2.5">
          {steps.map((label, i) => {
            const on = i < shownSteps;
            return (
              <div key={i} className="flex items-center gap-2.5 text-[13px] text-[#cdd9e3] transition-all duration-300"
                style={{ opacity: on ? 1 : 0, transform: on ? "translateX(0)" : "translateX(-6px)" }}>
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#f2b705]/[0.16]">
                  <svg viewBox="0 0 16 13" width="12" height="10" className="overflow-visible" aria-hidden>
                    <motion.path d="M2 7 L6 11 L14 2" fill="none" stroke="#f4ba12" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                      initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 0.3, ease: "easeOut" }} />
                  </svg>
                </span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-auto pt-4" onPointerMove={onFootMove} onPointerLeave={onFootLeave}>
          <motion.div style={reduce ? undefined : { x: mx, y: my }} {...rise(1.5)}>
            <Button onClick={onContinue}
              className="relative flex h-auto w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] py-4 text-[15px] font-semibold text-[#0b1622] hover:brightness-105 active:scale-[.985]">
              {ctaLabel}
              <motion.span aria-hidden className="inline-flex" animate={reduce ? undefined : { x: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>→</motion.span>
              {!reduce && (
                <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/45 blur-[2px]"
                  initial={{ x: "-170%" }} animate={{ x: "360%" }} transition={{ duration: 2.6, delay: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
              )}
            </Button>
          </motion.div>
          <motion.p className="mt-2.5 text-center text-xs text-[#6f8091]" {...rise(1.6)}>{microcopy}</motion.p>
        </div>
      </div>
    </section>
  );
}
