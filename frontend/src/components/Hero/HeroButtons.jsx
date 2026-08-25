import React, { useState } from "react";
import Loader from "../Loader";
import "./HeroButtons.css";

/**
 * HeroButtons
 * Primary "Start Scan" action + secondary "View Live Demo" action.
 * Primary shows a brief Loader while onStartScan is in flight, so
 * clicking never feels like nothing happened. Secondary uses an
 * animated gradient border. Both keep a visible focus ring for
 * keyboard users.
 */
export default function HeroButtons({ onStartScan, onViewDemo }) {
  const [loading, setLoading] = useState(false);

  const handleStartScan = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onStartScan?.();
    } finally {
      // Keep the spinner visible briefly even for instant callbacks,
      // so the click always reads as acknowledged.
      setTimeout(() => setLoading(false), 500);
    }
  };

  return (
    <div className="hero-buttons">
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleStartScan}
        disabled={loading}
      >
        <span className="btn__label">
          {loading ? "Starting scan..." : "Start free scan"}
        </span>
        {loading && <Loader size={15} />}
        <span className="btn__sheen" aria-hidden="true" />
      </button>

      <button type="button" className="btn btn--ghost" onClick={onViewDemo}>
        <span className="btn__label">Watch a live scan</span>
        <span className="btn__arrow" aria-hidden="true">→</span>
      </button>
    </div>
  );
}
