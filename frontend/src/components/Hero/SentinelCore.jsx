import React, { useCallback, useRef, useState } from "react";
import "./SentinelCore.css";

/**
 * SentinelCore
 * The signature element of Sentinel AI. Built as a layered "iris":
 * an outer hex ring, a rotating segmented scan ring, an inner glass
 * core with a pulsing eye, and orbiting network nodes. The whole
 * assembly tilts in 3D toward the cursor (parallax) so it reads as
 * a physical object reacting to the visitor, not a flat animation.
 *
 * No external 3D library - CSS perspective + transform does the job
 * and keeps the bundle light.
 */
export default function SentinelCore({ mouse }) {
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handleMove = useCallback((e) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: py * -14, ry: px * 16 });
  }, []);

  const handleLeave = useCallback(() => setTilt({ rx: 0, ry: 0 }), []);

  // Slight ambient drift even without the mouse, driven by the
  // shared mouse prop (page-level pointer) so the core feels alive
  // even before the visitor touches this exact spot.
  const ambientX = ((mouse?.x ?? 0.5) - 0.5) * 6;
  const ambientY = ((mouse?.y ?? 0.5) - 0.5) * 4;

  const nodes = [0, 60, 120, 180, 240, 300];
  const particles = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div
      ref={wrapRef}
      className="core-stage"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div
        className="core-tilt"
        style={{
          transform: `rotateX(${tilt.rx + ambientY}deg) rotateY(${
            tilt.ry + ambientX
          }deg)`,
        }}
      >
        {/* Energy background */}
        <div className="core-energy-ring core-energy-ring--one" />
        <div className="core-energy-ring core-energy-ring--two" />

        {/* Floating particles */}
        <div className="core-particles">
          {particles.map((i) => (
            <span
              key={i}
              className="core-particle"
              style={{
                top: `${(i * 37) % 100}%`,
                left: `${(i * 53) % 100}%`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* Outer hex frame */}
        <svg className="core-hex" viewBox="0 0 240 240" aria-hidden="true">
          <polygon
            points="120,10 214,65 214,175 120,230 26,175 26,65"
            className="core-hex__shape"
          />
          <polygon
            points="120,30 196,73 196,167 120,210 44,167 44,73"
            className="core-hex__shape core-hex__shape--inner"
          />
        </svg>

        {/* Rotating scan ring */}
        <div className="core-scan-ring">
          <div className="core-scan-sweep" />
        </div>

        {/* Orbiting network nodes */}
        <div className="core-orbit">
          {nodes.map((deg) => (
            <span
              key={deg}
              className="core-node"
              style={{ transform: `rotate(${deg}deg) translateX(108px)` }}
            >
              <span className="core-node__dot" />
            </span>
          ))}
        </div>

        {/* Neural connection lines - center to each node, same 108px
            real-pixel radius as the nodes above so they line up exactly */}
        <svg className="core-links" viewBox="-120 -120 240 240" aria-hidden="true">
          {nodes.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1="0"
                y1="0"
                x2={Math.cos(rad) * 108}
                y2={Math.sin(rad) * 108}
              />
            );
          })}
        </svg>

        {/* Glass core + pulsing eye */}
        <div className="core-glass">
          <div className="core-eye">
            <div className="core-eye__ring" />
            <div className="core-eye__pupil" />
          </div>
        </div>

        <div className="core-shadow" />
      </div>

      <span className="core-label">SENTINEL CORE — AI NEURAL INTELLIGENCE</span>
    </div>
  );
}
