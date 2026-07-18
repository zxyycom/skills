# 2026-07-01 - 使用版本化 release 发布 skill 制品

## 索引摘要
- 背景: 固定 `*-latest` release 被更新后，GitHub 页面仍显示 release 最初的 `published_at`，容易让使用者误以为包没有更新。
- 决策: 主仓库聚合发布和子仓库独立发布都使用 `<timestamp>-<hash12>` 作为版本化 release tag，时间戳使用 UTC `YYYYMMDDTHHMMSSZ` 格式。

## 背景
- 固定 `*-latest` release 被更新后，GitHub 页面仍显示 release 最初的 `published_at`，容易让使用者误以为包没有更新。
- 只覆盖 latest assets 缺少稳定的历史版本入口，不利于回滚、比对和确认某个包内容的发布时间。
- 仓库没有人工维护的语义版本号，不能把版本发布依赖到手写 changelog 或手动 bump。

## 决定
- 采用: 主仓库聚合发布和子仓库独立发布都使用 `<timestamp>-<hash12>` 作为版本化 release tag，时间戳使用 UTC `YYYYMMDDTHHMMSSZ` 格式。
- 采用: 主仓库 `<hash12>` 来自根目录 `skill-package-lock.json` 中 `aggregateHash` 的前 12 位；子仓库 `<hash12>` 来自该子仓库 `skill/` tree hash 的前 12 位。
- 采用: 版本化 release 是 GitHub Releases 列表里的真实发布记录，并显式标记为 Latest。
- 采用: 继续同步维护 `skills-latest` 和 `<repo-name>-latest` release，作为已有安装脚本和固定下载链接的兼容入口。
- 采用: 是否发布仍由当前聚合 hash 与上一提交中的聚合 hash 是否不同决定；`workflow_dispatch` 保留手动重发能力。
- 不采用: 为每次非 skill 提交创建版本化 release；版本号代表可安装包内容，不代表仓库提交历史。
- 不采用: 引入人工语义版本号；当前缺少需要人工版本规划的发布说明和兼容性承诺。

## 关系
- 修订: [使用 latest release 自动发布 skill 制品](260630-publish-skill-package-as-latest-release.md)
- 修订: [使用 skill hash 门禁 latest release 发布](260701-gate-latest-release-by-skill-hash.md)
