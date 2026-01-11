import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sprout, HandCoins, ArrowRight, Plus } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const LogPortal = () => {
    const { t, combinedLoggingMode } = useLanguage();

    const portals = [
        {
            to: '/income',
            title: combinedLoggingMode ? `${t('logHarvest')} & ${t('assocExpenses')}` : t('logIncome'),
            desc: combinedLoggingMode ? t('combinedModeDesc') : t('logIncomeDesc'),
            icon: combinedLoggingMode ? (
                <div className="relative">
                    <Sprout size={32} className="text-emerald-500" />
                    <Plus size={16} className="absolute -bottom-1 -right-1 text-emerald-600 font-bold bg-white rounded-full border border-emerald-100" />
                </div>
            ) : <Sprout size={32} className="text-emerald-500" />,
            bg: 'bg-emerald-50',
            border: 'border-emerald-100'
        },
        {
            to: '/expenses',
            title: t('logExpenses'),
            desc: t('logExpensesDesc'),
            icon: <HandCoins size={32} className="text-orange-500" />,
            bg: 'bg-orange-50',
            border: 'border-orange-100'
        }
    ];

    return (
        <div className="space-y-6 md:space-y-8 pb-32">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{t('log')}</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">Record a new activity for your estate.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {portals.map((portal) => (
                    <NavLink
                        key={portal.to}
                        to={portal.to}
                        className={`flex items-center gap-6 p-6 rounded-2xl border ${portal.bg} ${portal.border} shadow-sm group transition-all active:scale-95`}
                    >
                        <div className="p-4 bg-white rounded-xl shadow-sm">
                            {portal.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-800">{portal.title}</h3>
                            <p className="text-sm text-gray-500">{portal.desc}</p>
                        </div>
                        <ArrowRight size={20} className="text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

export default LogPortal;
