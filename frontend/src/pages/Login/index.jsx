// Place this file at: src/pages/Login/index.jsx
import API_BASE from "../../config/api";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA step
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/login`,
        { email, password }
      );

      if (response.data.requires2FA) {
        setTempToken(response.data.tempToken);
        setRequires2FA(true);
        return;
      }

      if (response.data.token) {
        localStorage.setItem("sentinel_token", response.data.token);
        localStorage.setItem("sentinel_user", JSON.stringify(response.data.user));
        navigate("/dashboard");
      } else {
        setError("Login failed. Please try again.");
      }
    }
    catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Login failed. Please try again.");
    }
    finally {
      setLoading(false);
    }
  }

  async function handleVerify2FA() {
    if (!totpCode.trim()) {
      setError("Please enter your 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/2fa/login-verify`,
        { tempToken, token: totpCode }
      );
      localStorage.setItem("sentinel_token", response.data.token);
      localStorage.setItem("sentinel_user", JSON.stringify(response.data.user));
      navigate("/dashboard");
    }
    catch (err) {
      setError(err.response?.data?.error || "Invalid code. Please try again.");
    }
    finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    setRequires2FA(false);
    setTempToken("");
    setTotpCode("");
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#020617",
        color: "white",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: "420px",
          padding: "45px",
          borderRadius: "22px",
          background: "rgba(15,23,42,0.85)",
          border: "1px solid rgba(59,130,246,0.3)",
          backdropFilter: "blur(15px)",
          boxShadow: "0 0 40px rgba(37,99,235,0.2)",
        }}
      >
        {!requires2FA ? (
          <>
            <h1
              style={{
                fontSize: "32px",
                marginBottom: "10px",
              }}
            >
              Sentinel AI Login
            </h1>
            <p
              style={{
                color: "#94A3B8",
                marginBottom: "30px",
              }}
            >
              Secure access to your cyber security platform
            </p>
            {error && (
              <p style={{ color: "#f87171", marginBottom: "15px", fontSize: "14px" }}>
                {error}
              </p>
            )}
            <input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <button
              style={buttonStyle}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
            <p
              style={{
                marginTop: "25px",
                color: "#94A3B8",
                textAlign: "center",
              }}
            >
              Don't have an account?
              <Link
                to="/register"
                style={{
                  color: "#3B82F6",
                  marginLeft: "8px",
                  textDecoration: "none",
                }}
              >
                Register
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1
              style={{
                fontSize: "28px",
                marginBottom: "10px",
              }}
            >
              Two-Factor Verification
            </h1>
            <p
              style={{
                color: "#94A3B8",
                marginBottom: "30px",
              }}
            >
              Enter the 6-digit code from your authenticator app
            </p>
            {error && (
              <p style={{ color: "#f87171", marginBottom: "15px", fontSize: "14px" }}>
                {error}
              </p>
            )}
            <input
              placeholder="6-digit code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            <button
              style={buttonStyle}
              onClick={handleVerify2FA}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <p
              style={{
                marginTop: "20px",
                color: "#94A3B8",
                textAlign: "center",
                cursor: "pointer",
                fontSize: "14px",
              }}
              onClick={backToLogin}
            >
              ← Back to login
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "15px",
  marginBottom: "15px",
  borderRadius: "10px",
  background: "#020617",
  color: "white",
  border: "1px solid #334155",
  outline: "none",
  fontSize: "16px",
};
const buttonStyle = {
  width: "100%",
  padding: "15px",
  marginTop: "10px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontSize: "17px",
  cursor: "pointer",
  boxShadow: "0 0 25px rgba(37,99,235,0.5)",
};
