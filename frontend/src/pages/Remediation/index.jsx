import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import {
    ArrowLeft,
    ShieldAlert,
    CheckCircle2,
    ExternalLink,
    Sparkles,
    Copy,
    Check,
    RefreshCw,
    XCircle,
} from "lucide-react";
import "./Remediation.css";

import API_BASE from "../../config/api";

// Implementation snippets are only meaningful for the handful of findings
// that map to a concrete HTTP response header — everything else (SSL,
// ports, CVEs, DNS) doesn't have a copy-pasteable server-config fix, so
// those just show the existing recommendation text with no tabs.
const IMPLEMENTATION_SNIPPETS = {
    MISSING_CSP: {
        example: "Content-Security-Policy: default-src 'self';",
        nginx: 'add_header Content-Security-Policy "default-src \'self\';" always;',
        apache: 'Header always set Content-Security-Policy "default-src \'self\';"',
        express: "app.use((req, res, next) => {\n  res.setHeader(\"Content-Security-Policy\", \"default-src 'self';\");\n  next();\n});",
        cloudflare: "Rules → Transform Rules → Modify Response Header\nAdd: Content-Security-Policy = default-src 'self';",
    },
    MISSING_HSTS: {
        example: "Strict-Transport-Security: max-age=63072000; includeSubDomains",
        nginx: 'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;',
        apache: 'Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"',
        express: "app.use((req, res, next) => {\n  res.setHeader(\"Strict-Transport-Security\", \"max-age=63072000; includeSubDomains\");\n  next();\n});",
        cloudflare: "SSL/TLS → Edge Certificates → Enable HSTS",
    },
    MISSING_XFO: {
        example: "X-Frame-Options: DENY",
        nginx: 'add_header X-Frame-Options "DENY" always;',
        apache: 'Header always set X-Frame-Options "DENY"',
        express: "app.use((req, res, next) => {\n  res.setHeader(\"X-Frame-Options\", \"DENY\");\n  next();\n});",
        cloudflare: "Rules → Transform Rules → Modify Response Header\nAdd: X-Frame-Options = DENY",
    },
    MISSING_XCTO: {
        example: "X-Content-Type-Options: nosniff",
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        apache: 'Header always set X-Content-Type-Options "nosniff"',
        express: "app.use((req, res, next) => {\n  res.setHeader(\"X-Content-Type-Options\", \"nosniff\");\n  next();\n});",
        cloudflare: "Rules → Transform Rules → Modify Response Header\nAdd: X-Content-Type-Options = nosniff",
    },
    MISSING_REFERRER_POLICY: {
        example: "Referrer-Policy: strict-origin-when-cross-origin",
        nginx: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
        apache: 'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
        express: "app.use((req, res, next) => {\n  res.setHeader(\"Referrer-Policy\", \"strict-origin-when-cross-origin\");\n  next();\n});",
        cloudflare: "Rules → Transform Rules → Modify Response Header\nAdd: Referrer-Policy = strict-origin-when-cross-origin",
    },
};

const PLATFORMS = [
    { key: "nginx", label: "Nginx" },
    { key: "apache", label: "Apache" },
    { key: "express", label: "Express" },
    { key: "cloudflare", label: "Cloudflare" },
];

function severityMeta(severity) {
    switch (severity) {
        case "critical": return { color: "#F0554B", label: "Critical" };
        case "high": return { color: "#F0554B", label: "High" };
        case "medium": return { color: "#F2A65A", label: "Medium" };
        case "low": return { color: "#5B8DEF", label: "Low" };
        default: return { color: "#7E88A6", label: "Unknown" };
    }
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard permissions denied — silently ignore, button just won't confirm */
        }
    }
    return (
        <button className="rem-copy-btn" onClick={handleCopy}>
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Fix</>}
        </button>
    );
}

export default function Remediation() {
    const { scanId, code } = useParams();
    const navigate = useNavigate();
    const [scan, setScan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [platform, setPlatform] = useState("nginx");
    const [resolvedLocally, setResolvedLocally] = useState(false);

    // Verify Fix state
    const [verifying, setVerifying] = useState(false);
    const [verifyStep, setVerifyStep] = useState("");
    const [verifyResult, setVerifyResult] = useState(null); // { stillPresent, newScanId }
    const socketRef = useRef(null);

    const token = localStorage.getItem("sentinel_token");

    useEffect(() => {
        fetchScan();
        const key = `resolved:${scanId}:${code}`;
        setResolvedLocally(localStorage.getItem(key) === "true");
        return () => socketRef.current?.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanId, code]);

    async function fetchScan() {
        setLoading(true);
        setError("");
        try {
            const response = await axios.get(`${API_BASE}/api/scan/${scanId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setScan(response.data);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to load this scan.");
        } finally {
            setLoading(false);
        }
    }

    function markResolved() {
        localStorage.setItem(`resolved:${scanId}:${code}`, "true");
        setResolvedLocally(true);
    }

    // Triggers a fresh scan of the same target and checks whether this
    // specific finding code still shows up once it completes — the only
    // real way to confirm a fix actually took effect.
    function verifyFix() {
        if (!scan) return;
        setVerifying(true);
        setVerifyResult(null);
        setVerifyStep("Starting rescan...");

        axios.post(
            `${API_BASE}/api/scan`,
            { target: scan.target },
            { headers: { Authorization: `Bearer ${token}` } }
        ).then(({ data }) => {
            const newScanId = data.scanId;
            const socket = io(API_BASE, { auth: { token } });
            socketRef.current = socket;

            socket.on("connect", () => socket.emit("scan:subscribe", newScanId));

            socket.on("scan:progress", ({ scanId: eventScanId, step, status, scan: finishedScan }) => {
                if (eventScanId !== newScanId) return;

                if (status === "failed") {
                    setVerifying(false);
                    setVerifyStep("");
                    setError("Rescan failed — try again in a moment.");
                    socket.disconnect();
                    return;
                }

                if (status === "complete" && finishedScan) {
                    const stillPresent = finishedScan.findings?.some((f) => f.code === code);
                    setVerifyResult({ stillPresent, newScanId });
                    if (!stillPresent) markResolved();
                    setVerifying(false);
                    setVerifyStep("");
                    socket.disconnect();
                    return;
                }

                setVerifyStep(step);
            });
        }).catch(() => {
            setVerifying(false);
            setVerifyStep("");
            setError("Couldn't start the rescan — check your connection and try again.");
        });
    }

    const finding = scan?.findings?.find((f) => f.code === code);
    const meta = severityMeta(finding?.severity);
    const snippet = IMPLEMENTATION_SNIPPETS[code];

    return (
        <div className="rem-page">
            <div className="rem-box">
                <button className="rem-back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={15} /> Back
                </button>

                {loading ? (
                    <p className="rem-loading">Loading finding...</p>
                ) : error && !finding ? (
                    <div className="rem-error">{error}</div>
                ) : !finding ? (
                    <div className="rem-error">
                        This finding couldn't be found — it may have been resolved by a newer scan.
                    </div>
                ) : (
                    <>
                        <p className="rem-eyebrow">Security Remediation</p>
                        <div className="rem-header">
                            <span className="rem-severity" style={{ "--c": meta.color }}>
                                <ShieldAlert size={13} /> {meta.label}
                            </span>
                            <span className="rem-target">{scan.target}</span>
                            {resolvedLocally && (
                                <span className="rem-resolved-tag"><CheckCircle2 size={12} /> Marked resolved</span>
                            )}
                        </div>

                        <h1>{finding.title}</h1>
                        <p className="rem-description">{finding.description}</p>

                        {finding.evidence && (
                            <div className="rem-card">
                                <h3>Detected Evidence</h3>
                                <div className="rem-evidence">
                                    {Object.entries(finding.evidence).map(([key, value]) => (
                                        <div className="rem-evidence-row" key={key}>
                                            <span className="rem-evidence-key">{key}</span>
                                            <span className="rem-evidence-value">
                                                {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="rem-card rem-recommendation">
                            <h3><Sparkles size={15} /> Recommended Fix</h3>
                            {finding.recommendation ? (
                                <p>{finding.recommendation}</p>
                            ) : (
                                <p className="rem-empty">No specific recommendation available for this finding yet.</p>
                            )}

                            {snippet && (
                                <>
                                    <div className="rem-example">
                                        <code>{snippet.example}</code>
                                        <CopyButton text={snippet.example} />
                                    </div>

                                    <div className="rem-tabs">
                                        {PLATFORMS.map((p) => (
                                            <button
                                                key={p.key}
                                                className={`rem-tab ${platform === p.key ? "active" : ""}`}
                                                onClick={() => setPlatform(p.key)}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="rem-snippet-block">
                                        <pre>{snippet[platform]}</pre>
                                        <CopyButton text={snippet[platform]} />
                                    </div>
                                </>
                            )}

                            <div className="rem-disclaimer">
                                <CheckCircle2 size={13} />
                                This is guidance, not an automated fix — Sentinel AI can't change your
                                server directly. Apply the steps above yourself, or hand them to whoever
                                manages {scan.target}, then verify below.
                            </div>
                        </div>

                        <div className="rem-card rem-verify">
                            <h3><RefreshCw size={15} /> Fix Verification</h3>

                            {!verifying && !verifyResult && (
                                <>
                                    <p className="rem-verify-copy">
                                        Once you've applied the fix, run a fresh scan to confirm it actually
                                        took effect.
                                    </p>
                                    <button className="rem-verify-btn" onClick={verifyFix}>
                                        <RefreshCw size={14} /> Verify Fix
                                    </button>
                                </>
                            )}

                            {verifying && (
                                <p className="rem-verify-progress">
                                    <RefreshCw size={14} className="rem-spin" /> {verifyStep || "Rescanning..."}
                                </p>
                            )}

                            {verifyResult && (
                                <div className="rem-verify-result">
                                    <div className="rem-verify-row">
                                        <span>Before</span>
                                        <span className="rem-before"><XCircle size={13} /> Present</span>
                                    </div>
                                    <div className="rem-verify-row">
                                        <span>After</span>
                                        {verifyResult.stillPresent ? (
                                            <span className="rem-before"><XCircle size={13} /> Still present</span>
                                        ) : (
                                            <span className="rem-after"><CheckCircle2 size={13} /> Resolved</span>
                                        )}
                                    </div>
                                    <div className={`rem-status-tag ${verifyResult.stillPresent ? "warn" : "ok"}`}>
                                        {verifyResult.stillPresent ? "NOT YET RESOLVED" : "RESOLVED"}
                                    </div>
                                    {verifyResult.stillPresent && (
                                        <p className="rem-verify-copy">
                                            Still showing up in the latest scan — double check the fix was
                                            deployed, then verify again.
                                        </p>
                                    )}
                                    <button
                                        className="rem-view-scan"
                                        onClick={() => navigate(`/history?scanId=${verifyResult.newScanId}`)}
                                    >
                                        View new scan <ExternalLink size={13} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="rem-actions">
                            {!resolvedLocally && (
                                <button className="rem-resolve-btn" onClick={markResolved}>
                                    <CheckCircle2 size={14} /> Mark as Resolved
                                </button>
                            )}
                            <button
                                className="rem-view-scan"
                                onClick={() => navigate(`/history?scanId=${scanId}`)}
                            >
                                View full scan report <ExternalLink size={13} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
