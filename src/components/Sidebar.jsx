import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FilePenLine, History, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const Sidebar = () => {
    const { t } = useLanguage();
    const navItems = [
        { to: '/', label: t('dashboard'), icon: <LayoutDashboard size={20} /> },
        { to: '/log', label: t('log'), icon: <FilePenLine size={20} /> },
        { to: '/history', label: t('history'), icon: <History size={20} /> },
        { to: '/more', label: t('more'), icon: <MoreHorizontal size={20} /> },
    ];

    return (
        <aside className="hidden md:flex w-64 bg-emerald-900 text-white min-h-screen flex-col shadow-xl">
            <div className="p-6 flex items-center space-x-3 border-b border-emerald-800">
                <h1 className="text-xl font-bold tracking-wide">TeaEstate<span className="text-emerald-400">Manager</span></h1>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-emerald-700 text-white shadow-md translate-x-1'
                                : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
                            }`
                        }
                    >
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t border-emerald-800 text-xs text-emerald-400 text-center">
                v1.0.0
            </div>
        </aside>
    );
};

export default Sidebar;
