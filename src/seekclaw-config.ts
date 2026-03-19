import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { resolveUserStateDir, resolveUserConfigPath } from "./constants";
import * as log from "./logger";

// ── 类型定义 ──

export interface SeekclawConfig {
  setupCompletedAt?: string;
  cliPreference?: "installed" | "uninstalled";
  skillStore?: {
    registryUrl?: string;
  };
}

// 四种归属状态
export type OwnershipState =
  | "seekclaw"
  | "legacy-seekclaw"
  | "external-openclaw"
  | "fresh";

// ── 路径 ──

// SeekClaw 专属配置文件路径
export function resolveSeekclawConfigPath(): string {
  return path.join(resolveUserStateDir(), "seekclaw.config.json");
}

// .device-id 文件路径（与官方 CLI 共用）
function resolveDeviceIdPath(): string {
  return path.join(resolveUserStateDir(), ".device-id");
}

// legacy skill-store.json 文件路径
function resolveSkillStoreConfigPath(): string {
  return path.join(resolveUserStateDir(), "skill-store.json");
}

// ── 读写 ──

// 读取 SeekClaw 专属配置，不存在或解析失败返回 null
export function readSeekclawConfig(): SeekclawConfig | null {
  try {
    const raw = fs.readFileSync(resolveSeekclawConfigPath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as SeekclawConfig;
  } catch {
    return null;
  }
}

// 写入 SeekClaw 专属配置
export function writeSeekclawConfig(config: SeekclawConfig): void {
  const dir = resolveUserStateDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    resolveSeekclawConfigPath(),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
}

// ── 归属检测 ──

// 老版 SeekClaw 独有文件（作为迁移标记）
function hasLegacyOneclawMarker(): boolean {
  return (
    fs.existsSync(path.join(resolveUserStateDir(), "seekclaw.config.json")) ||
    fs.existsSync(path.join(resolveUserStateDir(), "openclaw-setup-baseline.json"))
  );
}

// 判定当前 ~/.openclaw/ 目录的归属状态
export function detectOwnership(): OwnershipState {
  const seekclawConfig = readSeekclawConfig();
  if (seekclawConfig?.setupCompletedAt) return "seekclaw";

  // 检测是否存在老版 SeekClaw 痕迹
  if (hasLegacyOneclawMarker()) return "legacy-seekclaw";

  const openclawJsonExists = fs.existsSync(resolveUserConfigPath());
  if (openclawJsonExists) return "external-openclaw";

  return "fresh";
}

// ── 迁移 ──

// 从 legacy 文件迁移到 seekclaw.config.json（老 SeekClaw 用户升级）
export function migrateFromLegacy(): SeekclawConfig {
  const legacyConfigPath = path.join(resolveUserStateDir(), "seekclaw.config.json");
  let setupCompletedAt: string | undefined;
  let skillStore: SeekclawConfig["skillStore"];

  // 1. 优先从 seekclaw.config.json 迁移
  if (fs.existsSync(legacyConfigPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(legacyConfigPath, "utf-8"));
      setupCompletedAt = raw.setupCompletedAt;
      skillStore = raw.skillStore;
      log.info(`[config] migrated from ${legacyConfigPath}`);
    } catch {}
  }

  // 2. 如果之前没在 seekclaw.config.json 里找到，回退到从 openclaw.json (wizard.lastRunAt) 提取
  if (!setupCompletedAt) {
    try {
      const raw = JSON.parse(fs.readFileSync(resolveUserConfigPath(), "utf-8"));
      setupCompletedAt = raw.wizard?.lastRunAt;
    } catch {}
  }

  // 3. 如果没找到 skillStore，回退到从老的 skill-store.json 提取
  if (!skillStore) {
    try {
      const skillStorePath = resolveSkillStoreConfigPath();
      const raw = JSON.parse(fs.readFileSync(skillStorePath, "utf-8"));
      if (raw?.registryUrl) {
        skillStore = { registryUrl: raw.registryUrl };
      }
    } catch {}
  }

  const config: SeekclawConfig = { setupCompletedAt, skillStore };
  writeSeekclawConfig(config);

  // 迁移后安全删除旧标记文件，避免重复触发状态机跳转
  try {
    if (fs.existsSync(legacyConfigPath)) fs.unlinkSync(legacyConfigPath);
    const baselinePath = path.join(resolveUserStateDir(), "openclaw-setup-baseline.json");
    if (fs.existsSync(baselinePath)) fs.unlinkSync(baselinePath);
  } catch {}

  return config;
}

// ── 便捷方法 ──

// 标记 Setup 完成（写入 setupCompletedAt 到 seekclaw.config.json）
export function markSetupComplete(): void {
  let config = readSeekclawConfig();
  if (!config) {
    config = {};
  }
  config.setupCompletedAt = new Date().toISOString();
  writeSeekclawConfig(config);
}

// 确保 deviceId 存在，直接读写 .device-id 文件（与官方 CLI 共用）
export function ensureDeviceId(): string {
  const deviceIdPath = resolveDeviceIdPath();
  try {
    const existing = fs.readFileSync(deviceIdPath, "utf-8").trim();
    if (existing) return existing;
  } catch {}

  // 文件不存在或为空，生成新 ID 并写入
  const deviceId = crypto.randomUUID();
  const dir = resolveUserStateDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(deviceIdPath, deviceId + "\n", "utf-8");
  return deviceId;
}
