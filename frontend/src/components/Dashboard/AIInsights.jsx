import React from "react";
import { useNavigate } from "react-router-dom";
import { Bot, ArrowRight, AlertOctagon } from "lucide-react";
import "./AIInsights.css";

const SEVERITY_META = {
    Critical: { color: "#F0554B", tier: "Priority 1" },
    High: { color: "#F0554B", tier: "Priority 2" },
    Medium: { color: "#F2A65A", tier: "Priority 3" },
    Low: { color: "#5B8DEF", tier: "Priority 4" },
};

// data = { featured, insights } from GET /api/insights (see dashboardService.getInsights).
// `undefined` = still loading, `{ featured: null, insights: [] }` = loaded but no findings yet.
export default function AIInsights({ data }) {
    const navigate = useNavigate();
    const loading = data === undefined;
    const featured = data?.featured;
    const insights = data?.insights || [];

    function openScan(scanId, code) {
        if (!scanId || !code) return;
        navigate(`/remediation/${scanId}/${code}`);
    }

    return (
        <section className="panel insights-panel">
            <div className="panel-head">
                <div>
                    <h2><Bot size={16} color="var(--signal)" /> Sentinel AI</h2>
                    <p>Prioritized recommendations, live from your scans</p>
                </div>
            </div>

            {loading ? (
                <p className="expandable-empty">Loading insights...</p>
            ) : !featured ? (
                <p className="expandable-empty">No findings yet — run a scan to see prioritized recommendations here.</p>
            ) : (
                <>
                    <div className="ai-featured">
                        <div className="ai-avatar"><Bot size={18} /><span className="ai-avatar-ping" /></div>
                        <div className="ai-featured-body">
                            <div className="ai-featured-top">
                                <span className={`weight-tag ${featured.weight.split(" ")[0].toLowerCase()}`}>
                                    <AlertOctagon size={11} />{featured.weight}
                                </span>
                            </div>
                            <h3>{featured.title}</h3>
                            <p>{featured.detail}</p>
                            <button className="fix-now-btn" onClick={() => openScan(featured.scanId, featured.code)}>
                                Fix Now <ArrowRight size={13} />
                            </button>
                        </div>
                        <div className="ai-featured-side">
                            <div style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px",
                                minWidth: "72px",
                                padding: "10px 14px",
                                borderRadius: "12px",
                                textAlign: "center",
                                color: SEVERITY_META[featured.weight.split(" ")[0]]?.color || "#7E88A6",
                                background: `color-mix(in srgb, ${SEVERITY_META[featured.weight.split(" ")[0]]?.color || "#7E88A6"} 12%, transparent)`,
                                border: `1px solid color-mix(in srgb, ${SEVERITY_META[featured.weight.split(" ")[0]]?.color || "#7E88A6"} 30%, transparent)`,
                            }}>
                                <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                                    {featured.weight.split(" ")[0]}
                                </span>
                                <span style={{ fontSize: "10.5px", opacity: 0.85 }}>
                                    {SEVERITY_META[featured.weight.split(" ")[0]]?.tier || "Unranked"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {insights.length > 0 && (
                        <ul className="insight-list">
                            {insights.map((i, idx) => (
                                <li key={`${i.scanId}-${idx}`} onClick={() => openScan(i.scanId, i.code)} style={{ cursor: "pointer" }}>
                                    <span className={`weight-tag ${i.weight.toLowerCase()}`}>{i.weight}</span>
                                    <span className="insight-text">{i.text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}
