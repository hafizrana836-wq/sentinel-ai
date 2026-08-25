import { useState, useEffect } from "react";
import API_BASE from "../../config/api";
import axios from "axios";
import { motion } from "framer-motion";
import {
    Clock,
    Trash2,
    Pause,
    Play,
    AlertTriangle,
    Plus,
    CalendarClock,
    CheckCircle2,
} from "lucide-react";
import "./Schedule.css";

export default function Schedule() {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [target, setTarget] = useState("");
    const [frequency, setFrequency] = useState("daily");
    const [creating, setCreating] = useState(false);

    const token = localStorage.getItem("sentinel_token");
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchSchedules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchSchedules() {
        setLoading(true);
        setError("");
        try {
            const response = await axios.get(
                `${API_BASE}/api/schedule`,
                { headers }
            );
            setSchedules(response.data.schedules || []);
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to load scheduled scans.");
        }
        finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!target.trim()) {
            setError("Please enter a website to schedule.");
            return;
        }

        setCreating(true);
        setError("");

        try {
            await axios.post(
                `${API_BASE}/api/schedule`,
                { target, frequency },
                { headers }
            );
            setTarget("");
            fetchSchedules();
        }
        catch (err) {
            setError(err.response?.data?.message || "Failed to create scheduled scan.");
        }
        finally {
            setCreating(false);
        }
    }

    async function handleDelete(id) {
        try {
            await axios.delete(
                `${API_BASE}/api/schedule/${id}`,
                { headers }
            );
            setSchedules((prev) => prev.filter((s) => s.id !== id));
        }
        catch (err) {
            setError("Failed to delete scheduled scan.");
        }
    }

    async function handleToggle(id) {
        try {
            const response = await axios.patch(
                `${API_BASE}/api/schedule/${id}/toggle`,
                {},
                { headers }
            );
            setSchedules((prev) =>
                prev.map((s) => (s.id === id ? response.data.schedule : s))
            );
        }
        catch (err) {
            setError("Failed to update scheduled scan.");
        }
    }

    const activeCount = schedules.filter((s) => s.active).length;
    const pausedCount = schedules.length - activeCount;

    return (
        <div className="sch-page">
            <div className="sch-box">
                <div className="sch-top">
                    <h1><Clock size={22} /> Scheduled Scans</h1>
                    <p>Automatically scan websites on a recurring basis</p>
                </div>

                {error && (
                    <div className="sch-error">
                        <AlertTriangle size={15} /> {error}
                    </div>
                )}

                {schedules.length > 0 && (
                    <div className="sch-stats">
                        <div className="sch-stat">
                            <CalendarClock size={16} />
                            <div>
                                <span className="sch-stat-value">{schedules.length}</span>
                                <span className="sch-stat-label">Total Scheduled</span>
                            </div>
                        </div>
                        <div className="sch-stat">
                            <CheckCircle2 size={16} style={{ color: "var(--sn-success)" }} />
                            <div>
                                <span className="sch-stat-value" style={{ color: "var(--sn-success)" }}>{activeCount}</span>
                                <span className="sch-stat-label">Active</span>
                            </div>
                        </div>
                        <div className="sch-stat">
                            <Pause size={16} style={{ color: "var(--sn-text-dim)" }} />
                            <div>
                                <span className="sch-stat-value">{pausedCount}</span>
                                <span className="sch-stat-label">Paused</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="sch-create">
                    <input
                        type="text"
                        placeholder="Enter website URL..."
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                    />
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                    <button onClick={handleCreate} disabled={creating}>
                        <Plus size={15} /> {creating ? "Creating..." : "Schedule Scan"}
                    </button>
                </div>

                {loading ? (
                    <div className="sch-loading">
                        {[1, 2, 3].map((i) => <div key={i} className="sch-skel-row" />)}
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="sch-empty">
                        <CalendarClock size={36} />
                        <p>No scheduled scans yet.</p>
                        <span>Add a target above to have Sentinel AI scan it automatically, on repeat.</span>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="sch-list"
                    >
                        {schedules.map((s) => (
                            <div key={s.id} className={`sch-card ${!s.active ? "is-paused" : ""}`}>
                                <div className="sch-card-main">
                                    <p className="sch-target">{s.target}</p>
                                    <div className="sch-meta">
                                        <span className="sch-freq">{s.frequency}</span>
                                        <span className={`sch-status ${s.active ? "on" : "off"}`}>
                                            <span className="sch-status-dot" />
                                            {s.active ? "Active" : "Paused"}
                                        </span>
                                    </div>
                                    <p className="sch-next">Next run: {new Date(s.next_run).toLocaleString()}</p>
                                    {s.last_run && (
                                        <p className="sch-last">Last run: {new Date(s.last_run).toLocaleString()}</p>
                                    )}
                                </div>

                                <div className="sch-actions">
                                    <button onClick={() => handleToggle(s.id)} title={s.active ? "Pause" : "Resume"}>
                                        {s.active ? <Pause size={15} /> : <Play size={15} />}
                                    </button>
                                    <button onClick={() => handleDelete(s.id)} title="Delete" className="sch-delete">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
