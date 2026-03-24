module.exports = {
  apps: [
    {
      name: 'bot2',
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
