---
title: 分配可分发工具与仓库自动化的源码 owner
status: active
alignment: aligned
createdAt: 2026-08-11T03:25:49Z
purpose: 让源码路径明确表达运行环境、分发责任和允许的依赖方向，避免分发工具反向依赖仓库编排。
background: 可分发 CLI、仓库脚本和共享协议混在同一层时，独立 skill 会依赖主仓库结构并产生循环 owner。
decision: tools 承接分发运行时及真实共享协议，scripts 承接仓库自动化；领域工具只依赖明确的下层能力。
tags:
  - project-tooling
relations:
  - type: 拆分
    target: separate-tool-source-and-repository-automation.md
---

## 目的

- 让维护者从源码路径判断一项能力是否随 skill 分发、只服务主仓库，或属于多个工具共享的稳定协议。
- 建立从仓库构建适配到可分发工具源码的单向依赖边界，避免运行时反向消费自动化层。

## 背景

- 可分发 CLI 若依赖 `scripts/`、`skills/` 或构建产物路径，独立安装后就无法自包含运行。
- 多个领域工具真实共享的文件系统、版本管理或索引不变量需要稳定 owner，但一次性仓库 hash 不应因此升级为公共协议。
- 仓库入口、构建适配、共享脚本和 validator 具有不同维护责任，全部堆在顶层脚本会模糊边界。

## 决策

- 采用: `tools/<tool-name>/src/` 承接随 skill 分发的运行时源码，`api/` 只承接确需独立维护的公共声明源，`tests/` 承接源码、fixture 与分发模块验证。
- 采用: `scripts/` 只承接主仓库命令编排、校验、打包、Git 与 CI 自动化；生成适配、跨脚本共享能力和 validator 分别进入 `scripts/build/`、`scripts/lib/` 与 `scripts/validators/`。
- 采用: 多个工具已经真实共享的运行时原语进入 `tools/shared/`；发布端和 updater 共同遵守的 skill 版本与 release manifest 协议进入 `tools/skill-package/`。
- 采用: 仓库专用的临时 package hash 留在 `scripts/lib/`，不建立 package lock、公共 fingerprint 协议或分发运行时依赖。
- 采用: 领域工具只依赖自身源码、明确共享层、已建立跨领域协议、目标运行时和显式外部依赖；不依赖 `scripts/`、`skills/`、`dist/` 或另一个领域工具。
- 不采用: 在旧路径保留转发模块或兼容副本，也不为只在本仓库维护的工具源码建立额外包分发模型。
