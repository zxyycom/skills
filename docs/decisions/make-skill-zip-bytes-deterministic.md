---
title: 让 skill ZIP 字节具有确定性
status: active
alignment: aligned
createdAt: 2026-08-11T04:03:06Z
purpose: 让相同显式输入生成不受当前时间和文件遍历顺序影响的 skill ZIP。
background: ZIP entry 顺序和 mtime 若来自运行环境，会造成没有源码语义变化的不同制品。
decision: 归档使用稳定 entry 顺序和固定 mtime，并保证相同工具、配置与输入产生相同字节。
tags:
  - project-tooling
relations:
  - type: 修订
    target: build-deterministic-skill-zip-archives.md
---

## 目的

- 让 skill ZIP 的字节身份只受明确的打包输入、工具版本和配置影响。
- 降低无语义制品差异对 hash、发布审阅和重复构建核对造成的噪音。

## 背景

- 文件系统枚举顺序可能随平台和目录状态变化，ZIP entry 的默认 mtime 也可能取当前时间或源文件时间。
- 即使文件内容没有变化，这些环境值仍会改变归档字节和聚合 hash。
- 归档实现的选择由依赖政策负责；本记录只定义传给实现的确定性输入及应满足的字节结果。

## 决策

- 采用: Skill ZIP 在归档前按稳定规范顺序排列全部 entry。
- 采用: 每个 entry 使用固定 `mtime`，不读取当前打包时间或源文件时间决定产物字节。
- 采用: 在相同打包工具版本、配置、entry 路径和输入字节下，重复构建必须产生相同 ZIP 字节。
- 采用: 归档字节出现差异时，差异必须能够由上述显式输入变化解释。
