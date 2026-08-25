import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Background from "./Background";
import Particles from "./Particles";
import SentinelCore from "./SentinelCore";
import HeroButtons from "./HeroButtons";
import Reveal from "../Reveal";
import "./Hero.css";

/**
 * Hero
 * Combines all Hero sub-components into the full landing section.
 *
 * onStartScan / onViewDemo are optional overrides. If the parent
 * doesn't pass them, Hero falls back to sensible defaults:
 *  - Start scan -> navigate to /scanner
 *  - View demo  -> smooth-scroll down to the on-page ScanDemo section
 *    (id="live-demo", set in ScanDemo.jsx)
 */
export default function Hero({ onStartScan, onViewDemo }) {
  const sectionRef = useRef(null);
  const navigate = useNavigate();
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  const handleMouseMove = useCallback((e) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMouse({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const handleStartScan =
    onStartScan ||
    (() => {
      navigate("/scanner");
    });

  const handleViewDemo =
    onViewDemo ||
    (() => {
      document
        .getElementById("live-demo")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

  return (
    <section
      ref={sectionRef}
      className="hero"
      onMouseMove={handleMouseMove}
    >
      <Background mouse={mouse} />
      <Particles mouse={mouse} />

      <div className="hero-content">
        <Reveal delay={0}>
          <span className="hero-eyebrow">AI-POWERED WEBSITE SECURITY SCANNER</span>
        </Reveal>

        <Reveal delay={90}>
          <h1 className="hero-title">
            Find the vulnerability
            <br />
            before someone else does.
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <p className="hero-subcopy">
            Sentinel AI scans SSL, headers, open ports, and known CVEs in
            seconds, then tells you exactly what to fix and why it matters.
          </p>
        </Reveal>

        <Reveal delay={270}>
          <HeroButtons onStartScan={handleStartScan} onViewDemo={handleViewDemo} />
        </Reveal>

        <Reveal delay={380} className="hero-core-wrap">
          <SentinelCore mouse={mouse} />
        </Reveal>
      </div>
    </section>
  );
}
