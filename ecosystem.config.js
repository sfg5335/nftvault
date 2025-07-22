module.exports = {
  apps: [
    {
      name: 'nftvault-frontend',
      script: 'npm',
      args: 'start',
      cwd: './app',
      env: {
        PORT: 3000,
        HOST: '0.0.0.0',
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
    }
  ]
};
