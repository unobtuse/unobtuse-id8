const express = require('express');
const multer = require('multer');
const {
    v4: uuidv4
} = require('uuid');
const pool = require('../config/db');
const {
    uploadToS3,
    deleteFromS3
} = require('../config/s3');
const {
    authenticateToken
} = require('../middleware/auth');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 1024
    } // 1GB limit
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
        res.status(500).json({
            error: 'Failed to fetch settings'
        });
    }
});

// Update theme
router.patch('/theme', authenticateToken, async (req, res) => {
    try {
        const {
            theme
        } = req.body;

        if (!['light', 'dark'].includes(theme)) {
            return res.status(400).json({
                error: 'Invalid theme'
            });
        }

        const result = await pool.query(
            `UPDATE user_settings SET theme = $1, updated_at = NOW()
       WHERE user_id = $2 RETURNING *`,
            [theme, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({
            error: 'Failed to update theme'
        });
    }
});

// Upload background
router.post('/background', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                error: 'No file provided'
            });
        }

        const isVideo = file.mimetype.startsWith('video/');
        const isImage = file.mimetype.startsWith('image/');

        if (!isVideo && !isImage) {
            return res.status(400).json({
                error: 'File must be an image or video'
            });
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
        res.status(500).json({
            error: 'Failed to upload background'
        });
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
        res.status(500).json({
            error: 'Failed to remove background'
        });
    }
});

// Update screen name
router.patch('/screen-name', authenticateToken, async (req, res) => {
    try {
        const {
            screenName
        } = req.body;

        if (!screenName) {
            // Allow clearing screen name
            const result = await pool.query(
                `UPDATE users SET screen_name = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING id, name, email, avatar_url, screen_name`,
                [req.user.id]
            );
            return res.json(result.rows[0]);
        }

        // Validate screen name format (alphanumeric, underscores, 3-30 chars)
        const cleanName = screenName.startsWith('@') ? screenName.substring(1) : screenName;
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanName)) {
            return res.status(400).json({
                error: 'Screen name must be 3-30 characters, using only letters, numbers, and underscores'
            });
        }

        // Check if already taken
        const existing = await pool.query(
            `SELECT id FROM users WHERE LOWER(screen_name) = LOWER($1) AND id != $2`,
            [cleanName, req.user.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                error: 'Screen name already taken'
            });
        }

        const result = await pool.query(
            `UPDATE users SET screen_name = $1, updated_at = NOW()
             WHERE id = $2 RETURNING id, name, email, avatar_url, screen_name`,
            [cleanName, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update screen name error:', error);
        res.status(500).json({
            error: 'Failed to update screen name'
        });
    }
});

// Check screen name availability
router.get('/screen-name/check', authenticateToken, async (req, res) => {
    try {
        const {
            name
        } = req.query;
        if (!name) {
            return res.status(400).json({
                error: 'Name required'
            });
        }

        const cleanName = name.startsWith('@') ? name.substring(1) : name;

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanName)) {
            return res.json({
                available: false,
                reason: 'Invalid format'
            });
        }

        const existing = await pool.query(
            `SELECT id FROM users WHERE LOWER(screen_name) = LOWER($1) AND id != $2`,
            [cleanName, req.user.id]
        );

        res.json({
            available: existing.rows.length === 0
        });
    } catch (error) {
        console.error('Check screen name error:', error);
        res.status(500).json({
            error: 'Failed to check screen name'
        });
    }
});

// Upload avatar
router.post('/avatar', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                error: 'No file provided'
            });
        }

        const isImage = file.mimetype.startsWith('image/');

        if (!isImage) {
            return res.status(400).json({
                error: 'File must be an image'
            });
        }

        // Get current user to delete old avatar
        const current = await pool.query(
            `SELECT avatar_url FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (current.rows.length > 0 && current.rows[0].avatar_url) {
            // Only delete if it's an S3 URL (contains amazonaws or similar check if needed, 
            // but deleteFromS3 handles key extraction safely usually)
            try {
                await deleteFromS3(current.rows[0].avatar_url);
            } catch (e) {
                console.log('Could not delete old avatar:', e.message);
            }
        }

        // Upload new avatar
        const ext = file.originalname.split('.').pop();
        const key = `avatars/${req.user.id}/${uuidv4()}.${ext}`;
        const fileUrl = await uploadToS3(file, key);

        // Update user
        const result = await pool.query(
            `UPDATE users SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
            [fileUrl, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({
            error: 'Failed to upload avatar'
        });
    }
});

// Update API Keys
router.patch('/api-keys', authenticateToken, async (req, res) => {
    try {
        const {
            openaiKey,
            anthropicKey,
            geminiKey
        } = req.body;

        const result = await pool.query(
            `UPDATE users SET 
                openai_key = $1, 
                anthropic_key = $2, 
                gemini_key = $3, 
                updated_at = NOW()
             WHERE id = $4 
             RETURNING id, name, email, avatar_url, screen_name, openai_key, anthropic_key, gemini_key`,
            [openaiKey, anthropicKey, geminiKey, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update API keys error:', error);
        res.status(500).json({
            error: 'Failed to update API keys'
        });
    }
});

module.exports = router;