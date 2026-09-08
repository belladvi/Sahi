/**
 * JourneyRail.tsx — step-driven "journey rail" for the qualify steps (Sahi PWA).
 *
 * Unlike a scrollbar, this rail reflects the wizard's STEP progress and is
 * ALWAYS visible, so it stays alive even when a step fits on one screen with no
 * scrolling (which is the point — no forced overrun, the CTA stays reachable).
 *
 * Micro-interactions (all gated by useReducedMotion → static fallback):
 *   - a gold FILL that springs down to the current step,
 *   - waypoint TICKS that light gold as they're passed, current one glowing,
 *   - a glowing THUMB that springs to the current step + a gentle idle PULSE,
 *   - a light HAPTIC detent on each step change.
 *
 * Self-contained; only external import is Motion. Absolutely positioned inside
 * the step's (relative) <section>, so it touches no shared component.
 */

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Pre-account funnel: make → cook → sales → result → kitchen → what you'll need.
 * Every screen that shows the rail uses this total so the ticks/positions match. */
export const FUNNEL_TOTAL_STEPS = 6;

export interface JourneyRailProps {
  /** 1-based current step. */
  step: number;
  totalSteps: number;
}

export default function JourneyRail({ step, totalSteps }: JourneyRailProps) {
  const reduce = useReducedMotion();
  const prev = useRef(step);

  // light haptic detent when the step advances (or goes back)
  useEffect(() => {
    if (step !== prev.current) {
      if (!reduce && navigator.vibrate) {
        try {
          navigator.vibrate(6);
        } catch {
          /* no-op */
        }
      }
      prev.current = step;
    }
  }, [step, reduce]);

  const denom = Math.max(1, totalSteps - 1);
  const frac = Math.min(1, Math.max(0, (step - 1) / denom)); // 0..1 along the rail
  const springy = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 220, damping: 24 };

  return (
    <div aria-hidden className="pointer-events-none absolute right-2 top-4 bottom-4 z-[6] w-[3px]">
      {/* track */}
      <div className="absolute inset-0 rounded-full bg-white/[0.06]" />

      {/* fill — springs down to the current step */}
      <motion.div
        className="absolute left-0 top-0 w-full rounded-full"
        style={{ background: "linear-gradient(180deg,rgba(242,183,5,.55),rgba(242,183,5,.12))" }}
        initial={false}
        animate={{ height: `${frac * 100}%` }}
        transition={springy}
      />

      {/* waypoint ticks — one per step, lit as passed */}
      {Array.from({ length: totalSteps }).map((_, i) => {
        const t = i / denom;
        const passed = i <= step - 1;
        const current = i === step - 1;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border"
            style={{ top: `${t * 100}%`, marginTop: "-4px" }}
            initial={false}
            animate={{
              backgroundColor: passed ? "#f2b705" : "#243748",
              borderColor: passed ? "#f2b705" : "#35506a",
              scale: current ? 1.2 : passed ? 1.1 : 1,
              boxShadow: current
                ? "0 0 10px rgba(242,183,5,.85)"
                : passed
                  ? "0 0 6px rgba(242,183,5,.5)"
                  : "0 0 0 0 rgba(0,0,0,0)",
            }}
            transition={{ duration: 0.3 }}
          />
        );
      })}

      {/* glowing thumb — springs to the current step; gentle idle glow via a
          box-shadow pulse (not a scaling child), so it can never poke past the
          container edge and trigger a flickering scrollbar / layout jitter. */}
      <motion.span
        className="absolute left-1/2 h-3 w-[7px] -translate-x-1/2 rounded-full"
        style={{ background: "linear-gradient(180deg,#ffe89a,#f2b705)", marginTop: "-6px" }}
        initial={false}
        animate={{
          top: `${frac * 100}%`,
          boxShadow: reduce
            ? "0 0 10px rgba(242,183,5,.6)"
            : [
                "0 0 8px 1px rgba(242,183,5,.5)",
                "0 0 16px 3px rgba(242,183,5,.95)",
                "0 0 8px 1px rgba(242,183,5,.5)",
              ],
        }}
        transition={{
          top: springy,
          boxShadow: reduce ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </div>
  );
}
