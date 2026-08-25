import {
  IconSSL,
  IconHeaders,
  IconPorts,
  IconCVE,
  IconRisk,
  IconFix,
} from "./FeatureIcons";

const featuresData = [
  {
    id: "ssl",
    icon: IconSSL,
    title: "SSL & certificate check",
    description:
      "Catches expired certificates, weak ciphers, and misconfigured chains before browsers flag them for your visitors.",
  },
  {
    id: "headers",
    icon: IconHeaders,
    title: "Security header audit",
    description:
      "Verifies CSP, HSTS, and the other response headers that stop clickjacking and injection attempts at the door.",
  },
  {
    id: "ports",
    icon: IconPorts,
    title: "Open port detection",
    description:
      "Maps every reachable port on your server so nothing is exposed to the internet by accident.",
  },
  {
    id: "cve",
    icon: IconCVE,
    title: "Live CVE matching",
    description:
      "Cross-references your stack's exact versions against the CVE database the moment a new exploit is published.",
  },
  {
    id: "risk",
    icon: IconRisk,
    title: "Instant risk score",
    description:
      "Every finding is ranked by real-world exploitability, so you fix the issue that matters first, not the loudest one.",
  },
  {
    id: "fix",
    icon: IconFix,
    title: "AI-written fix guide",
    description:
      "Each result comes with the exact config change or patch command needed, written for the framework you're running.",
  },
];

export default featuresData;
