import { Link, useNavigate } from "react-router-dom";
import { FaShieldAlt } from "react-icons/fa";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sentinel_token");
  const userRaw = localStorage.getItem("sentinel_user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  function handleLogout() {
    localStorage.removeItem("sentinel_token");
    localStorage.removeItem("sentinel_user");
    navigate("/");
    window.location.reload();
  }

  return (
    <nav
      style={{
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center",
        padding:"25px 60px",
        borderBottom:"1px solid rgba(255,255,255,.08)",
        background:"#020617",
      }}
    >
      <Link
        to="/"
        style={{
          color:"white",
          textDecoration:"none",
          display:"flex",
          alignItems:"center",
          gap:"12px",
        }}
      >
        <FaShieldAlt
          size={32}
          color="#3B82F6"
        />
        <div>
          <h2 style={{margin:0}}>
            Sentinel AI
          </h2>
          <small style={{color:"#64748B"}}>
            AI SECURITY PLATFORM
          </small>
        </div>
      </Link>
      <div
        style={{
          display:"flex",
          alignItems:"center",
          gap:"25px",
        }}
      >
        {token ? (
          <>
            <Link to="/dashboard" style={linkStyle}>
              Dashboard
            </Link>
            <Link to="/scanner" style={linkStyle}>
              Scanner
            </Link>
            <Link to="/history" style={linkStyle}>
              History
            </Link>
            <Link to="/schedule" style={linkStyle}>
              Schedule
            </Link>
            <Link to="/api-access" style={linkStyle}>
              API Access
            </Link>
            <span style={{ color: "#94A3B8", fontSize: "14px" }}>
              {user?.username || "User"}
            </span>
            <button
              onClick={handleLogout}
              style={{
                ...linkStyle,
                background:"transparent",
                border:"1px solid #EF4444",
                color:"#EF4444",
                padding:"8px 18px",
                borderRadius:"10px",
                cursor:"pointer",
                fontSize:"14px",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={linkStyle}>
              Login
            </Link>
            <Link
              to="/register"
              style={{
                ...linkStyle,
                background:"#2563EB",
                padding:"10px 20px",
                borderRadius:"10px",
              }}
            >
              Create Account
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
const linkStyle = {
  color:"white",
  textDecoration:"none",
};
