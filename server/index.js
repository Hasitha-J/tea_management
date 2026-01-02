const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Database
initDb();

// --- API Routes ---

// Get Master Data
app.get('/api/fields', async (req, res) => {
    try {
        const { data, error } = await db.from('fields').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/activities', async (req, res) => {
    try {
        const { data, error } = await db.from('activity_master').select('*').order('id');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/activities/:id', async (req, res) => {
    const { id } = req.params;
    const { name, default_rate } = req.body;

    try {
        const { data, error } = await db.from('activity_master')
            .update({ name, default_rate })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ message: 'Activity updated', data: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const { data, error } = await db.from('inventory_master').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Transactions (Expenses)
app.post('/api/transactions', async (req, res) => {
    const { date, field_id, type, category_id, description, quantity, hours_worked, rate, total_amount } = req.body;

    try {
        const { data, error } = await db.from('transactions')
            .insert([{ date, field_id, type, category_id, description, quantity, hours_worked, rate, total_amount }])
            .select();

        if (error) throw error;
        res.json({ id: data[0].id, message: 'Transaction saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const { data, error } = await db.from('transactions')
            .select('*, fields(name)')
            .order('date', { ascending: false });

        if (error) throw error;

        // Flatten the relationship for frontend compatibility
        const flattened = data.map(t => ({
            ...t,
            field_name: t.fields?.name
        }));

        res.json(flattened);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Harvests (Income)
app.post('/api/harvests', async (req, res) => {
    const { date, field_id, crop_type, weight, rate, total_amount } = req.body;

    try {
        const { data, error } = await db.from('harvests')
            .insert([{ date, field_id, crop_type, weight, rate, total_amount }])
            .select();

        if (error) throw error;
        res.json({ id: data[0].id, message: 'Harvest saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/harvests', async (req, res) => {
    try {
        const { data, error } = await db.from('harvests')
            .select('*, fields(name)')
            .order('date', { ascending: false });

        if (error) throw error;

        const flattened = data.map(h => ({
            ...h,
            field_name: h.fields?.name
        }));

        res.json(flattened);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update/Delete Transactions
app.put('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    const { date, field_id, type, category_id, description, quantity, hours_worked, rate, total_amount } = req.body;
    try {
        const { data, error } = await db.from('transactions')
            .update({ date, field_id, type, category_id, description, quantity, hours_worked, rate, total_amount })
            .eq('id', id)
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await db.from('transactions').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update/Delete Harvests
app.put('/api/harvests/:id', async (req, res) => {
    const { id } = req.params;
    const { date, field_id, crop_type, weight, rate, total_amount } = req.body;
    try {
        const { data, error } = await db.from('harvests')
            .update({ date, field_id, crop_type, weight, rate, total_amount })
            .eq('id', id)
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/harvests/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await db.from('harvests').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard / Profit Calculation
app.get('/api/dashboard', async (req, res) => {
    try {
        // Fetch all data and aggregate in memory (Supabase doesn't natively support complex GROUP BY in simple query builder without Views/RPC)
        // For a small app, fetching all is fine. For larger, we should create a DB View.
        // Let's assume we fetch all and calculate.

        const [harvestsRes, transactionsRes, fieldsRes] = await Promise.all([
            db.from('harvests').select('field_id, total_amount'),
            db.from('transactions').select('field_id, total_amount'),
            db.from('fields').select('*')
        ]);

        if (harvestsRes.error) throw harvestsRes.error;
        if (transactionsRes.error) throw transactionsRes.error;
        if (fieldsRes.error) throw fieldsRes.error;

        const fields = fieldsRes.data;
        const harvests = harvestsRes.data;
        const transactions = transactionsRes.data;

        const dashboardData = fields.map(field => {
            const fieldIncome = harvests
                .filter(h => h.field_id === field.id)
                .reduce((sum, h) => sum + (h.total_amount || 0), 0);

            const fieldExpense = transactions
                .filter(t => t.field_id === field.id)
                .reduce((sum, t) => sum + (t.total_amount || 0), 0);

            return {
                field_id: field.id,
                field_name: field.name,
                total_income: fieldIncome,
                total_expense: fieldExpense,
                net_profit: fieldIncome - fieldExpense
            };
        });

        // Calculate Totals
        const totalIncome = dashboardData.reduce((acc, curr) => acc + curr.total_income, 0);
        const totalExpense = dashboardData.reduce((acc, curr) => acc + curr.total_expense, 0);
        const totalProfit = totalIncome - totalExpense;

        res.json({
            fields: dashboardData,
            summary: {
                total_income: totalIncome,
                total_expense: totalExpense,
                total_profit: totalProfit
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
