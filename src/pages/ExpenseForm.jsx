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

            // Reset category if type changes
            if (name === 'type') {
                newData.category_id = '';
                newData.description = '';
                newData.rate = '';
                newData.quantity = '1';
                newData.hours_worked = '';
            }

            // Auto-populate rate if category changes
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

    const calculateTotal = () => {
        const qty = parseFloat(formData.quantity) || 0;
        const rate = parseFloat(formData.rate) || 0;
        return qty * rate;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        // Enhanced Validation
        if (!formData.field_id && formData.type === 'labor_cost') {
            setStatus({ type: 'error', message: 'Please select a field for labor costs.' });
            return;
        }

        if ((formData.type === 'labor_cost' || formData.type === 'goods_cost' || formData.type === 'owner_labor') && !formData.category_id) {
            setStatus({ type: 'error', message: 'Please select an activity/item.' });
            return;
        }

        if (!formData.rate || parseFloat(formData.rate) <= 0) {
            setStatus({ type: 'error', message: 'Please enter a valid rate/amount.' });
            return;
        }

        // Sanitize Payload for Supabase (Ensure numbers are numbers, empty strings are null)
        const payload = {
            date: formData.date,
            field_id: (formData.field_id && formData.field_id !== 'general') ? parseInt(formData.field_id) : null,
            type: formData.type,
            category_id: formData.category_id ? parseInt(formData.category_id) : null,
            description: formData.description || null,
            quantity: parseFloat(formData.quantity) || 1,
            hours_worked: formData.hours_worked ? parseFloat(formData.hours_worked) : null,
            rate: parseFloat(formData.rate),
            total_amount: calculateTotal()
        };

        try {
            const { error } = await supabase.from('transactions').insert([payload]);
            if (error) throw error;

            setStatus({ type: 'success', message: t('saveSuccess') });

            // Reset form but keep date and field for convenience
            setFormData(prev => ({
                ...prev,
                category_id: '',
                description: '',
                quantity: '1',
                hours_worked: '',
                rate: ''
            }));
            fetchTransactions();
        } catch (error) {
            console.error('Submission Error:', error);
            setStatus({
                type: 'error',
                message: error.message || t('error')
            });
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
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8 pb-32">
            <div className="mb-4 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <HandCoins className="text-emerald-600" />
                    {t('logExpenses')}
                </h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">{t('logExpensesDesc')}</p>
            </div>

            <div className="bg-white p-5 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">

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
                                <option value="general">{t('generalEstateWide')}</option>
                                {fields.map(f => (
                                    <option key={f.id} value={f.id}>{t(f.name)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenseType')}</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            {[
                                { id: 'labor_cost', label: t('labor') },
                                { id: 'goods_cost', label: t('goods') },
                                { id: 'overhead', label: t('overhead') },
                                { id: 'owner_labor', label: t('ownerLabor') }
                            ].map(type => (
                                <label key={type.id} className={`
                  cursor-pointer border rounded-lg p-2.5 md:p-3 text-center transition-all text-sm
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

        </div>
    );
};

export default ExpenseForm;
