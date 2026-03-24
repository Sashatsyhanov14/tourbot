module.exports = {
  apps: [
    {
      name: 'excursion-bot',
      script: 'npm',
      args: 'start',
      cwd: './bot',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
