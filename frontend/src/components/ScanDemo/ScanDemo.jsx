import React from "react";
import ScanTerminal from "./ScanTerminal";
import Reveal from "../Reveal";
import "./ScanDemo.css";

/**
 * ScanDemo
 * Section wrapper around the live-feel terminal. Copy fades in first,
 * the terminal follows a beat later so the eye lands on the words
 * before the animated visual grabs attention.
 */
export default function ScanDemo() {
  return (
    <section className="scan-demo" id="live-demo">
      <div className="scan-demo__inner">
        <Reveal className="scan-demo__copy">
          <span className="scan-demo__eyebrow">SEE IT WORK</span>
          <h2 className="scan-demo__title">
            Watch a scan run in real time
          </h2>
          <p className="scan-demo__subcopy">
            This is the exact sequence Sentinel runs on your domain —
            certificate, headers, ports, and CVEs, checked live and
            reported the moment each one finishes.
          </p>
        </Reveal>

        <Reveal delay={150} className="scan-demo__visual">
          <ScanTerminal />
        </Reveal>
      </div>
    </section>
  );
}
