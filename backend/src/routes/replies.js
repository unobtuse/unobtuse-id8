const express = require('express');
const pool = require('../config/db');
const { deleteFromS3 } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');
const { notifyThreadUpdate } = require('../config/push');
const { emitToIdea, emitToAll } = require('../config/socket');

const router = express.Router();

// Initialize tables
const initTables = async () => {
  try {
    // Read receipts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reply_reads (
        id SERIAL PRIMARY KEY,
        reply_id UUID NOT NULL REFERENCES idea_replies(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(reply_id, user_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reply_reads_reply ON reply_reads(reply_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reply_reads_user ON reply_reads(user_id)`);

    // Add parent_id column to idea_replies for threaded replies
    await pool.query(`
      ALTER TABLE idea_replies ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES idea_replies(id) ON DELETE CASCADE
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_replies_parent ON idea_replies(parent_id)`);

    // Reactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reply_reactions (
        id SERIAL PRIMARY KEY,
        reply_id UUID NOT NULL REFERENCES idea_replies(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(reply_id, user_id, emoji)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reactions_reply ON reply_reactions(reply_id)`);
  } catch (error) {
    console.error('Failed to initialize tables:', error);
  }
};
initTables();

// Get recent thread activity for user
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, i.title as idea_title, i.id as idea_id, 
              u.name as author_name, u.avatar_url as author_avatar,
              (SELECT MAX(rr.read_at) FROM reply_reads rr WHERE rr.reply_id = r.id AND rr.user_id = $1) as user_read_at
       FROM idea_replies r
       JOIN ideas i ON r.idea_id = i.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $1 AND c.status = 'accepted'
       WHERE (i.user_id = $1 OR c.user_id = $1)
         AND r.user_id != $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Mark replies as read
router.post('/read', authenticateToken, async (req, res) => {
  try {
    const { replyIds } = req.body;
    
    if (!replyIds || !Array.isArray(replyIds)) {
      return res.status(400).json({ error: 'replyIds array required' });
    }
    
    for (const replyId of replyIds) {
      await pool.query(
        `INSERT INTO reply_reads (reply_id, user_id) VALUES ($1, $2)
         ON CONFLICT (reply_id, user_id) DO UPDATE SET read_at = NOW()`,
        [replyId, req.user.id]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Get read receipts for replies
router.get('/reads/:ideaId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rr.reply_id, rr.read_at, u.id as user_id, u.name, u.avatar_url
       FROM reply_reads rr
       JOIN users u ON rr.user_id = u.id
       JOIN idea_replies r ON rr.reply_id = r.id
       WHERE r.idea_id = $1
       ORDER BY rr.read_at DESC`,
      [req.params.ideaId]
    );
    
    // Group by reply_id
    const readsByReply = {};
    for (const row of result.rows) {
      if (!readsByReply[row.reply_id]) {
        readsByReply[row.reply_id] = [];
      }
      readsByReply[row.reply_id].push({
        user_id: row.user_id,
        name: row.name,
        avatar_url: row.avatar_url,
        read_at: row.read_at
      });
    }
    
    res.json(readsByReply);
  } catch (error) {
    console.error('Get reads error:', error);
    res.status(500).json({ error: 'Failed to fetch read receipts' });
  }
});

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
       p.content as parent_content, pu.name as parent_author_name,
       (SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_url', a.file_url, 'file_type', a.file_type))
        FROM attachments a WHERE a.reply_id = r.id) as attachments,
       (SELECT json_agg(json_build_object('emoji', rr.emoji, 'user_id', rr.user_id, 'user_name', ru.name))
        FROM reply_reactions rr JOIN users ru ON rr.user_id = ru.id WHERE rr.reply_id = r.id) as reactions
       FROM idea_replies r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN idea_replies p ON r.parent_id = p.id
       LEFT JOIN users pu ON p.user_id = pu.id
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
    const { ideaId, content, parentId } = req.body;
    
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
      `INSERT INTO idea_replies (idea_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [ideaId, req.user.id, content, parentId || null]
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

// Add reaction to reply
router.post('/:id/reactions', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    const replyId = req.params.id;
    
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji required' });
    }
    
    // Check if user has access to the reply's idea
    const accessCheck = await pool.query(
      `SELECT r.idea_id FROM idea_replies r
       JOIN ideas i ON r.idea_id = i.id
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE r.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [replyId, req.user.id]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await pool.query(
      `INSERT INTO reply_reactions (reply_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (reply_id, user_id, emoji) DO NOTHING
       RETURNING *`,
      [replyId, req.user.id, emoji]
    );
    
    // Get all reactions for this reply
    const reactions = await pool.query(
      `SELECT rr.emoji, rr.user_id, u.name as user_name
       FROM reply_reactions rr
       JOIN users u ON rr.user_id = u.id
       WHERE rr.reply_id = $1`,
      [replyId]
    );
    
    // Emit socket event for real-time update
    const ideaId = accessCheck.rows[0].idea_id;
    emitToIdea(ideaId, 'reply:reaction', { replyId, reactions: reactions.rows });
    
    res.json({ replyId, reactions: reactions.rows });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from reply
router.delete('/:id/reactions/:emoji', authenticateToken, async (req, res) => {
  try {
    const replyId = req.params.id;
    const emoji = decodeURIComponent(req.params.emoji);
    
    await pool.query(
      `DELETE FROM reply_reactions WHERE reply_id = $1 AND user_id = $2 AND emoji = $3`,
      [replyId, req.user.id, emoji]
    );
    
    // Get remaining reactions for this reply
    const reactions = await pool.query(
      `SELECT rr.emoji, rr.user_id, u.name as user_name
       FROM reply_reactions rr
       JOIN users u ON rr.user_id = u.id
       WHERE rr.reply_id = $1`,
      [replyId]
    );
    
    // Get idea_id for socket emit
    const replyData = await pool.query(
      `SELECT idea_id FROM idea_replies WHERE id = $1`,
      [replyId]
    );
    
    if (replyData.rows.length > 0) {
      emitToIdea(replyData.rows[0].idea_id, 'reply:reaction', { replyId, reactions: reactions.rows });
    }
    
    res.json({ replyId, reactions: reactions.rows });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

module.exports = router;
