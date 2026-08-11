---
title: 生成并核对可独立导入的工具产物
status: active
alignment: aligned
createdAt: 2026-08-11T04:14:54Z
purpose: 让独立 skill 获得不依赖主仓库路径且可安全导入，并能从唯一源码重建核对的工具产物。
background: 生成检查需要识别真实内容漂移，同时把 CRLF 与 LF 视为同一文本，不能误写成逐字节比较。
decision: 构建适配生成自包含 ESM 与必要契约；sync 写入规范输出，check 重建后按统一行尾比较文本内容。
relations:
  - type: 修订
    target: project-tooling/generate-import-safe-self-contained-tool-artifacts.md
---

## 目的

- 让独立 skill 使用与主仓库维护源码一致、无需仓库布局或其他 skill 的工具产物。
- 让可执行入口、程序化导入边界、可选机器契约及生成漂移检查来自同一构建路径。

## 背景

- 分发工具若在运行时读取 `tools/`、`scripts/` 或其他 skill，就不能作为独立制品安装和升级。
- 手工同步 ESM、声明、Schema 与 source map 会形成多个实现 owner。
- 生成文件是文本产物；跨平台 CRLF 与 LF 不改变其逻辑内容，其他差异才表示生成漂移。
- 分发产物的生成责任不决定根项目检查组成或打包读取哪个版本快照。

## 决策

- 采用: `scripts/build/` 中的适配器从对应的 `tools/` TypeScript 源生成 import-safe、自包含的单文件 ESM 和 linked source map。
- 采用: 生成模块只在作为主入口运行时执行 CLI，程序化导入不得触发命令执行。
- 采用: 分发产物只依赖目标运行时和包内内容；共享源码由构建器内联，不形成主仓库路径、其他 skill 或跨包运行时前置。
- 采用: 只有行为 owner 明确建立稳定程序化接口时才生成声明入口；只有存在跨语言机器契约时才从结构真源生成 JSON Schema 及相关声明。
- 采用: `sync:*` 通过该生成路径写入规范产物；`check:*` 在临时目录重建，并在把 CRLF 规范为 LF 后比较文本内容，除行尾形式外的差异报告为 stale。
- 采用: 可嵌入注释的生成头只记录稳定源码 owner 和重建入口，不写时间戳或本机绝对路径。
- 不采用: 让分发模块反向导入主仓库源码，或把手工维护的生成副本当作第二实现 owner。
