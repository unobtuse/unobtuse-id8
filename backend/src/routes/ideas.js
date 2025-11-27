const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');
const { emitToIdea, emitToAll } = require('../config/socket');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB for icons
});

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

// Update idea settings
router.patch('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { allow_member_invites } = req.body;
    
    const result = await pool.query(
      `UPDATE ideas SET allow_member_invites = COALESCE($1, allow_member_invites), updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [allow_member_invites, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found or not authorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Upload thread background
router.post('/:id/background', authenticateToken, upload.single('file'), async (req, res) => {
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
    
    // Check if user is owner or has permission
    const idea = await pool.query(
      `SELECT i.background_url, i.user_id FROM ideas i WHERE i.id = $1`,
      [req.params.id]
    );
    
    if (idea.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    const isOwner = idea.rows[0].user_id === req.user.id;
    
    if (!isOwner) {
      const permCheck = await pool.query(
        `SELECT can_change_background FROM collaborators 
         WHERE idea_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [req.params.id, req.user.id]
      );
      
      if (permCheck.rows.length === 0 || !permCheck.rows[0].can_change_background) {
        return res.status(403).json({ error: 'You do not have permission to change the background' });
      }
    }
    
    // Delete old background if exists
    if (idea.rows[0].background_url) {
      try {
        await deleteFromS3(idea.rows[0].background_url);
      } catch (e) {
        console.log('Could not delete old background:', e.message);
      }
    }
    
    // Upload new background
    const ext = file.originalname.split('.').pop();
    const key = `thread-backgrounds/${req.params.id}/${uuidv4()}.${ext}`;
    const bgUrl = await uploadToS3(file, key);
    
    // Update idea
    const result = await pool.query(
      `UPDATE ideas SET background_url = $1, background_type = $2, updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [bgUrl, isVideo ? 'video' : 'image', req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload background error:', error);
    res.status(500).json({ error: 'Failed to upload background' });
  }
});

// Remove thread background
router.delete('/:id/background', authenticateToken, async (req, res) => {
  try {
    const idea = await pool.query(
      `SELECT background_url, user_id FROM ideas WHERE id = $1`,
      [req.params.id]
    );
    
    if (idea.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    const isOwner = idea.rows[0].user_id === req.user.id;
    
    if (!isOwner) {
      const permCheck = await pool.query(
        `SELECT can_change_background FROM collaborators 
         WHERE idea_id = $1 AND user_id = $2 AND status = 'accepted'`,
        [req.params.id, req.user.id]
      );
      
      if (permCheck.rows.length === 0 || !permCheck.rows[0].can_change_background) {
        return res.status(403).json({ error: 'You do not have permission to change the background' });
      }
    }
    
    if (idea.rows[0].background_url) {
      await deleteFromS3(idea.rows[0].background_url);
    }
    
    const result = await pool.query(
      `UPDATE ideas SET background_url = NULL, background_type = 'image', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Remove background error:', error);
    res.status(500).json({ error: 'Failed to remove background' });
  }
});

// Upload idea icon
router.post('/:id/icon', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'File must be an image' });
    }
    
    // Check ownership
    const idea = await pool.query(
      `SELECT icon_url FROM ideas WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (idea.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found or not authorized' });
    }
    
    // Delete old icon if exists
    if (idea.rows[0].icon_url) {
      try {
        await deleteFromS3(idea.rows[0].icon_url);
      } catch (e) {
        console.log('Could not delete old icon:', e.message);
      }
    }
    
    // Resize image to 512x512 thumbnail
    const resizedBuffer = await sharp(file.buffer)
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toBuffer();
    
    // Upload resized icon
    const key = `icons/${req.params.id}/${uuidv4()}.png`;
    const resizedFile = { ...file, buffer: resizedBuffer, mimetype: 'image/png' };
    const iconUrl = await uploadToS3(resizedFile, key);
    
    // Update idea
    const result = await pool.query(
      `UPDATE ideas SET icon_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [iconUrl, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload icon error:', error);
    res.status(500).json({ error: 'Failed to upload icon' });
  }
});

// Remove idea icon
router.delete('/:id/icon', authenticateToken, async (req, res) => {
  try {
    const idea = await pool.query(
      `SELECT icon_url FROM ideas WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (idea.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found or not authorized' });
    }
    
    if (idea.rows[0].icon_url) {
      await deleteFromS3(idea.rows[0].icon_url);
    }
    
    const result = await pool.query(
      `UPDATE ideas SET icon_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Remove icon error:', error);
    res.status(500).json({ error: 'Failed to remove icon' });
  }
});

module.exports = router;
