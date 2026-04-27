import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function CashFlowChart({ data }) {
  const cumulative = [];
  let running = 0;
  data.forEach(d => { running += (d.revenue - d.expenses); cumulative.push(running); });

  const chartData = {
    labels: data.map(d => d.month),
    datasets: [
      { label: 'Inflow (Revenue)', data: data.map(d => d.revenue), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.4, pointRadius: 3 },
      { label: 'Outflow (Expenses)', data: data.map(d => d.expenses), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.08)', fill: true, tension: 0.4, pointRadius: 3 },
      { label: 'Net Cash Flow', data: cumulative, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.08)', fill: true, tension: 0.4, pointRadius: 3, borderDash: [5, 5] },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 3,
    plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 8, padding: 12 } },
    scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } } },
  };
  return <Line data={chartData} options={options} />;
}
