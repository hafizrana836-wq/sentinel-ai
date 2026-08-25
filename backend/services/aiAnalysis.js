function generateAIAnalysis(report) {
    const positives = [];
    const recommendations = [];
    const issues = [];

    let risk = "Low";
    if (report.securityScore < 50) {
        risk = "Critical";
    } else if (report.securityScore < 70) {
        risk = "High";
    } else if (report.securityScore < 90) {
        risk = "Medium";
    }

    if (report.ssl?.valid) {
        positives.push("the website uses a valid SSL/TLS certificate");
    } else {
        issues.push("the SSL/TLS certificate is invalid or missing");
    }

    if (report.robots?.exists) {
        positives.push("robots.txt is available");
    } else {
        recommendations.push("create a robots.txt file");
    }

    if (report.sitemap?.exists) {
        positives.push("a sitemap is available");
    } else {
        recommendations.push("publish a sitemap.xml file");
    }

    if (report.securityTxt?.exists) {
        positives.push("security.txt is available");
    } else {
        recommendations.push("publish a security.txt file");
    }

    if (report.directory?.totalFound > 0) {
        issues.push(report.directory.totalFound + " potentially sensitive directories were detected");
    }

    if (report.securityScore >= 90) {
        positives.push("the overall security score is excellent");
    } else if (report.securityScore >= 70) {
        positives.push("the overall security posture is good");
    } else {
        issues.push("the overall security score is below the recommended level");
    }

    // riskEngine.js only ever pushes a finding when a rule actually fires —
    // every entry here IS a problem already, there's no separate "status"
    // flag to check (that was headers.js's old shape, not this one's).
    (report.findings || []).forEach((f) => {
        issues.push(f.title || f.label || f.description);
    });

    let summary = "Overall Assessment: ";
    if (positives.length > 0) {
        summary += positives.join(", ") + ". ";
    }
    summary += "Risk Level: " + risk + ". ";
    if (issues.length > 0) {
        summary += "Key Weaknesses: " + issues.join(", ") + ". ";
    } else {
        summary += "No significant security weaknesses were detected. ";
    }
    if (recommendations.length > 0) {
        summary += "Priority Recommendations: " + recommendations.join(", ") + ". ";
    }
    summary += "Final Verdict: ";
    if (risk === "Critical") {
        summary += "Immediate remediation is strongly recommended.";
    } else if (risk === "High") {
        summary += "The website should address the identified issues as soon as possible.";
    } else if (risk === "Medium") {
        summary += "The website has a reasonable security posture but there is room for improvement.";
    } else {
        summary += "The website demonstrates a strong overall security posture.";
    }

    return summary;
}

module.exports = generateAIAnalysis;
