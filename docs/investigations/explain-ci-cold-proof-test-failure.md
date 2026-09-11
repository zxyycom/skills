---
title: "CI 环境变量使 release proof mode 测试与本地结果分叉"
id: "260911-explain-ci-cold-proof-test-failure"
formedAt: "2026-09-11T04:41:07Z"
question: "为什么 3f960041 之后本地门禁可以通过，而 Package Skills 在 CI 中持续失败于 test:check？"
tags:
  - "ci"
  - "repository-tooling"
  - "test-hermeticity"
  - "vibe-check"
relations:
  - type: "复查"
    target: "ci-clean-runner-environment-regressions"
    summary: "复查新 Gate 被 CI 环境变量触发的本地与远端分叉"
---

## 形成时背景

GitHub Actions 的 `Package Skills` 从提交 `3f9600414504e777597babd08205e6c67f793fd5`
开始出现连续失败。调查时可见的四次连续失败分别是
[run 34382202354](https://github.com/zxyycom/skills/actions/runs/34382202354)、
[run 34448361176](https://github.com/zxyycom/skills/actions/runs/34448361176)、
[run 34552845224](https://github.com/zxyycom/skills/actions/runs/34552845224) 与
[run 34560727053](https://github.com/zxyycom/skills/actions/runs/34560727053)。四次都在
`Validate and package` 的 `Script: test:check` 失败；最新一次中其他 59
项普通 Check 全部通过，版本授权与打包仅因前置失败而未运行。最近一次成功的
[run 34347001104](https://github.com/zxyycom/skills/actions/runs/34347001104)
使用提交 `12577684c320b01155679c53a5a1149e13c98200`，位于 `3f960041`
之前。

`3f960041` 同时引入 release test batch proof 的运行时逻辑与
`scripts/vibe-check-proof-mode.test.ts`。本地不设置 `CI` 环境变量时，直接运行
`bun run test:check` 可以通过，因而本轮先区分“增量 Gate 漏选”、“完整 Gate
并发时序”与“CI 环境语义”三类候选解释。根因闭合后，用户授权直接修复该局部缺口；
本轮不修改 workflow、发布交易或远端状态。

## 调查目的

回答为什么维护者在推送前已运行的本地 `check` 可以通过，而同一实现在 GitHub
Actions 中持续失败；确认失败是产品门禁行为错误、测试的环境耦合，还是本地与 CI
执行入口不等价。停止条件是在当前 revision 上以单变量对照稳定复现 CI 的断言失败，
并把环境条件、源码逻辑和引入时间连成因果链。

## 调查范围与依据

- 读取 `.github/workflows/package-skills.yml`、`package.json`、`docs/tooling.md`、
  `scripts/vibe-check.ts`、`scripts/vibe-check-proof-mode.test.ts` 与相关 Git 历史。
  workflow 明确运行 `bun run check -- --tag release --cold --baseline-ref <event-baseline>`；
  GitHub Actions 进程另外具有真值 `CI` 环境变量。
- 读取上述四次失败 run 的 job 状态和失败日志。日志一致指向
  `Script: test:check`，并在最后保留 `strictEqual` 的 `diff: 'simple'`；当前诊断尾部未保留
  失败测试名与断言行，workflow 也在 Gate 失败后跳过 artifact 上传。
- 在当前 `main` revision `5aab0174102b48b66f230093b49004115eb7478f`
  上直接运行 `bun run test:check` 三次，每次均为 43/43 通过。仅增加
  `CI=true` 后运行同一命令，稳定变为 42/43，失败用例为
  `CLI publishes auditable release test proof modes`，断言位于
  `scripts/vibe-check-proof-mode.test.ts:59`，实际值 `true`、期望值 `false`。
  把测试和忙循环固定在同一 CPU 核上后仍在同一断言失败，因而无需用并发时序解释该现象。
- `scripts/vibe-check.ts:162-166` 把有效 cold 模式定义为显式
  `invocation.cold` **或**真值 `process.env.CI`。测试的首个场景则调用
  `runVibeCheck(["--full"])` 并在第 59 行断言传入 definition 的 `cold`
  仍等于函数参数 `false`。该期望只在宿主没有真值 `CI` 时成立。
- Git blame 确认上述测试与断言由 `3f960041` 引入；这与连续失败的首个
  revision 一致，而前一个 revision 的 workflow 通过。
- 调查期间两次运行当前本地 base Gate，59 项普通 Check 均因输入变化实际执行；
  `test:check` 通过，但 `Task Graph portable build` 因本机 dependency 布局导致
  source map 出现越界的 `../node_modules/supports-color/index.js` 而失败。相应 Check
  在最新 CI 通过，因此这是另一个本地环境问题，不是本轮 CI 连续失败的原因。

## 调查结果与边界

### 已确认的根因

连续 CI 失败的直接根因是 **proof-mode 单测依赖未控制的宿主 `CI` 环境变量**。
生产逻辑有意把 CI 视为 cold，但测试又要在第一个场景证明“未显式传 `--cold`
就可以复用 proof”。本地通常没有 `CI`，所以得到 `cold=false`；GitHub Actions
自带 `CI=true`，所以同一调用得到 `cold=true` 并在进入真正测试行为前断言失败。
这是可由单变量稳定复现的测试密封性缺口，不是最近四次提交各自引入了新回归，也不是当前证据下的时序抖动。

### 为什么本地 `check` 和本地 `--cold` 都可能是绿的

1. 本地 base Gate 与 CI 的 tag 和重跑策略不同：前者可按输入 proof 复用通过的 Check，
   后者激活全部 62 项并禁止复用 release test batch proof。这会让 CI 更容易暴露未在本次重跑的问题，
   但不是首次 `3f960041` 失败的必要解释：即使直接重跑 `test:check`，环境对照仍会分叉。
2. 本地运行 `bun run check -- --tag release --cold` 也没有完整模拟 CI。外层
   `--cold` 只影响真正 Gate 的 release batch；`test:check` 是另一个子进程，它内部的用例重新调用
   `runVibeCheck(["--full"])`，不会继承外层 CLI 的 `--cold` argv。它会继承的是环境：
   本地无 `CI` 时继续通过，GitHub Actions 有 `CI=true` 时失败。

因此，“CI 调用同一个 `bun run check` 入口”只保证了命令 owner 一致，不保证宿主环境与
测试语义完全等价。当测试直接读取宿主环境时，本地通过不能证明 CI 条件下也通过。

### 实际修复、验证与未验证边界

已在 `VibeCheckDependencies` 增加可选的 `continuousIntegration` 事实。未注入时，
`runVibeCheck` 仍按原逻辑从 `process.env.CI` 派生，因而生产行为未变；proof-mode
测试改用 `reused`、`explicit-cold` 和 `ci-cold` 三种显式 fixture 模式，分别证明本地
可复用、显式 cold 和 CI 隐式 cold，不再依赖测试宿主。对应
`GATE-CLI-RESULT-001` Case 已同步当前 Contract 与 Proves，Case-only 索引已重建。

修复后的直接验证如下：

- `CI=true bun run test:check`：43/43 通过，原 CI 复现已关闭。
- `env -u CI bun run test:check`：43/43 通过，本地可复用路径保持。
- `bun run typecheck`、`bun run lint`、`bun run format:check`：全部通过。
- `bun run check:test-evidence-catalog`：827 个当前测试实体的项目引用检查通过；
  Case-only 目录检查同步通过。
- 调查集合检查 40/40 通过。
- `bun run check`：原失败项 `Script: test:check` 已通过，共 58 项通过、1 项失败、
  3 项 release-only 未启用；唯一失败仍是下述本机 `Task Graph portable build`。

当前 CI 日志的有界尾部只显示 assertion 对象的最后两行，且 Gate 失败后不上传本次
invocation transcript，使失败归因不必要地依赖本地复现。可在独立改动中让失败时的诊断保留用例名、
位置和首个断言摘要，或上传最小 Gate artifact；这不是修复本轮根因的前置。

截至报告形成，已修改 Gate 内部依赖注入与相应测试，但没有修改 workflow 或发布交易，
也没有发起新的 GitHub Actions run；因而本地证据已关闭原复现，远端实际恢复仍需修复提交并推送后的新 run 证明。
当前本地 `Task Graph portable build`
失败需要另行调查；若修复 proof-mode 测试后 CI 出现不同失败，应按新日志和 revision
重新界定，不把本报告外推为所有本地/CI 分叉的通用解释。
