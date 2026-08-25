import { useState } from "react";
import API_BASE from "../../config/api";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/register`,
        { username, email, password }
      );

      if (response.data.success) {
        localStorage.setItem("sentinel_token", response.data.token);
        localStorage.setItem("sentinel_user", JSON.stringify(response.data.user));
        navigate("/dashboard");
      }
    }
    catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    }
    finally {
      setLoading(false);
    }
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
        <h1
          style={{
            fontSize: "32px",
            marginBottom: "10px",
          }}
        >
          Create Sentinel AI Account
        </h1>
        <p
          style={{
            color:"#94A3B8",
            marginBottom:"30px",
          }}
        >
          Join the AI powered cyber security platform
        </p>

        {error && (
          <p style={{ color: "#f87171", marginBottom: "15px", fontSize: "14px" }}>
            {error}
          </p>
        )}

        <input
          placeholder="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />
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
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
        <p
          style={{
            marginTop:"25px",
            color:"#94A3B8",
            textAlign:"center",
          }}
        >
          Already have an account?
          <Link
            to="/login"
            style={{
              color:"#3B82F6",
              marginLeft:"8px",
              textDecoration:"none",
            }}
          >
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
const inputStyle = {
  width:"100%",
  padding:"15px",
  marginBottom:"15px",
  borderRadius:"10px",
  background:"#020617",
  color:"white",
  border:"1px solid #334155",
  outline:"none",
  fontSize:"16px",
};
const buttonStyle = {
  width:"100%",
  padding:"15px",
  marginTop:"10px",
  borderRadius:"10px",
  border:"none",
  background:"#2563EB",
  color:"white",
  fontSize:"17px",
  cursor:"pointer",
  boxShadow:"0 0 25px rgba(37,99,235,0.5)",
};
