import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

const Layout = () => {
    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
            <BottomNav />
        </div>
    );
};

export default Layout;
