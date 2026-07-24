---
title: 使用 tsgo 作为默认类型检查入口
status: active
alignment: aligned
createdAt: 2026-07-18T11:43:07+08:00
purpose: 为主仓库脚本提供更快、更稳定的 TypeScript 类型检查入口。
background: 主仓库脚本需要更好的 TypeScript 开发体验和更快的本地类型检查入口。
decision: 安装 `@typescript/native-preview`，并让 `bun run typecheck` 执行 `tsgo --noEmit`。
relations: []
---

## 目的
- 为主仓库脚本提供更快、更稳定的 TypeScript 类型检查入口。

## 背景
- 主仓库脚本需要更好的 TypeScript 开发体验和更快的本地类型检查入口。
- 继续使用 `tsc` 作为默认入口不能体现用户希望引入 `tsgo` 的工具链方向。

## 决策
- 采用: 安装 `@typescript/native-preview`，并让 `bun run typecheck` 执行 `tsgo --noEmit`。
- 采用: `tsconfig.json` 继续作为 IDE 类型提示和 `tsgo` 的统一配置。
- 不采用: 保留 `typecheck:tsc` 或其他 `tsc` fallback 脚本；当前项目只维护一个默认类型检查入口。
