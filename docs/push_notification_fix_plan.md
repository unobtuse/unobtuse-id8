# Fix Push Notifications

The user is not receiving push notifications. Diagnostic checks show 0 subscriptions in the database. This suggests that either the frontend is not subscribing successfully, or the backend is failing to save the subscription.

## User Review Required

- **Action**: You will need to open the app, go to **Settings**, and ensure **Push Notifications** are enabled. If they are already enabled, toggle them off and on again.
- **Action**: Check if the "Test Notification" button in Settings works.

## Proposed Changes

### Backend

#### [MODIFY] [push.js](file:///var/www/html/id8/backend/src/routes/push.js)

- Add detailed logging to the `/subscribe` endpoint to track incoming requests and errors.

#### [MODIFY] [push.js](file:///var/www/html/id8/backend/src/config/push.js)

- Add logging to `sendPushNotification` to track VAPID errors.

### Server Configuration (Apache)

#### [MODIFY] [id8-le-ssl.conf](/etc/apache2/sites-available/id8-le-ssl.conf)

- Explicitly exclude `sw.js` and `manifest.webmanifest` from the SPA fallback rewrite rule to ensure they are served correctly.

## Verification Plan

### Automated Tests

- Run the diagnostic script again to see if subscriptions count increases after user action.

### Manual Verification

- User navigates to Settings -> Enable Notifications.
- User clicks "Send Test".
- User verifies if a notification is received.
