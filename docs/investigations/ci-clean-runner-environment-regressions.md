---
title: "CI clean runner 暴露 wrapper 权限与 Git fixture identity 缺口"
formedAt: "2026-09-02T02:41:24+00:00"
question: "为什么 main 的 Package Skills 在 43f2faf 的 clean runner 上失败，而本地门禁通过？"
tags:
  - "ci"
  - "git-fixture"
  - "repository-tooling"
  - "vibe-check"
relations: []
---

## 形成时背景

GitHub Actions 的 [`Package Skills` run 33582749020](https://github.com/zxyycom/skills/actions/runs/33582749020) 于 2026-09-02 在 `main` revision `43f2faf9bf69161f8c565209fe50f8fe0ba8cb2c` 失败；此前最近一次成功 run `33321810329` 使用 revision `303048ef3f19db7e86873c7cf61556338b8971d8`。失败 run 的安装和显式 SCC/Lizard 版本探测通过，但 `Validate and package` 最终只有 52/60 checks passed，4 项 failed、4 项 unavailable；同一 revision 的本地普通门禁此前可以通过。

远端 runner 是新 checkout 的 Ubuntu 24.04 环境，没有可用的全局 Git author identity。当前本地仓库配置 `core.filemode=false`，并具有全局 Git identity；这两个本地状态都可能掩盖 clean runner 问题。本轮只调查和修复本地仓库，没有重跑、取消或修改远端 run。

## 调查目的

确定远端失败是项目代码回归、workflow 依赖安装、runner 版本变化还是测试环境泄漏，形成能够解释所有 failed/unavailable checks 的因果链，并选择不会把测试正确性继续外包给 runner 全局状态的最小修复。停止条件是：原失败条件可在本地以单变量对照复现，修复后同样隔离条件通过，并且与 CI 相同的 release-tag 门禁完整通过。

## 调查范围与依据

- 读取 run `33582749020` 的 `package` job `100100325745`、各 step 状态与失败日志。直接失败包括 `test:environment`、`test:check`、Decision Records lifecycle/recovery 和 pending-stage；Duplicate Detection、Function Metrics 与两个 release terminal checks 为 unavailable。
- 对照 workflow 的 `Install metric prerequisites` 与 `Verify metric prerequisites`：SCC `3.7.0` 和 Lizard `1.23.0` 已成功安装并从 PATH 运行，因此“依赖根本没有安装”与实际日志不符。Node 20 action deprecation 只产生 warning，各 setup step 均成功，也不能解释目标测试的确定性失败。
- 对比 Git tree 与本地文件系统：`scripts/lib/vibe-jscpd.js`、`scripts/lib/vibe-lizard.js` 在 `43f2faf` tree 中均为 `100644`，本地却分别为可执行的 `0775`、`0755`。把两文件临时改为 `0644` 后运行 `bun run test:check`，稳定复现与 CI 相同的两项失败：Duplicate Detection 和 Function Metrics，共 18/20 tests passed；恢复可执行位后 20/20 通过。
- 读取共享 `createGitRepositoryFixture`：首个 fixture commit 只通过进程环境传入 identity，没有写入仓库本地 `.git/config`；fixture 被复制后，`commitWorkspace` 的后续 commit 因此重新依赖宿主配置。使用空 `HOME`/`XDG_CONFIG_HOME` 运行远端对应测试，稳定复现 Decision Records lifecycle 6/68 失败、pending stage 2/21 失败，以及 environment linked-worktree hook 1/9 失败，错误均为 `Author identity unknown`。
- 修复后用相同空 identity 环境重跑：共享 fixture 目标入口 1/1、Decision Records lifecycle 68/68、pending stage 21/21、environment 9/9 全部通过。随后运行 `bun run check -- --tag release --baseline-ref 303048ef3f19db7e86873c7cf61556338b8971d8`，60/60 checks passed，包含 Duplicate Detection、Function Metrics、版本检查与打包。

## 调查结果与边界

确认存在两个独立但都由本地环境掩盖的根因：

1. Vibe Gate 把两个项目 wrapper 配置为自定义 executable，但 Git 没有记录 executable bit。开发工作区保留的文件系统权限让本地调用成功；clean checkout 按 `100644` 物化后，Vibe 的 availability probe 无法执行 wrapper，于是两个 native checks unavailable，对应单测也失败。修复把两个 Git tree mode 记录为 `100755`，不改变 wrapper 内容或依赖版本。
2. Git fixture 的基线提交虽然有固定 identity，后续提交却没有同一仓库本地事实。无全局 identity 的 runner 因此在测试准备阶段失败，测试没有进入原本要验证的 Decision Records 或 hook 行为。修复让共享 fixture 把调用方提供的 name/email 写入本地 config，并让独立的 linked-worktree hook 测试在真实目标 commit 上显式传入其既有固定 identity。

`project-config.test.ts` 报告的 Bun “test inside another test”出现在同一个并行 `test:environment` 聚合运行中，且在首个 environment 测试失败后出现；单独运行该文件及修复后的聚合入口均通过，因此把它判为失败传播时的伴随诊断，而非第三个根因。`Validate skill release versions` 与 `Package skills` 的 unavailable 是前置失败后的无效执行结果，修复前置根因后两者均通过。

本轮已同步两个受影响原生测试入口的 test-evidence case 与派生索引。验证证明本地工作区在隔离条件和 release gate 下符合预期，但尚未推送修复，也没有新的 GitHub-hosted runner run；“远端实际恢复”仍需在提交并推送后由新的 `Package Skills` run 证明。如果新 run 在 wrapper availability 或 Git identity 之外出现不同诊断，应以新环境和 revision 重新调查，不能把本报告外推为所有未来 CI 失败的解释。
