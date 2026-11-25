import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import path from "node:path";

// 纯静态导出时不支持动态 API 路由，构建期间临时移出 src/app/api，结束后恢复。
const root = path.resolve(import.meta.dirname, "..");
const apiDir = path.join(root, "src/app/api");
const backupDir = path.join(root, "src/.api-backup");

if (!existsSync(apiDir)) {
  console.error(`找不到 ${apiDir}`);
  process.exit(1);
}

await rename(apiDir, backupDir);
try {
  execSync("next build", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      NEXT_PUBLIC_API_MODE: "direct",
    },
  });
} finally {
  await rename(backupDir, apiDir);
}
