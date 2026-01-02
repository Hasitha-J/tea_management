import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import IncomeForm from './pages/IncomeForm';
import ExpenseForm from './pages/ExpenseForm';
import Settings from './pages/Settings';
import History from './pages/History';

import { LanguageProvider } from './LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="income" element={<IncomeForm />} />
            <Route path="expenses" element={<ExpenseForm />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
