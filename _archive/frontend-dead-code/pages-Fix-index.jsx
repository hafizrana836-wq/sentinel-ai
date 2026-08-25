import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeft,
    ShieldAlert,
    CheckCircle2,
    ExternalLink,
    Sparkles,
} from "lucide-react";
import "./Fix.css";

const API_BASE = "http://localhost:5000";

function severityMeta(severity) {
    switch (severity) {
        case "critical": return { color: "#F0554B", label: "Critical" };
        case "high": return { color: "#F0554B", label: "High" };
        case "medium": return { color: "#F2A65A", label: "Medium" };
        case "low": return { color: "#5B8DEF", label: "Low" };
        default: return { color: "#7E88A6", label: "Unknown" };
    }
}

export default function Fix() {
    const { scanId, code } = useParams();
    const navigate = useNavigate();
    const [scan, setScan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const token = localStorage.getItem("sentinel_token");

    useEffect(() => {
        fetchScan();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanId]);

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

    const finding = scan?.findings?.find((f) => f.code === code);
    const meta = severityMeta(finding?.severity);

    return (
        <div className="fix-page">
            <div className="fix-box">
                <button className="fix-back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={15} /> Back
                </button>

                {loading ? (
                    <p className="fix-loading">Loading finding...</p>
                ) : error ? (
                    <div className="fix-error">{error}</div>
                ) : !finding ? (
                    <div className="fix-error">
                        This finding couldn't be found — it may have been resolved by a newer scan.
                    </div>
                ) : (
                    <>
                        <div className="fix-header">
                            <span className="fix-severity" style={{ "--c": meta.color }}>
                                <ShieldAlert size={13} /> {meta.label}
                            </span>
                            <span className="fix-target">{scan.target}</span>
                        </div>

                        <h1>{finding.title}</h1>
                        <p className="fix-description">{finding.description}</p>

                        {finding.evidence && (
                            <div className="fix-card">
                                <h3>Evidence</h3>
                                <div className="fix-evidence">
                                    {Object.entries(finding.evidence).map(([key, value]) => (
                                        <div className="fix-evidence-row" key={key}>
                                            <span className="fix-evidence-key">{key}</span>
                                            <span className="fix-evidence-value">
                                                {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="fix-card fix-recommendation">
                            <h3><Sparkles size={15} /> Recommended Fix</h3>
                            {finding.recommendation ? (
                                <p>{finding.recommendation}</p>
                            ) : (
                                <p className="fix-empty">No specific recommendation available for this finding yet.</p>
                            )}
                            <div className="fix-disclaimer">
                                <CheckCircle2 size={13} />
                                This is guidance, not an automated fix — Sentinel AI can't make changes on
                                your server directly. Apply the steps above yourself, or hand them to whoever
                                manages {scan.target}.
                            </div>
                        </div>

                        <button
                            className="fix-view-scan"
                            onClick={() => navigate(`/history?scanId=${scanId}`)}
                        >
                            View full scan report <ExternalLink size={13} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
