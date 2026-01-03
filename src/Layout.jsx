import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

const Layout = () => {
    return (
        <div className="flex flex-col md:flex-row min-h-[100dvh] bg-gray-50 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 pt-[env(safe-area-inset-top)]">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
            <BottomNav />
        </div>
    );
};

export default Layout;
