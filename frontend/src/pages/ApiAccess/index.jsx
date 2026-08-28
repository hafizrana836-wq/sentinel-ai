import { useState, useEffect } from "react";
import API_BASE from "../../config/api";
import axios from "axios";
import { motion } from "framer-motion";
import {
    FaKey, FaTrash, FaCopy, FaExclamationTriangle, FaPlus, FaCode, FaSyncAlt, FaBook,
    FaBolt, FaTachometerAlt, FaCheckCircle, FaClock,
} from "react-icons/fa";
import "./ApiAccess.css";

const codeExamples = {
    curl: `curl -X POST ${API_BASE}/api/v1/scan \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"target": "https://example.com"}'`,
    javascript: `fetch("${API_BASE}/api/v1/scan", {
  method: "POST",
  headers: {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    target: "https://example.com"
  })
})
  .then(res => res.json())
  .then(data => console.log(data));`,
    python: `import requests

response = requests.post(
    "${API_BASE}/api/v1/scan",
    headers={
        "x-api-key": "YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={"target": "https://example.com"}
)

print(response.json())`,
    php: `<?php
$ch = curl_init("${API_BASE}/api/v1/scan");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "x-api-key: YOUR_API_KEY",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "target" => "https://example.com"
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

print_r(json_decode($response, true));
?>`
};

const responseExample = `{
  "success": true,
  "target": "https://example.com",
  "score": 82,
  "grade": "B",
  "risk": "Low",
  "ssl": {
    "valid": true,
    "issuer": "Let's Encrypt"
  },
  "findings": [ ... ]
}`;

// Inline shimmer placeholder — see ApiAccess.css for .api-skel
function Skel({ w = "100%", h = 14, style = {} }) {
    return <span className="api-skel" style={{ width: w, height: h, ...style }} />;
}

// icon+label config for the dashboard grid — used by both the real
// dashboard render and its skeleton so the shape always matches
const DASHBOARD_STATS = [
    { key: "activeKeys", label: "Active Keys", icon: FaKey, format: (v) => v },
    { key: "requestsToday", label: "Requests Today", icon: FaBolt, format: (v) => v },
    { key: "dailyLimit", label: "Daily Limit (Total)", icon: FaTachometerAlt, format: (v) => v },
    { key: "successRate", label: "Success Rate", icon: FaCheckCircle, format: (v) => (v !== null ? `${v}%` : "N/A") },
    { key: "avgResponseSeconds", label: "Avg Response Time", icon: FaClock, format: (v) => (v !== null ? `${v}s` : "N/A") },
];

function DashboardSkeleton() {
    return (
        <div className="api-dashboard">
            <h3 className="api-dashboard-title">API Overview</h3>
            <div className="api-dashboard-grid">
                {DASHBOARD_STATS.map(({ key, label, icon: Icon }) => (
                    <div className="api-dashboard-stat" key={key}>
                        <div className="api-dashboard-icon"><Icon size={12} /></div>
                        <span className="api-dashboard-label">{label}</span>
                        <Skel w="40px" h={18} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function ApiKeySkeletonItem() {
    return (
        <div className="api-key-item">
            <div className="api-key-top">
                <div>
                    <Skel w="140px" h={15} />
                    <div style={{ marginTop: 6 }}><Skel w="200px" h={12} /></div>
                </div>
                <Skel w="50px" h={20} style={{ borderRadius: 10 }} />
            </div>
            <div className="api-usage-grid">
                {["Requests Today", "Requests This Month", "Total Requests", "Last Used"].map((label) => (
                    <div className="api-usage-stat" key={label}>
                        <span className="api-usage-label">{label}</span>
                        <div style={{ marginTop: 4 }}><Skel w="60px" h={13} /></div>
                    </div>
                ))}
            </div>
            <div className="api-ratelimit">
                <Skel w="100%" h={7} style={{ borderRadius: 4 }} />
            </div>
        </div>
    );
}

export default function ApiAccess() {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [keyName, setKeyName] = useState("");
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [activeTab, setActiveTab] = useState("curl");
    const [showFullDocs, setShowFullDocs] = useState(false);
    const [confirmRegenId, setConfirmRegenId] = useState(null);

    const token = localStorage.getItem("sentinel_token");
    const headers = { Authorization: `Bearer ${token}` };

    const [dashboard, setDashboard] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);

    useEffect(() => {
        fetchKeys();
        fetchDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchDashboard() {
        try {
            const response = await axios.get(
                `${API_BASE}/api/keys/dashboard`,
                { headers }
            );
            setDashboard(response.data.dashboard);
        }
        catch (err) {
            // Dashboard stats optional hain, silently fail
        }
        finally {
            setDashboardLoading(false);
        }
    }

    async function fetchKeys() {
        setLoading(true);
        setError("");
        try {
            const response = await axios.get(
                `${API_BASE}/api/keys`,
                { headers }
            );
            setKeys(response.data.keys || []);
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to load API keys.");
        }
        finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        setCreating(true);
        setError("");
        try {
            const response = await axios.post(
                `${API_BASE}/api/keys`,
                { name: keyName || "My API Key" },
                { headers }
            );
            setNewKey(response.data.apiKey);
            setKeyName("");
            fetchKeys();
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to create API key.");
        }
        finally {
            setCreating(false);
        }
    }

    async function handleDelete(id) {
        try {
            await axios.delete(
                `${API_BASE}/api/keys/${id}`,
                { headers }
            );
            setKeys((prev) => prev.filter((k) => k.id !== id));
        }
        catch (err) {
            setError("Failed to delete API key.");
        }
    }

    async function handleToggle(id) {
        try {
            const response = await axios.patch(
                `${API_BASE}/api/keys/${id}/toggle`,
                {},
                { headers }
            );
            setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, ...response.data.apiKey } : k)));
        }
        catch (err) {
            setError("Failed to update API key.");
        }
    }

    async function handleRegenerate(id) {
        try {
            const response = await axios.patch(
                `${API_BASE}/api/keys/${id}/regenerate`,
                {},
                { headers }
            );
            setNewKey(response.data.apiKey);
            setConfirmRegenId(null);
            fetchKeys();
        }
        catch (err) {
            setError("Failed to regenerate API key.");
        }
    }

    function copyToClipboard(text, id) {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    return (
        <div className="api-page">
            <div className="api-box">
                <h1><FaKey /> API Access</h1>
                <p className="api-subtitle">
                    Generate API keys to run scans programmatically from your own applications
                </p>

                {error && (
                    <div className="api-error">
                        <FaExclamationTriangle /> {error}
                    </div>
                )}

                {dashboardLoading ? (
                    <DashboardSkeleton />
                ) : dashboard && (
                    <div className="api-dashboard">
                        <h3 className="api-dashboard-title">API Overview</h3>
                        <div className="api-dashboard-grid">
                            {DASHBOARD_STATS.map(({ key, label, icon: Icon, format }) => (
                                <div className="api-dashboard-stat" key={key}>
                                    <div className="api-dashboard-icon"><Icon size={12} /></div>
                                    <span className="api-dashboard-label">{label}</span>
                                    <span className="api-dashboard-value">{format(dashboard[key])}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {newKey && (
                    <div className="api-newkey-box">
                        <p><strong>New API key — copy it now, it won't be shown again:</strong></p>
                        <div className="api-newkey-value">
                            <code>{newKey.key}</code>
                            <button onClick={() => copyToClipboard(newKey.key, "new")}>
                                <FaCopy /> {copiedId === "new" ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>
                )}

                <div className="api-create">
                    <input
                        type="text"
                        placeholder="Key name (e.g. 'Production Server')"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                    />
                    <button onClick={handleCreate} disabled={creating}>
                        <FaPlus /> {creating ? "Generating..." : "Generate New Key"}
                    </button>
                </div>

                {loading ? (
                    <div className="api-key-list">
                        {Array.from({ length: 3 }).map((_, i) => <ApiKeySkeletonItem key={i} />)}
                    </div>
                ) : keys.length === 0 ? (
                    <p className="api-empty">No API keys yet. Generate one above to get started.</p>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="api-key-list"
                    >
                        {keys.map((k) => {
                            const usagePercent = Math.min(
                                100,
                                Math.round((k.requests_today / k.daily_limit) * 100)
                            );

                            return (
                                <div key={k.id} className={`api-key-item ${!k.active ? "api-key-inactive" : ""}`}>
                                    <div className="api-key-top">
                                        <div>
                                            <p className="api-key-name">{k.name}</p>
                                            <p className="api-key-masked">
                                                {k.keyPrefix}••••••••••••••••{k.keyLast4}
                                            </p>
                                        </div>
                                        <span className={`api-key-status ${k.active ? "status-active" : "status-paused"}`}>
                                            {k.active ? "Active" : "Paused"}
                                        </span>
                                    </div>

                                    <div className="api-usage-grid">
                                        <div className="api-usage-stat">
                                            <span className="api-usage-label">Requests Today</span>
                                            <span className="api-usage-value">{k.requests_today}</span>
                                        </div>
                                        <div className="api-usage-stat">
                                            <span className="api-usage-label">Requests This Month</span>
                                            <span className="api-usage-value">{k.requests_month.toLocaleString()}</span>
                                        </div>
                                        <div className="api-usage-stat">
                                            <span className="api-usage-label">Total Requests</span>
                                            <span className="api-usage-value">{k.total_requests?.toLocaleString() ?? 0}</span>
                                        </div>
                                        <div className="api-usage-stat">
                                            <span className="api-usage-label">Last Used</span>
                                            <span className="api-usage-value">
                                                {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="api-ratelimit">
                                        <div className="api-ratelimit-header">
                                            <span>Daily Limit: {k.daily_limit} scans</span>
                                            <span>{k.requests_today} / {k.daily_limit} used</span>
                                        </div>
                                        <div className="api-ratelimit-bar">
                                            <div
                                                className={`api-ratelimit-fill ${usagePercent >= 90 ? "fill-critical" : usagePercent >= 60 ? "fill-warning" : ""}`}
                                                style={{ width: `${usagePercent}%` }}
                                            />
                                        </div>
                                        <span className="api-ratelimit-remaining">
                                            Remaining today: {k.remaining_today}
                                        </span>
                                    </div>

                                    <div className="api-key-actions">
                                        <button onClick={() => handleToggle(k.id)}>
                                            {k.active ? "Pause" : "Activate"}
                                        </button>

                                        {confirmRegenId === k.id ? (
                                            <>
                                                <button className="api-regen-confirm" onClick={() => handleRegenerate(k.id)}>
                                                    Confirm Regenerate
                                                </button>
                                                <button onClick={() => setConfirmRegenId(null)}>Cancel</button>
                                            </>
                                        ) : (
                                            <button onClick={() => setConfirmRegenId(k.id)}>
                                                <FaSyncAlt /> Regenerate
                                            </button>
                                        )}

                                        <button className="api-key-delete" onClick={() => handleDelete(k.id)}>
                                            <FaTrash /> Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>
                )}

                <div className="api-docs">
                    <div className="api-docs-header">
                        <h3><FaCode /> How to use</h3>
                        <button className="api-docs-toggle" onClick={() => setShowFullDocs(!showFullDocs)}>
                            <FaBook /> {showFullDocs ? "Hide Full Docs" : "View Full API Docs"}
                        </button>
                    </div>

                    <div className="api-docs-tabs">
                        {Object.keys(codeExamples).map((lang) => (
                            <button
                                key={lang}
                                className={`api-tab-btn ${activeTab === lang ? "api-tab-active" : ""}`}
                                onClick={() => setActiveTab(lang)}
                            >
                                {lang === "curl" ? "cURL" : lang === "javascript" ? "JavaScript" : lang === "python" ? "Python" : "PHP"}
                            </button>
                        ))}
                    </div>

                    <pre>{codeExamples[activeTab]}</pre>

                    {showFullDocs && (
                        <>
                            <h4 className="api-docs-subheading">Endpoint</h4>
                            <p className="api-docs-text">
                                <code>POST /api/v1/scan</code> — requires <code>x-api-key</code> header. Body: <code>{`{ "target": "https://example.com" }`}</code>
                            </p>

                            <h4 className="api-docs-subheading">Example Response</h4>
                            <pre>{responseExample}</pre>

                            <h4 className="api-docs-subheading">Rate Limits</h4>
                            <p className="api-docs-text">
                                Each key has a daily limit (default 100 scans/day). Exceeding it 5 times in a row automatically disables the key for security — regenerate a new one if this happens.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

