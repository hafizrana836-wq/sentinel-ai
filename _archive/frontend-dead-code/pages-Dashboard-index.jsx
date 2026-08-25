import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
    LayoutDashboard,
    Search,
    History as HistoryIcon,
    FileText,
    KeyRound,
    Settings,
    ChevronLeft,
    Menu,
    X,
    LogOut,
    Shield,
} from "lucide-react";
import "../../components/Dashboard/Dashboard.css";
import DashboardHero from "../../components/Dashboard/DashboardHero";
import ScoreOverview from "../../components/Dashboard/ScoreOverview";
import StatsGrid from "../../components/Dashboard/StatsGrid";
import ActivityChart from "../../components/Dashboard/ActivityChart";
import RecentScans from "../../components/Dashboard/RecentScans";
import AIInsights from "../../components/Dashboard/AIInsights";
import SystemHealth from "../../components/Dashboard/SystemHealth";
import QuickActions from "../../components/Dashboard/QuickActions";

const API_BASE = "http://localhost:5000";

const NAV_ITEMS = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Scanner", path: "/scanner", icon: Search },
    { label: "History", path: "/history", icon: HistoryIcon },
    { label: "Reports", path: "/reports", icon: FileText },
    { label: "API Access", path: "/api-access", icon: KeyRound },
    { label: "Settings", path: "/settings", icon: Settings },
];

export default function Dashboard() {
    const [dashboard, setDashboard] = useState(null);
    const [recentScans, setRecentScans] = useState(null);
    const [systemHealth, setSystemHealth] = useState(null);
    const [insights, setInsights] = useState(undefined);
    const [error, setError] = useState("");
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const socketRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();
    const token = localStorage.getItem("sentinel_token");

    const userRaw = localStorage.getItem("sentinel_user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const displayName = user?.username || "Guest";
    const initial = displayName.charAt(0).toUpperCase();

    useEffect(() => {
        fetchDashboardData();

        // Every scan the backend finishes broadcasts "scan:completed" to the
        // owner's `user:<id>` room (see server.js / scanController.js) — the
        // dashboard doesn't know any scanId up front, so it listens on its
        // own account-wide room instead of `scan:<id>`, and just refetches
        // when it hears one.
        const socket = io(API_BASE, { auth: { token } });
        socketRef.current = socket;

        socket.on("scan:completed", () => {
            fetchDashboardData();
        });

        return () => {
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchDashboardData() {
        setError("");
        try {
            const [dashboardRes, recentRes, healthRes, insightsRes] = await Promise.all([
                axios.get(`${API_BASE}/api/dashboard`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                axios.get(`${API_BASE}/api/recent-scans`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                axios.get(`${API_BASE}/api/system-health`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                axios.get(`${API_BASE}/api/insights`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);
            setDashboard(dashboardRes.data);
            setRecentScans(recentRes.data);
            setSystemHealth(healthRes.data);
            setInsights(insightsRes.data);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || "Failed to load dashboard data.");
        }
    }

    function handleLogout() {
        localStorage.removeItem("sentinel_token");
        localStorage.removeItem("sentinel_user");
        navigate("/login");
    }

    const sidebarContent = (
        <>
            <div className="brand">
                <div className="brand-mark"><Shield size={16} /></div>
                <span>Sentinel AI</span>
                <button
                    className="collapse-btn"
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label="Collapse sidebar"
                >
                    <ChevronLeft size={13} style={{ transform: collapsed ? "rotate(180deg)" : "none" }} />
                </button>
                <button
                    className="mobile-close-btn"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                >
                    <X size={14} />
                </button>
            </div>

            <nav className="nav">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActive ? "is-active" : ""}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            <Icon size={16} />
                            <span>{item.label}</span>
                            {isActive && <span className="nav-indicator" />}
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-foot">
                <div className="sidebar-divider" />
                <div className="user-block">
                    <div className="avatar">{initial}</div>
                    <div className="user-meta">
                        <span className="user-name">{displayName}</span>
                        <span className="user-role">Administrator</span>
                    </div>
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Log out</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="dash-root">
            <div className="bg-fx">
                <div className="bg-grid" />
                <div className="bg-glow-a" />
                <div className="bg-glow-b" />
            </div>

            {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

            <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
                {sidebarContent}
            </aside>

            <main className="main">
                <div className="mobile-topbar">
                    <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                        <Menu size={18} />
                    </button>
                    <div className="mobile-brand">
                        <Shield size={16} />
                        <span>Sentinel AI</span>
                    </div>
                </div>

                {error && (
                    <div style={{
                        padding: "14px 18px",
                        borderRadius: "12px",
                        background: "rgba(240,85,75,0.1)",
                        border: "1px solid rgba(240,85,75,0.3)",
                        color: "#F0554B",
                        fontSize: "13.5px",
                    }}>
                        {error}
                    </div>
                )}

                <DashboardHero />
                <ScoreOverview dashboard={dashboard} />
                <StatsGrid dashboard={dashboard} />
                <ActivityChart />
                <RecentScans scans={recentScans} />
                <div className="two-col">
                    <AIInsights data={insights} />
                    <SystemHealth health={systemHealth} />
                </div>
                <QuickActions />
            </main>
        </div>
    );
}
