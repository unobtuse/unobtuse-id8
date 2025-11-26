const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get collaborators for an idea
router.get('/idea/:ideaId', authenticateToken, async (req, res) => {
  try {
    // Verify ownership
    const ownerCheck = await pool.query(
      `SELECT id FROM ideas WHERE id = $1 AND user_id = $2`,
      [req.params.ideaId, req.user.id]
    );
    
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only idea owner can view collaborators' });
    }
    
    const result = await pool.query(
      `SELECT c.*, u.name, u.email, u.avatar_url
       FROM collaborators c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.idea_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.ideaId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// Invite collaborator
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const { ideaId, email, role } = req.body;
    
    // Verify ownership
    const ownerCheck = await pool.query(
      `SELECT id FROM ideas WHERE id = $1 AND user_id = $2`,
      [ideaId, req.user.id]
    );
    
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only idea owner can invite collaborators' });
    }
    
    // Check if user exists
    const userCheck = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    const userId = userCheck.rows.length > 0 ? userCheck.rows[0].id : null;
    
    // Check for existing invitation
    const existingCheck = await pool.query(
      `SELECT id FROM collaborators WHERE idea_id = $1 AND (user_id = $2 OR invite_email = $3)`,
      [ideaId, userId, email]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User already invited' });
    }
    
    const result = await pool.query(
      `INSERT INTO collaborators (idea_id, user_id, invited_by, role, invite_email, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [ideaId, userId, req.user.id, role || 'contributor', email, userId ? 'pending' : 'pending']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
});

// Get pending invitations for current user
router.get('/invitations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, i.title as idea_title, u.name as inviter_name
       FROM collaborators c
       JOIN ideas i ON c.idea_id = i.id
       JOIN users u ON c.invited_by = u.id
       WHERE c.user_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Accept/reject invitation
router.patch('/:id/respond', authenticateToken, async (req, res) => {
  try {
    const { accept } = req.body;
    const status = accept ? 'accepted' : 'rejected';
    
    const result = await pool.query(
      `UPDATE collaborators SET status = $1
       WHERE id = $2 AND user_id = $3 AND status = 'pending' RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Respond to invitation error:', error);
    res.status(500).json({ error: 'Failed to respond to invitation' });
  }
});

// Remove collaborator
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Can be removed by idea owner or self
    const result = await pool.query(
      `DELETE FROM collaborators c
       USING ideas i
       WHERE c.id = $1 AND c.idea_id = i.id AND (i.user_id = $2 OR c.user_id = $2)
       RETURNING c.id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collaborator not found or not authorized' });
    }
    
    res.json({ message: 'Collaborator removed', id: req.params.id });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

module.exports = router;
