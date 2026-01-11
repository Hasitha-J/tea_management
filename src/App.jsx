import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import IncomeForm from './pages/IncomeForm';
import ExpenseForm from './pages/ExpenseForm';
import Settings from './pages/Settings';
import History from './pages/History';
import Reports from './pages/Reports';
import LogPortal from './pages/LogPortal';
import MoreMenu from './pages/MoreMenu';
import Collectors from './pages/Collectors';
import CombinedLogForm from './pages/CombinedLogForm';

import { LanguageProvider, useLanguage } from './LanguageContext';
import { App as CapApp } from '@capacitor/app';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationService } from './NotificationService';

const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const setupListener = async () => {
      const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
        if (location.pathname !== '/') {
          navigate(-1);
        } else {
          CapApp.exitApp();
        }
      });
      return listener;
    };

    const listenerPromise = setupListener();

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, [location, navigate]);

  return null;
};

const NotificationHandler = () => {
  const { language } = useLanguage();

  useEffect(() => {
    NotificationService.scheduleDailyReminder(language);
  }, [language]);

  return null;
};

const AppRoutes = () => {
  const { combinedLoggingMode } = useLanguage();
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="income" element={combinedLoggingMode ? <CombinedLogForm /> : <IncomeForm />} />
        <Route path="expenses" element={<ExpenseForm />} />
        <Route path="history" element={<History />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reports" element={<Reports />} />
        <Route path="log" element={<LogPortal />} />
        <Route path="more" element={<MoreMenu />} />
        <Route path="collectors" element={<Collectors />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <LanguageProvider>
      <NotificationHandler />
      <HashRouter>
        <BackButtonHandler />
        <AppRoutes />
      </HashRouter>
    </LanguageProvider>
  );
}

export default App;
