const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for stickers
});

// Create stickers table if not exists
const initStickersTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100),
        file_url TEXT NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stickers_user ON stickers(user_id)`);
  } catch (error) {
    console.error('Failed to create stickers table:', error);
  }
};
initStickersTable();

// Get user's stickers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM stickers WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get stickers error:', error);
    res.status(500).json({ error: 'Failed to fetch stickers' });
  }
});

// Upload sticker
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { name } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP, MP4, WebM' });
    }
    
    // Check sticker limit (max 50 per user)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM stickers WHERE user_id = $1`,
      [req.user.id]
    );
    if (parseInt(countResult.rows[0].count) >= 50) {
      return res.status(400).json({ error: 'Sticker limit reached (50 max)' });
    }
    
    // Upload to S3
    const ext = file.originalname.split('.').pop();
    const key = `stickers/${req.user.id}/${uuidv4()}.${ext}`;
    const fileUrl = await uploadToS3(file, key);
    
    // Save to database
    const result = await pool.query(
      `INSERT INTO stickers (user_id, name, file_url, file_type) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, name || file.originalname, fileUrl, file.mimetype]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload sticker error:', error);
    res.status(500).json({ error: 'Failed to upload sticker' });
  }
});

// Delete sticker
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Get sticker info
    const sticker = await pool.query(
      `SELECT * FROM stickers WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (sticker.rows.length === 0) {
      return res.status(404).json({ error: 'Sticker not found' });
    }
    
    // Delete from S3
    try {
      await deleteFromS3(sticker.rows[0].file_url);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
    }
    
    // Delete from database
    await pool.query(`DELETE FROM stickers WHERE id = $1`, [req.params.id]);
    
    res.json({ message: 'Sticker deleted', id: req.params.id });
  } catch (error) {
    console.error('Delete sticker error:', error);
    res.status(500).json({ error: 'Failed to delete sticker' });
  }
});

module.exports = router;
