/**
 * SideScrollbar.tsx — the "journey rail" overlay for the qualify step (Sahi PWA).
 *
 * A faithful React port of SideScrollbar.reference.html. Purely additive and
 * self-contained: a fixed overlay that returns null when its scroll container
 * doesn't actually scroll, so it can never affect layout when there's nothing
 * to scroll.
 *
 * Effects (all reproduced from the reference):
 *   1. Velocity-ELASTIC thumb — stretches with scroll speed, springs back.
 *   2. WAYPOINT ticks (from [data-waypoint] elements) — light gold as passed,
 *      with a light haptic detent on device.
 *   3. Drag LABEL — shows the current section name while scrubbing the thumb.
 *   4. DESTINATION bloom — the data-waypoint="Next" tick blooms into a ring.
 *   5. Auto-hide when idle, down-nudge hint at the top, bottom "more below" fade.
 *   6. Respects prefers-reduced-motion (stretch / bounce / hint / haptics off).
 *
 * Scroll target: pass `scrollRef` pointing at any element inside the scroll
 * container (e.g. the step's own <section>). The component resolves the nearest
 * scrollable ancestor itself, so no shared component (AppShell) is touched. If
 * no scrollable ancestor exists it falls back to the window.
 *
 * Only external import is Motion — no shadcn.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

interface Waypoint {
  frac: number;
  label: string;
  dest: boolean;
}

export interface SideScrollbarProps {
  /** A ref to any element inside the scroll container (or the container itself). */
  scrollRef?: React.RefObject<HTMLElement | null>;
}

const RAIL_TOP = 16; // px inset of the rail within the overlay root (matches reference)

/** Nearest scrollable ancestor by overflow style (independent of current size),
 * so we can observe a container that isn't overflowing yet. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") return node;
    node = node.parentElement;
  }
  return null;
}

const CSS = `
.ssb-root{pointer-events:none;z-index:50;}
.ssb-fade{position:absolute;left:0;right:0;bottom:0;height:52px;pointer-events:none;z-index:3;
  background:linear-gradient(180deg,rgba(11,22,34,0),#0b1622);transition:opacity .3s;opacity:0;}
.ssb-rail{position:absolute;top:${RAIL_TOP}px;bottom:${RAIL_TOP}px;right:8px;width:3px;border-radius:3px;
  background:rgba(255,255,255,.06);z-index:6;opacity:0;transition:opacity .4s;}
.ssb-rail.ssb-show{opacity:1;}
.ssb-fill{position:absolute;left:0;top:0;width:100%;border-radius:3px;
  background:linear-gradient(180deg,rgba(242,183,5,.55),rgba(242,183,5,.12));}
.ssb-tick{position:absolute;right:-2.5px;width:8px;height:8px;margin-top:-4px;border-radius:50%;
  background:#243748;border:1px solid #35506a;transition:background .25s,transform .25s,box-shadow .25s;}
.ssb-tick.ssb-lit{background:#f2b705;border-color:#f2b705;transform:scale(1.15);box-shadow:0 0 8px rgba(242,183,5,.7);}
.ssb-tick.ssb-dest{width:11px;height:11px;margin-top:-5.5px;right:-4px;}
.ssb-tick.ssb-dest.ssb-bloom{transform:scale(1.35);box-shadow:0 0 0 4px rgba(242,183,5,.25),0 0 12px rgba(242,183,5,.9);}
.ssb-thumb{position:absolute;left:50%;transform:translateX(-50%);width:5px;border-radius:4px;pointer-events:auto;
  background:linear-gradient(180deg,#ffe89a,#f2b705);box-shadow:0 0 10px rgba(242,183,5,.6);cursor:grab;
  transition:height .13s cubic-bezier(.34,1.56,.64,1),width .18s,box-shadow .18s;}
.ssb-rail.ssb-active .ssb-thumb{width:8px;box-shadow:0 0 18px rgba(242,183,5,.95);cursor:grabbing;}
.ssb-label{position:absolute;right:20px;z-index:7;background:#101f2d;border:1px solid #2f4457;color:#fff;font-size:12px;
  font-weight:500;padding:6px 11px;border-radius:20px;white-space:nowrap;opacity:0;transform:translateX(6px);
  transition:opacity .18s,transform .18s;pointer-events:none;box-shadow:0 8px 20px -8px rgba(0,0,0,.7);}
.ssb-label.ssb-show{opacity:1;transform:translateX(0);}
.ssb-hint{position:absolute;right:4px;color:#f2b705;z-index:7;opacity:0;transition:opacity .3s;pointer-events:none;display:flex;}
.ssb-hint.ssb-show{opacity:1;animation:ssbhint 1.3s ease-in-out infinite;}
@keyframes ssbhint{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
@media(prefers-reduced-motion:reduce){.ssb-thumb{transition:width .18s}.ssb-hint.ssb-show{animation:none}}
`;

export default function SideScrollbar({ scrollRef }: SideScrollbarProps) {
  const reduce = useReducedMotion();

  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [isWindow, setIsWindow] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wpSig = useRef("");

  // --- resolve the scroll container + observe whether it actually scrolls ---
  useEffect(() => {
    const start = scrollRef?.current ?? null;
    const el = getScrollParent(start);
    const doc = document.scrollingElement as HTMLElement | null;
    const target = el ?? doc;
    const win = !el;
    setScroller(target);
    setIsWindow(win);
    if (!target) return;

    const metrics = () => {
      const sh = win ? document.documentElement.scrollHeight : target.scrollHeight;
      const ch = win ? window.innerHeight : target.clientHeight;
      return sh - ch;
    };
    const check = () => setScrollable(metrics() > 1);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(target);
    if (!win && target.firstElementChild) ro.observe(target.firstElementChild);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [scrollRef]);

  // --- drive the rail while it is scrollable ---
  useEffect(() => {
    if (!scroller || !scrollable) return;

    const win = isWindow;
    const scrollTarget: HTMLElement | Window = win ? window : scroller;
    const queryRoot: ParentNode = win ? document : scroller;

    const getScrollTop = () => (win ? window.scrollY : scroller.scrollTop);
    const getClientH = () => (win ? window.innerHeight : scroller.clientHeight);
    const getScrollH = () => (win ? document.documentElement.scrollHeight : scroller.scrollHeight);
    const setScrollTop = (v: number) => {
      if (win) window.scrollTo(0, v);
      else scroller.scrollTop = v;
    };
    const containerRect = () =>
      win
        ? ({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight } as const)
        : scroller.getBoundingClientRect();

    // measure waypoints from [data-waypoint] elements inside the scroll content
    const measure = () => {
      const max = getScrollH() - getClientH() || 1;
      const scrollTop = getScrollTop();
      const baseTop = win ? 0 : scroller.getBoundingClientRect().top;
      const nodes = Array.from(queryRoot.querySelectorAll<HTMLElement>("[data-waypoint]"));
      const wps: Waypoint[] = nodes.map((el) => {
        const r = el.getBoundingClientRect();
        const top = r.top - baseTop + scrollTop;
        const label = el.getAttribute("data-waypoint") || "";
        return { frac: Math.min(1, Math.max(0, top / max)), label, dest: label === "Next" };
      });
      const sig = wps.map((w) => `${w.label}:${w.frac.toFixed(3)}`).join("|");
      if (sig !== wpSig.current) {
        wpSig.current = sig;
        setWaypoints(wps);
      }
      return wps;
    };

    let wps = measure();

    // position the fixed overlay onto the scroll container's rect
    const positionRoot = () => {
      const root = rootRef.current;
      if (!root) return;
      const c = containerRect();
      root.style.position = "fixed";
      root.style.top = `${c.top}px`;
      root.style.left = `${c.left}px`;
      root.style.width = `${c.width}px`;
      root.style.height = `${c.height}px`;
    };

    let lastTop = getScrollTop();
    let lastT = performance.now();
    let litN = 0;
    let dragging = false;
    let baseH = 28;
    let idle: number | undefined;
    let resetV: number | undefined;

    const railH = () => railRef.current?.clientHeight ?? 0;

    const render = (vel: number) => {
      const rail = railRef.current,
        thumb = thumbRef.current,
        fill = fillRef.current,
        label = labelRef.current,
        hint = hintRef.current,
        fade = fadeRef.current;
      if (!rail || !thumb || !fill) return;

      positionRoot();
      const max = getScrollH() - getClientH();
      if (max <= 1) {
        rail.classList.remove("ssb-show");
        if (fade) fade.style.opacity = "0";
        return;
      }
      const scrollTop = getScrollTop();
      const frac = scrollTop / max;
      const rh = railH();
      baseH = Math.max(24, rh * (getClientH() / getScrollH()));
      const stretch = reduce ? 0 : Math.min(26, Math.abs(vel || 0) * 38);
      const th = baseH + stretch;
      const top = frac * (rh - baseH);

      thumb.style.height = `${th}px`;
      thumb.style.top = `${top}px`;
      fill.style.height = `${top + baseH}px`;

      let lit = 0;
      wps.forEach((w, i) => {
        const t = tickRefs.current[i];
        if (!t) return;
        const on = frac >= w.frac - 0.008;
        t.classList.toggle("ssb-lit", on);
        if (on) lit++;
        if (w.dest) t.classList.toggle("ssb-bloom", frac >= w.frac - 0.01);
      });
      if (lit > litN && !reduce && navigator.vibrate) {
        try {
          navigator.vibrate(6);
        } catch {
          /* no-op */
        }
      }
      litN = lit;

      if (hint) {
        hint.style.top = `${RAIL_TOP + top + baseH + 6}px`;
        hint.classList.toggle("ssb-show", scrollTop < 24);
      }
      if (fade) fade.style.opacity = scrollTop >= max - 4 ? "0" : "1";

      if (dragging && label) {
        let cur = "";
        for (let i = 0; i < wps.length; i++) {
          const w = wps[i];
          if (w && frac >= w.frac - 0.02) cur = w.label;
        }
        label.textContent = cur || (wps[0]?.label ?? "");
        label.style.top = `${RAIL_TOP + top + th / 2 - 14}px`;
      }
    };

    const wake = () => {
      railRef.current?.classList.add("ssb-show");
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (!dragging) railRef.current?.classList.remove("ssb-show");
      }, 1200);
    };

    const onScroll = () => {
      const now = performance.now();
      const dt = now - lastT || 16;
      const st = getScrollTop();
      const v = (st - lastTop) / dt;
      lastTop = st;
      lastT = now;
      render(v);
      wake();
      window.clearTimeout(resetV);
      resetV = window.setTimeout(() => render(0), 90);
    };

    const onResize = () => {
      wps = measure();
      render(0);
    };

    const thumb = thumbRef.current;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      railRef.current?.classList.add("ssb-active", "ssb-show");
      labelRef.current?.classList.add("ssb-show");
      try {
        thumb?.setPointerCapture(e.pointerId);
      } catch {
        /* no active pointer (synthetic/edge) — capture is optional */
      }
      render(0);
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const rail = railRef.current;
      if (!rail) return;
      const r = rail.getBoundingClientRect();
      const y = e.clientY - r.top - baseH / 2;
      const frac = Math.min(1, Math.max(0, y / (r.height - baseH)));
      setScrollTop(frac * (getScrollH() - getClientH()));
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      railRef.current?.classList.remove("ssb-active");
      labelRef.current?.classList.remove("ssb-show");
      try {
        thumb?.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
      wake();
    };

    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    thumb?.addEventListener("pointerdown", onPointerDown);
    thumb?.addEventListener("pointermove", onPointerMove);
    thumb?.addEventListener("pointerup", onPointerUp);

    // first paint: briefly reveal the rail so the affordance is discoverable
    const kickoff = window.setTimeout(() => {
      wps = measure();
      render(0);
      railRef.current?.classList.add("ssb-show");
      window.setTimeout(() => {
        if (!dragging) railRef.current?.classList.remove("ssb-show");
      }, 1500);
    }, 300);

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      thumb?.removeEventListener("pointerdown", onPointerDown);
      thumb?.removeEventListener("pointermove", onPointerMove);
      thumb?.removeEventListener("pointerup", onPointerUp);
      window.clearTimeout(idle);
      window.clearTimeout(resetV);
      window.clearTimeout(kickoff);
    };
  }, [scroller, isWindow, scrollable, waypoints, reduce]);

  if (!scroller || !scrollable) return null;

  return (
    <>
      <style>{CSS}</style>
      <div ref={rootRef} className="ssb-root" style={{ position: "fixed", top: 0, left: 0 }}>
        <div ref={fadeRef} className="ssb-fade" />
        <div ref={railRef} className="ssb-rail">
          <div ref={fillRef} className="ssb-fill" />
          {waypoints.map((w, i) => (
            <div
              key={`${w.label}-${i}`}
              ref={(el) => {
                tickRefs.current[i] = el;
              }}
              className={`ssb-tick${w.dest ? " ssb-dest" : ""}`}
              style={{ top: `${w.frac * 100}%` }}
            />
          ))}
          <motion.div ref={thumbRef} className="ssb-thumb" aria-hidden />
        </div>
        <div ref={labelRef} className="ssb-label" />
        <span ref={hintRef} className="ssb-hint" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
    </>
  );
}
