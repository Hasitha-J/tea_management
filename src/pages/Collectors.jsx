import React, { useState, useEffect } from 'react';
import { Users, Plus, Save, Trash2, Calendar, Banknote, History, AlertCircle, CheckCircle2, Edit2 } from 'lucide-react';
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

    const syncHarvestRates = async (collector_id, month, year, rate) => {
        try {
            // Calculate date range for the month
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            // 1. Fetch all tea harvests for this collector in this month
            // We update harvests where rate is null OR where it's a tea crop (since tea rates are usually monthly)
            const { data: harvests, error: fetchError } = await supabase
                .from('harvests')
                .select('id, weight')
                .eq('collector_id', collector_id)
                .eq('crop_type', 'tea')
                .gte('date', startDate)
                .lte('date', endDate);

            if (fetchError) throw fetchError;

            if (harvests && harvests.length > 0) {
                // 2. Prepare updates
                const updates = harvests.map(h => ({
                    id: h.id,
                    rate: parseFloat(rate),
                    total_amount: (h.weight || 0) * parseFloat(rate)
                }));

                // 3. Perform bulk update (using upsert with IDs is a common way in Supabase if allowed, or multiple updates)
                // For simplicity and safety, we'll do them in a loop if there aren't too many, 
                // but better to use a single .upsert() if the table has an ID primary key.
                const { error: updateError } = await supabase.from('harvests').upsert(updates);
                if (updateError) throw updateError;
            }
        } catch (err) {
            console.error('Sync Error:', err);
        }
    };

    const handleAddRate = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('collector_rates').upsert([newRate]);
            if (error) throw error;

            // Sync with history
            await syncHarvestRates(newRate.collector_id, newRate.month, newRate.year, newRate.rate);

            setStatus({ type: 'success', message: t('saveSuccess') + ' & History Updated' });
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
                            <div key={r.id} className="flex items-center justify-between p-2 border-b border-gray-50 group">
                                <div className="flex-1">
                                    <span className="font-medium text-gray-800">{r.tea_collectors?.name}</span>
                                    <span className="ml-2 text-xs text-gray-400">({r.month}/{r.year})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-blue-600">Rs. {r.rate}</span>
                                    <button
                                        onClick={() => setNewRate({
                                            collector_id: r.collector_id,
                                            month: r.month,
                                            year: r.year,
                                            rate: r.rate
                                        })}
                                        className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => deleteItem('collector_rates', r.id)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Advances History */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Banknote size={18} className="text-orange-600" />
                        {t('advances')}
                    </h3>

                    <div className="mt-4">
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
                                    {advances.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-8 text-center text-gray-400">
                                                No advances logged yet. Use the Log Harvest form to add advances.
                                            </td>
                                        </tr>
                                    ) : (
                                        advances.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => (
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
                                        ))
                                    )}
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
