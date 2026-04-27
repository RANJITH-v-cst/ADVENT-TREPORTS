import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function RevenueExpenseChart({ data }) {
  const chartData = {
    labels: data.map(d => d.month),
    datasets: [
      { label: 'Revenue', data: data.map(d => d.revenue), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderRadius: 6, borderSkipped: false },
      { label: 'Expenses', data: data.map(d => d.expenses), backgroundColor: 'rgba(244, 63, 94, 0.7)', borderRadius: 6, borderSkipped: false },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 2,
    plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 8, padding: 12 } },
    scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } } },
  };
  return <Bar data={chartData} options={options} />;
}
