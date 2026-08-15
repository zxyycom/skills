---
title: 生成确定性的 skill ZIP 归档
status: archived
alignment: aligned
createdAt: 2026-08-11T03:25:50Z
purpose: 让相同版本的打包工具对同一 skill 输入生成不受当前时间和文件遍历顺序影响的 ZIP。
background: ZIP entry 顺序和 mtime 若来自运行环境，每次打包都会产生无语义内容变化的不同制品。
decision: Skill ZIP 使用稳定文件排序和固定 mtime，并由成熟归档实现生成，不让环境时间进入产物身份。
tags:
  - project-tooling
relations:
  - type: 拆分
    target: 260701-use-libraries-for-common-script-behavior.md
---

## 目的

- 让 skill ZIP 的内容身份只受真实打包输入和明确工具版本影响，不受当前时间或文件系统遍历顺序干扰。
- 降低无语义制品差异对 hash、发布审阅和重复构建核对造成的噪音。

## 背景

- 文件系统枚举顺序可能随平台和目录状态变化，ZIP entry 的默认 mtime 也可能取当前时间或源文件时间。
- 即使文件内容没有变化，这些环境值仍会改变归档字节和聚合 hash，制造无法由源码解释的发布差异。
- 确定性是打包行为契约，不要求仓库自己实现 ZIP header、CRC 或压缩算法。

## 决策

- 采用: Skill ZIP 在归档前按稳定规范顺序排列全部 entry，并为 entry 使用固定 `mtime`，不读取当前打包时间决定产物字节。
- 采用: 在相同打包工具版本、配置和输入字节下，重复构建应产生相同 ZIP；任何差异都必须能够由这些显式输入解释。
- 采用: ZIP 结构、CRC 和压缩继续交给符合仓库依赖政策的成熟归档实现；确定性适配只负责稳定输入顺序和元数据。
- 不采用: 依赖文件系统原生遍历顺序、运行时当前时间，或为控制归档元数据而重新手写 ZIP 底层格式。
