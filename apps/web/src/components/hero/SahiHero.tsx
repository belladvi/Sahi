/**
 * SahiHero — mobile-first hero for the Sahi FSSAI PWA (dark navy + yellow).
 *
 * Based on the approved v2 (single-column, fits the 390px app frame). The copy
 * and CTA are the critical path and render with zero animation dependency; the
 * layered 3D credential (back panel + card face + gold seal + status chips) and
 * its pointer/drag parallax are pure CSS transforms (see sahi-hero.css) and are
 * fully disabled under prefers-reduced-motion. No motion library, no runtime
 * third-party font/icon fetch (Fraunces + Inter are self-hosted via fontsource,
 * imported in main.tsx; icons are inline SVG).
 */

import { useEffect, useRef } from 'react';
import './sahi-hero.css';

export interface SahiHeroProps {
  onCheckEligibility?: () => void;
  onSignIn?: () => void;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3 5 6v6c0 4 3 6.7 7 8 4-1.3 7-4 7-8V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function SahiHero({ onCheckEligibility, onSignIn }: SahiHeroProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLDivElement>(null);

  // Decorative parallax tilt. Guarded for reduced-motion and non-browser/jsdom
  // (no matchMedia). Works with mouse (desktop / installed PWA) and drag (touch).
  useEffect(() => {
    const stage = stageRef.current;
    const rot = rotRef.current;
    if (!stage || !rot) return;
    if (typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const move = (x: number, y: number) => {
      const b = stage.getBoundingClientRect();
      const px = (x - b.left) / b.width - 0.5;
      const py = (y - b.top) / b.height - 0.5;
      rot.style.setProperty('--rx', `${py * -12}deg`);
      rot.style.setProperty('--ry', `${-13 + px * 20}deg`);
    };
    const onPointer = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onLeave = () => {
      rot.style.setProperty('--rx', '0deg');
      rot.style.setProperty('--ry', '-13deg');
    };
    stage.addEventListener('pointermove', onPointer);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      stage.removeEventListener('pointermove', onPointer);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <section aria-label="Sahi — FSSAI licence, done for you" className="sahi-hero">
      {/* header */}
      <div className="relative z-10 flex items-center justify-between">
        <span className="sahi-display text-[19px] font-medium text-white">Sahi</span>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded text-[13px] text-[#f2b705] hover:opacity-80"
        >
          Sign in
        </button>
      </div>

      {/* layered 3D credential (decorative) */}
      <div ref={stageRef} className="sahi-stage">
        <div className="sahi-float">
          <div ref={rotRef} className="sahi-rot">
            <div className="sahi-back" />
            <div className="sahi-card">
              <div className="flex items-center justify-between px-[13px] pt-[13px]">
                <span className="text-[9px] tracking-[1.4px] text-[#8aa0b4]">FSSAI · GOVT OF INDIA</span>
                <CheckIcon className="size-3.5 text-[#f2b705]" />
              </div>
              <div className="absolute inset-x-0 bottom-3.5 text-center">
                <span className="sahi-display block text-[13px] tracking-[2px] text-white">VERIFIED</span>
                <span className="mt-[3px] block text-[9px] text-[#6f8496]">Licence no. issued</span>
              </div>
            </div>
            <div className="sahi-seal" aria-hidden>
              <span className="text-[22px] leading-none text-[#4a3402]">★</span>
            </div>
            <span className="sahi-chip sahi-chip--1">
              <CheckIcon className="size-3 text-[#f2b705]" />
              Filed
            </span>
            <span className="sahi-chip sahi-chip--2">
              <ShieldCheckIcon className="size-3 text-[#f2b705]" />
              Approved
            </span>
          </div>
        </div>
      </div>

      {/* copy — critical path */}
      <div className="relative z-10 mt-3 text-center">
        <span className="mb-[13px] inline-block rounded-full bg-[#f2b705]/12 px-3 py-[5px] text-[11px] text-[#f2b705]">
          Government-authorised process
        </span>
        <h1 className="sahi-display mb-[11px] text-[27px] font-medium leading-[1.12] tracking-[-0.2px] text-white">
          Your FSSAI licence,
          <br />
          <span className="text-[#f2b705]">done for you.</span>
        </h1>
        <p className="mx-auto mb-[18px] max-w-[265px] text-[13px] leading-[1.55] text-[#93a3b3]">
          If you make, sell, or serve food, the law requires an FSSAI licence. We handle the whole
          thing — no confusing portal, no overpriced agent.
        </p>
        <button
          type="button"
          onClick={onCheckEligibility}
          className="min-h-11 rounded-xl bg-[#f2b705] px-6 py-3.5 text-sm font-medium text-[#0b1622] transition hover:brightness-105 active:scale-[0.98]"
        >
          Check if you qualify — free
        </button>
        <p className="mt-[11px] text-[11px] text-[#6f8091]">
          No signup needed to check. Takes about a minute.
        </p>
      </div>
    </section>
  );
}
