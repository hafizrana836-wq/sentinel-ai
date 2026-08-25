import React from "react";
import { ChevronRight } from "lucide-react";
import "./RecentScans.css";

// Fallback used only when no `scans` prop is passed.
const FALLBACK_SCANS = [
    { target: "app.northstar.io", score: 96, risk: "Low", time: "2m ago" },
    { target: "api.brightlane.dev", score: 88, risk: "Low", time: "17m ago" },
    { target: "legacy.orbitpay.com", score: 54, risk: "High", time: "42m ago" },
    { target: "staging.vertexhq.co", score: 71, risk: "Medium", time: "1h ago" },
    { target: "cdn.fluxmedia.net", score: 91, risk: "Low", time: "3h ago" },
];

function riskColor(risk) {
    if (risk === "Low") return "#3DD68C";
    if (risk === "Medium") return "#F2A65A";
    return "#F0554B";
}

function riskLabel(risk) {
    if (risk === "Low") return "Secure";
    return risk;
}

// GET /api/recent-scans returns `time` as a raw createdAt timestamp, not a
// pre-formatted "2m ago" string — format it here.
function timeAgo(value) {
    if (!value) return "—";
    const diffMs = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function RecentScans({ scans }) {
    const rows = scans
        ? scans.map((s) => ({ ...s, rawTime: s.time, time: timeAgo(s.time) }))
        : FALLBACK_SCANS.map((s) => ({ ...s, rawTime: s.time }));

    return (
        <section className="panel">
            <div className="panel-head">
                <div>
                    <h2>Recent Scans</h2>
                    <p>Latest results across your assets</p>
                </div>
                <button className="ghost-link">View all <ChevronRight size={14} /></button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr><th>Target</th><th>Score</th><th>Risk</th><th>Time</th><th>Report</th></tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={5} className="muted">No scans yet.</td></tr>
                        ) : rows.map((s, i) => (
                            <tr key={`${s.target}-${s.rawTime}-${i}`}>
                                <td className="target-cell">{s.target}</td>
                                <td className="mono">{s.score}</td>
                                <td>
                                    <span className={`risk-pill ${s.risk === "High" ? "pulse" : ""}`} style={{ "--c": riskColor(s.risk) }}>
                                        <span className="risk-dot" />{riskLabel(s.risk)}
                                    </span>
                                </td>
                                <td className="mono muted">{s.time}</td>
                                <td><button className="report-link">Open <ChevronRight size={13} /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
