import React from "react";
import { Activity, Clock, Trophy, TrendingDown } from "lucide-react";
import StatsCard from "./StatsCard";

// Note: no CSS import here on purpose — the "stats-grid" class this reuses
// is already defined globally in Dashboard.css (imported once by
// the legacy page), the same way the original StatsGrid.jsx
// never imported its own CSS file either.

// dashboard = { averageScore, latestScore, latestTarget, bestScore, worstScore, totalScans, ... }
// (from GET /api/dashboard, see dashboardService.getStats)
export default function ScoreOverview({ dashboard }) {
    const d = dashboard || {};
    const noScans = !d.totalScans;

    const cards = [
        {
            label: "Average Score",
            value: d.averageScore,
            suffix: d.averageScore !== null && d.averageScore !== undefined ? "/100" : "",
            sub: noScans ? "No scans yet" : `Across ${d.totalScans} scan${d.totalScans === 1 ? "" : "s"}`,
            icon: Activity,
            accent: "#5B8DEF",
        },
        {
            label: "Latest Score",
            value: d.latestScore,
            suffix: d.latestScore !== null && d.latestScore !== undefined ? "/100" : "",
            sub: d.latestTarget || "No scans yet",
            icon: Clock,
            accent: "#F2A65A",
        },
        {
            label: "Best Score",
            value: d.bestScore,
            suffix: d.bestScore !== null && d.bestScore !== undefined ? "/100" : "",
            sub: noScans ? "No scans yet" : "Highest recorded",
            icon: Trophy,
            accent: "#3DD68C",
        },
        {
            label: "Worst Score",
            value: d.worstScore,
            suffix: d.worstScore !== null && d.worstScore !== undefined ? "/100" : "",
            sub: noScans ? "No scans yet" : "Lowest recorded",
            icon: TrendingDown,
            accent: "#F0554B",
        },
    ];

    return (
        <section className="stats-grid score-overview">
            {cards.map((c) => (
                <StatsCard key={c.label} {...c} />
            ))}
        </section>
    );
}
