import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FilePenLine, History, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const BottomNav = () => {
    const { t } = useLanguage();

    const navItems = [
        { to: '/', label: t('dashboard'), icon: <LayoutDashboard size={22} /> },
        { to: '/log', label: t('log'), icon: <FilePenLine size={22} /> },
        { to: '/history', label: t('history'), icon: <History size={22} /> },
        { to: '/more', label: t('more'), icon: <MoreHorizontal size={22} /> },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center px-2 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        `flex flex-col items-center space-y-1 transition-colors duration-200 ${isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                        }`
                    }
                >
                    {item.icon}
                    <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );
};

export default BottomNav;
