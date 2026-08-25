import React, { useEffect, useRef } from "react";
import "./Particles.css";

/**
 * Particles
 * Canvas-based floating particles (not DOM divs) so we can render
 * a lot of them without hover-jank. Particles drift upward slowly,
 * twinkle, and shift a couple of pixels toward the cursor for a
 * subtle depth/parallax effect. Respects prefers-reduced-motion.
 */
export default function Particles({ mouse, count = 46 }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const mouseRef = useRef(mouse);

  mouseRef.current = mouse;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width, height, dpr;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeParticle = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 0.35 + 0.08,
      drift: (Math.random() - 0.5) * 0.15,
      twinkleSpeed: Math.random() * 0.02 + 0.006,
      twinklePhase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.5 ? "79, 140, 255" : "34, 211, 238",
    });

    resize();
    particlesRef.current = Array.from({ length: count }, makeParticle);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    if (prefersReduced) {
      // Draw a single static frame and stop.
      draw(0);
      return () => window.removeEventListener("resize", onResize);
    }

    let frame = 0;
    function draw() {
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      const mx = (mouseRef.current?.x ?? 0.5) - 0.5;
      const my = (mouseRef.current?.y ?? 0.5) - 0.5;

      for (const p of particlesRef.current) {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const twinkle =
          0.35 + Math.abs(Math.sin(frame * p.twinkleSpeed + p.twinklePhase)) * 0.65;

        const px = p.x - mx * 18;
        const py = p.y - my * 18;

        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue}, ${twinkle})`;
        ctx.shadowColor = `rgba(${p.hue}, ${twinkle})`;
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="particles-canvas"
      aria-hidden="true"
    />
  );
}
