---
title: "定位失败构建后滚动 Skill Release 不补发"
id: "260923-stale-skill-release-after-failed-ci"
formedAt: "2026-09-23T09:00:25Z"
question: "为什么含 skill 变更的 CI 失败后，后续成功构建没有补发当前制品？"
tags:
  - "ci"
  - "release"
  - "repository-tooling"
relations: []
---

## 形成时背景

2026-09-23 的 `main` 中，`skills/change-plan` 等六个 skill 的源码版本已高于 GitHub `skills-latest` 中的 manifest，安装端的 updater 因而看不到这些新版本。预期是一次包含新制品的成功构建最终能使滚动 Release 与当前制品一致；实际最近一次成功的 Package Skills 构建没有进入 publish job。本轮只读核对远端状态，不手工改动 Release。

## 调查目的

确定远端包落后是打包、版本门禁、发布事务还是发布触发判断造成；找到能在失败构建之后自动补发、又不在资产已同步时无谓写入远端的修复边界。

## 调查范围与依据

- 2026-09-23 读取仓库 `main@b4bc8578` 的 `.github/workflows/package-skills.yml`、发布器、版本/打包实现、updater 和 `docs/tooling.md`。`pack:skills` 从同一个 Git pending 快照产生 zip 与 manifest；updater 先读 manifest 版本，只有发现新版才下载并核对 zip。
- 通过 `gh release view skills-latest` 与 GitHub API 实际读取远端 Release 和 manifest：Release target 为 `33f8b40d`，manifest 中 `change-plan=28`、`decision-records=61`、`git-commit-organizer=5`、`investigation-report=51`、`task-graph=19`、`test-evidence-review=28`；当前源码分别为 `29/66/6/56/20/30`。`git diff 33f8b40d HEAD -- skills` 确认对应包内容也已改变。
- `gh run view 35815406489 --log-failed` 显示含 skill 变更的 `1b9ef733` 构建因 Decision Records pending-stage 测试失败，`release:skill-version` 与 `pack:skills` 未运行，发布 job 跳过。`gh run view 35817670009` 显示随后的 `b4bc8578` package job 成功，但 `publish` 被跳过；其日志明确输出 `Skill package content changed: false`，所用事件基线是 `1b9ef733`。
- 未检查消费者本机安装状态，也未下载全部远端 zip 逐字节比较；本轮不执行 GitHub 远端写入。

## 调查结果与边界

根因在 workflow 发布触发条件，而非 updater 的版本解析：原逻辑只比较**本次 push** 的 `before..HEAD -- skills`。含 skill 变更的构建失败时制品未发布；之后只有测试修复而没有 skill 改动的构建虽成功，本次 diff 为零，遂跳过发布。这样失败前积累的未发布版本不会由成功构建补偿，updater 仍收到旧 manifest。

本轮将每次成功的 `main` package job 接入发布核对，并在发布器中以完整资产名称、大小和 GitHub SHA-256 digest 判断是否已经同步；一致时只读返回，无 digest 或存在差异时沿既有先 zip 后 manifest 的恢复顺序同步。新增测试覆盖资产一致时不移动 tag、不 push、不上传；既有测试继续覆盖资产差异和远端 Release 缺失。本地 `bun run test:skill-release-publisher` 的六个测试、`bun run check` 的 60 个适用 Check，以及 `bun run check -- --tag release --cold --baseline-ref HEAD` 的 63 个 Check 全部通过。该 release Gate 从当前 Git index 打包，不能代替未来提交后的 GitHub Actions 结果。此改动仅在工作区，尚未提交、触发 GitHub Actions 或改变远端 Release。远端恢复须在修复进入 `main` 且 CI 完整通过后，以新 run 的 publish job 与远端 manifest 再次核对；若构建持续失败，发布仍会被门禁阻断。
