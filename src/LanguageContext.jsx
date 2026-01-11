import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Initial language from localStorage or default to 'en'
    const [language, setLanguage] = useState(localStorage.getItem('appLanguage') || 'en');
    const [combinedLoggingMode, setCombinedLoggingMode] = useState(localStorage.getItem('combinedLoggingMode') === 'true');

    useEffect(() => {
        localStorage.setItem('appLanguage', language);
    }, [language]);

    useEffect(() => {
        localStorage.setItem('combinedLoggingMode', combinedLoggingMode);
    }, [combinedLoggingMode]);

    const toggleCombinedLogging = () => setCombinedLoggingMode(prev => !prev);

    const t = (key) => {
        if (!key) return key === 0 ? '0' : '';
        const sKey = String(key).trim();

        // 1. Try exact match
        if (translations[language][sKey]) return translations[language][sKey];

        // 2. Try lowercase match
        const lowerKey = sKey.toLowerCase();
        if (translations[language][lowerKey]) return translations[language][lowerKey];

        // 3. Fallback: replace underscores with spaces and return
        const formatted = sKey.replace(/_/g, ' ');
        return translations[language][formatted.toLowerCase()] || formatted;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, combinedLoggingMode, toggleCombinedLogging, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
