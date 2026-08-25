import React, { useEffect, useRef } from "react";
import "./PageBackground.css";

/**
 * PageBackground
 * Mounted ONCE at the top of the app (in App.jsx), sits fixed behind
 * every section so the "premium AI atmosphere" continues as the
 * visitor scrolls past Hero, Features, ScanDemo, Footer, instead of
 * each section having its own flat dark background.
 *
 * Lighter than Hero's own Background/Particles (no cursor tracking,
 * fewer particles) since this one runs for the entire page lifetime,
 * not just while hovering the hero.
 */
export default function PageBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width, height, dpr, particles, raf;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeParticle = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.3,
      speed: Math.random() * 0.18 + 0.04,
      twinkleSpeed: Math.random() * 0.015 + 0.004,
      twinklePhase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.5 ? "79, 140, 255" : "34, 211, 238",
    });

    resize();
    particles = Array.from({ length: 34 }, makeParticle);

    const onResize = () => {
      resize();
      particles = Array.from({ length: 34 }, makeParticle);
    };
    window.addEventListener("resize", onResize);

    if (prefersReduced) {
      ctx.clearRect(0, 0, width, height);
      return () => window.removeEventListener("resize", onResize);
    }

    let frame = 0;
    function draw() {
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < -6) {
          p.y = height + 6;
          p.x = Math.random() * width;
        }
        const twinkle =
          0.25 + Math.abs(Math.sin(frame * p.twinkleSpeed + p.twinklePhase)) * 0.55;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue}, ${twinkle})`;
        ctx.shadowColor = `rgba(${p.hue}, ${twinkle})`;
        ctx.shadowBlur = 5;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="page-bg" aria-hidden="true">
      <div className="page-bg__void" />
      <div className="page-bg__glow page-bg__glow--a" />
      <div className="page-bg__glow page-bg__glow--b" />
      <div className="page-bg__grid" />
      <div className="page-bg__ray page-bg__ray--one" />
      <div className="page-bg__ray page-bg__ray--two" />
      <canvas ref={canvasRef} className="page-bg__particles" />
      <div className="page-bg__noise" />
    </div>
  );
}
