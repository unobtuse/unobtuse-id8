const express = require('express');
const pool = require('../config/db');
const { deleteFromS3 } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');
const { notifyThreadUpdate } = require('../config/push');
const { emitToIdea, emitToAll } = require('../config/socket');

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
    
    // Content can be empty if user is just attaching a file
    
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

    // Get idea title for notification
    const ideaResult = await pool.query('SELECT title FROM ideas WHERE id = $1', [ideaId]);
    const ideaTitle = ideaResult.rows[0]?.title || 'an idea';
    
    // Send push notifications to other participants
    notifyThreadUpdate(
      ideaId,
      req.user.id,
      'New reply in ' + ideaTitle,
      fullReply.rows[0].author_name + ': ' + (content || 'shared an attachment')
    );
    
    // Emit socket event for real-time update
    emitToIdea(ideaId, 'reply:created', fullReply.rows[0]);
    emitToAll('ideas:updated', { ideaId });
    
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
    // First check if user owns this reply
    const replyCheck = await pool.query(
      `SELECT id FROM idea_replies WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (replyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Reply not found or not authorized' });
    }
    
    // Get all attachments for this reply to delete from S3
    const attachments = await pool.query(
      `SELECT file_url FROM attachments WHERE reply_id = $1`,
      [req.params.id]
    );
    
    // Delete files from S3
    for (const att of attachments.rows) {
      try {
        await deleteFromS3(att.file_url);
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
      }
    }
    
    // Delete attachments from database (could also rely on CASCADE)
    await pool.query(`DELETE FROM attachments WHERE reply_id = $1`, [req.params.id]);
    
    // Get the idea_id before deleting
    const replyData = await pool.query(
      `SELECT idea_id FROM idea_replies WHERE id = $1`,
      [req.params.id]
    );
    const ideaId = replyData.rows[0]?.idea_id;
    
    // Delete the reply
    const result = await pool.query(
      `DELETE FROM idea_replies WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    
    // Emit socket event for real-time update
    if (ideaId) {
      emitToIdea(ideaId, 'reply:deleted', { id: result.rows[0].id });
    }
    
    res.json({ message: 'Reply deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete reply error:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

module.exports = router;
