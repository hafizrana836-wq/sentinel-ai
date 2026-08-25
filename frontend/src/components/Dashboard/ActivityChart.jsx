import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import "./ActivityChart.css";

import API_BASE from "../../config/api";

function formatLabel(dateStr, range) {
  const d = new Date(dateStr + "T00:00:00");
  if (range === "7d") return d.toLocaleDateString(undefined, { weekday: "short" });
  return String(d.getDate());
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label mono">{label}</div>
      {payload.map((p) => (
        <div className="chart-tip-row" key={p.dataKey}>
          <span style={{ background: p.color }} /> {p.name}
          <b className="mono">{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export default function ActivityChart() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("sentinel_token");

  useEffect(() => {
    fetchTrend(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function fetchTrend(r) {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/activity-trend`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: r },
      });
      const formatted = (res.data.series || []).map((point) => ({
        d: formatLabel(point.date, r),
        threats: point.threats,
        resolved: point.resolved,
      }));
      setData(formatted);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel activity-panel">
      <div className="panel-head">
        <div>
          <h2>Security Trend</h2>
          <p>Threats detected vs. resolved</p>
        </div>
        <div className="activity-head-right">
          <span className="live-tag"><span className="live-dot" />Live</span>
          <div className="range-toggle">
            {["7d", "30d", "90d"].map((r) => (
              <button key={r} className={range === r ? "is-active" : ""} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ "--lc": "#F0554B" }} />
          Threats
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ "--lc": "#5B8DEF" }} />
          Resolved
        </span>
      </div>

      <div className="chart-box">
        {loading ? (
          <p style={{ color: "#7E88A6", textAlign: "center", paddingTop: 100 }}>Loading trend...</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="threatFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F0554B" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#F0554B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1D2740" vertical={false} />
              <XAxis
                dataKey="d"
                tick={{ fill: "#7E88A6", fontSize: 11 }}
                axisLine={{ stroke: "#1D2740" }}
                tickLine={false}
                interval={range === "7d" ? 0 : "preserveStartEnd"}
              />
              <YAxis tick={{ fill: "#7E88A6", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="threats" name="Threats" stroke="#F0554B" strokeWidth={2} fill="url(#threatFill)" />
              <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#5B8DEF" strokeWidth={2} fill="url(#resolvedFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
