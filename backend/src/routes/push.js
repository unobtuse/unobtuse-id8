const express = require('express');
const pool = require('../config/db');
const {
    authenticateToken
} = require('../middleware/auth');
const {
    sendPushNotification
} = require('../config/push');

const router = express.Router();

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
    res.json({
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
});

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        const {
            subscription
        } = req.body;
        console.log('[PUSH] Received subscription request for user:', req.user.id);
        console.log('[PUSH] Subscription payload:', JSON.stringify(subscription));

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({
                error: 'Invalid subscription'
            });
        }

        // Upsert subscription
        await pool.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = $1,
        p256dh = $3,
        auth = $4
    `, [req.user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);

        // Update user settings
        await pool.query(
            'UPDATE user_settings SET notifications_enabled = true WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({
            error: 'Failed to subscribe'
        });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateToken, async (req, res) => {
    try {
        const {
            endpoint
        } = req.body;

        if (endpoint) {
            await pool.query(
                'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
                [req.user.id, endpoint]
            );
        } else {
            // Remove all subscriptions for this user
            await pool.query(
                'DELETE FROM push_subscriptions WHERE user_id = $1',
                [req.user.id]
            );
        }

        // Update user settings
        await pool.query(
            'UPDATE user_settings SET notifications_enabled = false WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({
            error: 'Failed to unsubscribe'
        });
    }
});

// Mark onboarding as seen
router.post('/onboarding-seen', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE user_settings SET has_seen_onboarding = true WHERE user_id = $1',
            [req.user.id]
        );
        res.json({
            success: true
        });
    } catch (error) {
        console.error('Mark onboarding error:', error);
        res.status(500).json({
            error: 'Failed to update'
        });
    }
});

// Send test notification
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const payload = {
            title: 'ID8 Test Notification',
            body: 'Push notifications are working! You will receive alerts when collaborators reply to your threads.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
        };

        console.log(`[PUSH] Sending test notification to user ${req.user.id}`);
        await sendPushNotification(req.user.id, payload);

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({
            error: 'Failed to send test notification'
        });
    }
});

module.exports = router;