# Agent Guidelines for id8

## UI/UX Rules

### Alerts and Notifications
- **Never use browser alert boxes** (`window.alert`, `window.confirm`, `Alert.alert`)
- **Always use styled modal components** for user notifications, confirmations, and errors
- Modals should match the glassmorphic design system (dark overlay, glass card, proper theming)

### Modal Design Standards
- Dark semi-transparent overlay (rgba(0, 0, 0, 0.7-0.9))
- Glassmorphic card with blur effect
- Proper contrast for light/dark themes
- Cancel and action buttons with appropriate styling (red for destructive actions)
- Click outside to dismiss where appropriate

## Code Standards

### Platform Compatibility
- Always check `Platform.OS === 'web'` for platform-specific code
- Use hidden HTML file inputs for file uploads on web
- Test features on both web and native platforms

### File Uploads
- Maximum file size: 1GB
- No resolution limits on images/videos
- Support all file types for attachments

## Build & Deployment

### After ALL Changes - Run a Fresh Build
After making any code changes, **always** run a fresh build and deploy:

```bash
# 1. Restart the backend API
pm2 restart id8-api

# 2. Build the web export
cd /var/www/html/id8/mobile && npx expo export --platform web

# 3. Add PWA meta tags to the generated index.html
# Edit dist/index.html to add after the theme-color meta tag:
# <meta name="apple-mobile-web-app-capable" content="yes">
# <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
# <meta name="apple-mobile-web-app-title" content="id8">
# <link rel="manifest" href="/manifest.webmanifest">
# <link rel="apple-touch-icon" href="/icon-192.png">

# 4. Create manifest.webmanifest in dist/ folder if not present

# 5. Deploy to web folder
cp -r /var/www/html/id8/mobile/dist/* /var/www/html/id8/web/
cp /var/www/html/id8/mobile/public/sw.js /var/www/html/id8/web/
cp /var/www/html/id8/mobile/assets/icon-192.png /var/www/html/id8/web/
cp /var/www/html/id8/mobile/assets/icon-512.png /var/www/html/id8/web/
cp /var/www/html/id8/logo/id8-logo-darkmode.svg /var/www/html/id8/web/
cp /var/www/html/id8/logo/id8-logo-lightmode.svg /var/www/html/id8/web/

# 6. Verify deployment
curl -s http://localhost:3001/health
```

### Logo Updates
When updating logos in `/var/www/html/id8/logo/`:
- `favicon.svg` - Browser tab icon (convert to PNG for favicon.ico)
- `app-icon.svg` - PWA/homescreen icon (convert to 192x192 and 512x512 PNGs)
- `id8-logo-darkmode.svg` - Logo for dark theme
- `id8-logo-lightmode.svg` - Logo for light theme

Use sharp to convert SVGs to PNGs:
```bash
cd /var/www/html/id8/backend && node -e "
const sharp = require('sharp');
const fs = require('fs');
// Convert app-icon.svg to icon-192.png, icon-512.png, icon.png
// Convert favicon.svg to favicon.png
"
```
