const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendInviteEmail } = require('../config/email');

const router = express.Router();

// Get collaborators for an idea
router.get('/idea/:ideaId', authenticateToken, async (req, res) => {
  try {
    // Check if user is owner or accepted collaborator
    const accessCheck = await pool.query(
      `SELECT i.id, i.user_id FROM ideas i
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE i.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [req.params.ideaId, req.user.id]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
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

// Update collaborator permissions
router.patch('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const { can_invite, can_change_background } = req.body;
    
    // Verify requester is the idea owner
    const ownerCheck = await pool.query(
      `SELECT i.id FROM ideas i
       JOIN collaborators c ON c.idea_id = i.id
       WHERE c.id = $1 AND i.user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only idea owner can change permissions' });
    }
    
    const result = await pool.query(
      `UPDATE collaborators SET 
        can_invite = COALESCE($1, can_invite),
        can_change_background = COALESCE($2, can_change_background)
       WHERE id = $3 RETURNING *`,
      [can_invite, can_change_background, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Invite collaborator
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const { ideaId, email, role } = req.body;
    
    // Check if user is owner or has invite permission
    const ideaCheck = await pool.query(
      `SELECT i.id, i.title, i.allow_member_invites, u.name as owner_name, i.user_id as owner_id
       FROM ideas i 
       JOIN users u ON i.user_id = u.id
       WHERE i.id = $1`,
      [ideaId]
    );
    
    if (ideaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    const idea = ideaCheck.rows[0];
    const isOwner = idea.owner_id === req.user.id;
    
    // If not owner, check if user has invite permission
    if (!isOwner) {
      const permCheck = await pool.query(
        `SELECT can_invite FROM collaborators 
         WHERE idea_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [ideaId, req.user.id]
      );
      
      if (permCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (!idea.allow_member_invites || !permCheck.rows[0].can_invite) {
        return res.status(403).json({ error: 'You do not have permission to invite' });
      }
    }
    
    // Get inviter name for email
    const inviterQuery = await pool.query(`SELECT name FROM users WHERE id = $1`, [req.user.id]);
    const inviterName = inviterQuery.rows[0]?.name || 'Someone';
    
    // Check if user exists (case-insensitive)
    const userCheck = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    const userId = userCheck.rows.length > 0 ? userCheck.rows[0].id : null;
    
    // Check for existing invitation (case-insensitive email check)
    const existingCheck = await pool.query(
      `SELECT id FROM collaborators WHERE idea_id = $1 AND (user_id = $2 OR LOWER(invite_email) = LOWER($3))`,
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
    
    // Send invite email
    sendInviteEmail(email, inviterName, idea.title);
    
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

// Toggle thread notifications for current user
router.patch('/idea/:ideaId/notifications', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    // Check if user is owner or collaborator
    const accessCheck = await pool.query(
      `SELECT i.id, i.user_id, c.id as collab_id
       FROM ideas i
       LEFT JOIN collaborators c ON i.id = c.idea_id AND c.user_id = $2 AND c.status = 'accepted'
       WHERE i.id = $1 AND (i.user_id = $2 OR c.user_id = $2)`,
      [req.params.ideaId, req.user.id]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const row = accessCheck.rows[0];
    
    if (row.user_id === req.user.id) {
      // User is owner - we could store owner notification prefs differently
      // For now, create a self-collaborator entry or use a separate table
      // Let's check if there's already a collaborator entry for owner
      const existingCollab = await pool.query(
        `SELECT id FROM collaborators WHERE idea_id = $1 AND user_id = $2`,
        [req.params.ideaId, req.user.id]
      );
      
      if (existingCollab.rows.length > 0) {
        await pool.query(
          `UPDATE collaborators SET notifications_enabled = $1 WHERE idea_id = $2 AND user_id = $3`,
          [enabled, req.params.ideaId, req.user.id]
        );
      } else {
        // Create a self-entry for notification tracking (use 'contributor' role for owner)
        await pool.query(
          `INSERT INTO collaborators (idea_id, user_id, invited_by, role, status, notifications_enabled)
           VALUES ($1, $2, $2, 'contributor', 'accepted', $3)`,
          [req.params.ideaId, req.user.id, enabled]
        );
      }
    } else {
      // User is collaborator
      await pool.query(
        `UPDATE collaborators SET notifications_enabled = $1 WHERE idea_id = $2 AND user_id = $3`,
        [enabled, req.params.ideaId, req.user.id]
      );
    }
    
    res.json({ success: true, notifications_enabled: enabled });
  } catch (error) {
    console.error('Toggle notifications error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Get notification setting for a thread
router.get('/idea/:ideaId/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT notifications_enabled FROM collaborators 
       WHERE idea_id = $1 AND user_id = $2`,
      [req.params.ideaId, req.user.id]
    );
    
    // Default to true if no entry exists
    const enabled = result.rows.length > 0 ? result.rows[0].notifications_enabled : true;
    res.json({ notifications_enabled: enabled });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notification settings' });
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
