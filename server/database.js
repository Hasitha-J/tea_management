const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key must be provided in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Log initialization
console.log('Supabase client initialized with URL:', supabaseUrl);

function initDb() {
  console.log('Database connected via Supabase Client.');
}

module.exports = { db: supabase, initDb };
