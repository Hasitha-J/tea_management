import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BadgeDollarSign, Loader2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const Dashboard = () => {
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800">{t('dashboard')} Overview</h2>
                <p className="text-gray-500 mt-1">Real-time profitability tracking across all fields.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                    title={t('totalIncome')}
                    amount={summary.total_income}
                    icon={<TrendingUp className="text-emerald-500" size={24} />}
                    bg="bg-emerald-50"
                    border="border-emerald-100"
                />
                <SummaryCard
                    title={t('totalExpense')}
                    amount={summary.total_expense}
                    icon={<TrendingDown className="text-red-500" size={24} />}
                    bg="bg-red-50"
                    border="border-red-100"
                />
                <SummaryCard
                    title={t('netProfit')}
                    amount={summary.total_profit}
                    icon={<BadgeDollarSign className={summary.total_profit >= 0 ? "text-emerald-600" : "text-red-600"} size={24} />}
                    bg={summary.total_profit >= 0 ? "bg-emerald-50" : "bg-red-50"}
                    border={summary.total_profit >= 0 ? "border-emerald-200" : "border-red-200"}
                    highlight
                />
            </div>

            {/* Charts */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Field-wise Profitability</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fields}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="field_name" />
                            <YAxis />
                            <Tooltip
                                formatter={(value) => `Rs. ${value.toLocaleString()}`}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            <Bar dataKey="total_income" name={t('income')} fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total_expense" name={t('expense')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="net_profit" name={t('netProfit')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, amount, icon, bg, border, highlight }) => (
    <div className={`p-6 rounded-xl shadow-sm border ${bg} ${border} transition-transform hover:scale-105 duration-200`}>
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
