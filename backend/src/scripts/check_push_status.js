require('dotenv').config();
const pool = require('../config/db');

async function check() {
    try {
        console.log('--- VAPID Keys ---');
        console.log('Public Key exists:', !!process.env.VAPID_PUBLIC_KEY);
        console.log('Private Key exists:', !!process.env.VAPID_PRIVATE_KEY);

        console.log('\n--- Database ---');
        const users = await pool.query('SELECT count(*) FROM users');
        console.log('Users count:', users.rows[0].count);

        const subs = await pool.query('SELECT count(*) FROM push_subscriptions');
        console.log('Push Subscriptions count:', subs.rows[0].count);

        if (subs.rows[0].count > 0) {
            const subDetails = await pool.query('SELECT user_id, endpoint FROM push_subscriptions LIMIT 5');
            console.log('Sample Subscriptions:', subDetails.rows);
        }

        const collabs = await pool.query('SELECT count(*) FROM collaborators');
        console.log('Collaborators count:', collabs.rows[0].count);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

check();