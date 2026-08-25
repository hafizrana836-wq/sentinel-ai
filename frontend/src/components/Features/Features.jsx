import React from "react";
import FeatureCard from "./FeatureCard";
import featuresData from "./featuresData";
import Reveal from "../Reveal";
import "./Features.css";

/**
 * Features
 * Section header + responsive grid of FeatureCard. Content lives in
 * featuresData.js so this file only handles layout. Header and each
 * card fade/slide in as the section scrolls into view, cards staggered
 * left-to-right / top-to-bottom by index.
 */
export default function Features() {
  return (
    <section className="features">
      <Reveal className="features-header">
        <span className="features-eyebrow">WHAT SENTINEL CHECKS</span>
        <h2 className="features-title">Every scan, six angles of coverage</h2>
        <p className="features-subcopy">
          One click runs the checks a manual security review would take a day
          to finish.
        </p>
      </Reveal>

      <div className="features-grid">
        {featuresData.map((f, i) => (
          <Reveal key={f.id} delay={i * 90}>
            <FeatureCard
              icon={f.icon}
              title={f.title}
              description={f.description}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
