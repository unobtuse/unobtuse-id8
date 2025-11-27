const webpush = require('web-push');
const pool = require('./db');

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:support@id8.unobtuse.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

const sendPushNotification = async (userId, payload) => {
    console.log(`[PUSH] sendPushNotification called for user ${userId}`);
    try {
        // Get all subscriptions for this user
        const result = await pool.query(
            'SELECT * FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        console.log(`[PUSH] Found ${result.rows.length} subscriptions for user ${userId}`);

        const notifications = result.rows.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                console.log(`[PUSH] Sending to endpoint: ${sub.endpoint.substring(0, 50)}...`);
                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
                console.log(`[PUSH] Successfully sent notification to subscription ${sub.id}`);
            } catch (error) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Subscription expired or invalid, remove it
                    await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                    console.log(`Removed expired subscription ${sub.id}`);
                } else {
                    console.error(`Push notification error for ${sub.id}:`, error.message);
                    console.error('Full error details:', JSON.stringify(error));
                }
            }
        });

        await Promise.all(notifications);
    } catch (error) {
        console.error('Send push notification error:', error);
    }
};

const notifyThreadUpdate = async (ideaId, excludeUserId, title, body) => {
    console.log(`[PUSH] notifyThreadUpdate called: ideaId=${ideaId}, excludeUserId=${excludeUserId}, title=${title}`);
    try {
        // Get all collaborators who have notifications enabled for this thread
        const result = await pool.query(`
      SELECT DISTINCT u.id as user_id
      FROM users u
      LEFT JOIN ideas i ON i.user_id = u.id AND i.id = $1
      LEFT JOIN collaborators c ON c.user_id = u.id AND c.idea_id = $1 AND c.status = 'accepted'
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE (i.id IS NOT NULL OR c.id IS NOT NULL)
        AND u.id != $2
        AND (us.notifications_enabled IS NULL OR us.notifications_enabled = true)
        AND (c.notifications_enabled IS NULL OR c.notifications_enabled = true)
    `, [ideaId, excludeUserId]);

        const payload = {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: {
                ideaId
            },
        };

        console.log(`[PUSH] Found ${result.rows.length} users to notify:`, result.rows.map(r => r.user_id));

        for (const row of result.rows) {
            console.log(`[PUSH] Sending notification to user ${row.user_id}`);
            await sendPushNotification(row.user_id, payload);
        }
    } catch (error) {
        console.error('Notify thread update error:', error);
    }
};

module.exports = {
    sendPushNotification,
    notifyThreadUpdate
};