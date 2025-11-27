require('dotenv').config();
const pool = require('./src/config/db');

const checkSubscriptions = async () => {
    try {
        const res = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', ['7ceaa8ed-81bd-4d66-b2e2-6d32c22554c1']);
        console.log('Subscriptions:', res.rows);
        console.log('Count:', res.rows.length);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
};

checkSubscriptions();