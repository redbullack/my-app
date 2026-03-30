import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // oracledb는 Native Addon이므로 서버 번들링에서 제외해야 한다.
  serverExternalPackages: ['oracledb'],
};

export default nextConfig;
