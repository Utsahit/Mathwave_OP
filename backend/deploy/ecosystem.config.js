module.exports = {
  apps: [
    {
      name: 'elixir-oak-api',
      script: 'dist/src/server.js',
      cwd: '/var/www/elixir-oak/backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env.production',
      max_memory_restart: '1G',
      error_file: '/var/log/elixir-oak/pm2/error.log',
      out_file: '/var/log/elixir-oak/pm2/out.log',
      log_file: '/var/log/elixir-oak/pm2/combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_restarts: 10,
      restart_delay: 4000,
      min_uptime: '10s',
      listen_timeout: 8000,
      kill_timeout: 10000,
      watch: false,
      node_args: '--max-old-space-size=1024',
    },
  ],
};
