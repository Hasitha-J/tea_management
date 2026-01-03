import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, Settings, ChevronRight, Share2, Info } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const MoreMenu = () => {
    const { t } = useLanguage();

    const menuItems = [
        {
            to: '/reports',
            title: t('reports'),
            desc: 'Generate & export PDF reports',
            icon: <FileText size={24} className="text-blue-500" />,
            bg: 'bg-blue-50'
        },
        {
            to: '/settings',
            title: t('settings'),
            desc: 'App language & configurations',
            icon: <Settings size={24} className="text-gray-600" />,
            bg: 'bg-gray-100'
        }
    ];

    return (
        <div className="space-y-6 md:space-y-8 pb-32">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{t('more')}</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">Additional tools and configurations.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {menuItems.map((item, idx) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={`flex items-center justify-between p-5 hover:bg-gray-50 transition-colors ${idx !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${item.bg}`}>
                                {item.icon}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">{item.title}</h3>
                                <p className="text-xs text-gray-500">{item.desc}</p>
                            </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-300" />
                    </NavLink>
                ))}
            </div>

            {/* Extra Info Section */}
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4">
                <Info className="text-emerald-500 shrink-0" size={24} />
                <div>
                    <h4 className="font-bold text-emerald-800 text-sm">TeaEstate Pro v1.1.0</h4>
                    <p className="text-xs text-emerald-600 mt-1 line-height-relaxed">
                        Optimized for mobile use. For support or feedback, please contact the developer.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MoreMenu;
