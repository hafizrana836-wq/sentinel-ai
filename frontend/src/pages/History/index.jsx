import { useState, useEffect, useMemo } from "react";
import API_BASE from "../../config/api";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    History as HistoryIcon,
    Globe,
    AlertTriangle,
    FileDown,
    Eye,
    Search,
    ArrowUpDown,
    ShieldCheck,
    ScanLine,
    TrendingUp,
    ShieldAlert,
} from "lucide-react";
import "./History.css";

function severityColor(risk) {
    switch (risk) {
        case "Critical": return "#F0554B";
        case "High": return "#F0554B";
        case "Medium": return "#F2A65A";
        case "Low": return "#3DD68C";
        default: return "#7E88A6";
    }
}

function gradeColor(grade) {
    if (!grade) return "#7E88A6";
    if (grade.startsWith("A")) return "#3DD68C";
    if (grade === "B") return "#5B8DEF";
    if (grade === "C") return "#F2A65A";
    return "#F0554B";
}

// findings come back with lowercase severities ("critical"|"high"|"medium"|"low").
// The badge wants the highest severity present, Title Cased, defaulting to "Low"
// when there are no findings at all.
function deriveRiskLabel(findings) {
    if (!Array.isArray(findings) || findings.length === 0) return "Low";
    const order = ["critical", "high", "medium", "low"];
    const highest = order.find((sev) => findings.some((f) => f.severity === sev));
    return highest ? highest.charAt(0).toUpperCase() + highest.slice(1) : "Low";
}

function countBySeverity(findings, severity) {
    if (!Array.isArray(findings)) return 0;
    return findings.filter((f) => f.severity === severity).length;
}

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

const SORTS = [
    { key: "recent", label: "Most Recent" },
    { key: "score-desc", label: "Highest Score" },
    { key: "score-asc", label: "Lowest Score" },
];

export default function History() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [history, setHistory] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [expandedReport, setExpandedReport] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("recent");

    const token = localStorage.getItem("sentinel_token");

    useEffect(() => {
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Deep-link support: AI Insights' "Fix Now" button sends the user here
    // as /history?scanId=<id> — once the list has loaded, auto-expand that
    // scan so they land straight on the detail instead of having to find
    // and click it manually.
    useEffect(() => {
        const targetId = searchParams.get("scanId");
        if (!loading && targetId && history.some((item) => item.id === targetId) && expandedId !== targetId) {
            toggleExpand(targetId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, history]);

    async function fetchHistory(targetFilter) {
        setLoading(true);
        setError("");
        try {
            const response = await axios.get(
                `${API_BASE}/api/history`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { limit: 50, target: targetFilter || undefined },
                }
            );
            setHistory(response.data.items || []);
            setTotal(response.data.total || 0);
        }
        catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || "Failed to load scan history.");
        }
        finally {
            setLoading(false);
        }
    }

    function handleSearchSubmit(e) {
        e.preventDefault();
        fetchHistory(search.trim());
    }

    async function toggleExpand(id) {
        if (expandedId === id) {
            setExpandedId(null);
            setExpandedReport(null);
            return;
        }

        setExpandedId(id);
        setLoadingDetail(true);
        setExpandedReport(null);

        try {
            const response = await axios.get(
                `${API_BASE}/api/scan/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setExpandedReport(response.data);
        }
        catch (err) {
            setExpandedReport({ error: "Failed to load this scan's details." });
        }
        finally {
            setLoadingDetail(false);
        }
    }

    async function downloadPdf(scanId, targetName) {
        try {
            const response = await axios.get(
                `${API_BASE}/api/scan/${scanId}/report`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: "blob"
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `sentinel-scan-${targetName || "report"}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        }
        catch (err) {
            setError("Failed to generate PDF for this report.");
        }
    }

    // Sorting is presentation-only — done client-side over the already
    // fetched page, no new API surface needed.
    const sortedHistory = useMemo(() => {
        const items = [...history];
        if (sort === "score-desc") items.sort((a, b) => (b.securityScore ?? 0) - (a.securityScore ?? 0));
        else if (sort === "score-asc") items.sort((a, b) => (a.securityScore ?? 0) - (b.securityScore ?? 0));
        // "recent" is already the backend's default order (created_at DESC)
        return items;
    }, [history, sort]);

    const averageScore = history.length
        ? Math.round(history.reduce((sum, r) => sum + (r.securityScore || 0), 0) / history.length)
        : null;
    const criticalCount = history.filter((r) => (r.findings || []).some((f) => f.severity === "critical")).length;

    return (
        <div className="hist-page">
            <div className="hist-box">
                <div className="hist-top">
                    <div>
                        <h1><HistoryIcon size={22} /> Scan History</h1>
                        <p>Every website you've scanned, in one place</p>
                    </div>
                    <form className="hist-search" onSubmit={handleSearchSubmit}>
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search by target..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </form>
                </div>

                {error && (
                    <div className="hist-error">
                        <AlertTriangle size={15} /> {error}
                    </div>
                )}

                <div className="hist-stats">
                    <div className="hist-stat">
                        <ScanLine size={16} />
                        <div>
                            <span className="hist-stat-value">{total}</span>
                            <span className="hist-stat-label">Total Scans</span>
                        </div>
                    </div>
                    <div className="hist-stat">
                        <TrendingUp size={16} />
                        <div>
                            <span className="hist-stat-value">{averageScore ?? "—"}</span>
                            <span className="hist-stat-label">Average Score</span>
                        </div>
                    </div>
                    <div className="hist-stat">
                        <ShieldAlert size={16} style={{ color: criticalCount > 0 ? "#F0554B" : undefined }} />
                        <div>
                            <span className="hist-stat-value" style={{ color: criticalCount > 0 ? "#F0554B" : undefined }}>{criticalCount}</span>
                            <span className="hist-stat-label">Critical Findings</span>
                        </div>
                    </div>
                </div>

                {history.length > 0 && (
                    <div className="hist-toolbar">
                        <ArrowUpDown size={13} />
                        <div className="hist-sort-group">
                            {SORTS.map((s) => (
                                <button
                                    key={s.key}
                                    className={sort === s.key ? "active" : ""}
                                    onClick={() => setSort(s.key)}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="hist-loading">
                        {[1, 2, 3].map((i) => <div key={i} className="hist-skeleton" />)}
                    </div>
                ) : history.length === 0 ? (
                    <div className="hist-empty">
                        <ShieldCheck size={36} />
                        <p>No scans yet.</p>
                        <span>Run your first scan to start building a security history for your sites.</span>
                        <button onClick={() => navigate("/scanner")}>Run your first scan</button>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hist-list"
                    >
                        {sortedHistory.map((item) => {
                            const risk = deriveRiskLabel(item.findings);
                            const score = item.securityScore ?? 0;
                            return (
                                <div
                                    key={item.id}
                                    className={`hist-card ${risk === "Critical" ? "hist-card-alert" : ""}`}
                                    style={{ "--rc": severityColor(risk) }}
                                >
                                    <div className="hist-card-header">
                                        <div className="hist-card-main">
                                            <div className="hist-card-icon"><Globe size={16} /></div>
                                            <div>
                                                <p className="hist-target">{item.target}</p>
                                                <p className="hist-date">{timeAgo(item.createdAt)}</p>
                                            </div>
                                        </div>

                                        <div className="hist-card-meta">
                                            <div className="hist-score-block">
                                                <span className="hist-score mono">{item.securityScore}<small>/100</small></span>
                                                <span className="hist-score-bar"><span style={{ width: `${score}%` }} /></span>
                                            </div>
                                            <span className="hist-grade" style={{ "--gc": gradeColor(item.grade) }}>{item.grade}</span>
                                            <span className="hist-risk-pill">
                                                <span className="hist-risk-dot" />{risk} Risk
                                            </span>
                                            <button
                                                className="hist-view-btn"
                                                onClick={() => toggleExpand(item.id)}
                                            >
                                                <Eye size={13} /> {expandedId === item.id ? "Hide" : "View"}
                                            </button>
                                        </div>
                                    </div>

                                    {expandedId === item.id && (
                                        <div className="hist-detail">
                                            {loadingDetail ? (
                                                <p className="hist-detail-loading">Loading details...</p>
                                            ) : expandedReport?.error ? (
                                                <p className="hist-error" style={{ margin: 0 }}>{expandedReport.error}</p>
                                            ) : expandedReport ? (
                                                <>
                                                    <div className="hist-detail-grid">
                                                        <div>
                                                            <span className="detail-label">Hostname</span>
                                                            <span className="detail-value">{expandedReport.target}</span>
                                                        </div>
                                                        <div>
                                                            <span className="detail-label">HTTP Status</span>
                                                            <span className="detail-value">{expandedReport.headers?.statusCode ?? "—"}</span>
                                                        </div>
                                                        <div>
                                                            <span className="detail-label">SSL Valid</span>
                                                            <span className="detail-value">{expandedReport.ssl?.valid ? "Yes" : "No"}</span>
                                                        </div>
                                                        <div className="sev-critical">
                                                            <span className="detail-label">Critical</span>
                                                            <span className="detail-value">{countBySeverity(expandedReport.findings, "critical")}</span>
                                                        </div>
                                                        <div className="sev-high">
                                                            <span className="detail-label">High</span>
                                                            <span className="detail-value">{countBySeverity(expandedReport.findings, "high")}</span>
                                                        </div>
                                                        <div className="sev-medium">
                                                            <span className="detail-label">Medium</span>
                                                            <span className="detail-value">{countBySeverity(expandedReport.findings, "medium")}</span>
                                                        </div>
                                                        <div className="sev-low">
                                                            <span className="detail-label">Low</span>
                                                            <span className="detail-value">{countBySeverity(expandedReport.findings, "low")}</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className="hist-pdf-btn"
                                                        onClick={() => downloadPdf(expandedId, expandedReport.target)}
                                                    >
                                                        <FileDown size={14} /> Download PDF Report
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
