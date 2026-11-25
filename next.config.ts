import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // 允许通过局域网 IP 访问开发服务器（HMR WebSocket 会校验来源）
  allowedDevOrigins: ["192.168.0.109", "192.168.0.109:3000"],
  ...(staticExport ? { output: "export" as const } : {}),
};

export default nextConfig;
