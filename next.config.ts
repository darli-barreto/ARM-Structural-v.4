import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  webpack(config, { isServer }) {
    if (!isServer) {
      config.module.rules.push({
        test: /manifold\.js$/,
        include: path.join(process.cwd(), 'node_modules', 'manifold-3d'),
        use: path.join(process.cwd(), 'scripts', 'strip-manifold-node-import.cjs'),
      });
    }
    return config;
  },
};

export default nextConfig;
