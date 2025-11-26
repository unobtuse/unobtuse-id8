const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'id8',
  user: process.env.DB_USER || 'grocery_user',
  password: process.env.DB_PASSWORD || 'grocery_secure_password_change_me',
});

module.exports = pool;
