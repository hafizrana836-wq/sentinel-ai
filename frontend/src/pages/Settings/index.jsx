// Place this file at: src/pages/Settings/index.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    User,
    Shield,
    Bell,
    Radar,
    Key,
    AlertTriangle,
    Monitor,
    Trash2,
    Save,
} from "lucide-react";
import "./Settings.css";

import API_BASE from "../../config/api";
const TABS = [
    { key: "profile", label: "Profile", icon: User },
    { key: "security", label: "Security", icon: Shield },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "scanning", label: "Scanning", icon: Radar },
    { key: "api", label: "API", icon: Key },
    { key: "danger", label: "Danger Zone", icon: AlertTriangle },
];

const NOTIF_LABELS = {
    criticalFinding: "Critical vulnerability found",
    highRiskScan: "High-risk scan",
    scheduledScanComplete: "Scheduled scan completed",
    weeklySummary: "Weekly security summary",
};

const SCAN_CHECKS = [
    { key: "ssl", label: "SSL/TLS" },
    { key: "headers", label: "Security Headers" },
    { key: "dns", label: "DNS" },
    { key: "ports", label: "Ports" },
    { key: "cves", label: "CVE" },
    { key: "directory", label: "Directory Discovery" },
];

// Small shimmer placeholder used everywhere a value hasn't loaded yet.
// The label/layout around it renders immediately — only this swaps in/out.
function Skel({ w = "100%", h = 14, style = {} }) {
    return <span className="set-skel" style={{ width: w, height: h, ...style }} />;
}

export default function Settings() {
    const navigate = useNavigate();
    const [tab, setTab] = useState("profile");

    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true);

    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // 2FA state
    const [twoFAStep, setTwoFAStep] = useState("idle"); // idle | verify
    const [qrCode, setQrCode] = useState("");
    const [manualSecret, setManualSecret] = useState("");
    const [totpCode, setTotpCode] = useState("");

    const token = localStorage.getItem("sentinel_token");
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        // Two independent fetches — profile and sessions don't block each other.
        fetchMe();
        fetchSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function flash(msg, isError = false) {
        setError(isError ? msg : "");
        setSuccess(isError ? "" : msg);
        setTimeout(() => { setError(""); setSuccess(""); }, 3000);
    }

    async function fetchMe() {
        try {
            const res = await axios.get(`${API_BASE}/api/auth/me`, { headers });
            setUser(res.data);
        } catch {
            flash("Failed to load your account.", true);
        } finally {
            setUserLoading(false);
        }
    }

    async function fetchSessions() {
        try {
            const res = await axios.get(`${API_BASE}/api/auth/sessions`, { headers });
            setSessions(res.data.sessions || []);
        } catch {
            /* non-critical, leave list empty */
        } finally {
            setSessionsLoading(false);
        }
    }

    async function saveProfile(e) {
        e.preventDefault();
        try {
            const res = await axios.put(`${API_BASE}/api/auth/profile`, {
                name: user.name, company: user.company, timezone: user.timezone,
            }, { headers });
            setUser(res.data);
            flash("Profile updated.");
        } catch (err) {
            flash(err.response?.data?.error || "Failed to update profile.", true);
        }
    }

    async function changePassword(e) {
        e.preventDefault();
        const form = e.target;
        const currentPassword = form.currentPassword.value;
        const newPassword = form.newPassword.value;
        try {
            await axios.put(`${API_BASE}/api/auth/password`, { currentPassword, newPassword }, { headers });
            form.reset();
            flash("Password updated.");
        } catch (err) {
            flash(err.response?.data?.error || "Failed to update password.", true);
        }
    }

    async function revokeSession(id) {
        try {
            await axios.delete(`${API_BASE}/api/auth/sessions/${id}`, { headers });
            setSessions((prev) => prev.filter((s) => s.id !== id));
            flash("Session revoked.");
        } catch {
            flash("Failed to revoke session.", true);
        }
    }

    async function start2FASetup() {
        try {
            const res = await axios.post(`${API_BASE}/api/auth/2fa/setup`, {}, { headers });
            setQrCode(res.data.qrCode);
            setManualSecret(res.data.secret);
            setTwoFAStep("verify");
        } catch (err) {
            flash(err.response?.data?.error || "Failed to start 2FA setup.", true);
        }
    }

    async function confirm2FASetup(e) {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/api/auth/2fa/verify`, { token: totpCode }, { headers });
            setUser({ ...user, twoFactorEnabled: true });
            setTwoFAStep("idle");
            setTotpCode("");
            setQrCode("");
            setManualSecret("");
            flash("Two-factor authentication enabled.");
        } catch (err) {
            flash(err.response?.data?.error || "Invalid code.", true);
        }
    }

    async function disable2FA() {
        if (!window.confirm("Turn off two-factor authentication?")) return;
        try {
            await axios.post(`${API_BASE}/api/auth/2fa/disable`, {}, { headers });
            setUser({ ...user, twoFactorEnabled: false });
            flash("Two-factor authentication disabled.");
        } catch {
            flash("Failed to disable 2FA.", true);
        }
    }

    async function saveNotifications(prefs) {
        try {
            const res = await axios.put(`${API_BASE}/api/auth/notifications`, prefs, { headers });
            setUser(res.data);
            flash("Notification preferences saved.");
        } catch {
            flash("Failed to save preferences.", true);
        }
    }

    async function saveScanProfile(profile) {
        try {
            const res = await axios.put(`${API_BASE}/api/auth/scan-profile`, profile, { headers });
            setUser(res.data);
            flash("Scan defaults saved.");
        } catch {
            flash("Failed to save scan defaults.", true);
        }
    }

    async function deleteAccount() {
        if (!window.confirm("This permanently deletes your account and all scan history. This cannot be undone. Continue?")) return;
        try {
            await axios.delete(`${API_BASE}/api/auth/account`, { headers });
            localStorage.removeItem("sentinel_token");
            localStorage.removeItem("sentinel_user");
            navigate("/");
        } catch {
            flash("Failed to delete account.", true);
        }
    }

    return (
        <div className="set-page">
            <div className="set-box">
                <div className="set-top">
                    <h1><Shield size={22} /> Settings</h1>
                    <p className="set-subtitle">
                        {userLoading ? <Skel w="180px" h={13} /> : user?.createdAt ? `Member since ${new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}` : "Manage your account and preferences"}
                    </p>
                </div>

                {error && <div className="set-flash set-flash-error">{error}</div>}
                {success && <div className="set-flash set-flash-ok">{success}</div>}

                <div className="set-layout">
                    <nav className="set-tabs">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                className={`set-tab ${tab === t.key ? "active" : ""}`}
                                onClick={() => setTab(t.key)}
                            >
                                <t.icon size={15} /> {t.label}
                            </button>
                        ))}
                    </nav>

                    <div className="set-panel">
                        {tab === "profile" && (
                            <form onSubmit={saveProfile} className="set-form">
                                <h2>Profile</h2>
                                <div className="set-form-grid">
                                    <label>Name
                                        {userLoading ? <Skel w="200px" /> : (
                                            <input value={user.name || ""} onChange={(e) => setUser({ ...user, name: e.target.value })} required />
                                        )}
                                    </label>
                                    <label>Email
                                        {userLoading ? <Skel w="220px" /> : (
                                            <input value={user.email || ""} disabled title="Email can't be changed yet" />
                                        )}
                                    </label>
                                    <label>Company
                                        {userLoading ? <Skel w="180px" /> : (
                                            <input value={user.company || ""} onChange={(e) => setUser({ ...user, company: e.target.value })} />
                                        )}
                                    </label>
                                    <label>Timezone
                                        {userLoading ? <Skel w="160px" /> : (
                                            <input value={user.timezone || "UTC"} onChange={(e) => setUser({ ...user, timezone: e.target.value })} placeholder="e.g. Asia/Karachi" />
                                        )}
                                    </label>
                                </div>
                                <button type="submit" className="set-save-btn" disabled={userLoading}>
                                    <Save size={14} /> Save Changes
                                </button>
                            </form>
                        )}

                        {tab === "security" && (
                            <div className="set-form">
                                <h2>Security</h2>

                                <div className="set-card">
                                    <form onSubmit={changePassword} className="set-subform">
                                        <h3>Change Password</h3>
                                        <label>Current Password
                                            <input type="password" name="currentPassword" required />
                                        </label>
                                        <label>New Password
                                            <input type="password" name="newPassword" minLength={8} required />
                                        </label>
                                        <button type="submit" className="set-save-btn"><Save size={14} /> Update Password</button>
                                    </form>
                                </div>

                                <div className="set-card">
                                    <h3><Monitor size={14} /> Active Sessions</h3>
                                    {sessionsLoading ? (
                                        <div className="set-sessions">
                                            <div className="set-session-row"><Skel w="70%" /></div>
                                            <div className="set-session-row"><Skel w="70%" /></div>
                                        </div>
                                    ) : sessions.length === 0 ? (
                                        <p className="set-empty">No other active sessions.</p>
                                    ) : (
                                        <div className="set-sessions">
                                            {sessions.map((s) => (
                                                <div className="set-session-row" key={s.id}>
                                                    <div>
                                                        <p className="set-session-agent">
                                                            <Monitor size={13} /> {s.userAgent || "Unknown device"}
                                                        </p>
                                                        <p className="set-session-meta">
                                                            {s.ip || "Unknown IP"} · Last active {new Date(s.lastActiveAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => revokeSession(s.id)}>Revoke</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="set-card">
                                    <h3><Shield size={14} /> Two-Factor Authentication</h3>
                                    {userLoading ? (
                                        <div className="set-2fa-status">
                                            <Skel w="90%" h={12} />
                                            <Skel w="120px" h={32} style={{ marginTop: 10, borderRadius: 10 }} />
                                        </div>
                                    ) : user.twoFactorEnabled ? (
                                        <div className="set-2fa-status">
                                            <span className="set-badge set-badge-on">Enabled</span>
                                            <p className="set-note">Two-factor authentication is protecting your account.</p>
                                            <button className="set-danger-btn" onClick={disable2FA}>Disable 2FA</button>
                                        </div>
                                    ) : twoFAStep === "idle" ? (
                                        <div className="set-2fa-status">
                                            <span className="set-badge set-badge-off">Disabled</span>
                                            <p className="set-note">Add an extra layer of security by requiring a code from an authenticator app at login.</p>
                                            <button className="set-save-btn" onClick={start2FASetup}>Enable 2FA</button>
                                        </div>
                                    ) : (
                                        <form onSubmit={confirm2FASetup} className="set-subform">
                                            <p className="set-note">Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.</p>
                                            {qrCode && <img src={qrCode} alt="2FA QR code" style={{ width: 180, height: 180, margin: "12px 0", borderRadius: 10 }} />}
                                            <p className="set-note">Can't scan? Enter manually: <code>{manualSecret}</code></p>
                                            <label>Enter the 6-digit code
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    value={totpCode}
                                                    onChange={(e) => setTotpCode(e.target.value)}
                                                    required
                                                />
                                            </label>
                                            <button type="submit" className="set-save-btn"><Save size={14} /> Confirm & Enable</button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}

                        {tab === "notifications" && (
                            userLoading
                                ? <NotificationsSkeleton />
                                : <NotificationsTab prefs={user.notificationPrefs} onSave={saveNotifications} />
                        )}

                        {tab === "scanning" && (
                            userLoading
                                ? <ScanningSkeleton />
                                : <ScanningTab profile={user.scanProfile} onSave={saveScanProfile} />
                        )}

                        {tab === "api" && (
                            <div className="set-form">
                                <h2>API Access</h2>
                                <p className="set-note">
                                    API key generation, usage stats, and docs live on their own page.
                                </p>
                                <button className="set-save-btn" onClick={() => navigate("/api-access")}>
                                    <Key size={14} /> Go to API Access
                                </button>
                            </div>
                        )}

                        {tab === "danger" && (
                            <div className="set-form">
                                <h2>Danger Zone</h2>
                                <div className="set-danger-row">
                                    <div>
                                        <p className="set-danger-title">Delete Account</p>
                                        <p className="set-danger-desc">Permanently deletes your account, all scan history, and all API keys.</p>
                                    </div>
                                    <button className="set-danger-btn" onClick={deleteAccount} disabled={userLoading}>
                                        <Trash2 size={14} /> Delete Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NotificationsTab({ prefs, onSave }) {
    const [local, setLocal] = useState(prefs || {});
    return (
        <div className="set-form">
            <h2>Notifications</h2>
            <div className="set-card">
                {Object.keys(NOTIF_LABELS).map((key) => (
                    <label className="set-toggle-row" key={key}>
                        <span>{NOTIF_LABELS[key]}</span>
                        <input
                            type="checkbox"
                            checked={!!local[key]}
                            onChange={(e) => setLocal({ ...local, [key]: e.target.checked })}
                        />
                    </label>
                ))}
            </div>
            <button className="set-save-btn" onClick={() => onSave(local)}><Save size={14} /> Save Preferences</button>
        </div>
    );
}

function NotificationsSkeleton() {
    return (
        <div className="set-form">
            <h2>Notifications</h2>
            {Object.keys(NOTIF_LABELS).map((key) => (
                <div className="set-toggle-row" key={key}>
                    <span>{NOTIF_LABELS[key]}</span>
                    <Skel w="36px" h={20} style={{ borderRadius: 10 }} />
                </div>
            ))}
        </div>
    );
}

function ScanningTab({ profile, onSave }) {
    const [local, setLocal] = useState(profile || {});
    const checks = local.checks || [];

    function toggleCheck(key) {
        setLocal({
            ...local,
            checks: checks.includes(key) ? checks.filter((c) => c !== key) : [...checks, key],
        });
    }

    return (
        <div className="set-form">
            <h2>Scanning Defaults</h2>

            <p className="set-note" style={{ marginBottom: 16 }}>
                These save to your account, but the scanner currently always runs its full fixed
                pipeline — it doesn't yet read this profile to skip steps. Real to store, not yet
                wired into scan behavior.
            </p>

            <h3>Default Scan Profile</h3>
            {["quick", "standard", "deep"].map((p) => (
                <label className="set-radio-row" key={p}>
                    <input
                        type="radio"
                        name="profile"
                        checked={local.profile === p}
                        onChange={() => setLocal({ ...local, profile: p })}
                    />
                    <span style={{ textTransform: "capitalize" }}>{p}</span>
                </label>
            ))}

            <h3 className="set-subheading">Checks</h3>
            {SCAN_CHECKS.map((c) => (
                <label className="set-toggle-row" key={c.key}>
                    <span>{c.label}</span>
                    <input type="checkbox" checked={checks.includes(c.key)} onChange={() => toggleCheck(c.key)} />
                </label>
            ))}

            <h3 className="set-subheading">Follow Redirects</h3>
            <label className="set-toggle-row">
                <span>Follow HTTP redirects during scans</span>
                <input
                    type="checkbox"
                    checked={local.followRedirects !== false}
                    onChange={(e) => setLocal({ ...local, followRedirects: e.target.checked })}
                />
            </label>

            <h3 className="set-subheading">Save Scan History</h3>
            <label className="set-toggle-row">
                <span>Keep completed scans in History</span>
                <input
                    type="checkbox"
                    checked={local.saveHistory !== false}
                    onChange={(e) => setLocal({ ...local, saveHistory: e.target.checked })}
                />
            </label>

            <button className="set-save-btn" onClick={() => onSave(local)}><Save size={14} /> Save Defaults</button>
        </div>
    );
}

function ScanningSkeleton() {
    return (
        <div className="set-form">
            <h2>Scanning Defaults</h2>
            <h3>Default Scan Profile</h3>
            {["quick", "standard", "deep"].map((p) => (
                <div className="set-radio-row" key={p}>
                    <Skel w="16px" h={16} style={{ borderRadius: "50%" }} />
                    <span style={{ textTransform: "capitalize" }}>{p}</span>
                </div>
            ))}
            <h3 className="set-subheading">Checks</h3>
            {SCAN_CHECKS.map((c) => (
                <div className="set-toggle-row" key={c.key}>
                    <span>{c.label}</span>
                    <Skel w="36px" h={20} style={{ borderRadius: 10 }} />
                </div>
            ))}
        </div>
    );
}
