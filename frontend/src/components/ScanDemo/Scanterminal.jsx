import React, { useEffect, useRef, useState } from "react";
import scanScript from "./scanSteps";
import "./ScanTerminal.css";

const TARGET_URL = "example.com";
const TYPE_SPEED = 65; // ms per character
const RESET_PAUSE = 2400; // ms to hold the final score before looping

/**
 * ScanTerminal
 * A fake but convincing terminal window: types out a target URL,
 * then plays through scanSteps.js as a running log — status lines,
 * a checklist, port results, a CVE hit, a report-generation bar,
 * and a final risk score — before looping. Pure setTimeout state
 * machine, no animation library needed.
 */
export default function ScanTerminal() {
  const [typed, setTyped] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [lines, setLines] = useState([]);
  const bodyRef = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const schedule = (fn, delay) => {
    const t = setTimeout(fn, delay);
    timers.current.push(t);
  };

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      // Static end-state, no loop, no timers.
      setTyped(TARGET_URL);
      setTypingDone(true);
      setLines(scanScript);
      return;
    }

    function runCycle() {
      setTyped("");
      setTypingDone(false);
      setLines([]);

      // 1. Type the URL character by character
      TARGET_URL.split("").forEach((_, i) => {
        schedule(() => {
          setTyped(TARGET_URL.slice(0, i + 1));
        }, TYPE_SPEED * (i + 1));
      });

      const afterTyping = TYPE_SPEED * TARGET_URL.length + 300;
      schedule(() => setTypingDone(true), afterTyping);

      // 2. Walk through the script, each item appending as a new log line
      let elapsed = afterTyping + 300;
      scanScript.forEach((item) => {
        elapsed += item.delay;
        schedule(() => {
          setLines((prev) => [...prev, item]);
        }, elapsed);
      });

      // 3. Hold the final state, then restart
      schedule(runCycle, elapsed + RESET_PAUSE);
    }

    runCycle();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the log scrolled to the latest line as it grows
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="scan-terminal">
      <div className="scan-terminal__bar">
        <span className="scan-dot scan-dot--red" />
        <span className="scan-dot scan-dot--yellow" />
        <span className="scan-dot scan-dot--green" />
        <span className="scan-terminal__title">sentinel — scan</span>
      </div>

      <div className="scan-terminal__body" ref={bodyRef}>
        <div className="scan-line">
          <span className="scan-prompt">$</span>
          <span className="scan-url">{typed}</span>
          {!typingDone && <span className="scan-cursor" />}
        </div>

        {lines.map((item) => (
          <ScanLine key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ScanLine({ item }) {
  switch (item.kind) {
    case "status":
      return <div className="scan-line scan-line--muted">{item.text}</div>;

    case "check":
      return (
        <div className="scan-line scan-row scan-row--done">
          <span className="scan-row__mark">✓</span>
          <span className="scan-row__label">{item.text}</span>
        </div>
      );

    case "port":
      return (
        <div className={`scan-line scan-row scan-row--port scan-row--${item.state}`}>
          <span className="scan-row__label">{item.text}</span>
          <span className="scan-row__tag">{item.detail}</span>
        </div>
      );

    case "cve":
      return (
        <div className="scan-line scan-row scan-row--cve">
          <span className="scan-row__label">{item.text}</span>
          <span className="scan-row__tag">{item.detail}</span>
        </div>
      );

    case "progress":
      return (
        <div className="scan-line scan-progress-row">
          <div className="scan-progress">
            <div
              className="scan-progress__fill"
              style={{ width: `${item.value}%` }}
            />
          </div>
          <span className="scan-progress__value">{item.value}%</span>
        </div>
      );

    case "score": {
      const risk =
        item.value >= 70 ? "high" : item.value >= 40 ? "medium" : "low";
      return (
        <div className={`scan-line scan-score scan-score--${risk}`}>
          Risk score: <strong>{item.value}</strong>
        </div>
      );
    }

    default:
      return null;
  }
}
