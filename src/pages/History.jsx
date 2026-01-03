import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, ArrowUpCircle, ArrowDownCircle, Edit2, Trash2, X, Check } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const History = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('income'); // 'income' or 'expenses'
    const [transactions, setTransactions] = useState([]);
    const [harvests, setHarvests] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [fields, setFields] = useState([]);
    const [selectedField, setSelectedField] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Default to last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];

            const [transRes, harvRes, ratesRes, fieldsRes] = await Promise.all([
                supabase.from('transactions').select('*, fields(name)').gte('date', dateLimit).order('date', { ascending: false }),
                supabase.from('harvests').select('*, fields(name), tea_collectors(name)').gte('date', dateLimit).order('date', { ascending: false }),
                supabase.from('collector_rates').select('*'),
                supabase.from('fields').select('id, name')
            ]);

            if (transRes.error) throw transRes.error;
            if (harvRes.error) throw harvRes.error;
            if (ratesRes.error) throw ratesRes.error;
            if (fieldsRes.error) throw fieldsRes.error;

            setFields(fieldsRes.data || []);
            const rates = ratesRes.data || [];

            const flattenedTrans = transRes.data.map(t => ({
                ...t,
                field_name: t.fields?.name
            }));

            const flattenedHarv = harvRes.data.map(h => {
                let amount = h.total_amount || 0;
                let rate = h.rate;

                if (h.crop_type === 'tea' && (!h.rate || h.rate === 0)) {
                    const hDate = new Date(h.date);
                    const month = hDate.getMonth() + 1;
                    const year = hDate.getFullYear();
                    const monthlyRate = rates.find(r => r.collector_id === h.collector_id && r.month === month && r.year === year);
                    if (monthlyRate) {
                        rate = monthlyRate.rate;
                        amount = (h.weight || 0) * monthlyRate.rate;
                    }
                }

                return {
                    ...h,
                    rate,
                    total_amount: amount,
                    field_name: h.fields?.name,
                    collector_name: h.tea_collectors?.name
                };
            });

            setTransactions(flattenedTrans);
            setHarvests(flattenedHarv);
        } catch (err) {
            console.error(err);
        }
    };

    const filteredTransactions = selectedField === 'all'
        ? transactions
        : transactions.filter(t => t.field_id === parseInt(selectedField));

    const filteredHarvests = selectedField === 'all'
        ? harvests
        : harvests.filter(h => h.field_id === parseInt(selectedField));

    const totalIncome = filteredHarvests.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    const totalExpense = filteredTransactions.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

    // --- Actions ---

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditForm({ ...item });
        setDeleteConfirmId(null);
        setStatus({ type: '', message: '' });
    };

    const cancelAction = () => {
        setEditingId(null);
        setDeleteConfirmId(null);
        setEditForm({});
    };

    const handleSave = async (id) => {
        try {
            const table = activeTab === 'expenses' ? 'transactions' : 'harvests';
            // Destructure to remove transient fields that aren't in the DB tables
            const { field_name, fields, ...dbPayload } = editForm;

            // Recalculate total if rate/qty changed
            if (activeTab === 'expenses') {
                dbPayload.total_amount = (parseFloat(dbPayload.quantity) || 0) * (parseFloat(dbPayload.rate) || 0);
            } else {
                dbPayload.total_amount = (parseFloat(dbPayload.weight) || 0) * (parseFloat(dbPayload.rate) || 0);
            }

            const { error } = await supabase.from(table).update(dbPayload).eq('id', id);
            if (error) throw error;

            setStatus({ type: 'success', message: t('updateSuccess') });
            setEditingId(null);
            fetchData();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: t('error') });
        }
    };

    const handleDelete = async (id) => {
        try {
            const table = activeTab === 'expenses' ? 'transactions' : 'harvests';
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;

            setStatus({ type: 'success', message: t('deleteSuccess') });
            setDeleteConfirmId(null);
            fetchData();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: t('error') });
        }
    };

    const [expandedId, setExpandedId] = useState(null);

    const toggleRow = (id) => {
        if (editingId || deleteConfirmId) return; // Don't toggle while editing/deleting
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 pb-32">
            <div className="px-4 md:px-0">
                <div className="mb-4 md:mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <HistoryIcon className="text-emerald-600" />
                        {t('history')}
                    </h2>
                    <p className="text-sm md:text-base text-gray-500 mt-1">{t('historyDesc')}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-gray-500 mb-1">{t('totalIncomeRec')}</p>
                            <p className="text-xl md:text-2xl font-bold text-emerald-600">Rs. {totalIncome.toLocaleString()}</p>
                        </div>
                        <ArrowUpCircle className="text-emerald-100" size={32} md:size={40} fill="currentColor" />
                    </div>
                    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs md:text-sm text-gray-500 mb-1">{t('totalExpenseRec')}</p>
                            <p className="text-xl md:text-2xl font-bold text-red-600">Rs. {totalExpense.toLocaleString()}</p>
                        </div>
                        <ArrowDownCircle className="text-red-100" size={32} md:size={40} fill="currentColor" />
                    </div>
                </div>

                {/* Tabs & Filter */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 mb-6">
                    <div className="flex">
                        <button
                            className={`px-6 py-3 font-medium text-sm transition-colors relative
                                ${activeTab === 'income' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}
                            `}
                            disabled={editingId !== null || deleteConfirmId !== null}
                            onClick={() => { setActiveTab('income'); setStatus({ type: '', message: '' }); setExpandedId(null); }}
                        >
                            {t('recentIncome')}
                        </button>
                        <button
                            className={`px-6 py-3 font-medium text-sm transition-colors relative
                                ${activeTab === 'expenses' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}
                            `}
                            disabled={editingId !== null || deleteConfirmId !== null}
                            onClick={() => { setActiveTab('expenses'); setStatus({ type: '', message: '' }); setExpandedId(null); }}
                        >
                            {t('recentExpenses')}
                        </button>
                    </div>

                    <div className="pb-3 md:pb-0 px-1">
                        <select
                            value={selectedField}
                            onChange={(e) => setSelectedField(e.target.value)}
                            className="text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                            <option value="all">{t('allFields')}</option>
                            {fields.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {status.message && (
                    <div className={`p-4 rounded-lg text-sm flex items-center gap-2 mb-6 ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        <Check size={18} />
                        {status.message}
                    </div>
                )}
            </div>

            {/* Data List (Minimalist Table) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mx-4 md:mx-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 bg-gray-50 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-4 md:px-6 py-3">{t('date')}</th>
                                <th className="px-4 md:px-6 py-3">{t('field')}</th>
                                <th className="px-4 md:px-6 py-3 text-right">{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(activeTab === 'expenses' ? filteredTransactions : filteredHarvests).map((item) => (
                                <React.Fragment key={item.id}>
                                    <tr
                                        onClick={() => toggleRow(item.id)}
                                        className={`cursor-pointer transition-colors ${expandedId === item.id ? 'bg-emerald-50/30' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-4 md:px-6 py-4 text-gray-600 whitespace-nowrap">
                                            {item.date}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 font-medium text-gray-800">
                                            {item.field_name}
                                        </td>
                                        <td className={`px-4 md:px-6 py-4 text-right font-bold ${activeTab === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                                            Rs. {item.total_amount?.toLocaleString()}
                                        </td>
                                    </tr>

                                    {/* Expanded Detail View */}
                                    {expandedId === item.id && (
                                        <tr className="bg-emerald-50/30">
                                            <td colSpan="3" className="px-4 md:px-6 py-4 border-t border-emerald-100/50">
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{t('typeCrop')}</p>
                                                            {editingId === item.id ? (
                                                                <input
                                                                    type="text"
                                                                    className="w-full border rounded px-2 py-1 text-sm"
                                                                    value={activeTab === 'income' ? editForm.crop_type : editForm.type}
                                                                    onChange={e => setEditForm({ ...editForm, [activeTab === 'income' ? 'crop_type' : 'type']: e.target.value })}
                                                                />
                                                            ) : (
                                                                <p className="text-sm font-medium text-gray-700 capitalize">
                                                                    {activeTab === 'income' ? (t(item.crop_type) || item.crop_type) : item.type?.replace('_', ' ')}
                                                                    {item.collector_name ? (
                                                                        <span className="text-xs text-emerald-600 ml-2">({item.collector_name})</span>
                                                                    ) : (
                                                                        item.crop_type === 'tea' && <span className="text-xs text-amber-600 ml-2">({t('cashSale')})</span>
                                                                    )}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{t('details')}</p>
                                                            {editingId === item.id ? (
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="number"
                                                                        className="w-1/2 border rounded px-2 py-1 text-sm"
                                                                        placeholder="Weight"
                                                                        value={editForm.weight}
                                                                        onChange={e => setEditForm({ ...editForm, weight: e.target.value })}
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        className="w-1/2 border rounded px-2 py-1 text-sm"
                                                                        placeholder="Rate"
                                                                        value={editForm.rate}
                                                                        onChange={e => setEditForm({ ...editForm, rate: e.target.value })}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-gray-600">
                                                                    {activeTab === 'income' ? (
                                                                        item.rate ? `${item.weight} kg @ Rs. ${item.rate}` : `${item.weight} kg (${t('pendingRate')})`
                                                                    ) : (item.description || '-')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2 border-t border-emerald-100/30">
                                                        <div className="flex gap-3">
                                                            {editingId === item.id ? (
                                                                <>
                                                                    <button onClick={() => handleSave(item.id)} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs flex items-center gap-1">
                                                                        <Check size={14} /> {t('save')}
                                                                    </button>
                                                                    <button onClick={cancelAction} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs flex items-center gap-1">
                                                                        <X size={14} /> {t('cancel')}
                                                                    </button>
                                                                </>
                                                            ) : deleteConfirmId === item.id ? (
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs text-red-600 font-bold">{t('confirm')}?</p>
                                                                    <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs uppercase">
                                                                        {t('delete')}
                                                                    </button>
                                                                    <button onClick={cancelAction} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                        <X size={18} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-emerald-600 hover:bg-white rounded transition-colors flex items-center gap-1 text-xs">
                                                                        <Edit2 size={16} /> {t('edit')}
                                                                    </button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }} className="p-2 text-red-400 hover:bg-white rounded transition-colors flex items-center gap-1 text-xs">
                                                                        <Trash2 size={16} /> {t('delete')}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                                                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                                        >
                                                            {t('close')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {(activeTab === 'expenses' ? filteredTransactions : filteredHarvests).length === 0 && (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-gray-400">
                                        {t('noData')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default History;
