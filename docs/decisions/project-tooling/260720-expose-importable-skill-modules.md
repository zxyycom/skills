# 2026-07-20 - 让 skill 分发脚本同时提供可导入模块

## 索引摘要
- 目的: 让已安装 skill 的自包含代码既能作为 CLI 运行，也能在现有 ESM 进程中直接导入复用。
- 背景: 现有单文件 JavaScript 主要按 Node 子进程入口交付，不同脚本的导入副作用、公共 exports 和 TypeScript 类型支持并不一致。
- 决策: 从同一 TypeScript 源生成 import-safe 的自包含 MJS、声明和 source map；主模块判断负责兼容 CLI。

## 目的
- 让已安装 skill 自身携带可以直接导入的稳定代码接口，不要求调用方连接主仓库源码、安装源码依赖或启动额外的 Node 子进程。
- 保留独立 CLI 的可移植兜底，并让直接导入和 CLI 复用同一份实现与生成检查。

## 背景
- 主仓库已经把 TypeScript 源码、测试和构建入口放在 `scripts/`，skill 目录只保存自包含的生成 JavaScript；这项源码与产物分离仍然有利于维护和独立分发。
- `decision-records.mjs` 已经能够安全导入部分核心函数，但 `validate-skill.mjs`、`test-evidence.mjs` 和自更新脚本仍会在导入时进入 CLI 或缺少一致的公共入口。
- 只有 JavaScript 和 source map 时，TypeScript 调用方无法从安装后的 skill 获得稳定声明；CJS 的 ESM 命名导入也不适合作为统一公共契约。
- 调用方需要的是包内模块，不是另一条连接主仓库源码的依赖路径；把原始 TypeScript 和源码依赖复制进 skill 又会扩大分发面并形成双重 owner。

## 决策
- 采用: TypeScript 源码、公共声明源、测试、夹具和构建入口继续由主仓库 `scripts/` 承接；skill 目录只承接实际分发的生成产物。
- 采用: 需要随 skill 分发的代码统一生成自包含单文件 ESM `.mjs`、同名 `.d.mts` 和 linked source map，由 `sync:*` 写入、`check:*` 逐字节检查，并一起进入 skill hash 和 zip。
- 采用: `.mjs` 导入时不执行 CLI、不修改退出状态，也不触发文件或网络操作；只有模块作为主程序运行时才进入 CLI。公共核心函数返回结构化结果，`run*Cli(argv)` 返回退出码并保留 CLI 输出语义。
- 采用: 自更新模块从 CJS 迁移为 MJS，导出内嵌的只读 skill 配置和 `runSkillUpdaterCli(argv)`；默认目标目录根据模块自身的 `import.meta.url` 定位，不能因被其他项目导入而改指向调用方入口。
- 采用: 分发模块继续只依赖目标的 Node-compatible 运行时和已打包内容，不要求安装主仓库的 Bun、pnpm、TypeScript 或源码依赖；Node CLI 命令继续作为独立运行入口。
- 采用: `pack:skills` 只收集已经同步并提交到 skill 目录的 Git blob，不在打包阶段临时构建源码、声明或未提交产物。
- 不采用: 在 skill 包内复制可直接执行的原始 TypeScript 源码和源码依赖；这会破坏自包含边界并形成源码与生成产物的双重调用契约。
- 不采用: 让已安装 skill 通过外部路径、源码仓库或额外 link 依赖获得可导入接口；公共接口直接由包内 MJS 和声明兑现。

## 关系
- 修订: [分离 skill 分发脚本源码与生成产物](260711-separate-skill-script-source-and-generated-artifacts.md)
