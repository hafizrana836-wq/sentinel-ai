/**
 * scanSteps
 * Ordered timeline the terminal walks through on every loop. Each
 * entry's `delay` is how long (ms) to wait after the previous entry
 * appears before this one appears. `kind` controls how ScanTerminal
 * renders it (status line, checklist item, port result, CVE hit,
 * progress bar, or the final risk score).
 */
const scanSteps = [
  { id: "init", kind: "status", text: "Initializing...", delay: 250 },
  { id: "progress-1", kind: "progress", value: 43, delay: 500 },
  { id: "dns", kind: "check", text: "DNS", delay: 450 },
  { id: "ssl", kind: "check", text: "SSL", delay: 400 },
  { id: "headers", kind: "check", text: "Headers", delay: 400 },
  { id: "port-label", kind: "status", text: "Scanning ports...", delay: 550 },
  { id: "port-80", kind: "port", text: "80", detail: "OPEN", state: "open", delay: 450 },
  { id: "port-443", kind: "port", text: "443", detail: "OPEN", state: "open", delay: 380 },
  { id: "port-22", kind: "port", text: "22", detail: "FILTERED", state: "filtered", delay: 380 },
  { id: "cve-label", kind: "status", text: "Searching CVEs...", delay: 550 },
  { id: "cve-found", kind: "cve", text: "CVE-2026-41207", detail: "Found", delay: 750 },
  { id: "report-label", kind: "status", text: "Generating AI report...", delay: 550 },
  { id: "progress-2", kind: "progress", value: 100, delay: 750 },
  { id: "score", kind: "score", value: 82, delay: 450 },
];

export default scanSteps;
