import React from "react";
import useInView from "./useInView";
import "./Reveal.css";

/**
 * Reveal
 * Wraps any content and fades + slides it up the first time it
 * scrolls into view. Use `delay` (ms) to stagger a list of children
 * -  e.g. feature cards revealing one after another instead of all
 * at once.
 *
 * <Reveal delay={index * 90}><FeatureCard .../></Reveal>
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}) {
  const [ref, inView] = useInView({ threshold: 0.15, rootMargin: "-40px" });

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "reveal--visible" : ""} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
