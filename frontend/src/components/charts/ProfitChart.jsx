import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function ProfitChart({ data }) {
  const chartData = {
    labels: data.map(d => d.month),
    datasets: [{
      label: 'Net Profit', data: data.map(d => d.profit), fill: true,
      borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.4, pointBackgroundColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6,
    }],
  };
  const options = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 2,
    plugins: { legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 8, padding: 12 } },
    scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } } },
  };
  return <Line data={chartData} options={options} />;
}
