---
title: 分离工具源码与仓库自动化
status: active
alignment: aligned
createdAt: 2026-07-24T05:56:33Z
purpose: 让可分发工具源码、共享协议、仓库自动化和 skill 产物保持单向 owner 边界。
background: 可分发运行时曾依赖仓库脚本，package lock 又把仓库状态误放进共享协议层。
decision: "`tools/` 维护可分发能力，`scripts/` 维护仓库自动化，临时 package hash 不进入共享协议。"
relations:
  - type: 修订
    target: project-tooling/separate-distributable-tool-source-from-repository-automation.md
---

## 目的
- 让维护者能够从路径判断代码的运行环境、分发责任和允许的依赖方向。
- 让独立安装的 skill 获得自包含工具，同时让仓库专用自动化不成为分发协议。

## 背景
- 可分发 CLI、仓库校验和构建适配混在 `scripts/` 时，工具运行时会反向依赖项目编排层。
- 文件系统、版本管理和 release manifest 等能力会被多个分发工具消费，需要稳定的共享 owner。
- package hash 只服务当前仓库的待提交检查和发布标识，不需要被 updater 或其他分发运行时消费。

## 决策
- 采用: `tools/<tool-name>/src/` 承接可分发运行时源码，`api/` 承接公共声明源，`tests/` 承接对应源码、fixture 和分发模块验证。
- 采用: `scripts/` 只承接仓库命令编排、校验、打包、Git 与 CI 自动化；构建适配、脚本共享能力和 validator 分别进入 `scripts/build/`、`scripts/lib/` 与 `scripts/validators/`。
- 采用: 多个工具真实共享的运行时原语进入 `tools/shared/`；发布端与 updater 共同遵守的 skill 版本和 release manifest 协议进入 `tools/skill-package/`。
- 采用: 仓库专用的临时 package hash 留在 `scripts/lib/`，不建立 package lock、共享 fingerprint 协议或分发运行时依赖。
- 采用: 具体工具只依赖自身、明确的共享层、目标运行时和显式外部库，不依赖 `scripts/`、`skills/`、`dist/` 或另一个领域工具。
- 采用: 构建器从同一 TypeScript 源生成 import-safe 的自包含 ESM、声明和 source map；`sync:*` 显式写入，`check:*` 逐字节验证，独立 skill 不需要连接主仓库或其他 skill。
- 采用: 根 TypeScript 配置和完整项目检查覆盖仓库脚本、工具源码、行为测试、生成漂移和 skill 打包，不为依赖方向额外建立 import 扫描门禁。
- 不采用: 在旧路径保留转发模块或兼容副本，也不为只在本仓库维护的工具源码建立额外包分发模型。
