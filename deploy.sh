#!/bin/bash

# Simple deployment script for VPS
# Run frontend and backend on the same server

echo "🚀 Deploying NFTVault..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd backend && npm install && cd ..

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Build backend
echo "🏗️ Building backend..."
cd backend && npm run build && cd ..

# Setup PM2 for process management
echo "⚙️ Setting up PM2..."
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'nftvault-frontend',
      script: 'npm',
      args: 'start',
      cwd: './',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      },
      restart_delay: 1000,
      max_memory_restart: '1G',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log'
    },
    {
      name: 'nftvault-backend',
      script: './dist/server.js',
      cwd: './backend',
      env: {
        BACKEND_PORT: 3001,
        NODE_ENV: 'production'
      },
      restart_delay: 1000,
      max_memory_restart: '512M',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log'
    },
    {
      name: 'nftvault-webhook',
      script: './webhook-server.ts',
      cwd: './backend',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 1000,
      instances: 1,
      error_file: '../logs/webhook-error.log',
      out_file: '../logs/webhook-out.log',
      log_file: '../logs/webhook-combined.log'
    }
  ]
};
EOF

# Create logs directory
mkdir -p logs

# Start services
echo "🏃 Starting services..."
pm2 delete all
pm2 start ecosystem.config.js

# Setup nginx (optional)
echo "🔧 Nginx configuration example:"
cat << 'EOF'
# /etc/nginx/sites-available/nftvault
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/vault {
        proxy_pass http://localhost:3001/api/vault;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo "✅ Deployment complete!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Run 'pm2 logs' to see logs"
echo "Run 'pm2 status' to see process status" 