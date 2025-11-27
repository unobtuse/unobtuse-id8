#!/bin/bash

echo "=== ID8 Clean Build Script ==="

cd /var/www/html/id8/mobile

# Clear all caches
echo "Clearing caches..."
rm -rf dist
rm -rf node_modules/.cache
rm -rf .expo

# Rebuild
echo "Building web export..."
npx expo export --platform web --clear

# Get the generated file names
JS_FILE=$(ls dist/_expo/static/js/web/AppEntry-*.js 2>/dev/null | head -1 | xargs basename)
CSS_FILE=$(ls dist/_expo/static/css/web-*.css 2>/dev/null | head -1 | xargs basename)

if [ -z "$JS_FILE" ] || [ -z "$CSS_FILE" ]; then
    echo "ERROR: Build failed - missing JS or CSS files"
    exit 1
fi

echo "Generated: JS=$JS_FILE CSS=$CSS_FILE"

# Create clean index.html
cat > dist/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ID8">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icon-192.png">
  <title>ID8</title>
  <meta name="theme-color" content="#000000">
  <meta name="description" content="Capture ideas. Iterate. Collaborate.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/_expo/static/css/${CSS_FILE}">
  <link rel="icon" href="/favicon.ico">
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body { overflow: hidden; }
    #root { display: flex; height: 100%; flex: 1; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/_expo/static/js/web/${JS_FILE}" defer></script>
</body>
</html>
EOF

# Deploy to web folder
echo "Deploying to web folder..."
cp -r dist/* /var/www/html/id8/web/
cp public/sw.js /var/www/html/id8/web/
cp assets/icon-192.png /var/www/html/id8/web/
cp assets/icon-512.png /var/www/html/id8/web/

# Create manifest
cat > /var/www/html/id8/web/manifest.webmanifest << EOF
{
  "name": "ID8",
  "short_name": "ID8",
  "description": "Capture ideas. Iterate. Collaborate.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
EOF

# Restart backend
echo "Restarting backend..."
pm2 restart id8-api

echo ""
echo "=== Build Complete ==="
echo "JS: $JS_FILE"
echo "CSS: $CSS_FILE"
echo ""
echo "Clear Safari cache and reload: https://id8.unobtuse.com"
