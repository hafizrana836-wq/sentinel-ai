import socket
import ssl
from datetime import datetime


def scan_ssl(host: str):
    if host.startswith("http://"):
        host = host.replace("http://", "")

    if host.startswith("https://"):
        host = host.replace("https://", "")

    host = host.split("/")[0]

    context = ssl.create_default_context()

    try:
        with socket.create_connection((host, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:

                cert = ssock.getpeercert()

                issuer = dict(x[0] for x in cert["issuer"])

                subject = dict(x[0] for x in cert["subject"])

                expires = cert["notAfter"]

                expire_date = datetime.strptime(
                    expires,
                    "%b %d %H:%M:%S %Y %Z",
                )

                days_remaining = (
                    expire_date - datetime.utcnow()
                ).days

                if days_remaining > 60:
                    risk = "Low"
                elif days_remaining > 30:
                    risk = "Medium"
                else:
                    risk = "High"

                return {
                    "target": host,
                    "issuer": issuer.get("organizationName"),
                    "subject": subject.get("commonName"),
                    "expires": expire_date.strftime("%Y-%m-%d"),
                    "days_remaining": days_remaining,
                    "tls_version": ssock.version(),
                    "risk": risk,
                }

    except Exception as e:

        return {
            "target": host,
            "error": str(e),
        }
