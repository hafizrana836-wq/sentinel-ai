import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    FileBarChart2,
    Search,
    Download,
    RefreshCw,
    Eye,
    GitCompare,
    X,
    ArrowRight,
    Calendar,
    TrendingUp,
    AlertTriangle,
} from "lucide-react";
import "./Reports.css";

import API_BASE from "../../config/api";

function riskColor(risk) {
    if (risk === "Low") return "#3DD68C";
    if (risk === "Medium") return "#F2A65A";
    return "#F0554B";
}

// New — same idea as riskColor, drives the grade badge so a glance at
// the table tells you good/bad without reading the letter.
function gradeColor(grade) {
    if (!grade) return "#7E88A6";
    const letter = grade.charAt(0).toUpperCase();
    if (letter === "A") return "#3DD68C";
    if (letter === "B") return "#7FD9A8";
    if (letter === "C") return "#F2A65A";
    return "#F0554B"; // D, F
}

// New — colors the raw score number itself, so score/grade/risk all
// read as one consistent traffic-light system across the row.
function scoreColor(score) {
    if (score === null || score === undefined) return "#7E88A6";
    if (score >= 80) return "#3DD68C";
    if (score >= 60) return "#F2A65A";
    return "#F0554B";
}

function riskFromFindings(findings) {
    if (!Array.isArray(findings) || findings.length === 0) return "Low";
    if (findings.some((f) => f.severity === "critical" || f.severity === "high")) return "High";
    if (findings.some((f) => f.severity === "medium")) return "Medium";
    return "Low";
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

// Inline shimmer placeholder — see Reports.css for .rep-skel
function Skel({ w = "100%", h = 14, style = {} }) {
    return <span className="rep-skel" style={{ width: w, height: h, ...style }} />;
}

function ReportSkeletonRow() {
    return (
        <tr className="rep-skel-row">
            <td><Skel w="14px" h={14} /></td>
            <td><Skel w="150px" /></td>
            <td><Skel w="26px" /></td>
            <td><Skel w="18px" /></td>
            <td><Skel w="56px" h={18} style={{ borderRadius: 12 }} /></td>
            <td><Skel w="18px" /></td>
            <td><Skel w="50px" /></td>
            <td><Skel w="70px" /></td>
        </tr>
    );
}

export default function Reports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState([]); // scanIds picked for compare
    const [compareData, setCompareData] = useState(null); // { a, b } full scans
    const [compareLoading, setCompareLoading] = useState(false);
    const [rescanningId, setRescanningId] = useState(null);

    const token = localStorage.getItem("sentinel_token");

    useEffect(() => {
        fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchReports(targetFilter) {
        setLoading(true);
        setError("");
        try {
            const response = await axios.get(`${API_BASE}/api/history`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 50, target: targetFilter || undefined },
            });
            setReports(response.data.items || []);
            setTotal(response.data.total || 0);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to load reports.");
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e) {
        e.preventDefault();
        fetchReports(search.trim());
    }

    async function downloadPdf(scanId, target) {
        try {
            const response = await axios.get(`${API_BASE}/api/scan/${scanId}/report`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `sentinel-scan-${target || "report"}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Failed to generate PDF for this report.");
        }
    }

    async function rescan(target) {
        setRescanningId(target);
        try {
            await axios.post(
                `${API_BASE}/api/scan`,
                { target },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch {
            setError(`Failed to start a rescan for ${target}.`);
        } finally {
            setTimeout(() => setRescanningId(null), 2500);
        }
    }

    function toggleSelect(scanId) {
        setSelected((prev) => {
            if (prev.includes(scanId)) return prev.filter((id) => id !== scanId);
            if (prev.length >= 2) return [prev[1], scanId]; // keep last 2 picked
            return [...prev, scanId];
        });
    }

    async function runCompare() {
        if (selected.length !== 2) return;
        setCompareLoading(true);
        try {
            const [resA, resB] = await Promise.all(
                selected.map((id) =>
                    axios.get(`${API_BASE}/api/scan/${id}`, { headers: { Authorization: `Bearer ${token}` } })
                )
            );
            // Order chronologically: earlier scan = "Previous", later = "Current"
            const [a, b] = [resA.data, resB.data].sort(
                (x, y) => new Date(x.createdAt) - new Date(y.createdAt)
            );
            setCompareData({ a, b });
        } catch {
            setError("Failed to load one of the selected scans for comparison.");
        } finally {
            setCompareLoading(false);
        }
    }

    const totalReports = total;
    const generatedThisMonth = reports.filter((r) => {
        const d = new Date(r.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const averageScore = reports.length
        ? Math.round(reports.reduce((sum, r) => sum + (r.securityScore || 0), 0) / reports.length)
        : null;
    const criticalReports = reports.filter((r) =>
        (r.findings || []).some((f) => f.severity === "critical")
    ).length;

    return (
        <div className="rep-page">
            <div className="rep-box">
                <div className="rep-top">
                    <div>
                        <h1><FileBarChart2 size={22} /> Security Report Center</h1>
                        <p>Your generated security assessments</p>
                    </div>
                    <form className="rep-search" onSubmit={handleSearch}>
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
                    <div className="rep-error">
                        <AlertTriangle size={15} /> {error}
                    </div>
                )}

                <div className="rep-stats">
                    <div className="rep-stat">
                        <div className="rep-stat-icon"><FileBarChart2 size={16} /></div>
                        <span className="rep-stat-value">{loading ? <Skel w="34px" h={22} /> : totalReports}</span>
                        <span className="rep-stat-label">Total Reports</span>
                    </div>
                    <div className="rep-stat">
                        <div className="rep-stat-icon"><Calendar size={16} /></div>
                        <span className="rep-stat-value">{loading ? <Skel w="34px" h={22} /> : generatedThisMonth}</span>
                        <span className="rep-stat-label">Generated This Month</span>
                    </div>
                    <div className="rep-stat">
                        <div className="rep-stat-icon"><TrendingUp size={16} /></div>
                        <span className="rep-stat-value">{loading ? <Skel w="34px" h={22} /> : (averageScore ?? "—")}</span>
                        <span className="rep-stat-label">Average Score</span>
                    </div>
                    <div className={`rep-stat ${!loading && criticalReports > 0 ? "is-critical" : ""}`}>
                        <div className="rep-stat-icon"><AlertTriangle size={16} /></div>
                        <span className="rep-stat-value" style={{ color: !loading && criticalReports > 0 ? "#F0554B" : undefined }}>
                            {loading ? <Skel w="34px" h={22} /> : criticalReports}
                        </span>
                        <span className="rep-stat-label">Critical Reports</span>
                    </div>
                </div>

                {selected.length > 0 && (
                    <div className="rep-compare-bar">
                        <span>{selected.length} selected {selected.length === 1 ? "— pick one more to compare" : ""}</span>
                        {selected.length === 2 && (
                            <button className="rep-compare-btn" onClick={runCompare} disabled={compareLoading}>
                                <GitCompare size={14} /> {compareLoading ? "Loading..." : "Compare Scans"}
                            </button>
                        )}
                        <button className="rep-clear-btn" onClick={() => setSelected([])}>Clear</button>
                    </div>
                )}

                {!loading && reports.length === 0 ? (
                    <div className="rep-empty">
                        <div className="rep-empty-icon"><FileBarChart2 size={22} /></div>
                        <p>No reports yet.</p>
                        <button onClick={() => navigate("/scanner")}>Run your first scan</button>
                    </div>
                ) : (
                    <div className="rep-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Target</th>
                                    <th>Score</th>
                                    <th>Grade</th>
                                    <th>Risk</th>
                                    <th>Findings</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => <ReportSkeletonRow key={i} />)
                                ) : (
                                    reports.map((r) => {
                                        const risk = riskFromFindings(r.findings);
                                        return (
                                            <tr key={r.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.includes(r.id)}
                                                        onChange={() => toggleSelect(r.id)}
                                                    />
                                                </td>
                                                <td className="rep-target-cell">{r.target}</td>
                                                <td className="mono">
                                                    <span className="rep-score-value" style={{ color: scoreColor(r.securityScore) }}>
                                                        {r.securityScore}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="rep-grade-pill" style={{ "--c": gradeColor(r.grade) }}>{r.grade}</span>
                                                </td>
                                                <td>
                                                    <span className="rep-risk-pill" style={{ "--c": riskColor(risk) }}>{risk}</span>
                                                </td>
                                                <td className="mono">{r.findings?.length ?? 0}</td>
                                                <td className="mono muted">{timeAgo(r.createdAt)}</td>
                                                <td>
                                                    <div className="rep-actions">
                                                        <button title="View Report" onClick={() => navigate(`/history?scanId=${r.id}`)}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button title="Download PDF" onClick={() => downloadPdf(r.id, r.target)}>
                                                            <Download size={14} />
                                                        </button>
                                                        <button
                                                            title="Rescan"
                                                            onClick={() => rescan(r.target)}
                                                            disabled={rescanningId === r.target}
                                                        >
                                                            <RefreshCw size={14} className={rescanningId === r.target ? "rep-spin" : ""} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {compareData && (
                <div className="rep-modal-backdrop" onClick={() => setCompareData(null)}>
                    <div className="rep-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="rep-modal-close" onClick={() => setCompareData(null)}><X size={16} /></button>
                        <h2>{compareData.a.target}</h2>
                        <div className="rep-compare-scores">
                            <div>
                                <span className="rep-compare-label">Previous</span>
                                <span className="rep-compare-score">{compareData.a.securityScore}</span>
                            </div>
                            <ArrowRight size={20} color="#7E88A6" />
                            <div>
                                <span className="rep-compare-label">Current</span>
                                <span className="rep-compare-score">{compareData.b.securityScore}</span>
                            </div>
                            <div className={`rep-compare-delta ${compareData.b.securityScore >= compareData.a.securityScore ? "up" : "down"}`}>
                                {compareData.b.securityScore >= compareData.a.securityScore ? "+" : ""}
                                {compareData.b.securityScore - compareData.a.securityScore} points
                            </div>
                        </div>

                        {compareData.a.categoryBreakdown && compareData.b.categoryBreakdown && (
                            <div className="rep-compare-categories">
                                {compareData.b.categoryBreakdown.map((catB) => {
                                    const catA = compareData.a.categoryBreakdown.find((c) => c.category === catB.category);
                                    if (!catA) return null;
                                    return (
                                        <div className="rep-compare-cat-row" key={catB.category}>
                                            <span className="rep-compare-cat-name">{catB.category}</span>
                                            <span className="mono">{catA.score}</span>
                                            <ArrowRight size={13} color="#7E88A6" />
                                            <span className="mono">{catB.score}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
