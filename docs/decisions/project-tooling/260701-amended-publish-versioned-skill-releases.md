# 2026-07-01 - 使用版本化 release 发布 skill 制品

## 状态
- 当前状态: amended
- 导致状态变化的决策: [2026-07-02 - 迁移为 skills 单仓库布局](260702-active-use-monorepo-skills-directory.md), [2026-07-03 - 用 skill package lock 承接发布和自更新](260703-active-use-per-skill-hash-lock-for-updater.md)
- 状态说明: 主仓库聚合发布仍按 UTC 时间戳和内容 hash 创建版本化 release，并同步维护 `skills-latest` 兼容入口；子仓库独立版本化 release 已不再作为当前契约，主仓库 tag hash 来源已改为 `skill-package-lock.json` 的 `aggregateHash`。

## 问题
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

## 影响
- 新的 skill 内容会产生新的 release 页面和准确的发布时间。
- `*-latest` 页面可能继续显示旧的 `published_at`，它只表示稳定下载入口，不表示最新发布时间。
- 相同 skill 内容在不同发布时间可以产生不同版本化 tag，但 tag 尾部 hash 保持可识别的内容指纹。
- 后续需要从 GitHub Releases 判断最新发布时间时，应查看被标记为 Latest 的版本化 release，而不是固定 `*-latest` release。

## 验证
- `.github/workflows/package-skills.yml` 在发布 job 中创建或更新 `<timestamp>-<hash12>`，并同步维护 `skills-latest`。
- 三个 submodule 的 `.github/workflows/publish-skill-package.yml` 在发布 job 中创建或更新 `<timestamp>-<hash12>`，并同步维护 `<repo-name>-latest`。
- `docs/tooling.md` 记录版本化 tag、latest 兼容入口和 hash 门禁关系。
