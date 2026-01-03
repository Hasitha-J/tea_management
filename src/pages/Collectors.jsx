import React, { useState, useEffect } from 'react';
import { Users, Plus, Save, Trash2, Calendar, Banknote, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const Collectors = () => {
    const { t } = useLanguage();
    const [collectors, setCollectors] = useState([]);
    const [rates, setRates] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [status, setStatus] = useState({ type: '', message: '' });

    const [newCollector, setNewCollector] = useState({ name: '', contact: '' });
    const [newRate, setNewRate] = useState({ collector_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), rate: '' });
    const [newAdvance, setNewAdvance] = useState({ collector_id: '', date: new Date().toISOString().split('T')[0], amount: '', description: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [cRes, rRes, aRes] = await Promise.all([
                supabase.from('tea_collectors').select('*'),
                supabase.from('collector_rates').select('*, tea_collectors(name)'),
                supabase.from('collector_advances').select('*, tea_collectors(name)')
            ]);
            if (cRes.data) setCollectors(cRes.data);
            if (rRes.data) setRates(rRes.data);
            if (aRes.data) setAdvances(aRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddCollector = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('tea_collectors').insert([newCollector]);
            if (error) throw error;
            setStatus({ type: 'success', message: t('saveSuccess') });
            setNewCollector({ name: '', contact: '' });
            fetchData();
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const handleAddRate = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('collector_rates').upsert([newRate]);
            if (error) throw error;
            setStatus({ type: 'success', message: t('saveSuccess') });
            setNewRate({ ...newRate, rate: '' });
            fetchData();
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const handleAddAdvance = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('collector_advances').insert([newAdvance]);
            if (error) throw error;
            setStatus({ type: 'success', message: t('saveSuccess') });
            setNewAdvance({ ...newAdvance, amount: '', description: '' });
            fetchData();
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const deleteItem = async (table, id) => {
        if (!confirm(t('confirmDelete') || 'Are you sure?')) return;
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4">
            <div className="flex items-center justify-between mt-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-emerald-600" />
                        {t('collectors')}
                    </h2>
                    <p className="text-sm text-gray-500">Manage tea collectors, rates, and advances.</p>
                </div>
            </div>

            {status.message && (
                <div className={`p-4 rounded-xl flex items-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    {status.message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Collector List */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Plus size={18} className="text-emerald-600" />
                        {t('addCollector')}
                    </h3>
                    <form onSubmit={handleAddCollector} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Collector Name"
                            value={newCollector.name}
                            onChange={e => setNewCollector({ ...newCollector, name: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Contact Info (Optional)"
                            value={newCollector.contact}
                            onChange={e => setNewCollector({ ...newCollector, contact: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all">
                            {t('save')}
                        </button>
                    </form>

                    <div className="mt-6 space-y-2">
                        {collectors.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                                <div>
                                    <p className="font-bold text-gray-800">{c.name}</p>
                                    <p className="text-xs text-gray-500">{c.contact || 'No contact info'}</p>
                                </div>
                                <button onClick={() => deleteItem('tea_collectors', c.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monthly Rates */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-blue-600" />
                        {t('monthlyRates')}
                    </h3>
                    <form onSubmit={handleAddRate} className="space-y-4">
                        <select
                            value={newRate.collector_id}
                            onChange={e => setNewRate({ ...newRate, collector_id: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="">{t('selectCollector')}</option>
                            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={newRate.month}
                                onChange={e => setNewRate({ ...newRate, month: parseInt(e.target.value) })}
                                className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                            </select>
                            <input
                                type="number"
                                placeholder="Year"
                                value={newRate.year}
                                onChange={e => setNewRate({ ...newRate, year: parseInt(e.target.value) })}
                                className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <input
                            type="number"
                            placeholder="Rate (Rs/kg)"
                            value={newRate.rate}
                            onChange={e => setNewRate({ ...newRate, rate: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all">
                            {t('save')}
                        </button>
                    </form>

                    <div className="mt-6 h-48 overflow-y-auto space-y-2 text-sm text-gray-600">
                        {rates.sort((a, b) => b.year - a.year || b.month - a.month).map(r => (
                            <div key={r.id} className="flex items-center justify-between p-2 border-b border-gray-50">
                                <span>{r.tea_collectors?.name} ({r.month}/{r.year})</span>
                                <span className="font-bold">Rs. {r.rate}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Advances */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Banknote size={18} className="text-orange-600" />
                        {t('advances')}
                    </h3>
                    <form onSubmit={handleAddAdvance} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">{t('collector')}</label>
                            <select
                                value={newAdvance.collector_id}
                                onChange={e => setNewAdvance({ ...newAdvance, collector_id: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                required
                            >
                                <option value="">{t('selectCollector')}</option>
                                {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">{t('date')}</label>
                            <input
                                type="date"
                                value={newAdvance.date}
                                onChange={e => setNewAdvance({ ...newAdvance, date: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">{t('amount')}</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={newAdvance.amount}
                                onChange={e => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                required
                            />
                        </div>
                        <button type="submit" className="py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-all">
                            {t('save')}
                        </button>
                    </form>

                    <div className="mt-8">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <History size={14} />
                            Recent Advances
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2">{t('date')}</th>
                                        <th className="px-4 py-2">{t('collector')}</th>
                                        <th className="px-4 py-2">{t('amount')}</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {advances.map(a => (
                                        <tr key={a.id} className="border-b border-gray-50">
                                            <td className="px-4 py-3">{a.date}</td>
                                            <td className="px-4 py-3 font-medium">{a.tea_collectors?.name}</td>
                                            <td className="px-4 py-3 font-bold text-orange-600">Rs. {a.amount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => deleteItem('collector_advances', a.id)} className="text-red-400">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Collectors;
