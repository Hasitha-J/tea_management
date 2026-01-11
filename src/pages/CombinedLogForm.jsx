import React, { useState, useEffect } from 'react';
import { Sprout, HandCoins, Plus, Trash2, Save, CheckCircle2, AlertCircle, History, Loader2, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const CombinedLogForm = () => {
    const { t, language } = useLanguage();
    const [fields, setFields] = useState([]);
    const [collectors, setCollectors] = useState([]);
    const [activities, setActivities] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Main Session State
    const [sessionData, setSessionData] = useState({
        date: new Date().toISOString().split('T')[0],
        field_id: '',
    });

    // Income Part
    const [incomeData, setIncomeData] = useState({
        crop_type: 'tea',
        weight: '',
        rate: '',
        collector_id: '',
        advance_amount: '',
    });

    // Expenses Part (List)
    const [expenses, setExpenses] = useState([]);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [currentExpense, setCurrentExpense] = useState({
        type: 'labor_cost',
        category_id: '',
        description: '',
        quantity: '1',
        hours_worked: '',
        rate: '',
    });

    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        fetchInitialData();
        fetchRecentSessions();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [fRes, cRes, aRes, iRes] = await Promise.all([
                supabase.from('fields').select('*'),
                supabase.from('tea_collectors').select('*'),
                supabase.from('activity_master').select('*').order('id'),
                supabase.from('inventory_master').select('*')
            ]);

            if (fRes.error) throw fRes.error;
            setFields(fRes.data || []);
            setCollectors(cRes.data || []);
            setActivities(aRes.data || []);
            setInventory(iRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentSessions = async () => {
        // Fetch last 5 harvests and their potentially related expenses
        // For "Recent Entry", we'll just show the last few harvests for now
        try {
            const { data, error } = await supabase.from('harvests')
                .select('*, fields(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setRecentSessions(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSessionChange = (e) => {
        setSessionData({ ...sessionData, [e.target.name]: e.target.value });
    };

    const handleIncomeChange = (e) => {
        setIncomeData({ ...incomeData, [e.target.name]: e.target.value });
    };

    const handleExpenseChange = (e) => {
        const { name, value } = e.target;
        setCurrentExpense(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'type') {
                newData.category_id = '';
                newData.description = '';
                newData.rate = '';
                newData.quantity = '1';
                newData.hours_worked = '';
            }
            if (name === 'category_id' && value) {
                if (prev.type === 'labor_cost' || prev.type === 'owner_labor') {
                    const act = activities.find(a => a.id === parseInt(value));
                    if (act) newData.rate = act.default_rate;
                } else if (prev.type === 'goods_cost') {
                    const inv = inventory.find(i => i.id === parseInt(value));
                    if (inv) newData.rate = inv.unit_price;
                }
            }
            return newData;
        });
    };

    const addExpense = () => {
        if (!currentExpense.rate || parseFloat(currentExpense.rate) <= 0) {
            alert("Please enter a valid rate/amount");
            return;
        }

        let label = currentExpense.description || '';
        if (currentExpense.type === 'labor_cost' || currentExpense.type === 'owner_labor') {
            const act = activities.find(a => a.id === parseInt(currentExpense.category_id));
            if (act) label = t(act.name.toLowerCase());
        } else if (currentExpense.type === 'goods_cost') {
            const inv = inventory.find(i => i.id === parseInt(currentExpense.category_id));
            if (inv) label = t(inv.name.toLowerCase());
        } else {
            label = currentExpense.description || t('overhead');
        }

        setExpenses([...expenses, { ...currentExpense, id: Date.now(), label }]);
        setCurrentExpense({
            type: 'labor_cost',
            category_id: '',
            description: '',
            quantity: '1',
            hours_worked: '',
            rate: '',
        });
        setShowExpenseForm(false);
    };

    const removeExpense = (id) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        setStatus({ type: '', message: '' });

        // Basic Validation
        if (!sessionData.field_id || !incomeData.weight) {
            setStatus({ type: 'error', message: 'Field and weight are required.' });
            return;
        }

        setSubmitting(true);
        try {
            const fieldId = parseInt(sessionData.field_id);
            const isTea = incomeData.crop_type === 'tea';
            const isCash = incomeData.collector_id === 'cash';

            // 1. Prepare Harvest Payload
            const harvestPayload = {
                date: sessionData.date,
                field_id: fieldId,
                crop_type: incomeData.crop_type,
                weight: parseFloat(incomeData.weight) || 0,
                rate: parseFloat(incomeData.rate) || null,
                collector_id: (isTea && !isCash) ? parseInt(incomeData.collector_id) : null,
                total_amount: (parseFloat(incomeData.weight) && parseFloat(incomeData.rate))
                    ? parseFloat(incomeData.weight) * parseFloat(incomeData.rate)
                    : 0
            };

            // 2. Insert Harvest
            const { error: harvestError } = await supabase.from('harvests').insert([harvestPayload]);
            if (harvestError) throw harvestError;

            // 3. Insert Advance if applicable
            if (isTea && !isCash && incomeData.advance_amount && parseFloat(incomeData.advance_amount) > 0) {
                await supabase.from('collector_advances').insert([{
                    collector_id: parseInt(incomeData.collector_id),
                    date: sessionData.date,
                    amount: parseFloat(incomeData.advance_amount),
                    description: `Advance during ${incomeData.crop_type} harvest`
                }]);
            }

            // 4. Insert Expenses
            if (expenses.length > 0) {
                const expensePayloads = expenses.map(exp => ({
                    date: sessionData.date,
                    field_id: fieldId,
                    type: exp.type,
                    category_id: exp.category_id ? parseInt(exp.category_id) : null,
                    description: exp.description || null,
                    quantity: parseFloat(exp.quantity) || 1,
                    hours_worked: exp.hours_worked ? parseFloat(exp.hours_worked) : null,
                    rate: parseFloat(exp.rate),
                    total_amount: (parseFloat(exp.quantity) || 1) * parseFloat(exp.rate)
                }));
                const { error: expError } = await supabase.from('transactions').insert(expensePayloads);
                if (expError) throw expError;
            }

            // Success!
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2500);

            // Reset
            setIncomeData({
                crop_type: 'tea',
                weight: '',
                rate: '',
                collector_id: '',
                advance_amount: '',
            });
            setExpenses([]);
            fetchRecentSessions();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: t('error') });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-600" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-32 relative">

            {/* Success Overlay */}
            {showSuccess && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all animate-in fade-in"
                    onClick={() => setShowSuccess(false)}
                >
                    <div className="bg-white p-8 rounded-2xl shadow-2xl text-center scale-110 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">{t('loggedSuccess')}</h2>
                    </div>
                </div>
            )}

            <div className="mb-4 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Sprout className="text-emerald-600" />
                    {t('logHarvest')} & {t('assocExpenses')}
                </h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">{t('combinedModeDesc')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* 1. Common Details Card */}
                <div className="bg-white p-5 md:p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('date')}</label>
                            <input
                                type="date"
                                name="date"
                                value={sessionData.date}
                                onChange={handleSessionChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('field')}</label>
                            <select
                                name="field_id"
                                value={sessionData.field_id}
                                onChange={handleSessionChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            >
                                <option value="">{t('selectField')}</option>
                                {fields.map(f => (
                                    <option key={f.id} value={f.id}>{t(f.name)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. Harvest Details Card */}
                <div className="bg-white p-5 md:p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Sprout size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 uppercase text-xs tracking-wider">{t('harvestType')}</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            {['tea', 'pepper', 'coffee'].map(crop => (
                                <label key={crop} className={`
                                    flex-1 cursor-pointer border rounded-lg p-3 text-center capitalize transition-all
                                    ${incomeData.crop_type === crop
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium ring-1 ring-emerald-500'
                                        : 'border-gray-200 hover:bg-gray-50'}
                                `}>
                                    <input
                                        type="radio"
                                        name="crop_type"
                                        value={crop}
                                        checked={incomeData.crop_type === crop}
                                        onChange={handleIncomeChange}
                                        className="sr-only"
                                    />
                                    {t(crop)}
                                </label>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('weight')} (kg)</label>
                                <input
                                    type="number"
                                    name="weight"
                                    value={incomeData.weight}
                                    onChange={handleIncomeChange}
                                    placeholder="0.00"
                                    step="0.01"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('rate')} (Rs/kg)</label>
                                <input
                                    type="number"
                                    name="rate"
                                    value={incomeData.rate}
                                    onChange={handleIncomeChange}
                                    placeholder={incomeData.crop_type === 'tea' ? t('pendingRate') : "0.00"}
                                    step="0.01"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {incomeData.crop_type === 'tea' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('collector')}</label>
                                    <select
                                        name="collector_id"
                                        value={incomeData.collector_id}
                                        onChange={handleIncomeChange}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    >
                                        <option value="">{t('selectCollector')}</option>
                                        {collectors.map(c => (
                                            <option key={c.id} value={c.id}>{t(c.name)}</option>
                                        ))}
                                        <option value="cash" className="font-bold text-emerald-600">{t('cashSale')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('advanceAmount')}</label>
                                    <input
                                        type="number"
                                        name="advance_amount"
                                        value={incomeData.advance_amount}
                                        onChange={handleIncomeChange}
                                        disabled={incomeData.collector_id === 'cash'}
                                        placeholder="0.00"
                                        className={`w-full px-4 py-2 border border-blue-200 bg-blue-50/20 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${incomeData.collector_id === 'cash' ? 'opacity-50' : ''}`}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Expenses Section */}
                <div className="bg-white p-5 md:p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                <HandCoins size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800 uppercase text-xs tracking-wider">{t('assocExpenses')}</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowExpenseForm(true)}
                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 transition-all"
                        >
                            <Plus size={14} /> {t('addExpense')}
                        </button>
                    </div>

                    {expenses.length > 0 ? (
                        <div className="space-y-3">
                            {expenses.map((exp) => (
                                <div key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 text-sm">{exp.label}</span>
                                        <span className="text-[10px] text-gray-500 uppercase tracking-tighter">
                                            {t(exp.type)} {exp.quantity > 1 && `x ${exp.quantity}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-red-600">Rs. {((parseFloat(exp.quantity) || 1) * parseFloat(exp.rate)).toLocaleString()}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeExpense(exp.id)}
                                            className="text-gray-300 hover:text-red-500 p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                            <p className="text-sm italic">No expenses added to this session.</p>
                        </div>
                    )}

                    {/* Quick Expense Form Modal */}
                    {showExpenseForm && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                                <button
                                    onClick={() => setShowExpenseForm(false)}
                                    className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>

                                <h4 className="text-lg font-bold text-gray-800 mb-6">{t('addExpense')}</h4>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        {['labor_cost', 'goods_cost', 'overhead', 'owner_labor'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => handleExpenseChange({ target: { name: 'type', value: type } })}
                                                className={`p-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all
                                                    ${currentExpense.type === type ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                            >
                                                {t(type)}
                                            </button>
                                        ))}
                                    </div>

                                    {(currentExpense.type === 'labor_cost' || currentExpense.type === 'owner_labor') && (
                                        <>
                                            <select
                                                name="category_id"
                                                value={currentExpense.category_id}
                                                onChange={handleExpenseChange}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                            >
                                                <option value="">{t('selectActivity')}</option>
                                                {activities.map(a => <option key={a.id} value={a.id}>{t(a.name.toLowerCase())}</option>)}
                                            </select>
                                            <div className="grid grid-cols-2 gap-4">
                                                <input
                                                    type="number"
                                                    name="quantity"
                                                    value={currentExpense.quantity}
                                                    onChange={handleExpenseChange}
                                                    placeholder={t('noOfPeople')}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                                />
                                                <input
                                                    type="number"
                                                    name="hours_worked"
                                                    value={currentExpense.hours_worked}
                                                    onChange={handleExpenseChange}
                                                    placeholder={t('hoursWorked')}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {currentExpense.type === 'goods_cost' && (
                                        <>
                                            <select
                                                name="category_id"
                                                value={currentExpense.category_id}
                                                onChange={handleExpenseChange}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                            >
                                                <option value="">Select Item...</option>
                                                {inventory.map(i => <option key={i.id} value={i.id}>{t(i.name.toLowerCase())}</option>)}
                                            </select>
                                            <input
                                                type="number"
                                                name="quantity"
                                                value={currentExpense.quantity}
                                                onChange={handleExpenseChange}
                                                placeholder={t('qty')}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                            />
                                        </>
                                    )}

                                    {currentExpense.type === 'overhead' && (
                                        <input
                                            type="text"
                                            name="description"
                                            value={currentExpense.description}
                                            onChange={handleExpenseChange}
                                            placeholder="Details (e.g. Transport)"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                        />
                                    )}

                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">{t('rate')} (Rs)</label>
                                        <input
                                            type="number"
                                            name="rate"
                                            value={currentExpense.rate}
                                            onChange={handleExpenseChange}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addExpense}
                                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all mt-4"
                                    >
                                        {t('addExpense')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Submit */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
                    <div className="flex gap-8">
                        <div className="text-center md:text-left">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('totalRevenue')}</p>
                            <p className="text-2xl font-bold text-emerald-600 uppercase">
                                Rs. {((parseFloat(incomeData.weight) || 0) * (parseFloat(incomeData.rate) || 0)).toLocaleString()}
                            </p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total Expenses</p>
                            <p className="text-2xl font-bold text-red-500 uppercase">
                                Rs. {expenses.reduce((sum, exp) => sum + (parseFloat(exp.quantity) || 1) * parseFloat(exp.rate), 0).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full md:w-auto px-10 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        {t('saveCombined')}
                    </button>
                </div>

                {status.message && (
                    <div className={`p-4 rounded-xl flex items-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                        {status.message}
                    </div>
                )}
            </form>

            {/* 4. Last Activity List */}
            <div className="pt-10">
                <div className="flex items-center gap-2 mb-4">
                    <History className="text-gray-400" size={20} />
                    <h3 className="text-lg font-bold text-gray-700">{t('lastEntry')}</h3>
                </div>

                {recentSessions.length > 0 ? (
                    <div className="space-y-3">
                        {recentSessions.slice(0, 3).map((sess) => (
                            <div key={sess.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-100 uppercase">
                                        {sess.crop_type.slice(0, 3)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{t(sess.fields?.name)}</p>
                                        <p className="text-xs text-gray-500">{sess.date} • {sess.weight} kg</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-600 text-sm">Rs. {sess.total_amount?.toLocaleString()}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('income')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400">
                        {t('noIncome')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CombinedLogForm;
