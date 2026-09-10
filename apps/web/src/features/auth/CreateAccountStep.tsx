/**
 * CreateAccountStep.tsx — passwordless "Create your account" (Sahi PWA).
 * Stack: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, Motion.  (npm i motion)
 *
 * Micro-interactions:
 *   - Mobile/Email toggle: a gold indicator SLIDES between the two; body copy,
 *     label, placeholder and CTA label CROSS-FADE on switch.
 *   - Input: animated gold border + golden glow on focus (with a +91 prefix on
 *     mobile); a gold check DRAWS IN once the number/email is valid.
 *   - CTA: disabled-dark until valid, then #f4ba12 → #ffce3b with glow pulse +
 *     send-icon nudge + tap ripple + shimmer + magnetic pull.
 *   All motion gated by useReducedMotion.
 *
 * SAFE TO ADD: self-contained; only external import is the shadcn Button;
 * no router coupling. onSendCode({ method, value }); value is "+91XXXXXXXXXX"
 * for mobile or the email string.
 *
 * USAGE:
 *   <CreateAccountStep
 *     onBack={() => navigate(-1)}
 *     onSendCode={({ method, value }) => sendOtp(method, value)}
 *     onSignIn={() => navigate("/signin")} />
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, useSpring } from "motion/react";
// This repo has no shadcn `Button` and no `@/` path alias (the other steps use a
// plain <button>), so `Button` is a bare native button element — used exactly
// like the shadcn Button (className/onClick/onPointerDown/disabled/children).
const Button = "button" as const;

type Method = "mobile" | "email";

export interface CreateAccountStepProps {
  initialMethod?: Method;
  /** True while the caller's OTP send is in flight — CTA shows "Sending…" and locks. */
  pending?: boolean;
  /** Send failure to surface under the CTA (the send is async and can fail). */
  error?: string | null;
  onSendCode?: (data: { method: Method; value: string }) => void;
  onSignIn?: () => void;
  onTerms?: () => void;
  onPrivacy?: () => void;
  onBack?: () => void;
}

const COPY: Record<Method, { body: string; label: string; placeholder: string; cta: string }> = {
  mobile: { body: "Enter your mobile and we'll text you a code — that's your login. No password to remember.", label: "Mobile number", placeholder: "98765 43210", cta: "Send code by SMS" },
  email: { body: "Enter your email and we'll send you a code — that's your login. No password to remember.", label: "Email address", placeholder: "you@example.com", cta: "Send code by email" },
};

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function CreateAccountStep({
  initialMethod = "mobile", pending = false, error = null, onSendCode, onSignIn, onTerms, onPrivacy, onBack,
}: CreateAccountStepProps) {
  const reduce = useReducedMotion();
  const [method, setMethod] = useState<Method>(initialMethod);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const digits = value.replace(/\D/g, "").slice(0, 10);
  const valid = method === "mobile" ? digits.length === 10 : emailOk(value);
  const active = focused || value.length > 0;

  const mx = useSpring(0, { stiffness: 200, damping: 15 });
  const my = useSpring(0, { stiffness: 200, damping: 15 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; s: number }[]>([]);
  const ripId = useRef(0);

  const switchTo = (m: Method) => {
    if (m === method) return;
    if (navigator.vibrate) { try { navigator.vibrate(9); } catch { /* no-op */ } }
    setMethod(m); setValue(""); setFocused(false);
  };
  const onChange = (raw: string) => {
    if (method === "mobile") {
      const d = raw.replace(/\D/g, "").slice(0, 10);
      setValue(d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);
    } else setValue(raw);
  };
  const submit = () => {
    if (!valid || pending) return;
    onSendCode?.({ method, value: method === "mobile" ? `+91${digits}` : value.trim() });
  };

  const onFootMove = (e: React.PointerEvent) => {
    if (reduce || !valid || pending) return;
    const b = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - b.left - b.width / 2) * 0.05); my.set((e.clientY - b.top - b.height / 2) * 0.12);
  };
  const onFootLeave = () => { mx.set(0); my.set(0); };
  const onBtnDown = (e: React.PointerEvent) => {
    if (reduce || !valid) return;
    const b = e.currentTarget.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    setRipples((r) => [...r, { id: ripId.current++, x: e.clientX - b.left, y: e.clientY - b.top, s: size }]);
    if (navigator.vibrate) { try { navigator.vibrate(11); } catch { /* no-op */ } }
  };

  const c = COPY[method];

  return (
    <section className="flex min-h-full flex-col bg-[#0b1622] px-[18px] pt-5 text-white">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-[#1a2a39] pb-4 text-[17px] font-semibold">
        <button type="button" onClick={onBack} aria-label="Back" className="text-[#e6edf3] hover:opacity-80">←</button>
        Create your account
      </div>

      {/* body (cross-fades on switch) */}
      <div className="mt-[18px] min-h-[44px] text-sm leading-relaxed text-[#93a3b3]">
        <AnimatePresence mode="wait">
          <motion.p key={method}
            initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.18 }}>
            {c.body}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* segmented toggle — elastic squash-stretch pill + popping icons + gold glow */}
      <div className="relative mt-4 flex rounded-xl border border-[#22384a] bg-[#101f2d] p-1" role="tablist" aria-label="Login method">
        <motion.div aria-hidden className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[9px]"
          style={{ transformOrigin: "center", background: "linear-gradient(180deg,#ffce3b,#f4ba12)", boxShadow: "0 5px 16px -4px rgba(242,183,5,0.65)" }}
          animate={reduce
            ? { x: method === "email" ? "100%" : "0%" }
            : { x: method === "email" ? "100%" : "0%", scaleX: [1, 1.16, 1] }}
          transition={reduce ? { duration: 0 } : {
            x: { type: "spring", stiffness: 420, damping: 26 },
            scaleX: { duration: 0.36, times: [0, 0.45, 1], ease: "easeOut" },
          }} />
        {(["mobile", "email"] as Method[]).map((m) => {
          const on = method === m;
          return (
            <button key={m} type="button" role="tab" aria-selected={on} onClick={() => switchTo(m)}
              className={`relative z-[1] flex flex-1 items-center justify-center gap-2 rounded-[9px] py-2.5 text-sm font-semibold transition-colors ${on ? "text-[#0b1622]" : "text-[#9fb0c0]"}`}>
              <motion.span aria-hidden className="inline-flex"
                animate={on && !reduce ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ duration: 0.34, ease: "easeOut" }}>
                {m === "mobile" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>
                )}
              </motion.span>
              {m === "mobile" ? "Mobile" : "Email"}
            </button>
          );
        })}
      </div>

      {/* input */}
      <label htmlFor="ca-input" className="mb-1.5 mt-[18px] block text-sm font-medium transition-colors" style={{ color: focused ? "#f4ba12" : "#cdd9e3" }}>
        {c.label}
      </label>
      <div className="relative overflow-hidden rounded-[13px] p-[1.6px] transition-[background-color,box-shadow] duration-300"
        style={{ backgroundColor: active ? "rgba(242,183,5,0.5)" : "#2b3f52", boxShadow: focused ? "0 0 0 3px rgba(242,183,5,0.15), 0 0 20px rgba(242,183,5,0.30)" : "none" }}>
        {focused && !reduce && (
          <motion.div aria-hidden className="pointer-events-none absolute"
            style={{ inset: "-60%", background: "conic-gradient(from 0deg, transparent 0 55%, #f4ba12 72%, #ffce3b 82%, transparent 92%)" }}
            animate={{ rotate: 360 }} transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }} />
        )}
        <div className="relative z-[1] flex items-center rounded-[11.6px] py-[13px] pl-3.5 pr-10 transition-[background-image] duration-200"
          style={{ backgroundColor: "#0e1c29", backgroundImage: active ? "linear-gradient(rgba(242,183,5,0.07),rgba(242,183,5,0.07))" : "none" }}>
          {method === "mobile" && <span className="mr-2 text-[15px] text-[#9fb0c0]">+91</span>}
          <input id="ca-input" value={value} inputMode={method === "mobile" ? "numeric" : "email"}
            onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder={c.placeholder}
            className="w-full flex-1 border-0 bg-transparent text-[15px] text-white outline-none placeholder:text-[#5f7387]" />
        </div>
        <span className="pointer-events-none absolute right-3.5 top-1/2 z-[2] -translate-y-1/2">
          <motion.svg viewBox="0 0 18 15" width="18" height="15" className="overflow-visible" aria-hidden
            initial={false} animate={{ opacity: valid ? 1 : 0 }} transition={{ duration: 0.2 }}>
            <motion.path d="M2 8 L7 13 L16 2" fill="none" stroke="#f4ba12" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
              initial={false} animate={{ pathLength: valid ? 1 : 0 }} transition={{ duration: 0.35, ease: "easeOut" }} />
          </motion.svg>
        </span>
      </div>
      <p className="mt-2.5 text-[12.5px] text-[#8397a8]"><b className="font-medium text-[#f4ba12]">No payment yet</b> — this just saves your progress.</p>

      {/* footer */}
      <div className="mt-auto pb-5 pt-4">
        <p className="mb-3 text-center text-[11.5px] text-[#6f8091]">
          By continuing you agree to our{" "}
          <button type="button" onClick={onTerms} className="text-[#9fb0c0] underline underline-offset-2">Terms</button> &amp;{" "}
          <button type="button" onClick={onPrivacy} className="text-[#9fb0c0] underline underline-offset-2">Privacy</button>.
        </p>
        {error && (
          <p role="alert" className="mb-3 text-center text-[13px] text-[#f87171]">{error}</p>
        )}
        <div onPointerMove={onFootMove} onPointerLeave={onFootLeave}>
          <motion.div className="rounded-xl" style={reduce ? undefined : { x: mx, y: my }}
            animate={reduce ? undefined : valid && !pending
              ? { boxShadow: ["0 6px 20px -8px rgba(242,183,5,0.5)", "0 9px 30px -6px rgba(242,183,5,0.85)", "0 6px 20px -8px rgba(242,183,5,0.5)"] }
              : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
            <Button onClick={submit} onPointerDown={onBtnDown} disabled={!valid || pending} aria-busy={pending || undefined}
              className={[
                "relative flex h-auto w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-[15px] font-semibold transition-colors",
                valid ? "bg-gradient-to-r from-[#f4ba12] to-[#ffce3b] text-[#0b1622] hover:brightness-105 active:scale-[.985]"
                      : "cursor-not-allowed bg-[#182838] text-[#5f7387] hover:bg-[#182838]",
                pending ? "cursor-wait opacity-90" : "",
              ].join(" ")}>
              {valid && !pending && !reduce && (
                <motion.span aria-hidden className="inline-flex" animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2Z" /></svg>
                </motion.span>
              )}
              <AnimatePresence mode="wait">
                <motion.span key={pending ? "sending" : c.cta} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.15 }}>
                  {pending ? "Sending…" : c.cta}
                </motion.span>
              </AnimatePresence>
              {valid && !pending && !reduce && (
                <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/50 blur-[2px]"
                  initial={{ x: "-170%" }} animate={{ x: "360%" }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }} />
              )}
              {ripples.map((r) => (
                <motion.span key={r.id} aria-hidden className="pointer-events-none absolute rounded-full bg-white/50"
                  initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}
                  onAnimationComplete={() => setRipples((p) => p.filter((x) => x.id !== r.id))}
                  style={{ left: r.x - r.s / 2, top: r.y - r.s / 2, width: r.s, height: r.s }} />
              ))}
            </Button>
          </motion.div>
        </div>
        <p className="mt-3.5 text-center text-[13px] text-[#8397a8]">
          Already have an account?{" "}
          <button type="button" onClick={onSignIn} className="font-semibold text-[#f4ba12]">Sign in</button>
        </p>
      </div>
    </section>
  );
}
