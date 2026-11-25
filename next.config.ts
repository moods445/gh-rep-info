import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 纯静态导出：next build 直接产出 out/，可部署到任意静态托管
  output: "export",
  images: { unoptimized: true },
  // 允许通过局域网 IP 访问开发服务器（HMR WebSocket 会校验来源）
  allowedDevOrigins: ["192.168.0.109", "192.168.0.109:3000"],
};

export default nextConfig;
