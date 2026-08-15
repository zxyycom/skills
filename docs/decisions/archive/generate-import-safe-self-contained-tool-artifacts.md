---
title: 生成可独立导入的自包含工具产物
status: archived
alignment: aligned
createdAt: 2026-08-11T04:03:07Z
purpose: 让独立 skill 获得不依赖主仓库路径且可安全导入的工具产物。
background: 直接运行仓库源码会破坏独立分发，手工维护多个生成副本又会产生实现漂移。
decision: 构建适配从 tools 源码生成自包含 ESM，并按稳定接口需要生成声明或 Schema。
tags:
  - project-tooling
relations:
  - type: 修订
    target: generate-self-contained-tool-distributions.md
---

## 目的

- 让独立 skill 使用与主仓库维护源码一致、无需仓库布局或其他 skill 的工具产物。
- 让可执行入口、程序化导入边界以及可选机器契约都来自同一生成路径。

## 背景

- 分发工具若在运行时读取 `tools/`、`scripts/` 或其他 skill，就不能作为独立制品安装和升级。
- 手工同步 ESM、声明、Schema 与 source map 会形成多个实现 owner。
- 分发产物的生成责任不决定根项目检查组成、额外 import 扫描门禁或打包时机。

## 决策

- 采用: `scripts/build/` 中的适配器从对应的 `tools/` TypeScript 源生成 import-safe、自包含的单文件 ESM 和 linked source map。
- 采用: 生成模块只在作为主入口运行时执行 CLI，程序化导入不得触发命令执行。
- 采用: 分发产物只依赖目标运行时和包内内容；共享源码由构建器内联，不形成主仓库路径、其他 skill 或跨包运行时前置。
- 采用: 只有行为 owner 明确建立稳定程序化接口时才生成声明入口；只有存在跨语言机器契约时才从结构真源生成 JSON Schema 及相关声明。
- 采用: `sync:*` 通过该生成路径显式写入产物，`check:*` 通过同一路径重建并逐字节比较；生成头只记录稳定源码 owner 和重建入口。
- 不采用: 让分发模块反向导入主仓库源码，或把手工维护的生成副本当作第二实现 owner。
