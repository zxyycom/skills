---
title: 不用脚本校验 workflow 结构
status: active
alignment: aligned
createdAt: 2026-07-18T11:43:07+08:00
purpose: 避免在校验脚本中复制 workflow 结构，让检查聚焦稳定的项目约束。
background: 用 TypeScript validator 解析或正则匹配 GitHub Actions workflow, 会把 workflow 结构重复表达在脚本里。
decision: 校验脚本只检查仓库长期源文件、skill 入口、Markdown 链接、决策记录和 package script 等项目约束。
relations:
  - type: 修订
    target: project-tooling/260630-publish-skill-package-as-latest-release.md
  - type: 修订
    target: project-tooling/260701-gate-latest-release-by-skill-hash.md
---

## 目的
- 避免在校验脚本中复制 workflow 结构，让检查聚焦稳定的项目约束。

## 背景
- 用 TypeScript validator 解析或正则匹配 GitHub Actions workflow, 会把 workflow 结构重复表达在脚本里。
- 这类检查容易变成对代码结构的二次维护, 让真实 workflow、文档约定和校验脚本三处同时漂移。

## 决策
- 采用: 校验脚本只检查仓库长期源文件、skill 入口、Markdown 链接、决策记录和 package script 等项目约束。
- 采用: Workflow 的具体步骤、发布门禁和权限配置不由脚本解析或正则检查。
- 不采用: 用代码检查 workflow 结构或把 workflow 发布契约复制进 validator。
