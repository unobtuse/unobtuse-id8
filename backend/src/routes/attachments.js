const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload attachment
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { ideaId, replyId } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Verify access to idea
    const accessCheck = await pool.query(
      `SELECT i.id FROM ideas i
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE i.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [ideaId, req.user.id]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Generate unique key
    const ext = file.originalname.split('.').pop();
    const key = `${ideaId}/${uuidv4()}.${ext}`;
    
    // Upload to S3
    const fileUrl = await uploadToS3(file, key);
    
    // Save to database
    const result = await pool.query(
      `INSERT INTO attachments (idea_id, reply_id, user_id, file_name, file_url, file_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ideaId, replyId || null, req.user.id, file.originalname, fileUrl, file.mimetype, file.size]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get attachments for an idea
router.get('/idea/:ideaId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as uploader_name
       FROM attachments a
       JOIN users u ON a.user_id = u.id
       WHERE a.idea_id = $1
       ORDER BY a.created_at DESC`,
      [req.params.ideaId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Delete attachment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Get attachment info
    const attachment = await pool.query(
      `SELECT * FROM attachments WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (attachment.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found or not authorized' });
    }
    
    // Delete from S3
    await deleteFromS3(attachment.rows[0].file_url);
    
    // Delete from database
    await pool.query(`DELETE FROM attachments WHERE id = $1`, [req.params.id]);
    
    res.json({ message: 'Attachment deleted', id: req.params.id });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

module.exports = router;
