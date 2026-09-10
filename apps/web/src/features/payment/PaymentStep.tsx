/**
 * PaymentStep.tsx — "One payment, all-in" screen (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Micro-interactions:
 *   - Hero ₹ total COUNTS UP.
 *   - Breakdown ASSEMBLES: the two line items slide in, then "You pay" pops as
 *     their sum (the math is shown, not asserted).
 *   - "What's included" checks DRAW IN one by one.
 *   - UPI/Card toggle: elastic squash-stretch pill + popping icons + haptic.
 *   - CTA: glow pulse + shimmer + magnetic + ripple, with a secure lock.
 *   All motion gated by useReducedMotion.
 *
 * SAFE TO ADD: self-contained; only external import is the shadcn Button;
 * no router coupling. onPay(method) / onBack.
 *
 * USAGE:
 *   <PaymentStep priceAllIn={599} govtFee={100} helpFee={499}
 *     onBack={() => navigate(-1)} onPay={(method) => startCheckout(method)} />
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
// This repo has no shadcn `Button` and no `@/` path alias (the other steps use a
// plain <button>), so `Button` is a bare native button element — used exactly
// like the shadcn Button (className/onClick/onPointerDown/children).
const Button = "button" as const;

type PayMethod = "upi" | "card";

export interface PaymentStepProps {
  priceAllIn?: number;
  govtFee?: number;
  helpFee?: number;
  included?: string[];
  demo?: boolean;
  initialMethod?: PayMethod;
  onPay?: (method: PayMethod) => void;
  onBack?: () => void;
}

const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function CountUp({ value, delay = 0, reduce }: { value: number; delay?: number; reduce: boolean | null }) {
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setN(value); return; }
    let raf = 0, t0 = 0;
    const start = window.setTimeout(() => {
      const tick = (t: number) => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / 750); setN(Math.round(k * value)); if (k < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { window.clearTimeout(start); cancelAnimationFrame(raf); };
  }, [value, delay, reduce]);
  return <>{rupee(n)}</>;
}

const Icon = ({ name }: { name: string }) => {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    upi: <><rect x="3" y="3" width="7" height="7" rx="1" {...p} /><rect x="14" y="3" width="7" height="7" rx="1" {...p} /><rect x="3" y="14" width="7" height="7" rx="1" {...p} /><path d="M14 14h3v3M20 14v.01M17 20h.01M20 17v4" {...p} /></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2.5" {...p} /><path d="M2 10h20" {...p} /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" {...p} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></>,
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>{paths[name]}</svg>;
};

const DEFAULT_INCLUDED = [
  "We fill in and file your application",
  "We choose the right licence category for you",
  "If the government raises a query, we fix it — free",
];

export default function PaymentStep({
  priceAllIn = 599,
  govtFee = 100,
  helpFee = 499,
  included = DEFAULT_INCLUDED,
  demo = false,
  initialMethod = "upi",
  onPay,
  onBack,
}: PaymentStepProps) {
  const reduce = useReducedMotion();
  const [method, setMethod] = useState<PayMethod>(initialMethod);
  const [shownSteps, setShownSteps] = useState(reduce ? included.length : 0);

  useEffect(() => {
    if (reduce) return;
    const timers = included.map((_, i) => window.setTimeout(() => setShownSteps((s) => Math.max(s, i + 1)), 1150 + i * 200));
    return () => timers.forEach(clearTimeout);
  }, [reduce, included]);

  const switchTo = (m: PayMethod) => { if (m !== method) { if (navigator.vibrate) { try { navigator.vibrate(9); } catch { /* no-op */ } } setMethod(m); } };

  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; s: number }[]>([]);
  const ripId = useRef(0);
  const onFootMove = (e: React.PointerEvent) => { if (reduce) return; const b = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - b.left - b.width / 2) * 0.05); my.set((e.clientY - b.top - b.height / 2) * 0.12); };
  const onFootLeave = () => { mx.set(0); my.set(0); };
  const onBtnDown = (e: React.PointerEvent) => { if (reduce) return; const b = e.currentTarget.getBoundingClientRect(); const s = Math.max(b.width, b.height); setRipples((r) => [...r, { id: ripId.current++, x: e.clientX - b.left, y: e.clientY - b.top, s }]); if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* no-op */ } } };

  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } });

  return (
    <section className="flex min-h-full flex-col bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[#1a2a39] pb-4 text-[17px] font-semibold">
        <button type="button" onClick={onBack} aria-label="Back" className="text-[#e6edf3] hover:opacity-80">←</button>
        One payment, all-in
      </div>

      {/* hero */}
      <motion.p className="mt-[18px] mb-1 text-[13px] text-[#8397a8]" {...rise(0.05)}>Everything included</motion.p>
      <motion.h1 className="mb-4 font-['Fraunces_Variable',_Georgia,_serif] text-[40px] font-medium" {...rise(0.12)}>
        <CountUp value={priceAllIn} delay={120} reduce={reduce} /> <span className="font-['Inter'] text-lg font-normal text-[#8397a8]">all-in</span>
      </motion.h1>

      {/* breakdown — assembles */}
      <motion.div className="rounded-2xl border border-[#22384a] bg-[#101f2d] p-4" {...rise(0.2)}>
        <motion.div className="flex justify-between py-1.5 text-sm text-[#93a3b3]"
          initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.45 }}>
          Government fee <b className="font-medium text-[#cdd9e3]">{rupee(govtFee)}</b>
        </motion.div>
        <motion.div className="flex justify-between py-1.5 text-sm text-[#93a3b3]"
          initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.6 }}>
          Our help (done-for-you) <b className="font-medium text-[#cdd9e3]">{rupee(helpFee)}</b>
        </motion.div>
        <div className="my-2 h-px bg-[#22384a]" />
        <motion.div className="flex items-center justify-between"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.82, type: "spring", stiffness: 300, damping: 16 }}>
          <span className="text-base font-semibold text-white">You pay</span>
          <span className="text-lg font-bold text-[#f4ba12]">{rupee(priceAllIn)}</span>
        </motion.div>
      </motion.div>

      {/* what's included */}
      <motion.div className="mt-5 mb-2.5 text-[15px] font-semibold text-white" {...rise(0.95)}>What's included</motion.div>
      <div className="flex flex-col gap-2.5">
        {included.map((label, i) => {
          const on = i < shownSteps;
          return (
            <div key={i} className="flex items-start gap-2.5 text-[13px] leading-snug text-[#cdd9e3] transition-all duration-300"
              style={{ opacity: on ? 1 : 0, transform: on ? "translateX(0)" : "translateX(-6px)" }}>
              <span className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#f2b705]/[0.16]">
                <svg viewBox="0 0 16 13" width="12" height="10" className="overflow-visible" aria-hidden>
                  <motion.path d="M2 7 L6 11 L14 2" fill="none" stroke="#f4ba12" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                    initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 0.3, ease: "easeOut" }} />
                </svg>
              </span>
              {label}
            </div>
          );
        })}
      </div>

      {/* pay with — elastic toggle */}
      <motion.div className="mt-[22px] mb-2 text-sm font-semibold text-white" {...rise(1.05)}>Pay with</motion.div>
      <motion.div className="relative flex rounded-xl border border-[#22384a] bg-[#101f2d] p-1" role="tablist" aria-label="Payment method" {...rise(1.1)}>
        <motion.div aria-hidden className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[9px]"
          style={{ transformOrigin: "center", background: "linear-gradient(180deg,#ffce3b,#f4ba12)", boxShadow: "0 5px 16px -4px rgba(242,183,5,0.6)" }}
          animate={reduce ? { x: method === "card" ? "100%" : "0%" } : { x: method === "card" ? "100%" : "0%", scaleX: [1, 1.16, 1] }}
          transition={reduce ? { duration: 0 } : { x: { type: "spring", stiffness: 420, damping: 26 }, scaleX: { duration: 0.36, times: [0, 0.45, 1], ease: "easeOut" } }} />
        {(["upi", "card"] as PayMethod[]).map((m) => {
          const on = method === m;
          return (
            <button key={m} type="button" role="tab" aria-selected={on} onClick={() => switchTo(m)}
              className={`relative z-[1] flex flex-1 items-center justify-center gap-2 rounded-[9px] py-2.5 text-sm font-semibold transition-colors ${on ? "text-[#0b1622]" : "text-[#9fb0c0]"}`}>
              <motion.span aria-hidden className="inline-flex" animate={on && !reduce ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ duration: 0.34, ease: "easeOut" }}>
                <Icon name={m} />
              </motion.span>
              {m === "upi" ? "UPI" : "Card"}
            </button>
          );
        })}
      </motion.div>

      {demo && (
        <motion.div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#22384a] bg-[#101f2d] px-3 py-2.5 text-[12px] text-[#8397a8]" {...rise(1.15)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7d8ea0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /></svg>
          Demo payment — no money will be charged.
        </motion.div>
      )}

      {/* CTA */}
      <div className="mt-auto pb-5 pt-4" onPointerMove={onFootMove} onPointerLeave={onFootLeave}>
        <motion.div className="rounded-xl" style={reduce ? undefined : { x: mx, y: my }}
          animate={reduce ? undefined : { boxShadow: ["0 6px 20px -8px rgba(242,183,5,0.5)", "0 9px 30px -6px rgba(242,183,5,0.85)", "0 6px 20px -8px rgba(242,183,5,0.5)"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}>
          <Button onClick={() => onPay?.(method)} onPointerDown={onBtnDown}
            className="relative flex h-auto w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] py-4 text-[15px] font-semibold text-[#0b1622] hover:brightness-105 active:scale-[.985]">
            <span className="inline-flex"><Icon name="lock" /></span>
            Pay {rupee(priceAllIn)}
            {!reduce && (
              <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/50 blur-[2px]"
                initial={{ x: "-170%" }} animate={{ x: "360%" }} transition={{ duration: 2.8, delay: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
            )}
            {ripples.map((r) => (
              <motion.span key={r.id} aria-hidden className="pointer-events-none absolute rounded-full bg-white/50"
                initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}
                onAnimationComplete={() => setRipples((p) => p.filter((x) => x.id !== r.id))}
                style={{ left: r.x - r.s / 2, top: r.y - r.s / 2, width: r.s, height: r.s }} />
            ))}
          </Button>
        </motion.div>
        <motion.p className="mt-2.5 text-center text-xs text-[#6f8091]" {...rise(1.3)}>One payment. No surprises.</motion.p>
      </div>
    </section>
  );
}
