HIGH = 25
MEDIUM = 15
LOW = 5


def analyze_header_scan(results):

    score = 100
    recommendations = []

    for item in results:

        if item["present"]:
            continue

        if item["risk"] == "High":
            score -= HIGH

        elif item["risk"] == "Medium":
            score -= MEDIUM

        else:
            score -= LOW

        recommendations.append(
            f"Add {item['header']} header."
        )

    score = max(score, 0)

    if score >= 80:
        overall = "Low"

    elif score >= 60:
        overall = "Medium"

    else:
        overall = "High"

    return {
        "score": score,
        "overall_risk": overall,
        "recommendations": recommendations,
    }
