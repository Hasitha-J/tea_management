import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Loader2, Share2, ChevronRight } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const Reports = () => {
    const { t, language } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);

    const setPreset = (type) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                break;
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchReportData();
        }
    }, [startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const [harvestsRes, transactionsRes, fieldsRes] = await Promise.all([
                supabase.from('harvests')
                    .select('*, fields(name)')
                    .gte('date', startDate)
                    .lte('date', endDate),
                supabase.from('transactions')
                    .select('*, fields(name)')
                    .gte('date', startDate)
                    .lte('date', endDate),
                supabase.from('fields').select('*')
            ]);

            if (harvestsRes.error) throw harvestsRes.error;
            if (transactionsRes.error) throw transactionsRes.error;

            const fields = fieldsRes.data;
            const harvests = harvestsRes.data;
            const transactions = transactionsRes.data;

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

            const totalIncome = fieldStats.reduce((sum, f) => sum + f.income, 0);
            const totalExpense = fieldStats.reduce((sum, f) => sum + f.expense, 0);

            setReportData({
                fieldStats,
                totalIncome,
                totalExpense,
                totalProfit: totalIncome - totalExpense,
                harvests,
                transactions
            });
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = async () => {
        if (!reportData) return;
        setGenerating(true);

        try {
            const doc = new jsPDF();
            const isSi = language === 'si';

            // PDF Styling
            doc.setTextColor(34, 197, 94); // emerald-500
            doc.setFontSize(22);
            // Use English labels for PDF content to avoid encoding issues with Sinhala in jspdf
            doc.text("Estate Financial Report", 14, 22);

            doc.setTextColor(107, 114, 128); // gray-500
            doc.setFontSize(10);
            doc.text(`Period: ${startDate} - ${endDate}`, 14, 30);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 35);

            // Summary Table
            doc.autoTable({
                startY: 45,
                head: [["Field", "Income", "Expense", "Net Profit"]],
                body: reportData.fieldStats.map(f => [
                    f.name || "Unnamed Field",
                    `Rs. ${f.income.toLocaleString()}`,
                    `Rs. ${f.expense.toLocaleString()}`,
                    `Rs. ${f.profit.toLocaleString()}`
                ]),
                foot: [["Total", `Rs. ${reportData.totalIncome.toLocaleString()}`, `Rs. ${reportData.totalExpense.toLocaleString()}`, `Rs. ${reportData.totalProfit.toLocaleString()}`]],
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] }
            });

            // Detailed Transactions if wanted?
            doc.addPage();
            doc.text("Transaction Details", 14, 20);

            const allActions = [
                ...reportData.harvests.map(h => ({ date: h.date, type: "Income", field: h.fields?.name, details: h.crop_type, amount: h.total_amount })),
                ...reportData.transactions.map(t => ({ date: t.date, type: "Expense", field: t.fields?.name, details: t.description || t.expense_type, amount: t.total_amount }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            doc.autoTable({
                startY: 25,
                head: [["Date", "Type", "Field", "Details", "Total"]],
                body: allActions.map(a => [
                    a.date,
                    a.type,
                    a.field || "General",
                    a.details || "N/A",
                    `Rs. ${a.amount.toLocaleString()}`
                ]),
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] }
            });

            const pdfBase64 = doc.output('datauristring').split(',')[1];
            const fileName = `Estate_Report_${startDate}_${endDate}.pdf`;

            if (Capacitor.isNativePlatform()) {
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: pdfBase64,
                    directory: Directory.Cache
                });

                await Share.share({
                    title: 'Estate Report',
                    text: `Financial report for ${startDate} to ${endDate}`,
                    url: savedFile.uri,
                    dialogTitle: 'Share Report'
                });
            } else {
                doc.save(fileName);
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert(t('error'));
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 pb-32">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{t('reports')}</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">{t('reportInfo')}</p>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                    onClick={() => setPreset('month')}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-500 transition-colors group"
                >
                    <span className="font-medium text-gray-700">{t('thisMonth')}</span>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-emerald-500" />
                </button>
                <button
                    onClick={() => setPreset('quarter')}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-500 transition-colors group"
                >
                    <span className="font-medium text-gray-700">{t('last3Months')}</span>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-emerald-500" />
                </button>
                <button
                    onClick={() => setPreset('year')}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-500 transition-colors group"
                >
                    <span className="font-medium text-gray-700">{t('thisYear')}</span>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-emerald-500" />
                </button>
            </div>

            {/* Custom Range */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Calendar size={18} className="text-emerald-500" />
                    {t('customRange')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase">{t('startDate')}</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase">{t('endDate')}</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Report Preview */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
                    <p className="text-gray-500 text-sm">Fetching estate data...</p>
                </div>
            ) : reportData ? (
                <div className="space-y-6">
                    <div className="bg-emerald-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
                        <FileText size={80} className="absolute -right-4 -bottom-4 opacity-10" />
                        <div className="relative z-10">
                            <h4 className="text-emerald-100 text-sm font-medium uppercase tracking-wider">{t('netProfit')}</h4>
                            <p className="text-3xl font-bold mt-1">Rs. {reportData.totalProfit.toLocaleString()}</p>
                            <div className="flex gap-4 mt-4 text-sm opacity-90">
                                <div>
                                    <span className="block text-emerald-200 text-xs">{t('income')}</span>
                                    <span className="font-bold">Rs. {reportData.totalIncome.toLocaleString()}</span>
                                </div>
                                <div className="w-px h-8 bg-white/20" />
                                <div>
                                    <span className="block text-emerald-200 text-xs">{t('expense')}</span>
                                    <span className="font-bold">Rs. {reportData.totalExpense.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={generatePDF}
                        disabled={generating}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
                        {t('exportPdf')}
                    </button>
                </div>
            ) : (startDate && endDate) ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    {t('noDataForPeriod')}
                </div>
            ) : null}
        </div>
    );
};

export default Reports;
