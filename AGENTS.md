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

### Glassmorphic Blur Requirements
- **All UI elements must have background blur** - cards, toolbars, drawers, message bubbles
- Use `expo-blur` BlurView on native platforms with intensity 60-80
- Use CSS `backdrop-blur-xl` class on web with `backdrop-filter: blur(24px)`
- Always pair blur with semi-transparent background color (colors.glass)
- Input containers, media pickers, and navigation bars must all have blur

### Viewport and Mobile Settings
- **Lock viewport to prevent zooming** on mobile/tablet devices
- Viewport meta tag must include: `user-scalable=no, maximum-scale=1.0, minimum-scale=1.0`
- Full viewport tag: `<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, maximum-scale=1.0, minimum-scale=1.0" />`

### Text Input Behavior
- **Text inputs should auto-expand** with content up to a reasonable max-height
- Set `minHeight: 40` and `maxHeight: 120` for multiline inputs
- Use `multiline` and `textAlignVertical="center"` for proper alignment

### Media Picker (Stickers & Emoji)
- **Use combined MediaPicker component** with tabs for switching between emoji and stickers
- Single button in toolbar opens the combined picker
- Tabs: "😀 Emoji" and "🖼️ Stickers"
- MediaPicker must have background blur like other UI elements

## Code Standards

### JavaScript Syntax - CRITICAL
**Optional chaining operators MUST NOT have spaces.** This is the most common syntax error that breaks builds.

CORRECT:
```javascript
obj?.property
arr?.[0]
func?.()
obj?.method?.()
response.data?.items?.[0]?.name
```

WRONG (will cause Metro bundler to fail):
```javascript
obj ? .property    // BROKEN - space before dot
arr ? . [0]        // BROKEN - spaces before bracket
arr?. [0]          // BROKEN - space before bracket
func ? .()         // BROKEN - space in optional call
```

**Common patterns to watch for:**
- `ref.current?.click()` not `ref.current ? .click()`
- `event.target.files?.[0]` not `event.target.files ? . [0]`
- `item.name?.toLowerCase()` not `item.name ? .toLowerCase()`
- `type?.startsWith('video/')` not `type ? .startsWith('video/')`

These syntax errors cause Metro bundler to fail silently or with cryptic errors.

### Platform Compatibility
- Always check `Platform.OS === 'web'` for platform-specific code
- Use hidden HTML file inputs for file uploads on web
- Test features on both web and native platforms

### File Uploads
- Maximum file size: 1GB
- No resolution limits on images/videos
- Support all file types for attachments

## Git Commits

### Commit Message Rules
- **Never add Co-authored-by lines** - Do not include `Co-authored-by: factory-droid[bot]` or any bot attribution in commit messages
- Keep commit messages concise and descriptive
- Use conventional commit format: `feat:`, `fix:`, `refactor:`, `docs:`, etc.

## Build & Deployment

### After ALL Changes - Run a Fresh Build
After making any code changes, **always** run a fresh build and deploy:

```bash
# 1. Restart the backend API
pm2 restart id8-api

# 2. Build the web export
cd /var/www/html/id8/mobile && npx expo export --platform web

# 3. Update viewport and add PWA meta tags to the generated index.html
# Edit dist/index.html:
# - Replace viewport meta tag with: <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, maximum-scale=1.0, minimum-scale=1.0" />
# - Add after the theme-color meta tag:
# <meta name="apple-mobile-web-app-capable" content="yes">
# <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
# <meta name="apple-mobile-web-app-title" content="id8">
# <link rel="manifest" href="/manifest.webmanifest">
# <link rel="apple-touch-icon" href="/icon-192.png">
# - Add Switch thumb color override CSS inside the existing <style id="expo-reset"> tag:
# [role="switch"][aria-checked="true"] > div > div { background-color: #C7B500 !important; }

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
