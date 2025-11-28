const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all friends (accepted)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.screen_name, f.created_at as friends_since
       FROM friends f
       JOIN users u ON (
         CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
       ) = u.id
       WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
       ORDER BY u.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get pending friend requests (received)
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, u.id as user_id, u.name, u.email, u.avatar_url, u.screen_name, f.created_at
       FROM friends f
       JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// Get pending friend requests (sent)
router.get('/requests/sent', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, u.id as user_id, u.name, u.email, u.avatar_url, u.screen_name, f.created_at
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// Search users by screen name or email
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = q.startsWith('@') ? q.substring(1) : q;
    
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.screen_name,
              EXISTS(
                SELECT 1 FROM friends f 
                WHERE ((f.user_id = $1 AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = $1))
              ) as has_request,
              (
                SELECT f.status FROM friends f 
                WHERE ((f.user_id = $1 AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = $1))
                LIMIT 1
              ) as friend_status
       FROM users u
       WHERE u.id != $1 AND (
         LOWER(u.screen_name) LIKE LOWER($2) OR
         LOWER(u.email) LIKE LOWER($2) OR
         LOWER(u.name) LIKE LOWER($2)
       )
       LIMIT 20`,
      [req.user.id, `%${searchTerm}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Send friend request (by user id or screen name)
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { userId, screenName } = req.body;
    
    let friendId = userId;
    
    if (!friendId && screenName) {
      const cleanScreenName = screenName.startsWith('@') ? screenName.substring(1) : screenName;
      const userResult = await pool.query(
        `SELECT id FROM users WHERE LOWER(screen_name) = LOWER($1)`,
        [cleanScreenName]
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      friendId = userResult.rows[0].id;
    }
    
    if (!friendId) {
      return res.status(400).json({ error: 'User ID or screen name required' });
    }
    
    if (friendId === req.user.id) {
      return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }
    
    // Check if already friends or request exists
    const existing = await pool.query(
      `SELECT id, status FROM friends 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.user.id, friendId]
    );
    
    if (existing.rows.length > 0) {
      const status = existing.rows[0].status;
      if (status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      } else if (status === 'pending') {
        return res.status(400).json({ error: 'Friend request already pending' });
      } else if (status === 'blocked') {
        return res.status(400).json({ error: 'Unable to send request' });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [req.user.id, friendId]
    );
    
    // Get friend details
    const friendDetails = await pool.query(
      `SELECT id, name, email, avatar_url, screen_name FROM users WHERE id = $1`,
      [friendId]
    );
    
    res.status(201).json({ ...result.rows[0], friend: friendDetails.rows[0] });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.patch('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE friends SET status = 'accepted'
       WHERE id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject/cancel friend request
router.delete('/request/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM friends 
       WHERE id = $1 AND (user_id = $2 OR friend_id = $2) AND status = 'pending'
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    res.json({ message: 'Friend request removed' });
  } catch (error) {
    console.error('Remove friend request error:', error);
    res.status(500).json({ error: 'Failed to remove friend request' });
  }
});

// Remove friend
router.delete('/:friendId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM friends 
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
       AND status = 'accepted'
       RETURNING id`,
      [req.user.id, req.params.friendId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend not found' });
    }
    
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

module.exports = router;
