import React from "react";

/**
 * Icons
 * Tiny inline SVGs (no external icon package dependency).
 * Each is 22x22 on a transparent canvas, single-color stroke so it
 * inherits currentColor and tints correctly on hover.
 */

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconSSL = (props) => (
  <svg {...base} {...props}>
    <rect x="5" y="11" width="14" height="9" rx="1.6" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    <path d="M12 14.5v2" />
  </svg>
);

export const IconHeaders = (props) => (
  <svg {...base} {...props}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h10" />
    <circle cx="18.5" cy="18" r="2" />
  </svg>
);

export const IconPorts = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="8" width="18" height="9" rx="2" />
    <path d="M7 12h.01" />
    <path d="M11 12h.01" />
    <path d="M15 12h.01" />
    <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const IconCVE = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3 3.5 7.5v6C3.5 18 7 21 12 22c5-1 8.5-4 8.5-8.5v-6L12 3Z" />
    <path d="M9.5 12.5 11 14l3.5-4" />
  </svg>
);

export const IconRisk = (props) => (
  <svg {...base} {...props}>
    <path d="M4 19h16" />
    <path d="M7 19v-5" />
    <path d="M12 19V8" />
    <path d="M17 19v-9" />
    <path d="M15 5l2-2 2 2" />
  </svg>
);

export const IconFix = (props) => (
  <svg {...base} {...props}>
    <path d="M14.5 3.5a3 3 0 0 1 4 4L8 18l-4.5 1.5L5 15 14.5 3.5Z" />
    <path d="M13 5l4 4" />
  </svg>
);
