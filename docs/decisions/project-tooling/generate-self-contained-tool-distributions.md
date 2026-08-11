---
title: 从工具源码生成自包含分发产物
status: archived
alignment: aligned
createdAt: 2026-08-11T03:25:49Z
purpose: 让独立 skill 获得可导入、可验证且不依赖主仓库路径的工具产物，并由根检查覆盖生成漂移。
background: 直接运行仓库源码或依赖其他 skill 会破坏独立分发，手工维护生成副本又会产生源码漂移。
decision: 构建适配从同一源码生成自包含 ESM 和必要契约；sync 写入、check 重建比较，根检查覆盖完整链路。
relations:
  - type: 拆分
    target: project-tooling/separate-tool-source-and-repository-automation.md
---

## 目的

- 让每个独立 skill 能够使用与主仓库维护源码一致的自包含工具，不依赖仓库布局或其他 skill。
- 让生成写入、逐字节漂移检查、类型检查和项目门禁共同证明源码到分发产物的单向链路。

## 背景

- 分发工具若在运行时读取 `tools/`、`scripts/` 或其他 skill，就无法作为独立 skill 制品安装和升级。
- 手工同步 ESM、声明、Schema 与 source map 容易产生多个源码 owner，需要由同一构建路径机械生成和核对。
- 根项目已经能够通过 TypeScript 配置、行为测试和生成检查覆盖真实依赖方向，不需要再用正则 import 扫描建立不完整门禁。

## 决策

- 采用: `scripts/build/` 中的适配器从同一 `tools/` TypeScript 源生成 import-safe、自包含的单文件 ESM 和 linked source map；模块只有作为主入口运行时才执行 CLI。
- 采用: 只有行为 owner 明确建立稳定程序化接口时才生成声明入口，只有明确需要跨语言机器契约时才从结构真源生成 JSON Schema 及相关声明。
- 采用: 分发产物只依赖目标运行时和包内内容；共享源码由构建器内联，不形成主仓库路径、其他 skill 或跨包运行时前置。
- 采用: `sync:*` 显式写入生成产物，`check:*` 使用同一构建路径在临时目录重建并逐字节比较；生成头标明维护源码与重建命令，不包含时间戳或本机绝对路径。
- 采用: 根 TypeScript 配置和完整项目检查覆盖仓库脚本、工具源码、行为测试、生成漂移与 skill 打包，不为依赖方向另建基于文本匹配的 import 扫描门禁。
- 采用: `pack:skills` 只收集已经进入版本管理 pending 的稳定 skill 输入，不在打包期间临时生成或修复工具产物。
- 不采用: 让分发模块反向导入主仓库源码，或把手工维护的生成副本当作第二实现 owner。
