---
title: 用独立版本和文件覆盖更新 skill
status: active
alignment: aligned
createdAt: 2026-07-24T04:13:51Z
purpose: 让本地定制不干扰更新判断，并避免更新删除正式制品之外的本地文件。
background: 用本地目录 hash 判断更新会把定制误判为新版本，整目录替换还会删除额外文件。
decision: updater 只比较每个 skill 的独立版本，确认前列出文件，并覆盖正式制品中的路径。
relations:
  - type: 修订
    target: project-tooling/260703-use-per-skill-hash-lock-for-updater.md
  - type: 修订
    target: project-tooling/260703-follow-latest-release-for-skill-updater.md
---

## 目的
- 让本地定制不改变 skill 是否存在上游更新的判断。
- 让使用者在写入前知道哪些现有文件会被覆盖、哪些文件会被新增。
- 更新正式制品中的文件时保留远端包没有包含的本地文件。

## 背景
- 主仓库继续通过聚合 release 发布每个 skill 的独立 zip，但任一 skill 变化都会产生新的聚合 release。
- updater 原来比较远端 skill hash 与当前本地目录 hash；本地定制会让两者不同，即使对应 skill 没有发布新版本。
- updater 原来通过替换整个目标目录完成更新，远端包中不存在的本地文件也会被删除。
- 仓库仍可以在发布时临时计算 hash 标识本次制品并检查版本遗漏，但这些职责不要求进入已安装 skill 的更新协议，也不需要持久化 package lock。

## 决策
- 采用: 每个 `skills/<skill-name>/SKILL.md` frontmatter 的 `metadata.version` 保存手动维护的正整数字符串独立版本；正式 release 提供只包含各 skill 版本的 `skill-release-manifest.json`。
- 采用: updater 只比较本地 `metadata.version` 与正式 release manifest 中当前 skill 的版本，不读取、不计算也不回退使用 package hash。
- 采用: 需要写入时下载对应 skill zip，并验证 zip 内 `SKILL.md` 的 `metadata.version` 与 release manifest 一致。
- 采用: updater 在确认前分别列出将覆盖的现有文件和将新增的文件；`--yes` 只跳过交互确认，不能省略文件清单。
- 采用: 更新只覆盖 zip 中包含的文件路径，不删除 zip 中不存在的本地文件；同名本地文件的定制由使用者根据更新前清单决定是否允许覆盖。
- 采用: 默认继续跟随正式 latest release，`--release-tag` 保留为指定正式 release 的入口。
- 采用: 仓库 package hash 只按需临时计算，不保存 hash 或 lock，也不作为 updater 的输入。
- 不采用: 根据本地内容 hash 推断安装版本或本地定制状态；这会重新耦合仓库内容证明与已安装 skill 更新。
- 不采用: 跟踪 `skill-package-lock.json` 或其他派生 package 状态文件；版本与 Git 历史已经能够承接更新判断和版本遗漏检查。
- 不采用: 自动合并同名文件中的本地定制；当前只承诺更新前清楚展示并由使用者确认覆盖。
