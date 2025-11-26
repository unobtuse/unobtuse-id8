# Deployment Guide

This guide covers deploying id8 to a production environment.

## Prerequisites

- Ubuntu 22.04+ server
- Node.js 18+
- PostgreSQL 15+
- Nginx
- PM2 (Node.js process manager)
- SSL certificate (Let's Encrypt recommended)
- Domain name

## Server Setup

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE id8;
CREATE USER id8_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE id8 TO id8_user;
\q

# Run schema
psql -U id8_user -d id8 -f /path/to/docs/database-schema.sql
```

### 3. Clone and Configure

```bash
# Clone repository
cd /var/www/html
git clone https://github.com/unobtuse/unobtuse-id8.git id8
cd id8

# Configure backend
cd backend
cp .env.example .env
nano .env  # Edit with your production values

# Install dependencies
npm install --production
```

### 4. PM2 Process Manager

```bash
# Start the backend
cd /var/www/html/id8/backend
pm2 start src/index.js --name id8-api

# Save PM2 process list
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/id8`:

```nginx
server {
    listen 80;
    server_name id8.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name id8.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/id8.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/id8.yourdomain.com/privkey.pem;

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/id8 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Certificate

```bash
sudo certbot --nginx -d id8.yourdomain.com
```

## Mobile App Deployment

### Expo Application Services (EAS)

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**
   ```bash
   cd mobile
   eas init
   ```

3. **Build for Production**
   ```bash
   # iOS
   eas build --platform ios --profile production
   
   # Android
   eas build --platform android --profile production
   ```

4. **Submit to App Stores**
   ```bash
   # iOS App Store
   eas submit --platform ios
   
   # Google Play Store
   eas submit --platform android
   ```

### Web Export (Optional)

```bash
cd mobile
expo export:web
# Deploy the `web-build` folder to your static hosting
```

## Environment Variables Reference

### Production Backend (.env)

```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://id8.yourdomain.com

DB_HOST=localhost
DB_PORT=5432
DB_NAME=id8
DB_USER=id8_user
DB_PASSWORD=your_secure_password

JWT_SECRET=generate_a_long_random_string_here

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
AWS_BUCKET=your_bucket_name
```

### Production Mobile (.env)

```env
API_URL=https://id8.yourdomain.com/api
GOOGLE_CLIENT_ID=your_google_client_id
```

## Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs id8-api

# Monitor processes
pm2 monit

# View status
pm2 status
```

### Health Check

The API exposes a health endpoint at `/health` that returns:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Backup Strategy

### Database Backup

```bash
# Create backup
pg_dump -U id8_user id8 > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U id8_user id8 < backup_20240101.sql
```

### S3 Backup

AWS S3 provides built-in versioning and replication. Enable versioning on your bucket:

```bash
aws s3api put-bucket-versioning \
    --bucket your-bucket \
    --versioning-configuration Status=Enabled
```

## Troubleshooting

### Common Issues

1. **API not responding**
   ```bash
   pm2 restart id8-api
   pm2 logs id8-api
   ```

2. **Database connection failed**
   ```bash
   sudo systemctl status postgresql
   sudo systemctl restart postgresql
   ```

3. **Nginx 502 Bad Gateway**
   - Check if PM2 process is running: `pm2 status`
   - Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

4. **File upload fails**
   - Check AWS credentials
   - Verify S3 bucket permissions
   - Check Nginx `client_max_body_size`

## Security Checklist

- [ ] Use strong JWT secret (32+ random characters)
- [ ] Enable HTTPS only
- [ ] Set secure CORS origins
- [ ] Use environment variables for all secrets
- [ ] Regular security updates
- [ ] Database access restricted to localhost
- [ ] Firewall configured (only 80, 443 open)
- [ ] Rate limiting on API endpoints
