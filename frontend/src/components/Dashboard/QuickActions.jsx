import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Play, Download, KeyRound, CalendarClock, History } from "lucide-react";
import "./QuickActions.css";

import API_BASE from "../../config/api";

// latestScanId enables the one action here that isn't a plain nav link —
// downloading the most recent scan's PDF directly from the dashboard.
export default function QuickActions({ latestScanId }) {
    const navigate = useNavigate();
    const [downloading, setDownloading] = useState(false);
    const token = localStorage.getItem("sentinel_token");

    async function downloadLatestReport() {
        if (!latestScanId) {
            navigate("/reports");
            return;
        }
        setDownloading(true);
        try {
            const response = await axios.get(`${API_BASE}/api/scan/${latestScanId}/report`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "sentinel-latest-scan-report.pdf");
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            navigate("/reports");
        } finally {
            setDownloading(false);
        }
    }

    const actions = [
        { label: "New Scan", icon: Play, primary: true, onClick: () => navigate("/scanner") },
        { label: downloading ? "Downloading..." : "Download Report", icon: Download, onClick: downloadLatestReport, disabled: downloading },
        { label: "API Keys", icon: KeyRound, onClick: () => navigate("/api-access") },
        { label: "Schedule Scan", icon: CalendarClock, onClick: () => navigate("/schedule") },
        { label: "History", icon: History, onClick: () => navigate("/history") },
    ];

    return (
        <section className="panel">
            <div className="panel-head"><div><h2>Quick Actions</h2></div></div>
            <div className="actions-row">
                {actions.map((a) => (
                    <button
                        key={a.label}
                        className={`action-btn ${a.primary ? "primary" : ""}`}
                        onClick={a.onClick}
                        disabled={a.disabled}
                    >
                        <a.icon size={15} /> {a.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
