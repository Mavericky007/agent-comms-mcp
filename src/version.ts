import { readFileSync } from "node:fs";

export interface VersionInfo {
  version: string;
  gitHash: string;
  buildTime: string;
}

let cached: VersionInfo | null = null;

export function getVersionInfo(): VersionInfo {
  if (cached) return cached;
  try {
    const raw = readFileSync(new URL("../version.json", import.meta.url), "utf-8");
    cached = JSON.parse(raw);
    return cached!;
  } catch {
    cached = { version: "unknown", gitHash: "unknown", buildTime: "unknown" };
    return cached;
  }
}

export function getVersionString(): string {
  const { version, gitHash } = getVersionInfo();
  return `${version}+${gitHash}`;
}
