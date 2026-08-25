// frontend/DownloadReportButton.jsx
// Simple React component: click -> fetch PDF from backend -> trigger browser download

import { useState } from 'react';

export default function DownloadReportButton({ scanId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${scanId}/pdf`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `scan-report-${scanId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleDownload} disabled={loading}>
        {loading ? 'Generating PDF...' : 'Download PDF'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
