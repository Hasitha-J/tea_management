import React, { useState, useEffect } from 'react';
import {
    FileText,
    Calendar,
    Loader2,
    Share2,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    BarChart3,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Use default import for functional calls

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

// -------------------------------------------------
// Helper to make any string safe for jsPDF
// -------------------------------------------------
const safeText = (text) => {
    if (typeof text !== 'string') return '-';
    // Replaces common non-Latin characters if needed, or just returns text
    // if a Unicode font is loaded.
    return text.trim() || '-';
};

const Reports = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);

    // -------------------------------------------------
    // Initialize default date range on mount
    // -------------------------------------------------
    useEffect(() => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const fmt = (d) => d.toISOString().split('T')[0];
        setStartDate(fmt(start));
        setEndDate(fmt(today));
    }, []);

    const setPreset = (preset) => {
        const today = new Date();
        let start;
        let end = today;
        switch (preset) {
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                break;
            default:
                start = today;
        }
        const fmt = (d) => d.toISOString().split('T')[0];
        setStartDate(fmt(start));
        setEndDate(fmt(end));
    };

    // -------------------------------------------------
    // Data fetching
    // -------------------------------------------------
    const fetchReportData = async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        try {
            const [fieldsRes, harvestsRes, transactionsRes, ratesRes, advancesRes, collectorsRes] = await Promise.all([
                supabase.from('fields').select('*'),
                supabase.from('harvests').select('*').gte('date', startDate).lte('date', endDate),
                supabase.from('transactions').select('*').gte('date', startDate).lte('date', endDate),
                supabase.from('collector_rates').select('*'),
                supabase.from('collector_advances').select('*').gte('date', startDate).lte('date', endDate),
                supabase.from('tea_collectors').select('*')
            ]);

            if (fieldsRes.error) throw fieldsRes.error;
            if (harvestsRes.error) throw harvestsRes.error;
            if (transactionsRes.error) throw transactionsRes.error;
            if (ratesRes.error) throw ratesRes.error;
            if (advancesRes.error) throw advancesRes.error;
            if (collectorsRes.error) throw collectorsRes.error;

            const fields = fieldsRes.data;
            const transactions = transactionsRes.data;
            const rates = ratesRes.data || [];
            const advances = advancesRes.data || [];
            const collectors = collectorsRes.data || [];

            // Process harvests to fill in missing rates for tea
            const harvests = (harvestsRes.data || []).map(h => {
                let amount = h.total_amount || 0;
                let rateValue = h.rate;

                if (h.crop_type === 'tea' && (!h.rate || h.rate === 0)) {
                    const hDate = new Date(h.date);
                    const month = hDate.getMonth() + 1;
                    const year = hDate.getFullYear();
                    const monthlyRate = rates.find(r => r.collector_id === h.collector_id && r.month === month && r.year === year);
                    if (monthlyRate) {
                        rateValue = monthlyRate.rate;
                        amount = (h.weight || 0) * monthlyRate.rate;
                    }
                }
                return { ...h, rate: rateValue, total_amount: amount };
            });

            // Collector Summary
            const collectorSummary = collectors.map(c => {
                const totalWeight = harvests.filter(h => h.collector_id === c.id).reduce((s, h) => s + (h.weight || 0), 0);
                const totalRevenue = harvests.filter(h => h.collector_id === c.id).reduce((s, h) => s + (h.total_amount || 0), 0);
                const totalAdvances = advances.filter(a => a.collector_id === c.id).reduce((s, a) => s + (a.amount || 0), 0);
                return {
                    name: c.name,
                    weight: totalWeight,
                    revenue: totalRevenue,
                    advances: totalAdvances,
                    balance: totalRevenue - totalAdvances
                };
            }).filter(cs => cs.weight > 0 || cs.advances > 0);

            // Aggregates per field
            const fieldStats = fields.map(field => {
                const income = harvests
                    .filter(h => h.field_id === field.id)
                    .reduce((sum, h) => sum + (h.total_amount || 0), 0);
                const expense = transactions
                    .filter(t => t.field_id === field.id)
                    .reduce((sum, t) => sum + (t.total_amount || 0), 0);
                return {
                    name: field.name,
                    income,
                    expense,
                    profit: income - expense
                };
            });

            // Crop performance
            const crops = harvests.reduce((arr, h) => {
                const existing = arr.find(c => c.type === h.crop_type);
                if (existing) {
                    existing.weight += (h.weight || 0);
                    existing.revenue += (h.total_amount || 0);
                } else {
                    arr.push({
                        type: h.crop_type || 'Unknown',
                        weight: h.weight || 0,
                        revenue: h.total_amount || 0
                    });
                }
                return arr;
            }, []);

            // Expense breakdown
            const expenseTypes = [
                { id: 'labor_cost', label: 'Labor' },
                { id: 'goods_cost', label: 'Goods/Supplies' },
                { id: 'overhead', label: 'Overheads' },
                { id: 'owner_labor', label: 'Owner Labor' }
            ].map(type => {
                const amount = transactions
                    .filter(t => t.type === type.id)
                    .reduce((sum, t) => sum + (t.total_amount || 0), 0);
                return { ...type, amount };
            }).filter(e => e.amount > 0);

            // Combined activities for full log
            const combinedLogs = [
                ...harvests.map(h => ({
                    date: h.date,
                    type: 'Income',
                    field: fields.find(f => f.id === h.field_id)?.name || '-',
                    details: h.crop_type === 'tea' ? `${h.crop_type} (${collectors.find(c => c.id === h.collector_id)?.name || '?'})` : h.crop_type,
                    amount: h.total_amount
                })),
                ...transactions.map(t => ({
                    date: t.date,
                    type: 'Expense',
                    field: fields.find(f => f.id === t.field_id)?.name || '-',
                    details: t.description || t.type,
                    amount: t.total_amount
                })),
                ...advances.map(a => ({
                    date: a.date,
                    type: 'Advance',
                    field: '-',
                    details: `Advance: ${collectors.find(c => c.id === a.collector_id)?.name || '?'}`,
                    amount: a.amount
                }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            setReportData({
                fieldStats,
                totalIncome: fieldStats.reduce((s, f) => s + f.income, 0),
                totalExpense: fieldStats.reduce((s, f) => s + f.expense, 0),
                crops,
                expenseTypes,
                collectorSummary,
                transactions: combinedLogs,
                harvestsCount: harvests.length
            });
        } catch (error) {
            console.error('Report Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate]);

    // -------------------------------------------------
    // PDF generation (Stable Version)
    // -------------------------------------------------
    const generatePDF = async () => {
        if (!reportData) return;
        setGenerating(true);
        try {
            const doc = new jsPDF();

            // Standard font to avoid cmap issues unless we have a vetted font file
            doc.setFont("helvetica", "normal");

            // Header
            doc.setTextColor(34, 197, 94);
            doc.setFontSize(22);
            doc.text("ESTATE FINANCIAL REPORT", 14, 20);

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(10);
            const periodText = `Period: ${startDate} to ${endDate}`;
            const genDate = `Generated: ${new Date().toLocaleString()}`;
            doc.text(periodText, 14, 28);
            doc.text(genDate, 14, 33);

            // 1. Executive Summary Table
            autoTable(doc, {
                startY: 40,
                head: [['Total Income', 'Total Expense', 'Net Profit']],
                body: [[
                    `Rs. ${reportData.totalIncome.toLocaleString()}`,
                    `Rs. ${reportData.totalExpense.toLocaleString()}`,
                    `Rs. ${(reportData.totalIncome - reportData.totalExpense).toLocaleString()}`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [5, 150, 105], halign: 'center' },
                bodyStyles: { fontSize: 12, fontStyle: 'bold', halign: 'center' }
            });

            // 2. Field-wise Table
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(14);
            doc.text("Field-wise Performance", 14, doc.lastAutoTable.finalY + 12);
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 16,
                head: [['Field Name', 'Income', 'Expense', 'Profit']],
                body: reportData.fieldStats.map(f => [
                    safeText(f.name),
                    `Rs. ${f.income.toLocaleString()}`,
                    `Rs. ${f.expense.toLocaleString()}`,
                    `Rs. ${f.profit.toLocaleString()}`
                ]),
                headStyles: { fillColor: [16, 185, 129] }
            });

            // 3. Crop Table
            doc.setFontSize(14);
            doc.text("Production Summary", 14, doc.lastAutoTable.finalY + 12);
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 16,
                head: [['Crop Type', 'Total Weight', 'Revenue']],
                body: reportData.crops.map(c => [
                    safeText(c.type?.toUpperCase()),
                    `${c.weight.toFixed(2)} kg`,
                    `Rs. ${c.revenue.toLocaleString()}`
                ]),
                headStyles: { fillColor: [59, 130, 246] }
            });

            // 4. Collector Summary Table (New)
            if (reportData.collectorSummary && reportData.collectorSummary.length > 0) {
                doc.setFontSize(14);
                doc.text("Collector Summary & Advances", 14, doc.lastAutoTable.finalY + 12);
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 16,
                    head: [['Collector', 'Weight', 'Revenue', 'Advances', 'Balance']],
                    body: reportData.collectorSummary.map(cs => [
                        safeText(cs.name),
                        `${cs.weight.toFixed(2)} kg`,
                        `Rs. ${cs.revenue.toLocaleString()}`,
                        `Rs. ${cs.advances.toLocaleString()}`,
                        `Rs. ${cs.balance.toLocaleString()}`
                    ]),
                    headStyles: { fillColor: [245, 158, 11] } // Orange theme
                });
            }
            doc.addPage();
            doc.setFontSize(16);
            doc.text("Detailed Transaction Log", 14, 20);
            autoTable(doc, {
                startY: 25,
                head: [['Date', 'Type', 'Field', 'Details', 'Amount']],
                body: reportData.transactions.map(t => [
                    t.date,
                    t.type,
                    safeText(t.field),
                    safeText(t.details),
                    `Rs. ${t.amount.toLocaleString()}`
                ]),
                alternateRowStyles: { fillColor: [248, 250, 252] },
                headStyles: { fillColor: [100, 116, 139] }
            });

            const fileName = `Report_${startDate}_${endDate}.pdf`;

            if (Capacitor.isNativePlatform()) {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: pdfBase64,
                    directory: Directory.Cache
                });
                await Share.share({
                    title: 'Estate Report',
                    url: savedFile.uri
                });
            } else {
                // Web Download
                const pdfBlob = doc.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert("Error: Could not generate PDF. Please check data for special characters.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-6 pb-24 px-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mt-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{t('reports')}</h2>
                    <p className="text-sm text-gray-500">{t('reportInfo') || 'Generate and export estate reports'}</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <TrendingUp size={24} />
                </div>
            </div>

            {/* Range Presets */}
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setPreset('month')} className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-emerald-500 transition-colors">
                    {t('thisMonth') || 'This Month'}
                </button>
                <button onClick={() => setPreset('quarter')} className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-emerald-500 transition-colors">
                    {t('last3Months') || 'Last 3 Mo'}
                </button>
                <button onClick={() => setPreset('year')} className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-emerald-500 transition-colors">
                    {t('thisYear') || 'This Year'}
                </button>
            </div>

            {/* Custom Range */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('startDate')}</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm p-2 bg-gray-50 border border-gray-100 rounded-md outline-none" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('endDate')}</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full text-sm p-2 bg-gray-50 border border-gray-100 rounded-md outline-none" />
                </div>
            </div>

            {/* Content Preview */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
                    <p className="text-gray-400 text-sm">Calculating estate financials...</p>
                </div>
            ) : reportData ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {/* Performance Summary Card */}
                    <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
                        <TrendingUp size={100} className="absolute -right-4 -bottom-4 opacity-10" />
                        <h4 className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">{t('netProfit')}</h4>
                        <p className="text-3xl font-black mt-1">Rs. {(reportData.totalIncome - reportData.totalExpense).toLocaleString()}</p>

                        <div className="flex gap-6 mt-4">
                            <div>
                                <span className="block text-emerald-200 text-[10px] uppercase font-bold">Income</span>
                                <span className="text-lg font-bold">Rs. {reportData.totalIncome.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="block text-emerald-200 text-[10px] uppercase font-bold">Expenses</span>
                                <span className="text-lg font-bold">Rs. {reportData.totalExpense.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Records</span>
                            <p className="text-xl font-bold text-gray-800">{reportData.transactions.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Crops</span>
                            <p className="text-xl font-bold text-gray-800">{reportData.crops.length}</p>
                        </div>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={generatePDF}
                        disabled={generating}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
                        {t('exportPdf') || 'EXPORT PDF REPORT'}
                    </button>

                    <p className="text-[10px] text-gray-400 text-center px-4">
                        Includes full breakdown of weights, rates, and category-wise analysis.
                    </p>
                </div>
            ) : (startDate && endDate) && (
                <div className="py-20 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">No data found for this period.</p>
                </div>
            )}
        </div>
    );
};

export default Reports;
