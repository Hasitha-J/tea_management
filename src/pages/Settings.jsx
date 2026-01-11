import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Check, X, Edit2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';

const Settings = () => {
    const { language, setLanguage, combinedLoggingMode, toggleCombinedLogging, t } = useLanguage();
    const [activities, setActivities] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', default_rate: '' });
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        fetchActivities();
    }, []);

    const fetchActivities = async () => {
        try {
            const { data, error } = await supabase.from('activity_master').select('*').order('id');
            if (error) throw error;
            setActivities(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleEditClick = (activity) => {
        setEditingId(activity.id);
        setEditForm({ name: activity.name, default_rate: activity.default_rate });
        setStatus({ type: '', message: '' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({ name: '', default_rate: '' });
    };

    const handleSave = async (id) => {
        try {
            const { error } = await supabase.from('activity_master')
                .update({
                    name: editForm.name,
                    default_rate: parseFloat(editForm.default_rate)
                })
                .eq('id', id);

            if (error) throw error;

            setStatus({ type: 'success', message: t('updateSuccess') });
            setEditingId(null);
            fetchActivities();
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: t('error') });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-10">
            <div className="mb-4 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <SettingsIcon className="text-emerald-600" />
                    {t('settings')} & Master Data
                </h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">Manage standard rates for estate activities.</p>
            </div>

            {/* General Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-800">{t('generalSettings')}</h3>
                </div>
                <div className="p-5">
                    <div className="flex items-center justify-between">
                        <div className="pr-4">
                            <p className="font-medium text-gray-800">{t('language')}</p>
                            <p className="text-[10px] md:text-xs text-gray-500">Select your preferred UI language.</p>
                        </div>
                        <select
                            className="border rounded-lg px-3 py-1.5 md:px-4 md:py-2 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            <option value="en">{t('english')}</option>
                            <option value="si">{t('sinhala')}</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between pt-5 border-t border-gray-100 mt-5">
                        <div className="pr-4">
                            <p className="font-medium text-gray-800">{t('combinedMode')}</p>
                            <p className="text-[10px] md:text-xs text-gray-500">{t('combinedModeDesc')}</p>
                        </div>
                        <button
                            onClick={toggleCombinedLogging}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${combinedLoggingMode ? 'bg-emerald-600' : 'bg-gray-200'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${combinedLoggingMode ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-800">{t('activity')} Rates</h3>
                </div>

                {status.message && (
                    <div className={`mx-5 mt-4 p-3 rounded-lg text-sm ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {status.message}
                    </div>
                )}

                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3">{t('activity')} Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Default {t('rate')} (Rs)</th>
                                <th className="px-4 py-3 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {activities.map((activity) => (
                                <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                        {t(activity.name.toLowerCase()) !== activity.name.toLowerCase() ? t(activity.name.toLowerCase()) : activity.name}
                                    </td>
                                    <td className="px-4 py-3 capitalize text-gray-500">
                                        {t(activity.type.toLowerCase()) !== activity.type.toLowerCase() ? t(activity.type.toLowerCase()) : activity.type}
                                    </td>
                                    <td className="px-4 py-3 text-gray-800">
                                        {editingId === activity.id ? (
                                            <input
                                                type="number"
                                                className="border rounded px-2 py-1 w-24"
                                                value={editForm.default_rate}
                                                onChange={(e) => setEditForm({ ...editForm, default_rate: e.target.value })}
                                            />
                                        ) : activity.default_rate ? `Rs. ${activity.default_rate.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {editingId === activity.id ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleSave(activity.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                    <Check size={18} />
                                                </button>
                                                <button onClick={handleCancel} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleEditClick(activity)} className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-gray-100 rounded">
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Settings;
