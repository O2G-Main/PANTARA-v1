"use client";
import { useEffect, useRef } from "react";

// Integer-only adaptation of React Bits Count Up for dashboard totals.
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / 420);
      node.textContent = String(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <><b aria-hidden="true" ref={ref}>{value}</b><b className="sr-only">{value}</b></>;
}
