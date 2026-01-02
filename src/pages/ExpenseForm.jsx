import React, { useState, useEffect } from 'react';
import { HandCoins, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const ExpenseForm = () => {
    const { t } = useLanguage();
    const [fields, setFields] = useState([]);
    const [activities, setActivities] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [transactions, setTransactions] = useState([]);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        field_id: '',
        type: 'labor_cost', // labor_cost, goods_cost, overhead, owner_labor
        category_id: '',
        description: '',
        quantity: '1', // Default to 1
        hours_worked: '',
        rate: '',
    });

    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [fieldsRes, activityRes, invRes] = await Promise.all([
                supabase.from('fields').select('*'),
                supabase.from('activity_master').select('*').order('id'),
                supabase.from('inventory_master').select('*')
            ]);

            if (fieldsRes.error) throw fieldsRes.error;
            if (activityRes.error) throw activityRes.error;
            if (invRes.error) throw invRes.error;

            setFields(fieldsRes.data);
            setActivities(activityRes.data);
            setInventory(invRes.data);

            fetchTransactions();
        } catch (err) {
            console.error(err);
        }
    };

    const fetchTransactions = async () => {
        try {
            const { data, error } = await supabase.from('transactions')
                .select('*, fields(name)')
                .order('date', { ascending: false });

            if (error) throw error;

            const flattened = data.map(t => ({
                ...t,
                field_name: t.fields?.name
            }));
            setTransactions(flattened);
        } catch (err) {
            console.error('Failed to refresh transactions', err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-populate rate if category changes
            if (name === 'category_id') {
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

    const calculateTotal = () => {
        const qty = parseFloat(formData.quantity) || 0;
        const rate = parseFloat(formData.rate) || 0;
        return qty * rate;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (!formData.field_id || !formData.rate) {
            setStatus({ type: 'error', message: 'Please fill all required fields.' });
            return;
        }

        const payload = {
            ...formData,
            total_amount: calculateTotal()
        };

        try {
            const { error } = await supabase.from('transactions').insert([payload]);
            if (error) throw error;

            setStatus({ type: 'success', message: t('saveSuccess') });
            // Reset sensitive fields
            setFormData(prev => ({
                ...prev,
                category_id: '',
                description: '',
                quantity: '1', // Reset to 1
                hours_worked: '',
                rate: ''
            }));
            fetchTransactions();
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: t('error') });
        }
    };

    const renderDynamicFields = () => {
        switch (formData.type) {
            case 'labor_cost':
            case 'owner_labor':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('activity')}</label>
                            <select
                                name="category_id"
                                value={formData.category_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            >
                                <option value="">{t('selectActivity')}</option>
                                {activities.map(a => (
                                    <option key={a.id} value={a.id}>{t(a.name.toLowerCase()) !== a.name.toLowerCase() ? t(a.name.toLowerCase()) : a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('noOfPeople')}</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    placeholder="1"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('hoursWorked')}</label>
                                <input
                                    type="number"
                                    name="hours_worked"
                                    value={formData.hours_worked}
                                    onChange={handleChange}
                                    placeholder="8"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </>
                );
            case 'goods_cost':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('item')}</label>
                            <select
                                name="category_id"
                                value={formData.category_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            >
                                <option value="">Select Item...</option>
                                {inventory.map(i => (
                                    <option key={i.id} value={i.id}>{t(i.name.toLowerCase()) !== i.name.toLowerCase() ? t(i.name.toLowerCase()) : i.name} ({i.unit})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('qty')}</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </>
                );
            case 'overhead':
                return (
                    <>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('details')}</label>
                            <input
                                type="text"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="e.g., Transport, Machine Repair"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('amountRate')}</label>
                            <input
                                type="number"
                                name="rate"
                                value={formData.rate}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <div className="hidden">
                            <input type="hidden" name="quantity" value="1" />
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <HandCoins className="text-emerald-600" />
                    {t('logExpenses')}
                </h2>
                <p className="text-gray-500 mt-1">{t('logExpensesDesc')}</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('date')}</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('field')}</label>
                            <select
                                name="field_id"
                                value={formData.field_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            >
                                <option value="">{t('selectField')}</option>
                                {fields.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenseType')}</label>
                        <div className="flex flex-wrap gap-4">
                            {[
                                { id: 'labor_cost', label: t('labor') },
                                { id: 'goods_cost', label: t('goods') },
                                { id: 'overhead', label: t('overhead') },
                                { id: 'owner_labor', label: t('ownerLabor') }
                            ].map(type => (
                                <label key={type.id} className={`
                  flex-1 cursor-pointer border rounded-lg p-3 text-center transition-all min-w-[140px]
                  ${formData.type === type.id
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium ring-1 ring-emerald-500'
                                        : 'border-gray-200 hover:bg-gray-50'}
                `}>
                                    <input
                                        type="radio"
                                        name="type"
                                        value={type.id}
                                        checked={formData.type === type.id}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    {type.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {renderDynamicFields()}

                        {formData.type !== 'overhead' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('rate')} (Rs)</label>
                                <input
                                    type="number"
                                    name="rate"
                                    value={formData.rate}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">{t('totalCost')}</p>
                            <p className="text-2xl font-bold text-red-600">Rs. {calculateTotal().toLocaleString()}</p>
                        </div>

                        <button
                            type="submit"
                            className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 transition-all flex items-center gap-2"
                        >
                            <Save size={18} />
                            {t('saveExpense')}
                        </button>
                    </div>

                    {status.message && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                            {status.message}
                        </div>
                    )}
                </form>
            </div>

            {/* Expense History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">{t('recentExpenses')}</h3>
                    <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{transactions.length} {t('records')}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 bg-gray-50 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">{t('date')}</th>
                                <th className="px-6 py-3">{t('field')}</th>
                                <th className="px-6 py-3">{t('expenseType')}</th>
                                <th className="px-6 py-3">{t('descriptionItem')}</th>
                                <th className="px-6 py-3 text-right">{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                        {t('noExpenses')}
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-gray-600">{t.date}</td>
                                        <td className="px-6 py-3 font-medium text-gray-800">{t.field_name}</td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium capitalize 
                        ${t.type === 'labor_cost' ? 'bg-blue-50 text-blue-700' :
                                                    t.type === 'goods_cost' ? 'bg-amber-50 text-amber-700' :
                                                        t.type === 'overhead' ? 'bg-purple-50 text-purple-700' :
                                                            'bg-gray-100 text-gray-700'}`}>
                                                {t.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {t.description || (t.category_id ? `Category ID: ${t.category_id}` : '-')}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-800">
                                            Rs. {t.total_amount?.toLocaleString()}
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

export default ExpenseForm;
