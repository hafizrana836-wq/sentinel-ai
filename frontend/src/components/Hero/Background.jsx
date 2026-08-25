import React, { useEffect, useRef } from "react";
import "./Background.css";

/**
 * Background
 * Layered atmosphere behind the hero: a slow-drifting AI grid,
 * two soft light rays that rotate on their own axis, a radial
 * "signal glow" that follows the cursor, and a fine noise
 * texture on top to kill any flat/plasticky gradient look.
 *
 * Everything here is decorative -> aria-hidden, pointer-events: none.
 */
export default function Background({ mouse }) {
  const glowRef = useRef(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    // Smoothly move the radial glow toward the cursor position.
    // mouse.x / mouse.y are normalized 0..1 values from Hero.jsx
    el.style.setProperty("--glow-x", `${mouse.x * 100}%`);
    el.style.setProperty("--glow-y", `${mouse.y * 100}%`);
  }, [mouse]);

  return (
    <div className="bg-layer" aria-hidden="true">
      <div className="bg-void" />
      <div className="bg-grid" />
      <div className="bg-ray bg-ray--one" />
      <div className="bg-ray bg-ray--two" />
      <div ref={glowRef} className="bg-cursor-glow" />
      <div className="bg-noise" />
      <div className="bg-vignette" />
    </div>
  );
}
