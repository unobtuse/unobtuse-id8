const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get replies for an idea
router.get('/idea/:ideaId', authenticateToken, async (req, res) => {
  try {
    // Check access to idea
    const accessCheck = await pool.query(
      `SELECT i.id FROM ideas i
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE i.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [req.params.ideaId, req.user.id]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await pool.query(
      `SELECT r.*, u.name as author_name, u.avatar_url as author_avatar,
       (SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_url', a.file_url, 'file_type', a.file_type))
        FROM attachments a WHERE a.reply_id = r.id) as attachments
       FROM idea_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.idea_id = $1
       ORDER BY r.created_at ASC`,
      [req.params.ideaId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// Create reply
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { ideaId, content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Check access to idea
    const accessCheck = await pool.query(
      `SELECT i.id FROM ideas i
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE i.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [ideaId, req.user.id]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await pool.query(
      `INSERT INTO idea_replies (idea_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [ideaId, req.user.id, content]
    );
    
    // Update idea's updated_at
    await pool.query(`UPDATE ideas SET updated_at = NOW() WHERE id = $1`, [ideaId]);
    
    // Get full reply with user info
    const fullReply = await pool.query(
      `SELECT r.*, u.name as author_name, u.avatar_url as author_avatar
       FROM idea_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [result.rows[0].id]
    );
    
    res.status(201).json(fullReply.rows[0]);
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

// Update reply
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    const result = await pool.query(
      `UPDATE idea_replies SET content = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [content, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reply not found or not authorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update reply error:', error);
    res.status(500).json({ error: 'Failed to update reply' });
  }
});

// Delete reply
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM idea_replies WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reply not found or not authorized' });
    }
    
    res.json({ message: 'Reply deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete reply error:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

module.exports = router;
