module.exports = {
  apps: [
    {
      name: "pos-api",
      cwd: "/home/ubuntu/projects/POS_SaaS/server",
      script: "npm",
      args: "start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "pos-client",
      cwd: "/home/ubuntu/projects/POS_SaaS/client",
      script: "npm",
      args: "run start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
