import React, { useCallback, useRef } from "react";
import "./FeatureCard.css";

/**
 * FeatureCard
 * A single card with three coordinated hover effects:
 *  - lift: whole card rises 6px with a soft shadow
 *  - spotlight: a radial glow follows the cursor inside the card
 *    (position passed via CSS custom properties, updated on mousemove)
 *  - border sweep: a thin gradient border animates around the edge
 * All three are driven by a single `.is-hover` state via CSS, kept
 * cheap by only writing two custom properties per mousemove frame.
 */
export default function FeatureCard({ icon: Icon, title, description }) {
  const cardRef = useRef(null);

  const handleMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div ref={cardRef} className="feature-card" onMouseMove={handleMove}>
      <span className="feature-card__border" aria-hidden="true" />
      <span className="feature-card__spotlight" aria-hidden="true" />

      <div className="feature-card__icon">
        <Icon />
      </div>

      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__desc">{description}</p>
    </div>
  );
}
