---
title: 为已启用 Hook 授权按小时节流的 Main 自动推送
id: 260908-authorize-throttled-main-auto-push-hook
status: active
alignment: aligned
createdAt: 2026-09-08T16:42:17Z
purpose: 让已启用仓库 hook 的 commit 在明确授权边界内自动同步可快进的 main，同时限制外部写入频率。
background: commit 与手工 push 原本分别授权；本仓库需要把目标和频率受限的自动 push 作为启用 hook 后的预先许可行为。
decision: 启用仓库 hooks 即授权 post-commit 滚动一小时内至多尝试一次非强制 origin main push；该授权不扩展到手工、强制或其他目标 push。
tags:
  - project-tooling
relations:
  - type: 修订
    target: bootstrap-platform-git-hooks
---

## 目的

- 让正常提交能够在已启用仓库 hook 的明确许可下自动同步 `origin/main`，不再要求 agent 为 hook 自身重复取得推送授权。
- 把自动外部写入收敛到可预测的 branch、remote、更新方式和频率，并保留远端冲突时的安全拒绝。
- 继续让 clone 和 linked worktree 通过标准 setup 获得符合当前 Git 平台的全部 hook 条件。

## 背景

- 当前 setup 已经是需要使用者选择的有副作用入口，并通过 `core.hooksPath=.githooks` 启用仓库 hook；原决策只覆盖 `pre-commit` 的跨平台启用条件，没有定义自动远端写入及其授权语义。
- 若每次 commit 都无条件 push，会增加远端写入频率；若用工作树文件或各 worktree 独立状态节流，并发提交又可能绕过上限或污染工作区。
- 自动推送不能用 force 掩盖远端分叉，也不能因失败撤销已经形成的本地 commit；手工推送和其他目标仍应保留独立授权边界。

## 决策

- 采用: `.githooks/*` 通过 `.gitattributes` 固定 LF 并在 Git index 保留 executable mode；标准 setup 始终配置当前 worktree 的 `core.hooksPath=.githooks`，只在 POSIX 恢复 `pre-commit` 与 `post-commit` 的执行位，Windows 继续使用 Git for Windows 的存在性语义。
- 采用: `post-commit` 仅在当前 symbolic branch 是 `main` 且存在 `origin` 时，显式执行非强制 `refs/heads/main:refs/heads/main` 推送。普通 Git fast-forward 检查拒绝冲突或非快进，不回退到 force、其他 branch 或其他 remote。
- 采用: 同一 Git common dir 每小时至多保留一次自动推送尝试。尝试前用独立 Git ref 的 timestamp blob 和 `update-ref` compare-and-swap 建立共享节流状态；失败尝试同样进入一小时窗口，避免网络或冲突失败造成高频重试。
- 采用: `post-commit` 的跳过或失败只产生诊断，不改变已经完成的 commit。节流状态读取、格式或写入无法确认时失败关闭，不发起远端写入。
- 采用: `core.hooksPath=.githooks` 且当前平台所需的 hook 文件条件满足时，即视为使用者启用仓库 hooks 并预先授权上述精确范围的自动外部写入。agent 获得当前 commit 授权后无需再次请求该 hook 的 push 授权，也不专门绕过或阻止 hook；当前任务的显式限制仍优先。
- 不采用: 该启用许可不授权手工调用 helper、手工 push、force、其他 remote/ref 或提高频率；这些动作继续服从当前任务的独立授权。
