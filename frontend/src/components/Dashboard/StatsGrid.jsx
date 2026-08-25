import React from "react";
import { AlertTriangle, Server, ScanLine } from "lucide-react";
import StatsCard from "./StatsCard";

// Fallback used only when no `dashboard` prop is passed (e.g. component
// previewed in isolation). The live page always passes real data.
const FALLBACK_STATS = [
    { label: "Open Findings", value: 6, suffix: "", icon: AlertTriangle, accent: "#F0554B" },
    { label: "Assets Monitored", value: 5, suffix: "", icon: Server, accent: "#3DD68C" },
    { label: "Total Scans", value: 31, suffix: "", icon: ScanLine, accent: "#F2A65A" },
];

// dashboard = { openFindings, assetsMonitored, totalScans, ... } (see GET /api/dashboard)
function buildStats(dashboard) {
    return [
        {
            label: "Open Findings",
            value: dashboard.openFindings,
            suffix: "",
            icon: AlertTriangle,
            accent: dashboard.openFindings > 0 ? "#F0554B" : "#3DD68C",
        },
        {
            label: "Assets Monitored",
            value: dashboard.assetsMonitored,
            suffix: "",
            icon: Server,
            accent: "#3DD68C",
        },
        {
            label: "Total Scans",
            value: dashboard.totalScans,
            suffix: "",
            icon: ScanLine,
            accent: "#F2A65A",
        },
    ];
}

export default function StatsGrid({ dashboard }) {
    const stats = dashboard ? buildStats(dashboard) : FALLBACK_STATS;

    return (
        <section className="stats-grid">
            {stats.map((s) => (
                <StatsCard key={s.label} {...s} />
            ))}
        </section>
    );
}
