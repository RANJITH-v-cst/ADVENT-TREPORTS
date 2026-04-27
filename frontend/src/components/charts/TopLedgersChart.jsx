import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function TopLedgersChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No ledger data available</div>;
  }
  const sorted = [...data].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 8);
  const chartData = {
    labels: sorted.map(d => d.name.length > 20 ? d.name.slice(0, 20) + '…' : d.name),
    datasets: [{
      label: 'Amount', data: sorted.map(d => Math.abs(d.amount)),
      backgroundColor: sorted.map(d => d.amount >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(244,63,94,0.7)'),
      borderRadius: 6, borderSkipped: false,
    }],
  };
  const options = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: true, aspectRatio: 1.5,
    plugins: { legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 8, padding: 12 } },
    scales: { x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
      y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } },
  };
  return <Bar data={chartData} options={options} />;
}
