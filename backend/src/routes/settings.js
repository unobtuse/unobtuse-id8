const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// Get user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      // Create default settings
      const newSettings = await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
      return res.json(newSettings.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update theme
router.patch('/theme', authenticateToken, async (req, res) => {
  try {
    const { theme } = req.body;
    
    if (!['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme' });
    }
    
    const result = await pool.query(
      `UPDATE user_settings SET theme = $1, updated_at = NOW()
       WHERE user_id = $2 RETURNING *`,
      [theme, req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Upload background
router.post('/background', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    
    if (!isVideo && !isImage) {
      return res.status(400).json({ error: 'File must be an image or video' });
    }
    
    // Get current settings to delete old background
    const current = await pool.query(
      `SELECT background_url FROM user_settings WHERE user_id = $1`,
      [req.user.id]
    );
    
    if (current.rows.length > 0 && current.rows[0].background_url) {
      try {
        await deleteFromS3(current.rows[0].background_url);
      } catch (e) {
        console.log('Could not delete old background:', e.message);
      }
    }
    
    // Upload new background
    const ext = file.originalname.split('.').pop();
    const key = `backgrounds/${req.user.id}/${uuidv4()}.${ext}`;
    const fileUrl = await uploadToS3(file, key);
    
    // Update settings
    const result = await pool.query(
      `UPDATE user_settings SET background_url = $1, background_type = $2, updated_at = NOW()
       WHERE user_id = $3 RETURNING *`,
      [fileUrl, isVideo ? 'video' : 'image', req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload background error:', error);
    res.status(500).json({ error: 'Failed to upload background' });
  }
});

// Remove background
router.delete('/background', authenticateToken, async (req, res) => {
  try {
    const current = await pool.query(
      `SELECT background_url FROM user_settings WHERE user_id = $1`,
      [req.user.id]
    );
    
    if (current.rows.length > 0 && current.rows[0].background_url) {
      await deleteFromS3(current.rows[0].background_url);
    }
    
    const result = await pool.query(
      `UPDATE user_settings SET background_url = NULL, background_type = 'image', updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Remove background error:', error);
    res.status(500).json({ error: 'Failed to remove background' });
  }
});

module.exports = router;
