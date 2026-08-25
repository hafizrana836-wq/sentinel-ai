// routes/report.js
// Example Express route — adjust path/import to match your project structure

const express = require('express');
const router = express.Router();
const { generateScanReportPDF } = require('../services/pdfReport');

// GET or POST — pick whichever fits your app; POST shown here since you likely
// send the current scan's data/id from the frontend.
router.post('/reports/:scanId/pdf', async (req, res) => {
  try {
    // Replace this with your actual scan lookup (DB / in-memory store / etc.)
    const scanReport = await getScanReportById(req.params.scanId);

    if (!scanReport) {
      return res.status(404).json({ error: 'Scan report not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="scan-report-${req.params.scanId}.pdf"`
    );

    await generateScanReportPDF(scanReport, res);
  } catch (err) {
    console.error('PDF generation failed:', err);
    // Don't send JSON here if headers were already sent to the client
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF report' });
    }
  }
});

// Stub — replace with your real data source
async function getScanReportById(scanId) {
  return {
    target: 'https://example.com',
    scanType: 'Full Vulnerability Scan',
    scanDate: new Date().toISOString(),
    duration: '2m 14s',
    summary: { critical: 1, high: 2, medium: 3, low: 4, info: 2 },
    findings: [
      {
        title: 'Outdated TLS version enabled',
        severity: 'high',
        affected: 'example.com:443',
        description: 'The server accepts connections using TLS 1.0, which is deprecated and vulnerable to known attacks.',
        recommendation: 'Disable TLS 1.0/1.1 and enforce TLS 1.2 or higher.',
      },
      {
        title: 'Missing Content-Security-Policy header',
        severity: 'medium',
        affected: '/',
        description: 'No CSP header was found, increasing the risk of XSS attacks going undetected.',
        recommendation: 'Add a strict Content-Security-Policy header appropriate for your app.',
      },
    ],
  };
}

module.exports = router;
