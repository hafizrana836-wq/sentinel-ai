import React from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Plus, FileText } from "lucide-react";
import "./DashboardHero.css";

/* Signature element: animated radar-style "Sentinel Core" orb */
function SentinelCore() {
  return (
    <div className="core-wrap" aria-hidden="true">
      <svg viewBox="0 0 240 240" className="core-svg">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5B8DEF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5B8DEF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5B8DEF" stopOpacity="0" />
            <stop offset="100%" stopColor="#5B8DEF" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="110" fill="url(#coreGlow)" />
        <circle cx="120" cy="120" r="95" fill="none" stroke="#232C46" strokeWidth="1" />
        <circle cx="120" cy="120" r="72" fill="none" stroke="#232C46" strokeWidth="1" />
        <circle cx="120" cy="120" r="49" fill="none" stroke="#232C46" strokeWidth="1" />
        <circle cx="120" cy="120" r="95" fill="none" stroke="#3DD68C" strokeWidth="1.2" strokeDasharray="2 8" className="ring-spin-slow" />
        <g className="ring-spin">
          <path d="M120 120 L120 25 A95 95 0 0 1 202 72 Z" fill="url(#sweepGrad)" opacity="0.5" />
        </g>
        <circle cx="120" cy="120" r="30" fill="#0F1626" stroke="#5B8DEF" strokeWidth="1.4" />
        <circle cx="120" cy="120" r="5" fill="#5B8DEF" className="core-pulse" />
        {[...Array(10)].map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          const r = 95;
          return (
            <circle
              key={i}
              cx={120 + r * Math.cos(a)}
              cy={120 + r * Math.sin(a)}
              r="2"
              fill="#3DD68C"
              opacity={i % 3 === 0 ? 0.9 : 0.25}
            />
          );
        })}
      </svg>
    </div>
  );
}

const RISK_COLOR = { Low: "#3DD68C", Medium: "#F2A65A", High: "#F0554B" };

function riskFromScore(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return "Low";
  if (score >= 50) return "Medium";
  return "High";
}

// userName: real account name only — "Guest" is reserved for when there
// truly is no logged-in user, not shown just because a field was missing.
export default function DashboardHero({
  userName,
  lastScan = "—",
  score = null,
  findings = null,
  assetsMonitored = null,
  totalScans = null,
  latestScanId = null,
}) {
  const navigate = useNavigate();
  const risk = riskFromScore(score) || "Low";
  const riskColor = RISK_COLOR[risk];
  const hasScore = score !== null && score !== undefined;

  return (
    <section className="hero" style={{ display: "block" }}>
      <p className="eyebrow"><Radio size={13} /> Security Operations Center</p>

      <div style={{
        display: "flex",
        gap: "28px",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "28px 32px",
        borderRadius: "20px",
        background: "linear-gradient(135deg, rgba(91,141,239,0.08), rgba(19,26,43,0.6))",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <p style={{ color: "#7E88A6", fontSize: "13px", margin: "0 0 4px" }}>Welcome back</p>
          <h1 style={{ margin: "0 0 12px", fontSize: "22px" }}>{userName || "Guest"}</h1>

          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
            <div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "44px", fontWeight: 700, lineHeight: 1 }}>
                {hasScore ? score : "—"}
              </span>
              <span style={{ color: "#7E88A6", fontSize: "16px", marginLeft: "4px" }}>/100</span>
            </div>
            {hasScore && (
              <span style={{
                fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px",
                color: riskColor, background: `color-mix(in srgb, ${riskColor} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${riskColor} 35%, transparent)`,
                padding: "4px 12px", borderRadius: "99px",
              }}>
                {risk} Risk
              </span>
            )}
          </div>

          <p style={{ color: "#A8B0C4", fontSize: "13.5px", lineHeight: 1.6, margin: "0 0 18px", maxWidth: "480px" }}>
            Your security surface is being monitored continuously
            {assetsMonitored !== null && assetsMonitored !== undefined ? ` across ${assetsMonitored} asset${assetsMonitored === 1 ? "" : "s"}.` : "."}
          </p>

          <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", marginBottom: "20px" }}>
            <MiniStat label="Assets" value={assetsMonitored} />
            <MiniStat label="Scans" value={totalScans} />
            <MiniStat label="Open Findings" value={findings} color={findings > 0 ? "#F2A65A" : "#3DD68C"} />
            <MiniStat label="Last Scan" value={lastScan} isText />
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/scanner")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "linear-gradient(135deg,#5B8DEF,#7C6CF0)", color: "white", border: "none",
                fontSize: "13px", fontWeight: 600, padding: "11px 20px", borderRadius: "10px", cursor: "pointer",
              }}
            >
              <Plus size={15} /> Start New Scan
            </button>
            <button
              onClick={() => navigate(latestScanId ? `/history?scanId=${latestScanId}` : "/reports")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "none", color: "#E8ECF5", border: "1px solid rgba(255,255,255,0.14)",
                fontSize: "13px", fontWeight: 600, padding: "11px 20px", borderRadius: "10px", cursor: "pointer",
              }}
            >
              <FileText size={15} /> {latestScanId ? "View Latest Report" : "Open Reports"}
            </button>
          </div>
        </div>

        <div className="hero-right"><SentinelCore /></div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, color, isText }) {
  const display = value === null || value === undefined ? "—" : value;
  return (
    <div>
      <div style={{ fontFamily: isText ? "inherit" : "'JetBrains Mono', monospace", fontSize: isText ? "13px" : "17px", fontWeight: 700, color: color || "#E8ECF5" }}>
        {display}
      </div>
      <div style={{ fontSize: "11px", color: "#7E88A6", marginTop: "2px" }}>{label}</div>
    </div>
  );
}
