import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import IncomeForm from './pages/IncomeForm';
import ExpenseForm from './pages/ExpenseForm';
import Settings from './pages/Settings';
import History from './pages/History';
import Reports from './pages/Reports';

import { LanguageProvider } from './LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="income" element={<IncomeForm />} />
            <Route path="expenses" element={<ExpenseForm />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </HashRouter>
    </LanguageProvider>
  );
}

export default App;
