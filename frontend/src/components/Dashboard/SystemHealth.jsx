import { Cpu, MemoryStick, HardDrive, Globe2, Database as DbIcon, Radar, ListChecks } from "lucide-react";
import "./SystemHealth.css";

const STATUS_META = {
    operational: { label: "Operational", color: "var(--success)" },
    degraded: { label: "Degraded", color: "var(--warn)" },
    down: { label: "Down", color: "var(--lo)" },
};

const GAUGE_METRICS = [
    { key: "cpu", label: "CPU", icon: Cpu },
    { key: "memory", label: "Memory", icon: MemoryStick },
    { key: "storage", label: "Storage", icon: HardDrive },
];

// Fallback used only when no `health` prop is passed.
const FALLBACK_HEALTH = {
    api: { status: "operational" },
    database: { status: "operational", latencyMs: 24 },
    scanner: { status: "operational", successRate: 95 },
    cpu: 34, memory: 58, storage: 71, queue: 2,
};

function healthColor(value) {
    if (value === null || value === undefined) return "var(--lo)";
    if (value >= 85) return "var(--success)";
    if (value >= 60) return "var(--signal)";
    if (value >= 35) return "var(--warn)";
    return "var(--lo)";
}

function Gauge({ value }) {
    const r = 24;
    const c = 2 * Math.PI * r;
    const known = value !== null && value !== undefined;
    const offset = known ? c - (value / 100) * c : c * 0.92;

    return (
        <div className="gauge" style={{ "--gc": healthColor(value) }}>
            <svg viewBox="0 0 60 60">
                <circle cx="30" cy="30" r={r} className="gauge-track" />
                <circle cx="30" cy="30" r={r} className="gauge-value" style={{ strokeDasharray: c, strokeDashoffset: offset }} />
            </svg>
            <span className="gauge-label mono">{known ? `${value}%` : "N/A"}</span>
        </div>
    );
}

function StatusRow({ icon: Icon, label, status, detail }) {
    const meta = STATUS_META[status] || STATUS_META.down;
    return (
        <div className="status-row">
            <div className="status-row-left">
                <Icon size={14} />
                <span>{label}</span>
            </div>
            <div className="status-row-right">
                {detail && <span className="status-detail mono">{detail}</span>}
                <span className="status-dot" style={{ background: meta.color }} />
                <span className="status-label" style={{ color: meta.color }}>{meta.label}</span>
            </div>
        </div>
    );
}

export default function SystemHealth({ health }) {
    const h = health || FALLBACK_HEALTH;
    const gauges = GAUGE_METRICS.map((m) => ({ ...m, value: h[m.key] ?? null }));

    return (
        <section className="panel">
            <div className="panel-head"><div><h2>System Health</h2><p>Live status &amp; resource usage</p></div></div>

            <div className="status-list">
                <StatusRow icon={Globe2} label="API" status={h.api?.status} />
                <StatusRow
                    icon={DbIcon}
                    label="Database"
                    status={h.database?.status}
                    detail={h.database?.latencyMs !== null && h.database?.latencyMs !== undefined ? `${h.database.latencyMs} ms` : null}
                />
                <StatusRow
                    icon={Radar}
                    label="Scanner"
                    status={h.scanner?.status}
                    detail={h.scanner?.successRate !== null && h.scanner?.successRate !== undefined ? `${h.scanner.successRate}% success` : null}
                />
            </div>

            <div className="health-grid">
                {gauges.map((item) => (
                    <div className="health-item" key={item.key}>
                        <Gauge value={item.value} />
                        <div className="health-item-meta">
                            <item.icon size={13} />
                            <span>{item.label}</span>
                        </div>
                    </div>
                ))}
                <div className="health-item">
                    <div className="queue-count">
                        <ListChecks size={20} />
                        <span className="queue-count-value mono">{h.queue ?? 0}</span>
                    </div>
                    <div className="health-item-meta">
                        <span>Queued Scans</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
