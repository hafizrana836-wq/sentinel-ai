def calculate_security_score(scan_result: dict):

    score = 100
    recommendations = []


    # Port Analysis
    ports = scan_result["port_scan"]["open_ports"]

    dangerous_ports = [
        21,
        23,
        445,
        3389,
    ]

    for port in ports:

        if port in dangerous_ports:
            score -= 15

            recommendations.append(
                f"Secure or close port {port}"
            )


    # Header Analysis
    headers = scan_result["header_scan"]["results"]

    for header in headers:

        if not header["present"]:

            if header["risk"] == "High":
                score -= 10

            elif header["risk"] == "Medium":
                score -= 5

            else:
                score -= 2


            recommendations.append(
                f"Enable {header['header']} header"
            )


    # SSL Analysis
    ssl = scan_result["ssl_scan"]

    if ssl.get("risk") == "High":

        score -= 20

    elif ssl.get("risk") == "Medium":

        score -= 10


    score = max(score, 0)


    if score >= 80:

        risk = "Low"

    elif score >= 50:

        risk = "Medium"

    else:

        risk = "High"


    return {
        "security_score": score,
        "overall_risk": risk,
        "recommendations": recommendations,
    }
