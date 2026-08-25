import dns.resolver


RECORD_TYPES = [
    "A",
    "AAAA",
    "MX",
    "NS",
    "TXT",
]


def scan_dns(target: str):
    if target.startswith(("http://", "https://")):
        target = target.replace("http://", "").replace("https://", "")

    target = target.split("/")[0]

    records = {}

    for record_type in RECORD_TYPES:
        try:
            answers = dns.resolver.resolve(target, record_type)
            records[record_type] = [str(answer) for answer in answers]
        except Exception:
            records[record_type] = []

    return {
        "target": target,
        "records": records,
    }
