module.exports = {
  apps: [
    {
      name: 'bot3',
      script: 'npm',
      args: 'start',
      cwd: './bot',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
    },
  ],
};
