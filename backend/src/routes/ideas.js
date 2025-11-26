const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all ideas (own + collaborated)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { archived } = req.query;
    const archivedFilter = archived === 'true' ? true : archived === 'false' ? false : null;
    
    let query = `
      SELECT DISTINCT i.*, u.name as owner_name, u.avatar_url as owner_avatar,
        CASE WHEN i.user_id = $1 THEN 'owner' ELSE 'collaborator' END as role
      FROM ideas i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $1 AND c.status = 'accepted'
      WHERE (i.user_id = $1 OR c.user_id = $1)
    `;
    
    const params = [req.user.id];
    
    if (archivedFilter !== null) {
      query += ` AND i.is_archived = $2`;
      params.push(archivedFilter);
    }
    
    query += ` ORDER BY i.updated_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get ideas error:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

// Get single idea
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, u.name as owner_name, u.avatar_url as owner_avatar
       FROM ideas i
       JOIN users u ON i.user_id = u.id
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE i.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get idea error:', error);
    res.status(500).json({ error: 'Failed to fetch idea' });
  }
});

// Create idea
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO ideas (user_id, title, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, title, content || '']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create idea error:', error);
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

// Update idea
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    const result = await pool.query(
      `UPDATE ideas SET title = COALESCE($1, title), content = COALESCE($2, content), updated_at = NOW()
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [title, content, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found or not authorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update idea error:', error);
    res.status(500).json({ error: 'Failed to update idea' });
  }
});

// Archive/unarchive idea
router.patch('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { archived } = req.body;
    
    const result = await pool.query(
      `UPDATE ideas SET is_archived = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [archived, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found or not authorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Archive idea error:', error);
    res.status(500).json({ error: 'Failed to archive idea' });
  }
});

// Delete idea (only archived ideas)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM ideas WHERE id = $1 AND user_id = $2 AND is_archived = true RETURNING id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found, not archived, or not authorized' });
    }
    
    res.json({ message: 'Idea deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete idea error:', error);
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

module.exports = router;
