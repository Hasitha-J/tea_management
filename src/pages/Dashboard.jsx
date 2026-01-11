import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BadgeDollarSign, Loader2, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

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
            const [fieldsRes, harvestsRes, transactionsRes, ratesRes] = await Promise.all([
                supabase.from('fields').select('*'),
                supabase.from('harvests').select('*'),
                supabase.from('transactions').select('*'),
                supabase.from('collector_rates').select('*')
            ]);

            if (harvestsRes.error) throw harvestsRes.error;
            if (transactionsRes.error) throw transactionsRes.error;
            if (fieldsRes.error) throw fieldsRes.error;
            if (ratesRes.error) throw ratesRes.error;

            const fields = fieldsRes.data;
            const rates = ratesRes.data || [];

            // Process harvests to fill in missing rates for tea
            const harvests = (harvestsRes.data || []).map(h => {
                let amount = h.total_amount || 0;
                if (h.crop_type === 'tea' && (!h.rate || h.rate === 0)) {
                    const hDate = new Date(h.date);
                    const month = hDate.getMonth() + 1;
                    const year = hDate.getFullYear();
                    const monthlyRate = rates.find(r => r.collector_id === h.collector_id && r.month === month && r.year === year);
                    if (monthlyRate) {
                        amount = (h.weight || 0) * monthlyRate.rate;
                    }
                }
                return { ...h, total_amount: amount };
            });

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

            // Calculate General Expenses (not tied to any field)
            const generalExpense = transactions
                .filter(t => !t.field_id)
                .reduce((sum, t) => sum + (t.total_amount || 0), 0);

            if (generalExpense > 0) {
                dashboardData.push({
                    field_id: 'general',
                    field_name: t('generalEstateWide'),
                    total_income: 0,
                    total_expense: generalExpense,
                    net_profit: -generalExpense
                });
            }

            // Check for missing rates in the previous month for notification
            const prevMonthDate = new Date();
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const prevMonth = prevMonthDate.getMonth() + 1;
            const prevYear = prevMonthDate.getFullYear();

            const collectorsWithHarvests = Array.from(new Set(
                harvestsRes.data
                    .filter(h => {
                        const d = new Date(h.date);
                        return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear && h.crop_type === 'tea';
                    })
                    .map(h => h.collector_id)
            ));

            const missingPrevRates = collectorsWithHarvests.some(cid =>
                !rates.find(r => r.collector_id === cid && r.month === prevMonth && r.year === prevYear)
            );

            const totalIncome = harvests.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const totalExpense = transactions.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const totalProfit = totalIncome - totalExpense;

            setData({
                fields: dashboardData,
                summary: {
                    total_income: totalIncome,
                    total_expense: totalExpense,
                    total_profit: totalProfit
                },
                missingRates: missingPrevRates
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
        : fields.filter(f => String(f.field_id) === String(selectedFieldId));

    const displaySummary = selectedFieldId === 'all'
        ? summary
        : {
            total_income: filteredFields[0]?.total_income || 0,
            total_expense: filteredFields[0]?.total_expense || 0,
            total_profit: filteredFields[0]?.net_profit || 0
        };

    return (
        <div className="space-y-6 md:space-y-8 pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{t('dashboard')}</h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1">{t('estateSummary')}</p>
                </div>
            </div>

            {data.missingRates && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 text-amber-800">
                        <AlertCircle className="shrink-0" size={24} />
                        <div>
                            <p className="font-bold text-sm md:text-base">{t('previousMonthRatesMissing')}</p>
                            <p className="text-xs md:text-sm opacity-90">{t('missingRatesNotice')}</p>
                        </div>
                    </div>
                    <Link
                        to="/collectors"
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs md:text-sm font-bold shadow-sm hover:bg-amber-700 whitespace-nowrap"
                    >
                        {t('setRatesNow')}
                    </Link>
                </div>
            )}

            {/* Global Summary Cards */}
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

            {/* Split Chart Section */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <h3 className="text-xl font-bold text-gray-800">{t('fieldPerformance')}</h3>

                    <div className="w-full sm:w-64">
                        <select
                            value={selectedFieldId}
                            onChange={(e) => setSelectedFieldId(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2em' }}
                        >
                            <option value="all">Compare All Fields</option>
                            {fields.map(f => (
                                <option key={f.field_id} value={f.field_id}>{t(f.field_name)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="h-80 min-w-[300px] md:min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredFields.map(f => ({ ...f, field_name: t(f.field_name) }))}>
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
