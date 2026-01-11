import React, { useState, useEffect } from 'react';
import { Sprout, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const IncomeForm = () => {
    const { t } = useLanguage();
    const [fields, setFields] = useState([]);
    const [collectors, setCollectors] = useState([]);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        field_id: '',
        crop_type: 'tea',
        weight: '',
        rate: '',
        collector_id: '',
        advance_amount: '',
    });
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        // Fetch fields and collectors
        Promise.all([
            supabase.from('fields').select('*'),
            supabase.from('tea_collectors').select('*')
        ]).then(([fRes, cRes]) => {
            if (fRes.error) throw fRes.error;
            setFields(fRes.data);
            if (cRes.data) setCollectors(cRes.data);
        }).catch(err => console.error(err));
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        const isTea = formData.crop_type === 'tea';
        const isCash = formData.collector_id === 'cash';

        if (!formData.field_id || !formData.weight) {
            setStatus({ type: 'error', message: 'Field and weight are required.' });
            return;
        }

        if ((!isTea || isCash) && !formData.rate) {
            setStatus({ type: 'error', message: 'Rate is required for cash sales/non-tea crops.' });
            return;
        }

        if (isTea && !isCash && !formData.collector_id) {
            setStatus({ type: 'error', message: 'Please select a collector.' });
            return;
        }

        const payload = {
            date: formData.date,
            field_id: parseInt(formData.field_id),
            crop_type: formData.crop_type,
            weight: parseFloat(formData.weight) || 0,
            rate: parseFloat(formData.rate) || null,
            collector_id: (isTea && !isCash) ? parseInt(formData.collector_id) : null,
            total_amount: (parseFloat(formData.weight) && parseFloat(formData.rate))
                ? parseFloat(formData.weight) * parseFloat(formData.rate)
                : 0
        };

        try {
            // 1. Insert harvest record
            const { error: harvestError } = await supabase.from('harvests').insert([payload]);
            if (harvestError) throw harvestError;

            // 2. If tea (NOT cash) and advance provided, insert advance record
            if (isTea && !isCash && formData.advance_amount && parseFloat(formData.advance_amount) > 0) {
                const advancePayload = {
                    collector_id: parseInt(formData.collector_id),
                    date: formData.date,
                    amount: parseFloat(formData.advance_amount),
                    description: `Advance during ${formData.crop_type} harvest`
                };
                const { error: advanceError } = await supabase.from('collector_advances').insert([advancePayload]);
                if (advanceError) throw advanceError;
            }

            setStatus({ type: 'success', message: t('saveSuccess') });
            setFormData({ ...formData, weight: '', rate: '', advance_amount: '' }); // Reset data fields
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: t('error') });
        }
    };

    const calculateTotal = () => {
        const w = parseFloat(formData.weight) || 0;
        const r = parseFloat(formData.rate) || 0;
        return w * r;
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 md:space-y-8 pb-10">
            <div className="mb-4 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Sprout className="text-emerald-600" />
                    {t('logHarvest')}
                </h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">{t('logIncomeDesc')}</p>
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
                                {fields.map(f => (
                                    <option key={f.id} value={f.id}>{t(f.name)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('harvestType')}</label>
                        <div className="flex gap-4">
                            {['tea', 'pepper', 'coffee'].map(crop => (
                                <label key={crop} className={`
                  flex-1 cursor-pointer border rounded-lg p-3 text-center capitalize transition-all
                  ${formData.crop_type === crop
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium ring-1 ring-emerald-500'
                                        : 'border-gray-200 hover:bg-gray-50'}
                `}>
                                    <input
                                        type="radio"
                                        name="crop_type"
                                        value={crop}
                                        checked={formData.crop_type === crop}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    {t(crop)}
                                </label>
                            ))}
                        </div>
                    </div>

                    {formData.crop_type === 'tea' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('collector')}</label>
                                <select
                                    name="collector_id"
                                    value={formData.collector_id}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
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
                                    value={formData.advance_amount}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    step="0.01"
                                    disabled={formData.collector_id === 'cash'}
                                    className={`w-full px-4 py-2 border border-blue-200 bg-blue-50/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${formData.collector_id === 'cash' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('weight')} (kg)</label>
                            <input
                                type="number"
                                name="weight"
                                value={formData.weight}
                                onChange={handleChange}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('rate')} (Rs/kg) {(formData.crop_type === 'tea' && formData.collector_id !== 'cash') && `(${t('optional') || 'Optional'})`}
                            </label>
                            <input
                                type="number"
                                name="rate"
                                value={formData.rate}
                                onChange={handleChange}
                                placeholder={formData.crop_type === 'tea' ? t('pendingRate') : "0.00"}
                                step="0.01"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">{t('totalRevenue')}</p>
                            <p className="text-2xl font-bold text-gray-900">Rs. {calculateTotal().toLocaleString()}</p>
                        </div>

                        <button
                            type="submit"
                            className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 transition-all flex items-center gap-2"
                        >
                            <Save size={18} />
                            {t('saveRecord')}
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

export default IncomeForm;
