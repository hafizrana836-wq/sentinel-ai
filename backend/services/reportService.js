// Place this file at: services/reportService.js
const PDFDocument = require("pdfkit");

/**
 * Streams a PDF report for a scan directly into the given writable stream
 * (e.g. an Express `res` object). Returns the PDFDocument in case the
 * caller wants to listen for "end".
 */
function generateScanReportPDF(scan, outputStream) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(outputStream);

  doc.fontSize(20).fillColor("#0A0E17").text("Sentinel AI — Security Scan Report", { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#555").text(`Target: ${scan.target}`);
  doc.text(`Scanned: ${new Date(scan.createdAt).toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(14).fillColor("#000").text(`Security Score: ${scan.securityScore} (${scan.grade})`);
  doc.fontSize(14).text(`Risk Score: ${scan.riskScore}`);
  doc.moveDown();

  doc.fontSize(14).fillColor("#000").text("Findings", { underline: true });
  doc.moveDown(0.3);
  if (!scan.findings?.length) {
    doc.fontSize(11).fillColor("#333").text("No issues detected.");
  } else {
    for (const f of scan.findings) {
      doc.fontSize(11).fillColor("#333").text(`• [${f.severity.toUpperCase()}] ${f.label}  (+${f.weight})`);
    }
  }
  doc.moveDown();

  doc.fontSize(14).fillColor("#000").text("Recommendations", { underline: true });
  doc.moveDown(0.3);
  if (!scan.recommendations?.length) {
    doc.fontSize(11).fillColor("#333").text("No action needed.");
  } else {
    for (const r of scan.recommendations) {
      doc.fontSize(11).fillColor("#333").text(`• (${r.priority}) ${r.message}`);
    }
  }

  doc.end();
  return doc;
}

module.exports = { generateScanReportPDF };
