import requests

SECURITY_HEADERS = {
    "Content-Security-Policy": "High",
    "Strict-Transport-Security": "High",
    "X-Frame-Options": "Medium",
    "X-Content-Type-Options": "Medium",
    "Referrer-Policy": "Low",
    "Permissions-Policy": "Low",
}


def scan_headers(url: str):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        response = requests.get(url, timeout=10)

        results = []

        for header, risk in SECURITY_HEADERS.items():
            results.append(
                {
                    "header": header,
                    "present": header in response.headers,
                    "risk": risk,
                }
            )

        return {
            "target": url,
            "results": results,
        }

    except Exception as e:
        return {
            "target": url,
            "error": str(e),
        }
