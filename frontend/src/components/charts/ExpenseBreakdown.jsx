import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

export default function ExpenseBreakdown({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No expense data available</div>;
  }
  const chartData = {
    labels: data.map(d => d.name),
    datasets: [{
      data: data.map(d => d.value),
      backgroundColor: COLORS.slice(0, data.length),
      borderColor: '#0a0e1a', borderWidth: 3, hoverOffset: 8,
    }],
  };
  const options = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 1.5,
    plugins: {
      legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 8, padding: 12 },
    },
    cutout: '65%',
  };
  return <Doughnut data={chartData} options={options} />;
}
