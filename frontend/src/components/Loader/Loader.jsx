import React from "react";
import "./Loader.css";

/**
 * Loader
 * Small ring spinner for inline use inside buttons or cards while
 * something is in flight (e.g. "Start free scan" while the request
 * to actually kick off a scan is pending).
 *
 * size: pixel diameter. Defaults to fit inline inside a button.
 */
export default function Loader({ size = 16 }) {
  return (
    <span
      className="loader"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
