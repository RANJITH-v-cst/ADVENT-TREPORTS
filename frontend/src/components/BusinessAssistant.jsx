import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

export default function BusinessAssistant({ apiBaseUrl, initialData }) {
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [simulation, setSimulation] = useState({ oldProfit: 0, newProfit: 0, difference: 0 });
  const [sliders, setSliders] = useState({ salesChange: 0, purchaseChange: 0 });
  const [nlInput, setNlInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!initialData) {
      fetchAnalysis();
    }
  }, []);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiBaseUrl}/analysis`);
      setData(res.data);
      if (res.data.simulation) {
        setSimulation({
          oldProfit: res.data.simulation.old_profit,
          newProfit: res.data.simulation.new_profit,
          difference: res.data.simulation.difference
        });
      }
    } catch (error) {
      console.error("Error fetching analysis", error);
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async (salesChange, purchaseChange) => {
    try {
      setSimLoading(true);
      const res = await axios.post(`${apiBaseUrl}/simulate`, {
        sales_change_pct: salesChange,
        purchase_change_pct: purchaseChange
      });
      setSimulation({
        oldProfit: res.data.old_profit,
        newProfit: res.data.new_profit,
        difference: res.data.difference
      });
    } catch (error) {
      console.error("Error running simulation", error);
    } finally {
      setSimLoading(false);
    }
  };

  const handleSliderChange = (e, type) => {
    const val = parseFloat(e.target.value);
    const newSliders = { ...sliders, [type]: val };
    setSliders(newSliders);
    runSimulation(newSliders.salesChange, newSliders.purchaseChange);
  };

  const handleNlSubmit = (e) => {
    e.preventDefault();
    // Basic NLP parsing for demo purposes
    const salesMatch = nlInput.match(/sales.*?([\+\-]?\d+)\s*%/i) || nlInput.match(/increase.*?sales.*?(\d+)\s*%/i) || nlInput.match(/reduce.*?sales.*?(\d+)\s*%/i);
    const purchaseMatch = nlInput.match(/purchase.*?([\+\-]?\d+)\s*%/i) || nlInput.match(/increase.*?purchase.*?(\d+)\s*%/i) || nlInput.match(/reduce.*?purchase.*?(\d+)\s*%/i);
    
    let sc = sliders.salesChange;
    let pc = sliders.purchaseChange;
    
    if (salesMatch) {
      let val = parseFloat(salesMatch[1]);
      if (nlInput.toLowerCase().includes('reduce sales') || nlInput.toLowerCase().includes('decrease sales')) val = -val;
      sc = val;
    }
    if (purchaseMatch) {
      let val = parseFloat(purchaseMatch[1]);
      if (nlInput.toLowerCase().includes('reduce purchase') || nlInput.toLowerCase().includes('decrease purchase')) val = -val;
      pc = val;
    }

    setSliders({ salesChange: sc, purchaseChange: pc });
    runSimulation(sc, pc);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!data) return <div className="p-4 text-center text-gray-500">No data available.</div>;

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Business Assistant
            </h1>
            <p className="text-slate-500 text-sm mt-1">Smart insights, predictions, and simulations</p>
          </div>
          <div className="flex items-center space-x-3">
             <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-600">Models Active</span>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-indigo-100 text-sm font-medium mb-1">Total Sales</p>
              <h2 className="text-3xl font-bold">₹{(data.sales_analysis?.daily_average * 30 || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
              <p className="text-sm mt-2 flex items-center gap-1">
                <span className={data.sales_analysis?.monthly_growth_pct >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {data.sales_analysis?.monthly_growth_pct >= 0 ? '↑' : '↓'} {Math.abs(data.sales_analysis?.monthly_growth_pct || 0)}%
                </span>
                <span className="text-indigo-200">vs last month</span>
              </p>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-20">
              <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Estimated Profit</p>
              <h2 className="text-3xl font-bold text-slate-800">₹{simulation.oldProfit?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}</h2>
            </div>
            <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Productivity Score</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold text-slate-800">{data.productivity?.productivity_score || 0}</h2>
                <span className="text-sm font-medium text-slate-400">/ 100</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">{data.productivity?.insight || 'No insight'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Sales Trend */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Trend & Forecast (ML)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.chart_data || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{r: 6}} name="Actual Sales" />
                    <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={false} name="Forecast" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* What-If Simulation */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-1">What-If Simulation</h3>
              <p className="text-sm text-slate-500 mb-6">Adjust parameters to see projected impact on profit.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Sales Volume</label>
                    <span className="text-sm font-bold text-indigo-600">{sliders.salesChange > 0 ? '+' : ''}{sliders.salesChange}%</span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" value={sliders.salesChange} 
                    onChange={(e) => handleSliderChange(e, 'salesChange')}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Purchase Costs</label>
                    <span className="text-sm font-bold text-rose-500">{sliders.purchaseChange > 0 ? '+' : ''}{sliders.purchaseChange}%</span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" value={sliders.purchaseChange} 
                    onChange={(e) => handleSliderChange(e, 'purchaseChange')}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-600 font-medium">Projected Profit</span>
                  {simLoading && <span className="text-xs text-slate-400">Recalculating...</span>}
                </div>
                <div className="flex items-end gap-4">
                  <h3 className="text-3xl font-bold text-slate-800">₹{simulation.newProfit?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}</h3>
                  <div className={`flex items-center gap-1 mb-1 font-medium ${simulation.difference >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {simulation.difference >= 0 ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    )}
                    <span>₹{Math.abs(simulation.difference || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>

              {/* Natural Language Input */}
              <div className="mt-6">
                <form onSubmit={handleNlSubmit} className="relative">
                  <input
                    type="text"
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    placeholder="e.g. 'Increase sales by 5% and reduce purchase by 3%'"
                    className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button type="submit" className="absolute right-2 top-1.5 bottom-1.5 px-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
                </form>
              </div>

            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Predictions */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">ML Predictions</h3>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Weekly Projection</p>
                  <p className="text-xl font-bold text-slate-800">₹{data.prediction?.weekly?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">Monthly Projection</p>
                  <p className="text-xl font-bold text-slate-800">₹{data.prediction?.monthly?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Yearly Projection</p>
                  <p className="text-xl font-bold text-slate-800">₹{data.prediction?.yearly?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}</p>
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">AI Suggestions</h3>
              <ul className="space-y-3">
                {data.suggestions?.length > 0 ? data.suggestions.map((sug, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{sug}</span>
                  </li>
                )) : (
                  <li className="text-sm text-slate-500">No suggestions at this time.</li>
                )}
              </ul>
            </div>

            {/* Supplier Ratings */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Top Suppliers</h3>
              <div className="space-y-3">
                {data.supplier_ranking?.slice(0, 5).map((sup, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <span className="text-sm font-medium text-slate-700">{sup.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">{sup.rating?.toFixed(1)}</span>
                      <span className={`h-2 w-2 rounded-full ${sup.rating >= 7 ? 'bg-emerald-500' : sup.rating >= 4 ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                    </div>
                  </div>
                ))}
                {(!data.supplier_ranking || data.supplier_ranking.length === 0) && (
                  <div className="text-sm text-slate-500">No supplier data available.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
