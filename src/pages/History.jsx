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

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [transRes, harvRes] = await Promise.all([
                supabase.from('transactions').select('*, fields(name)').order('date', { ascending: false }),
                supabase.from('harvests').select('*, fields(name)').order('date', { ascending: false })
            ]);

            if (transRes.error) throw transRes.error;
            if (harvRes.error) throw harvRes.error;

            const flattenedTrans = transRes.data.map(t => ({
                ...t,
                field_name: t.fields?.name
            }));

            const flattenedHarv = harvRes.data.map(h => ({
                ...h,
                field_name: h.fields?.name
            }));

            setTransactions(flattenedTrans);
            setHarvests(flattenedHarv);
        } catch (err) {
            console.error(err);
        }
    };

    const totalIncome = harvests.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    const totalExpense = transactions.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

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

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <HistoryIcon className="text-emerald-600" />
                    {t('history')}
                </h2>
                <p className="text-gray-500 mt-1">{t('historyDesc')}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">{t('totalIncomeRec')}</p>
                        <p className="text-2xl font-bold text-emerald-600">Rs. {totalIncome.toLocaleString()}</p>
                    </div>
                    <ArrowUpCircle className="text-emerald-100" size={40} fill="currentColor" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">{t('totalExpenseRec')}</p>
                        <p className="text-2xl font-bold text-red-600">Rs. {totalExpense.toLocaleString()}</p>
                    </div>
                    <ArrowDownCircle className="text-red-100" size={40} fill="currentColor" />
                </div>
            </div>

            {status.message && (
                <div className={`p-4 rounded-lg text-sm flex items-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    <Check size={18} />
                    {status.message}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    className={`px-6 py-3 font-medium text-sm transition-colors relative
                        ${activeTab === 'income' ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}
                    `}
                    disabled={editingId !== null || deleteConfirmId !== null}
                    onClick={() => { setActiveTab('income'); setStatus({ type: '', message: '' }); }}
                >
                    {t('recentIncome')}
                </button>
                <button
                    className={`px-6 py-3 font-medium text-sm transition-colors relative
                        ${activeTab === 'expenses' ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}
                    `}
                    disabled={editingId !== null || deleteConfirmId !== null}
                    onClick={() => { setActiveTab('expenses'); setStatus({ type: '', message: '' }); }}
                >
                    {t('recentExpenses')}
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 bg-gray-50 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">{t('date')}</th>
                                <th className="px-6 py-3">{t('field')}</th>
                                <th className="px-6 py-3">{t('typeCrop')}</th>
                                <th className="px-6 py-3">{t('details')}</th>
                                <th className="px-6 py-3 text-right">{t('total')}</th>
                                <th className="px-6 py-3 text-right w-32">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {activeTab === 'expenses' ? (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3">
                                            {editingId === t.id ? (
                                                <input type="date" className="border rounded px-2 py-1" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                                            ) : t.date}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-800">{t.field_name}</td>
                                        <td className="px-6 py-3 capitalize">{t.type?.replace('_', ' ')}</td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {editingId === t.id ? (
                                                <input type="text" className="border rounded px-2 py-1 w-full" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                                            ) : t.description || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-800">
                                            {editingId === t.id ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <input type="number" className="border rounded px-2 py-1 w-24 text-right" value={editForm.rate} onChange={e => setEditForm({ ...editForm, rate: e.target.value })} placeholder="Rate" />
                                                    <span className="text-[10px] text-gray-400">Rate x Qty</span>
                                                </div>
                                            ) : `Rs. ${t.total_amount?.toLocaleString()}`}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {editingId === t.id ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleSave(t.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={18} /></button>
                                                    <button onClick={cancelAction} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><X size={18} /></button>
                                                </div>
                                            ) : deleteConfirmId === t.id ? (
                                                <div className="flex justify-end gap-2 bg-red-50 p-1 rounded border border-red-100">
                                                    <button onClick={() => handleDelete(t.id)} className="text-[10px] font-bold text-red-600 hover:underline">{t('confirm').toUpperCase()}</button>
                                                    <button onClick={cancelAction} className="p-0.5 text-gray-400 hover:bg-white rounded"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-2 text-gray-400">
                                                    <button onClick={() => startEdit(t)} className="hover:text-emerald-600 transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => setDeleteConfirmId(t.id)} className="hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                harvests.map((h) => (
                                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3">
                                            {editingId === h.id ? (
                                                <input type="date" className="border rounded px-2 py-1" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                                            ) : h.date}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-800">{h.field_name}</td>
                                        <td className="px-6 py-3 capitalize">{t(h.crop_type) || h.crop_type}</td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {editingId === h.id ? (
                                                <div className="flex gap-2">
                                                    <input type="number" className="border rounded px-2 py-1 w-20" value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: e.target.value })} placeholder="kg" />
                                                    <input type="number" className="border rounded px-2 py-1 w-20" value={editForm.rate} onChange={e => setEditForm({ ...editForm, rate: e.target.value })} placeholder="Rs/kg" />
                                                </div>
                                            ) : `${h.weight} kg @ Rs. ${h.rate}`}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-emerald-600">
                                            Rs. {h.total_amount?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {editingId === h.id ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleSave(h.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={18} /></button>
                                                    <button onClick={cancelAction} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><X size={18} /></button>
                                                </div>
                                            ) : deleteConfirmId === h.id ? (
                                                <div className="flex justify-end gap-2 bg-red-50 p-1 rounded border border-red-100">
                                                    <button onClick={() => handleDelete(h.id)} className="text-[10px] font-bold text-red-600 hover:underline">{t('confirm').toUpperCase()}</button>
                                                    <button onClick={cancelAction} className="p-0.5 text-gray-400 hover:bg-white rounded"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-2 text-gray-400">
                                                    <button onClick={() => startEdit(h)} className="hover:text-emerald-600 transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => setDeleteConfirmId(h.id)} className="hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default History;
