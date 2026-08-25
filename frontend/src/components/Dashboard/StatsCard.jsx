import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import "./StatsCard.css";

export default function StatsCard({ label, value, suffix = "", delta, up, sub, icon: Icon, accent }) {
    const hasDelta = delta !== null && delta !== undefined;
    // `sub` lets callers show something more specific than "vs. last week"
    // (e.g. which target a score belongs to, or how many scans it's based
    // on). Falls back to the old behavior when not provided.
    const subText = sub !== undefined ? sub : (hasDelta ? "vs. last week" : null);
    const hasValue = value !== null && value !== undefined;

    return (
        <div className="stat-card" style={{ "--accent": accent }}>
            <div className="stat-top">
                <div className="stat-icon"><Icon size={16} strokeWidth={2.1} /></div>
                {hasDelta && (
                    <span className={`stat-delta ${up ? "up" : "down"}`}>
                        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {delta}
                    </span>
                )}
            </div>
            <div className="stat-value mono">{hasValue ? value : "—"}{hasValue ? suffix : ""}</div>
            <div className="stat-label">{label}</div>
            {subText && <div className="stat-sub">{subText}</div>}
            <div className="stat-glow" />
        </div>
    );
}
