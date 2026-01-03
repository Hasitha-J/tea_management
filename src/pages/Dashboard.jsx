import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BadgeDollarSign, Loader2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const Dashboard = () => {
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedFieldId, setSelectedFieldId] = useState('all');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [harvestsRes, transactionsRes, fieldsRes] = await Promise.all([
                supabase.from('harvests').select('field_id, total_amount'),
                supabase.from('transactions').select('field_id, total_amount'),
                supabase.from('fields').select('*')
            ]);

            if (harvestsRes.error) throw harvestsRes.error;
            if (transactionsRes.error) throw transactionsRes.error;
            if (fieldsRes.error) throw fieldsRes.error;

            const fields = fieldsRes.data;
            const harvests = harvestsRes.data;
            const transactions = transactionsRes.data;

            const dashboardData = fields.map(field => {
                const fieldIncome = harvests
                    .filter(h => h.field_id === field.id)
                    .reduce((sum, h) => sum + (h.total_amount || 0), 0);

                const fieldExpense = transactions
                    .filter(t => t.field_id === field.id)
                    .reduce((sum, t) => sum + (t.total_amount || 0), 0);

                return {
                    field_id: field.id,
                    field_name: field.name,
                    total_income: fieldIncome,
                    total_expense: fieldExpense,
                    net_profit: fieldIncome - fieldExpense
                };
            });

            const totalIncome = dashboardData.reduce((acc, curr) => acc + curr.total_income, 0);
            const totalExpense = dashboardData.reduce((acc, curr) => acc + curr.total_expense, 0);
            const totalProfit = totalIncome - totalExpense;

            setData({
                fields: dashboardData,
                summary: {
                    total_income: totalIncome,
                    total_expense: totalExpense,
                    total_profit: totalProfit
                }
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-600" size={48} />
            </div>
        );
    }

    if (!data) return <div className="text-red-500">Failed to load data.</div>;

    const { summary, fields } = data;

    const filteredFields = selectedFieldId === 'all'
        ? fields
        : fields.filter(f => f.field_id === parseInt(selectedFieldId));

    const displaySummary = selectedFieldId === 'all'
        ? summary
        : {
            total_income: filteredFields[0]?.total_income || 0,
            total_expense: filteredFields[0]?.total_expense || 0,
            total_profit: filteredFields[0]?.net_profit || 0
        };

    return (
        <div className="space-y-6 md:space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{t('dashboard')}</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1">Real-time profitability tracking.</p>
                </div>

                <div className="w-full md:w-64">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Field</label>
                    <select
                        value={selectedFieldId}
                        onChange={(e) => setSelectedFieldId(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em' }}
                    >
                        <option value="all">All Fields</option>
                        {fields.map(f => (
                            <option key={f.field_id} value={f.field_id}>{f.field_name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                    title={t('totalIncome')}
                    amount={displaySummary.total_income}
                    icon={<TrendingUp className="text-emerald-500" size={24} />}
                    bg="bg-emerald-50"
                    border="border-emerald-100"
                />
                <SummaryCard
                    title={t('totalExpense')}
                    amount={displaySummary.total_expense}
                    icon={<TrendingDown className="text-red-500" size={24} />}
                    bg="bg-red-50"
                    border="border-red-100"
                />
                <SummaryCard
                    title={t('netProfit')}
                    amount={displaySummary.total_profit}
                    icon={<BadgeDollarSign className={displaySummary.total_profit >= 0 ? "text-emerald-600" : "text-red-600"} size={24} />}
                    bg={displaySummary.total_profit >= 0 ? "bg-emerald-50" : "bg-red-50"}
                    border={displaySummary.total_profit >= 0 ? "border-emerald-200" : "border-red-200"}
                    highlight
                />
            </div>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800 font-display">
                        {selectedFieldId === 'all' ? 'Field-wise Profitability' : `${filteredFields[0]?.field_name} Performance`}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <div className="h-80 min-w-[300px] md:min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredFields}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis
                                    dataKey="field_name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                    tickFormatter={(val) => `Rs.${val / 1000}k`}
                                />
                                <Tooltip
                                    formatter={(value) => `Rs. ${value.toLocaleString()}`}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                                <Bar dataKey="total_income" name={t('income')} fill="#10b981" radius={[4, 4, 0, 0]} barSize={selectedFieldId === 'all' ? 20 : 60} />
                                <Bar dataKey="total_expense" name={t('expense')} fill="#ef4444" radius={[4, 4, 0, 0]} barSize={selectedFieldId === 'all' ? 20 : 60} />
                                <Bar dataKey="net_profit" name={t('netProfit')} fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={selectedFieldId === 'all' ? 20 : 60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, amount, icon, bg, border, highlight }) => (
    <div className={`p-4 md:p-6 rounded-xl shadow-sm border ${bg} ${border} transition-transform hover:scale-105 duration-200`}>
        <div className="flex items-start justify-between">
            <div>
                <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">{title}</p>
                <h3 className={`text-2xl font-bold mt-2 ${highlight ? (amount >= 0 ? 'text-emerald-700' : 'text-red-700') : 'text-gray-900'}`}>
                    Rs. {amount.toLocaleString()}
                </h3>
            </div>
            <div className="p-3 bg-white rounded-lg shadow-sm">
                {icon}
            </div>
        </div>
    </div>
);

export default Dashboard;
