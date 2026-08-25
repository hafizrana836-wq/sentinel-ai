import Settings from "./pages/Settings";
import Remediation from "./pages/Remediation";
import Reports from "./pages/Reports";
import Features from "./components/Features";
import ScanDemo from "./components/ScanDemo";
import PageBackground from "./components/PageBackground";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./components/Dashboard";
import Scanner from "./pages/Scanner";
import History from "./pages/History";
import Schedule from "./pages/Schedule";
import ApiAccess from "./pages/ApiAccess";
import ProtectedRoute from "./components/ProtectedRoute";

function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
      }}
    >
      <Navbar />
      <Hero />
      <Features />
      <ScanDemo />
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <>
      <PageBackground />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/remediation/:scanId/:code"
          element={
            <ProtectedRoute>
              <Remediation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />

<Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />     

   <Route
          path="/scanner"
          element={
            <ProtectedRoute>
              <Scanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Schedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/api-access"
          element={
            <ProtectedRoute>
              <ApiAccess />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
