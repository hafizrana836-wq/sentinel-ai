import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    FaSearch, FaGlobe, FaShieldAlt, FaServer, FaLock, FaCode,
    FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaFileDownload,
    FaBug, FaSyncAlt, FaChevronDown, FaChevronUp,
} from "react-icons/fa";
import "./Scanner.css";

import API_BASE from "../../config/api";

const SEVERITY_META = {
    critical: { label: "Critical", color: "#F0554B" },
    high: { label: "High", color: "#F0554B" },
    medium: { label: "Medium", color: "#F2A65A" },
    low: { label: "Low", color: "#5B8DEF" },
    info: { label: "Info", color: "#7E88A6" },
};

function SeverityBadge({ severity }) {
    const meta = SEVERITY_META[(severity || "").toLowerCase()] || SEVERITY_META.info;
    return (
        <span className="scn-badge" style={{ "--c": meta.color }}>{meta.label}</span>
    );
}

function ScoreGauge({ score = 0, grade = "-" }) {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(score, 100)) / 100;
    const offset = circumference * (1 - progress);
    let color = "#3DD68C";
    if (score < 50) color = "#F0554B";
    else if (score < 80) color = "#F2A65A";

    return (
        <div className="scn-gauge">
            <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r={radius} stroke="rgba(255,255,255,.08)" strokeWidth="12" fill="none" />
                <circle
                    cx="75" cy="75" r={radius}
                    stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    transform="rotate(-90 75 75)"
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                />
                <text x="75" y="70" textAnchor="middle" fontSize="30" fontWeight="700" fill="#E8ECF5">{score}</text>
                <text x="75" y="94" textAnchor="middle" fontSize="13" fill="#7E88A6">/ 100</text>
            </svg>
            <div className="scn-gauge-grade" style={{ color }}>Grade {grade}</div>
        </div>
    );
}

function Accordion({ title, defaultOpen = false, children, badge }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="scn-accordion">
            <button className="scn-accordion-head" onClick={() => setOpen((o) => !o)}>
                <span>{title}</span>
                <div className="scn-accordion-right">
                    {badge}
                    {open ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                </div>
            </button>
            {open && <div className="scn-accordion-body">{children}</div>}
        </div>
    );
}

// Flattens nested evidence objects into clean key/value rows instead of
// dumping raw JSON — e.g. { observed: { header: "CSP", status: "missing" } }
// becomes two rows: "header" / "status".
function flattenEvidence(obj, rows = []) {
    if (!obj || typeof obj !== "object") return rows;
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;
        if (typeof value === "object" && !Array.isArray(value)) {
            flattenEvidence(value, rows);
        } else {
            rows.push({ key, value: Array.isArray(value) ? value.join(", ") : String(value) });
        }
    }
    return rows;
}

function EvidenceRows({ evidence }) {
    const rows = flattenEvidence(evidence);
    if (rows.length === 0) return null;
    return (
        <div className="scn-evidence">
            {rows.map((r, i) => (
                <div className="scn-evidence-row" key={i}>
                    <span className="scn-evidence-key">{r.key}</span>
                    <span className="scn-evidence-value">{r.value}</span>
                </div>
            ))}
        </div>
    );
}

function FixNowLink({ scanId, code }) {
    if (!scanId || !code) return null;
    return (
        <Link to={`/remediation/${scanId}/${code}`} className="scn-fixnow">
            Fix Now →
        </Link>
    );
}

function StatusIcon({ ok }) {
    return ok ? <FaCheckCircle className="scn-icon-ok" /> : <FaTimesCircle className="scn-icon-bad" />;
}

function ExpandableList({ items = [], previewCount = 10, emptyText = "None", render }) {
    const [expanded, setExpanded] = useState(false);
    if (!items || items.length === 0) return <p className="scn-empty-text">{emptyText}</p>;
    const visible = expanded ? items : items.slice(0, previewCount);
    return (
        <div>
            {visible.map((item, i) => render(item, i))}
            {items.length > previewCount && (
                <button className="scn-showmore" onClick={() => setExpanded(!expanded)}>
                    {expanded ? "Show Less" : `Show ${items.length - previewCount} More`}
                </button>
            )}
        </div>
    );
}

const NAV_SECTIONS = [
    { id: "scn-overview", label: "Overview" },
    { id: "scn-score", label: "Security" },
    { id: "scn-ssl", label: "SSL" },
    { id: "scn-headers", label: "Headers" },
    { id: "scn-technology", label: "Technology" },
    { id: "scn-network", label: "Network" },
    { id: "scn-vulnerabilities", label: "Vulnerabilities" },
    { id: "scn-recon", label: "Recon" },
    { id: "scn-findings", label: "Findings" },
];

const PIPELINE_STEPS = ["Initializing", "SSL", "Headers", "Ports", "CVEs", "Recon", "AI Analysis"];

const HEADER_CHECKLIST = [
    { code: "MISSING_CSP", label: "Content-Security-Policy" },
    { code: "MISSING_HSTS", label: "Strict-Transport-Security" },
    { code: "MISSING_XFO", label: "X-Frame-Options" },
    { code: "MISSING_XCTO", label: "X-Content-Type-Options" },
    { code: "MISSING_REFERRER_POLICY", label: "Referrer-Policy" },
];

export default function Scanner() {
    const [target, setTarget] = useState("");
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState("");
    const [currentStep, setCurrentStep] = useState("");
    const [scanId, setScanId] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Core scan runner — used by both the "Start Scan" button (reads the
    // input field) and the hero's "Rescan" button (reuses report.target
    // directly, without needing the input field re-filled).
    function runScan(hostnameToScan) {
        const token = localStorage.getItem("sentinel_token");
        if (!token) {
            setError("You must be logged in to start a scan.");
            return;
        }

        setLoading(true);
        setError("");
        setReport(null);
        setCurrentStep("Connecting...");

        axios.post(
            `${API_BASE}/api/scan`,
            { target: hostnameToScan },
            { headers: { Authorization: `Bearer ${token}` } }
        ).then((startResponse) => {
            const newScanId = startResponse.data.scanId;
            setScanId(newScanId);

            const socket = io(API_BASE, { auth: { token } });
            socketRef.current = socket;

            socket.on("connect", () => {
                socket.emit("scan:subscribe", newScanId);
            });

            socket.on("connect_error", (err) => {
                setError(`Live progress connection failed: ${err.message}`);
                setLoading(false);
            });

            socket.on("scan:progress", ({ scanId: eventScanId, step, status, error: stepError, scan }) => {
                if (eventScanId !== newScanId) return;

                if (status === "failed") {
                    setError(stepError || "Scan failed.");
                    setLoading(false);
                    socket.disconnect();
                    return;
                }

                if (status === "complete" && scan) {
                    setReport(scan);
                    setLoading(false);
                    socket.disconnect();
                    return;
                }

                setCurrentStep(step);
            });
        }).catch((err) => {
            setError(err.response?.data?.message || "Backend connection failed");
            setLoading(false);
        });
    }

    function startScan() {
        if (!target.trim()) {
            setError("Please enter a website.");
            return;
        }
        runScan(target);
    }

    function handleRescan() {
        if (report?.target) runScan(report.target);
    }

    async function downloadPdf() {
        if (!scanId) return;
        try {
            const token = localStorage.getItem("sentinel_token");
            const response = await axios.get(
                `${API_BASE}/api/scan/${scanId}/report`,
                { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" }
            );
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `sentinel-scan-${report?.target || "report"}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        }
        catch (err) {
            setError("Failed to generate PDF report.");
        }
    }

    function scrollTo(id) {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (!report && !loading) {
        return (
            <div className="scn-page">
                <div className="scn-box">
                    <h1><FaSearch /> Sentinel AI Website Scanner</h1>
                    <div className="scn-input-area">
                        <input
                            type="text"
                            placeholder="Enter website URL..."
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                        />
                        <button onClick={startScan}>Start Scan</button>
                    </div>
                    {error && <div className="scn-error"><FaExclamationTriangle /> {error}</div>}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="scn-page">
                <div className="scn-box">
                    <h1><FaSearch /> Sentinel AI Website Scanner</h1>
                    <div className="scn-loading-box">
                        <div className="scn-spinner" />
                        <p>{currentStep || "Starting scan..."}</p>
                        <div className="scn-step-list">
                            {PIPELINE_STEPS.map((step) => (
                                <span key={step} className={`scn-step-chip ${step === currentStep ? "active" : ""}`}>
                                    {step}
                                </span>
                            ))}
                        </div>
                    </div>
                    {error && <div className="scn-error"><FaExclamationTriangle /> {error}</div>}
                </div>
            </div>
        );
    }

    // --- Findings prep ---
    const findings = report.findings || [];
    const severityOrder = ["critical", "high", "medium", "low", "info"];
    const counts = Object.fromEntries(severityOrder.map((s) => [s, findings.filter((f) => (f.severity || "").toLowerCase() === s).length]));
    const topPriority = [...findings].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)).slice(0, 3);

    // --- Directory scan reinterpretation: a 403 means the path is
    // BLOCKED, not that a vulnerability was confirmed. Only a 200 means
    // something is genuinely, currently accessible.
    const dirItems = report.directory?.directories || [];
    const dirBlocked = dirItems.filter((d) => d.status === 403).length;
    const dirAccessible = dirItems.filter((d) => d.status === 200).length;
    const dirRedirected = dirItems.filter((d) => d.status === 301 || d.status === 302).length;

    return (
        <div className="scn-page">
            <div className="scn-box">
                <div className="scn-newscan-bar">
                    <input
                        type="text"
                        placeholder="Enter another website URL to scan..."
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && startScan()}
                    />
                    <button onClick={startScan}><FaSearch size={13} /> New Scan</button>
                </div>

                <nav className="scn-subnav">
                    {NAV_SECTIONS.map((s) => (
                        <button key={s.id} onClick={() => scrollTo(s.id)}>{s.label}</button>
                    ))}
                </nav>

                {error && <div className="scn-error"><FaExclamationTriangle /> {error}</div>}

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

                    {/* 1. Hero */}
                    <div className="scn-card scn-hero" id="scn-overview">
                        <div className="scn-hero-top">
                            <div>
                                <h2 className="scn-hero-target">{report.target}</h2>
                                <p className="scn-hero-meta">Security assessment · {new Date().toLocaleDateString()}</p>
                            </div>
                            <span className="scn-status-pill"><FaCheckCircle size={11} /> COMPLETED</span>
                        </div>

                        <div className="scn-hero-score-row">
                            <ScoreGauge score={report.securityScore || 0} grade={report.grade} />
                            <div className="scn-hero-findings-row">
                                <div><span>{findings.length}</span><small>Findings</small></div>
                                <div><span style={{ color: SEVERITY_META.medium.color }}>{counts.medium}</span><small>Medium</small></div>
                                <div><span style={{ color: SEVERITY_META.high.color }}>{counts.high}</span><small>High</small></div>
                                <div><span style={{ color: SEVERITY_META.critical.color }}>{counts.critical}</span><small>Critical</small></div>
                            </div>
                        </div>

                        <p className="scn-subheading">Executive Summary</p>
                        <div className="scn-kv-grid">
                            <KV label="Target" value={report.target} />
                            <KV label="Status" value={report.status} />
                            <KV label="Security Score" value={report.securityScore} />
                            <KV label="Grade" value={report.grade} />
                            <KV label="Risk Score" value={report.riskScore} />
                            <KV label="Total Findings" value={findings.length} />
                        </div>
                        <p className="scn-verdict">
                            {report.securityScore >= 80
                                ? "Website security posture is strong."
                                : report.securityScore >= 50
                                ? "Moderate risk — improvements recommended."
                                : "Significant security gaps — action required."}
                        </p>

                        <div className="scn-hero-actions">
                            <button className="scn-btn-ghost" onClick={handleRescan}><FaSyncAlt size={12} /> Rescan</button>
                            <button className="scn-btn-primary" onClick={downloadPdf}><FaFileDownload size={12} /> Download PDF</button>
                        </div>
                    </div>

                    {/* 2. Security Score */}
                    <div className="scn-card" id="scn-score">
                        <h3><FaShieldAlt /> Security Score</h3>
                        {report.categoryBreakdown?.length > 0 && (
                            <div className="scn-category-list">
                                {report.categoryBreakdown.map((cat, i) => (
                                    <div className="scn-category-row" key={i}>
                                        <span>{cat.category}</span>
                                        <div className="scn-category-bar">
                                            <div className="scn-category-fill" style={{ width: `${cat.score}%`, background: cat.score >= 80 ? "#3DD68C" : cat.score >= 50 ? "#F2A65A" : "#F0554B" }} />
                                        </div>
                                        <span className="mono">{cat.score}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {report.scoreExplanation?.length > 0 && (
                            <Accordion title="Why this score?">
                                {report.scoreExplanation.map((line, i) => <p key={i} className="scn-explain-line">• {line}</p>)}
                            </Accordion>
                        )}
                    </div>

                    {/* 3. Findings Overview */}
                    <div className="scn-card" id="scn-findings-overview">
                        <h3>Findings Overview</h3>
                        <div className="scn-sev-counts">
                            {severityOrder.filter((s) => s !== "info").map((s) => (
                                <div className="scn-sev-count" key={s} style={{ "--c": SEVERITY_META[s].color }}>
                                    <span>{counts[s]}</span>
                                    <small>{SEVERITY_META[s].label}</small>
                                </div>
                            ))}
                        </div>
                        {topPriority.length > 0 && (
                            <>
                                <p className="scn-subheading">Top Priority</p>
                                {topPriority.map((f, i) => (
                                    <div className="scn-priority-row" key={i}>
                                        <SeverityBadge severity={f.severity} />
                                        <span className="scn-priority-title">{f.title}</span>
                                        <div className="scn-priority-actions">
                                            <button className="scn-link-btn" onClick={() => scrollTo("scn-findings")}>View</button>
                                            <FixNowLink scanId={scanId} code={f.code} />
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* 4. Security Findings (detailed) */}
                    <div className="scn-card" id="scn-findings">
                        <h3><FaShieldAlt /> Security Findings</h3>
                        {findings.length > 0 ? (
                            severityOrder.map((level) => {
                                const group = findings.filter((f) => (f.severity || "").toLowerCase() === level);
                                if (group.length === 0) return null;
                                return (
                                    <div key={level} className="scn-finding-group">
                                        <p className="scn-finding-group-heading" style={{ color: SEVERITY_META[level].color }}>
                                            {SEVERITY_META[level].label.toUpperCase()} ({group.length})
                                        </p>
                                        {group.map((f, i) => (
                                            <div className="scn-finding-card" key={i} style={{ "--c": SEVERITY_META[level].color }}>
                                                <div className="scn-finding-top">
                                                    <SeverityBadge severity={f.severity} />
                                                    <strong>{f.title}</strong>
                                                </div>
                                                <p className="scn-finding-desc">{f.description || "No description available."}</p>
                                                {f.evidence && (
                                                    <Accordion title="Show evidence">
                                                        <EvidenceRows evidence={f.evidence} />
                                                    </Accordion>
                                                )}
                                                <FixNowLink scanId={scanId} code={f.code} />
                                            </div>
                                        ))}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="scn-empty-text">No findings — this scan came back clean.</p>
                        )}
                    </div>

                    {/* 5. SSL/TLS */}
                    <div className="scn-card" id="scn-ssl">
                        <h3><FaLock /> SSL / TLS <StatusIcon ok={!!report.ssl?.valid} /></h3>
                        {report.ssl ? (
                            <>
                                <div className="scn-kv-grid">
                                    <KV label="Protocol" value={report.ssl.protocol} />
                                    <KV label="Cipher Suite" value={report.ssl.cipher} />
                                    <KV label="Certificate Valid" value={report.ssl.valid ? "Yes" : "No"} />
                                    <KV label="Days Remaining" value={report.ssl.daysRemaining} />
                                    <KV label="Key Algorithm" value={report.ssl.keyAlgorithm} />
                                    <KV label="Key Size" value={report.ssl.keyBits ? `${report.ssl.keyBits} bits` : report.ssl.namedCurve || "N/A"} />
                                </div>
                                <Accordion title="Advanced Certificate Details">
                                    <div className="scn-kv-grid">
                                        <KV label="Issuer" value={report.ssl.issuer} />
                                        <KV label="Subject" value={report.ssl.subject} />
                                        <KV label="Valid From" value={report.ssl.validFrom} />
                                        <KV label="Valid To" value={report.ssl.validTo} />
                                        <KV label="Chain Length" value={report.ssl.chainLength} />
                                        <KV label="Chain Status" value={report.ssl.certificateChain?.status} />
                                        <KV label="SHA-256 Fingerprint" value={report.ssl.fingerprintSHA256} />
                                    </div>
                                    {report.ssl.subjectAltNames?.length > 0 && (
                                        <>
                                            <p className="scn-subheading">Subject Alternative Names</p>
                                            <ExpandableList
                                                items={report.ssl.subjectAltNames}
                                                previewCount={5}
                                                render={(san, i) => <span key={i} className="scn-chip">{san}</span>}
                                            />
                                        </>
                                    )}
                                </Accordion>
                            </>
                        ) : <p className="scn-empty-text">No SSL data.</p>}
                    </div>

                    {/* 6. Security Headers */}
                    <div className="scn-card" id="scn-headers">
                        <h3><FaCode /> Security Headers</h3>
                        {report.headers ? (
                            <div className="scn-checklist">
                                {HEADER_CHECKLIST.map((h) => {
                                    const missingEntry = report.headers.missing?.find((m) => m.code === h.code);
                                    const isMissing = !!missingEntry;
                                    const finding = findings.find((f) => f.code === h.code);
                                    return (
                                        <div className="scn-check-row" key={h.code}>
                                            <div className="scn-check-left">
                                                <StatusIcon ok={!isMissing} />
                                                <span>{h.label}</span>
                                            </div>
                                            {isMissing && finding && <FixNowLink scanId={scanId} code={h.code} />}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p className="scn-empty-text">No header data.</p>}
                    </div>

                    {/* 7. Technology */}
                    <div className="scn-card" id="scn-technology">
                        <h3><FaCode /> Technology Detected</h3>
                        {report.technology?.length > 0 ? (
                            <div className="scn-tech-badges">
                                {report.technology.map((item, i) => (
                                    <span key={i} className="scn-chip"><strong>{item.name}:</strong> {item.value}</span>
                                ))}
                            </div>
                        ) : <p className="scn-empty-text">No technology detected.</p>}
                    </div>

                    {/* 8. Network / Ports */}
                    <div className="scn-card" id="scn-network">
                        <h3><FaServer /> Network Exposure</h3>
                        {report.ports ? (
                            <>
                                <div className="scn-kv-grid">
                                    <KV label="Ports Scanned" value={report.ports.scanned} />
                                    <KV label="Open" value={report.ports.open?.length ?? 0} />
                                    <KV label="Risky" value={report.ports.riskyOpen?.length ?? 0} />
                                    <KV label="Exposure" value={report.ports.exposure} />
                                </div>
                                {report.ports.open?.length > 0 ? (
                                    <table className="scn-table">
                                        <thead><tr><th>Port</th><th>Service</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {report.ports.open.map((p) => (
                                                <tr key={p.port}>
                                                    <td className="mono">{p.port}</td>
                                                    <td>{p.service}</td>
                                                    <td>
                                                        <span className="scn-badge" style={{ "--c": p.severity === "Expected" ? "#3DD68C" : "#F0554B" }}>
                                                            {p.severity === "Expected" ? "Expected" : "Risky"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : <p className="scn-empty-text">No open ports found.</p>}
                            </>
                        ) : <p className="scn-empty-text">No port data.</p>}
                    </div>

                    {/* 9. CVE Intelligence */}
                    <div className="scn-card" id="scn-vulnerabilities">
                        <h3><FaBug /> CVE Intelligence</h3>
                        {report.cves ? (
                            <>
                                {(report.cves.results?.length || 0) === 0 ? (
                                    <div className="scn-calm-state">
                                        <FaCheckCircle color="#3DD68C" /> No confirmed CVE matches
                                    </div>
                                ) : (
                                    report.cves.results.map((c) => (
                                        <div key={c.id} className="scn-finding-card" style={{ "--c": SEVERITY_META[(c.severity || "").toLowerCase()]?.color || "#7E88A6" }}>
                                            <div className="scn-finding-top">
                                                <SeverityBadge severity={c.severity?.toLowerCase()} />
                                                <strong>{c.id}</strong>
                                                <span className="mono" style={{ marginLeft: "auto", color: "#7E88A6" }}>{c.score}</span>
                                            </div>
                                            <p className="scn-finding-desc">{c.summary}</p>
                                            <p className="scn-empty-text">{c.product} {c.version} — Confidence: {c.confidence}</p>
                                        </div>
                                    ))
                                )}
                                {report.cves.potentialMatches?.length > 0 && (
                                    <Accordion title="Potential / Unverified Matches" badge={<span className="scn-badge" style={{ "--c": "#7E88A6" }}>Informational</span>}>
                                        {report.cves.potentialMatches.map((m, i) => (
                                            <p key={i} className="scn-empty-text"><strong>{m.product}</strong> — {m.confidence}. {m.note}</p>
                                        ))}
                                    </Accordion>
                                )}
                            </>
                        ) : <p className="scn-empty-text">No CVE data.</p>}
                    </div>

                    {/* 10. Recon (Domain Intelligence + Web Hygiene + Directory Scan) */}
                    <div className="scn-card" id="scn-recon">
                        <h3><FaGlobe /> Reconnaissance</h3>

                        <Accordion title="DNS Records" defaultOpen>
                            <div className="scn-kv-grid">
                                <KV label="A Records" value={report.dns?.a?.join(", ") || "Not detected"} />
                                <KV label="AAAA Records" value={report.dns?.aaaa?.join(", ") || "Not detected"} />
                                <KV label="Name Servers" value={report.dns?.ns?.join(", ") || "Not detected"} />
                                <KV label="MX" value={report.dns?.mx?.map((m) => `${m.exchange} (${m.priority})`).join(", ") || "Not detected"} />
                                <KV label="CAA Records" value={report.dns?.caa?.length ? report.dns.caa.length : "Not detected"} />
                                <KV label="Wildcard DNS" value={report.dns?.wildcardDetected ? "Detected" : "Not detected"} />
                            </div>
                        </Accordion>

                        <Accordion title="Email Security (SPF / DMARC)">
                            <div className="scn-kv-grid">
                                <KV label="SPF Present" value={report.dns?.spf?.present ? "Yes" : "No"} />
                                <KV label="SPF Lookup Count" value={report.dns?.spf?.lookupCount} />
                                <KV label="SPF Overly Permissive" value={report.dns?.spf?.overlyPermissive ? "Yes (+all)" : "No"} />
                                <KV label="SPF All Qualifier" value={report.dns?.spf?.allQualifier} />
                                <KV label="DMARC Present" value={report.dns?.dmarc?.present ? "Yes" : "No"} />
                                <KV label="DMARC Policy" value={report.dns?.dmarc?.policy || "Not available"} />
                                <KV label="DMARC Percentage" value={report.dns?.dmarc?.pct} />
                            </div>
                        </Accordion>

                        <Accordion title="WHOIS">
                            <div className="scn-kv-grid">
                                <KV label="Registrar" value={report.whois?.registrar} />
                                <KV label="Created" value={report.whois?.createdDate} />
                                <KV label="Expires" value={report.whois?.expiryDate} />
                                <KV label="Name Servers" value={report.whois?.nameServers?.join(", ")} />
                            </div>
                        </Accordion>

                        <Accordion title="Approximate IP Location">
                            {report.geo?.error ? (
                                <p className="scn-empty-text">{report.geo.error}</p>
                            ) : (
                                <div className="scn-kv-grid">
                                    <KV label="IP" value={report.geo?.ip} />
                                    <KV label="Approx. Country" value={report.geo?.country} />
                                    <KV label="Approx. City" value={report.geo?.city} />
                                    <KV label="Org" value={report.geo?.org} />
                                </div>
                            )}
                        </Accordion>

                        <Accordion title="Robots.txt" badge={<StatusIcon ok={!!report.robots?.exists} />}>
                            <div className="scn-kv-grid">
                                <KV label="Found" value={report.robots?.exists ? "Yes" : "No"} />
                                <KV label="Allow Rules" value={report.robots?.allow?.length ?? 0} />
                                <KV label="Disallow Rules" value={report.robots?.disallow?.length ?? 0} />
                                <KV label="Sitemap Declared" value={report.robots?.sitemap || "Not declared"} />
                                <KV label="Crawl Delay" value={report.robots?.crawlDelay || "Not set"} />
                                <KV label="File Size" value={report.robots?.size ? `${report.robots.size} bytes` : "Unknown"} />
                            </div>
                            {report.robots?.userAgents?.length > 0 && (
                                <>
                                    <p className="scn-subheading">User Agents</p>
                                    <ExpandableList
                                        items={report.robots.userAgents}
                                        previewCount={6}
                                        render={(ua, i) => <span key={i} className="scn-chip">{ua}</span>}
                                    />
                                </>
                            )}
                        </Accordion>

                        <Accordion title="Sitemap" badge={<StatusIcon ok={!!report.sitemap?.exists} />}>
                            <div className="scn-kv-grid">
                                <KV label="Found" value={report.sitemap?.exists ? "Yes" : "No"} />
                                <KV label="URLs" value={report.sitemap?.totalUrls ?? 0} />
                                <KV label="Is Index" value={report.sitemap?.isIndex ? "Yes" : "No"} />
                                <KV label="File Size" value={report.sitemap?.size ? `${report.sitemap.size} bytes` : "Unknown"} />
                            </div>
                            <p className="scn-empty-text">{report.sitemap?.message || "No additional information available."}</p>
                        </Accordion>

                        <Accordion title="Security.txt" badge={<StatusIcon ok={!!report.securityTxt?.exists} />}>
                            <div className="scn-kv-grid">
                                <KV label="Contact" value={report.securityTxt?.contact} />
                                <KV label="Encryption" value={report.securityTxt?.encryption?.length ? report.securityTxt.encryption.join(", ") : "Not provided"} />
                                <KV label="Policy" value={report.securityTxt?.policy} />
                                <KV label="Expires" value={report.securityTxt?.expires} />
                                <KV label="Canonical" value={report.securityTxt?.canonical} />
                                <KV label="Languages" value={report.securityTxt?.languages} />
                            </div>
                        </Accordion>

                        <Accordion title="Directory Scan">
                            <div className="scn-kv-grid">
                                <KV label="Scanned" value={report.directory?.scanned ?? 0} />
                                <KV label="Accessible" value={dirAccessible} />
                                <KV label="Blocked" value={dirBlocked} />
                                <KV label="Redirected" value={dirRedirected} />
                                <KV label="Critical (by path sensitivity)" value={report.directory?.critical ?? 0} />
                                <KV label="High (by path sensitivity)" value={report.directory?.high ?? 0} />
                            </div>
                            {dirItems.length > 0 && (
                                <>
                                    <p className="scn-subheading">Potential Sensitive Paths</p>
                                    <ExpandableList
                                        items={dirItems}
                                        previewCount={10}
                                        render={(item, i) => (
                                            <div className="scn-dir-row" key={i}>
                                                <span className="mono">{item.path}</span>
                                                <span
                                                    className="scn-badge"
                                                    style={{ "--c": item.status === 403 ? "#7E88A6" : item.status === 200 ? SEVERITY_META[(item.severity || "low").toLowerCase()]?.color : "#5B8DEF" }}
                                                >
                                                    {item.status === 403 ? "Blocked" : item.status === 200 ? "Accessible" : `Redirected (${item.status})`}
                                                </span>
                                            </div>
                                        )}
                                    />
                                </>
                            )}
                        </Accordion>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}

function KV({ label, value }) {
    return (
        <div className="scn-kv">
            <span className="scn-kv-label">{label}</span>
            <span className="scn-kv-value">
                {value === undefined || value === null || value === "" ? "Not available" : String(value)}
            </span>
        </div>
    );
}
