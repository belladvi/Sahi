/**
 * AboutKitchenStep.tsx — registration step "Tell us about your kitchen" (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Fields: business name (required) · Designation radio pills (required) ·
 * description (optional).
 *
 * Micro-interactions:
 *   - Both text boxes: animated golden-yellow border on focus (a gold light
 *     travels the edge) + a golden GLOW bloom + the chips' gold tint; a solid
 *     gold border when filled; neutral hairline at rest.
 *   - Name: gold check draws in when valid. Description: textarea auto-grows.
 *   - Designation pills: select POP + radio dot springs in + gold border/tint/glow.
 *   - Continue: enabled when name + designation set; approved #f4ba12 → #ffce3b
 *     gradient with shimmer + magnetic pull, PLUS a gold glow pulse, a nudging
 *     → arrow, and a tap ripple from the press point (with haptic).
 *   All motion gated by useReducedMotion.
 *
 * SAFE TO ADD: self-contained; no router coupling. onContinue receives
 * { name, designation, description }.
 *
 * USAGE:
 *   <AboutKitchenStep makes={["Cakes","Cookies"]}
 *     onBack={() => navigate(-1)}
 *     onContinue={(d) => { save(d); navigate("/next"); }} />
 */

import { useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import JourneyRail from "../../components/JourneyRail";
// This repo has no shadcn `Button` and no `@/` path alias (the other steps use a
// plain <button>), so `Button` is a bare native button element — used exactly
// like the shadcn Button (className/onClick/disabled/onPointerDown/children).
const Button = "button" as const;

export interface AboutKitchenStepProps {
  title?: string;
  makes?: string[];
  designations?: string[];
  initialName?: string;
  initialDesignation?: string;
  initialDescription?: string;
  onContinue?: (data: { name: string; designation: string; description: string }) => void;
  onBack?: () => void;
}

const DEFAULT_DESIGNATIONS = ["Individual", "Partner", "Proprietor", "Co-operative Society", "Other"];

/* animated golden-yellow border wrapper with glow */
function GoldBorder({
  focused, filled, reduce, children,
}: { focused: boolean; filled: boolean; reduce: boolean | null; children: React.ReactNode }) {
  const active = focused || filled;
  return (
    <div className="relative overflow-hidden rounded-[13px] p-[1.6px] transition-[background-color,box-shadow] duration-300"
      style={{
        backgroundColor: active ? "rgba(242,183,5,0.5)" : "#2b3f52",
        boxShadow: focused ? "0 0 0 3px rgba(242,183,5,0.15), 0 0 20px rgba(242,183,5,0.30)" : "none",
      }}>
      {focused && !reduce && (
        <motion.div aria-hidden className="pointer-events-none absolute"
          style={{ inset: "-60%", background: "conic-gradient(from 0deg, transparent 0 55%, #f4ba12 72%, #ffce3b 82%, transparent 92%)" }}
          animate={{ rotate: 360 }} transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }} />
      )}
      {children}
    </div>
  );
}

const innerStyle = (active: boolean): React.CSSProperties => ({
  backgroundColor: "#0e1c29",
  backgroundImage: active ? "linear-gradient(rgba(242,183,5,0.07),rgba(242,183,5,0.07))" : "none",
});

export default function AboutKitchenStep({
  title = "Tell us about your kitchen",
  makes = [],
  designations = DEFAULT_DESIGNATIONS,
  initialName = "",
  initialDesignation = "",
  initialDescription = "",
  onContinue,
  onBack,
}: AboutKitchenStepProps) {
  const reduce = useReducedMotion();
  const [name, setName] = useState(initialName);
  const [designation, setDesignation] = useState(initialDesignation);
  const [description, setDescription] = useState(initialDescription);
  const [focus, setFocus] = useState<"name" | "desc" | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; s: number }[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const ripId = useRef(0);

  const nameValid = name.trim().length > 0;
  const descFilled = description.trim().length > 0;
  const canProceed = nameValid && designation.length > 0;
  // journey rail reflects completion of the two required fields (name → designation);
  // it reaches full exactly when Continue enables.
  const filledCount = (nameValid ? 1 : 0) + (designation.length > 0 ? 1 : 0);

  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const onFootMove = (e: React.PointerEvent) => {
    if (reduce || !canProceed) return;
    const b = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.06);
    my.set((e.clientY - b.top - b.height / 2) * 0.12);
  };
  const onFootLeave = () => { mx.set(0); my.set(0); };

  const onDesc = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    const el = taRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }
  };
  const pick = (d: string) => {
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch { /* no-op */ } }
    setDesignation(d);
  };
  const onBtnDown = (e: React.PointerEvent) => {
    if (reduce || !canProceed) return;
    const b = e.currentTarget.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    setRipples((r) => [...r, { id: ripId.current++, x: e.clientX - b.left, y: e.clientY - b.top, s: size }]);
    if (navigator.vibrate) { try { navigator.vibrate(11); } catch { /* no-op */ } }
  };

  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } });
  const inputCls = "relative z-[1] block w-full rounded-[11.6px] border-0 text-[15px] text-white outline-none transition-[background-image] duration-200 placeholder:text-[#5f7387]";

  return (
    <section className="relative flex min-h-full flex-col bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* journey rail — step-driven overlay; fills as the required fields are completed */}
      <JourneyRail step={filledCount + 1} totalSteps={3} />
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[#1a2a39] pb-4 text-[17px] font-semibold">
        <button type="button" onClick={onBack} aria-label="Back" className="text-[#e6edf3] hover:opacity-80">←</button>
        {title}
      </div>

      {/* recap chips */}
      {makes.length > 0 && (
        <motion.div className="mt-4 flex flex-wrap items-center gap-2" {...rise(0.05)}>
          <span className="mr-0.5 text-xs text-[#7d8ea0]">You make</span>
          {makes.map((m) => (
            <span key={m} className="flex items-center gap-1.5 rounded-2xl border border-[#f2b705]/40 bg-[#f2b705]/[0.12] px-2.5 py-1 text-xs text-[#f4ba12]">
              <span aria-hidden className="text-[10px]">✓</span>{m}
            </span>
          ))}
        </motion.div>
      )}

      {/* business name */}
      <motion.div className="mt-[18px]" {...rise(0.1)}>
        <label htmlFor="biz-name" className="mb-1.5 block text-sm font-medium transition-colors" style={{ color: focus === "name" ? "#f4ba12" : "#cdd9e3" }}>
          Your business name <span className="text-[#f4ba12]">*</span>
        </label>
        <GoldBorder focused={focus === "name"} filled={nameValid} reduce={reduce}>
          <input id="biz-name" value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocus("name")} onBlur={() => setFocus(null)}
            placeholder="e.g. Riya's Home Bakes"
            style={innerStyle(focus === "name" || nameValid)}
            className={`${inputCls} py-[13px] pl-3.5 pr-10`} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 z-[2] -translate-y-1/2">
            <motion.svg viewBox="0 0 18 15" width="18" height="15" className="overflow-visible" aria-hidden
              initial={false} animate={{ opacity: nameValid ? 1 : 0 }} transition={{ duration: 0.2 }}>
              <motion.path d="M2 8 L7 13 L16 2" fill="none" stroke="#f4ba12" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                initial={false} animate={{ pathLength: nameValid ? 1 : 0 }} transition={{ duration: 0.35, ease: "easeOut" }} />
            </motion.svg>
          </span>
        </GoldBorder>
        <p className="mt-1.5 text-xs text-[#7d8ea0]">No brand yet? Your own name works.</p>
      </motion.div>

      {/* designation */}
      <motion.div className="mt-[18px]" {...rise(0.16)}>
        <div className="mb-2 text-sm font-medium text-[#cdd9e3]">Designation <span className="text-[#f4ba12]">*</span></div>
        <div role="radiogroup" aria-label="Designation" className="flex flex-wrap gap-2.5">
          {designations.map((d) => {
            const sel = d === designation;
            return (
              <motion.button key={d} type="button" role="radio" aria-checked={sel} onClick={() => pick(d)}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                animate={reduce ? undefined : {
                  boxShadow: sel ? "0 0 0 1px rgba(242,183,5,0.4), 0 6px 16px -8px rgba(242,183,5,0.55)" : "0 0 0 0 rgba(0,0,0,0)",
                  scale: sel ? [1, 1.05, 1] : 1,
                }}
                transition={{ duration: 0.32 }}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b705]/50",
                  sel ? "border-[#f4ba12] bg-[#f2b705]/[0.10] text-white" : "border-[#2b3f52] bg-[#0e1c29] text-[#cdd9e3] hover:border-[#38516a]",
                ].join(" ")}>
                <span className={["relative h-4 w-4 flex-shrink-0 rounded-full border-2 transition-colors", sel ? "border-[#f4ba12]" : "border-[#35506a]"].join(" ")}>
                  <motion.span className="absolute inset-[3px] rounded-full bg-[#f4ba12]" initial={false}
                    animate={{ scale: sel ? 1 : 0 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 22 }} />
                </span>
                {d}
              </motion.button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[#7d8ea0]">Not sure? Most home kitchens are &ldquo;Individual&rdquo;.</p>
      </motion.div>

      {/* description */}
      <motion.div className="mt-[18px]" {...rise(0.22)}>
        <label htmlFor="biz-desc" className="mb-1.5 block text-sm font-medium transition-colors" style={{ color: focus === "desc" ? "#f4ba12" : "#cdd9e3" }}>
          In your words, what do you make?
        </label>
        <GoldBorder focused={focus === "desc"} filled={descFilled} reduce={reduce}>
          <textarea id="biz-desc" ref={taRef} value={description} rows={3}
            onChange={onDesc}
            onFocus={() => setFocus("desc")} onBlur={() => setFocus(null)}
            placeholder="e.g. Custom cakes, cupcakes and brownies, baked to order from my home kitchen."
            style={innerStyle(focus === "desc" || descFilled)}
            className={`${inputCls} min-h-[92px] resize-none overflow-hidden p-3.5 leading-relaxed`} />
        </GoldBorder>
        <p className="mt-1.5 text-xs text-[#7d8ea0]">A sentence is plenty.</p>
      </motion.div>

      {/* trust line */}
      <motion.div className="mt-5 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#8397a8]" {...rise(0.3)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f4ba12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-shrink-0" aria-hidden>
          <path d="M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" />
        </svg>
        <span>We'll handle the official paperwork — you'll never pick a licence category.</span>
      </motion.div>

      {/* sticky CTA — glow pulse + arrow nudge + tap ripple + shimmer + magnetic */}
      <div className="sticky bottom-0 mt-auto bg-gradient-to-b from-transparent via-[#0b1622]/80 to-[#0b1622] pb-5 pt-6"
        onPointerMove={onFootMove} onPointerLeave={onFootLeave}>
        <motion.div className="rounded-xl" style={reduce ? undefined : { x: mx, y: my }}
          animate={reduce ? undefined : canProceed
            ? { boxShadow: ["0 6px 20px -8px rgba(242,183,5,0.5)", "0 9px 30px -6px rgba(242,183,5,0.85)", "0 6px 20px -8px rgba(242,183,5,0.5)"] }
            : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
          <Button
            onClick={() => canProceed && onContinue?.({ name: name.trim(), designation, description: description.trim() })}
            onPointerDown={onBtnDown}
            disabled={!canProceed}
            className={[
              "relative flex h-auto w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-[15px] font-semibold transition-colors",
              canProceed
                ? "bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] text-[#0b1622] hover:brightness-105 active:scale-[.985]"
                : "cursor-not-allowed bg-[#182838] text-[#5f7387] hover:bg-[#182838]",
            ].join(" ")}
          >
            Continue
            <motion.span aria-hidden className="inline-flex"
              animate={canProceed && !reduce ? { x: [0, 4, 0] } : { x: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>→</motion.span>
            {canProceed && !reduce && (
              <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/45 blur-[2px]"
                initial={{ x: "-170%" }} animate={{ x: "360%" }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
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
      </div>
    </section>
  );
}
