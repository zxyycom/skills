---
title: 将受管调查资源限制为版本控制可见成员
status: active
alignment: aligned
createdAt: 2026-08-29T15:42:48Z
purpose: 让项目 ignore 排除的未跟踪生成文件退出受管调查资源成员与引用完整性检查。
background: 递归扫描全部磁盘文件会把项目已忽略的缓存和编译产物误判为完全未引用资源，而内置缓存名单无法覆盖项目真实边界。
decision: Git 工作区只管理版本控制可见资源；非 Git 工作区继续完整发现文件系统资源。
tags:
  - investigation-report
  - version-control
relations:
  - type: 拆分
    target: define-version-control-visible-investigation-resources.md
---

## 目的

- 让项目已经通过版本控制 ignore 排除的未跟踪缓存、编译产物和本地噪声不进入调查资源的完全未引用资源检查。
- 保持报告引用可分发，不让本地不可见材料成为调查证据。

## 背景

- `_resources/` 可能保存需要脚本处理的形成时材料；递归文件系统扫描会发现项目已明确忽略的未跟踪文件。
- 内置语言或工具缓存名单无法覆盖各项目的真实生成文件，也可能静默排除用户有意保存的材料。

## 决策

- 采用: Git 工作区以 `git ls-files --cached --others --exclude-standard` 在 `_resources/` 范围内返回的文件作为受管资源；ignore 排除的未跟踪文件不参与完全未引用资源检查，已经跟踪的文件即使命中 ignore 仍保持受管。
- 采用: 报告显式引用存在但因 Git ignore 退出版本控制可见集合的未跟踪文件时失败，避免本地不可分发材料成为调查证据。
- 采用: 非 Git 工作区没有可复用的项目 ignore 语义时继续完整发现 `_resources/` 文件系统成员。
- 不采用: 调查工具内置缓存名单或独立 `.investigationignore`。
