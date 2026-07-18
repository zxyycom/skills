# 2026-07-01 - 不用脚本校验 workflow 结构

## 索引摘要
- 目的: 避免在校验脚本中复制 workflow 结构，让检查聚焦稳定的项目约束。
- 背景: 用 TypeScript validator 解析或正则匹配 GitHub Actions workflow, 会把 workflow 结构重复表达在脚本里。
- 决策: 校验脚本只检查仓库长期源文件、skill 入口、Markdown 链接、决策记录和 package script 等项目约束。

## 目的
- 避免在校验脚本中复制 workflow 结构，让检查聚焦稳定的项目约束。

## 背景
- 用 TypeScript validator 解析或正则匹配 GitHub Actions workflow, 会把 workflow 结构重复表达在脚本里。
- 这类检查容易变成对代码结构的二次维护, 让真实 workflow、文档约定和校验脚本三处同时漂移。

## 决策
- 采用: 校验脚本只检查仓库长期源文件、skill 入口、Markdown 链接、决策记录和 package script 等项目约束。
- 采用: Workflow 的具体步骤、发布门禁和权限配置不由脚本解析或正则检查。
- 不采用: 用代码检查 workflow 结构或把 workflow 发布契约复制进 validator。

## 关系
- 修订: [使用 latest release 自动发布 skill 制品](260630-publish-skill-package-as-latest-release.md)
- 修订: [使用 skill hash 门禁 latest release 发布](260701-gate-latest-release-by-skill-hash.md)
