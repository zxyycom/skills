---
title: "隔离 CI 版本管理测试的并行负载与失败诊断"
id: "260912-isolate-ci-version-control-test-load"
formedAt: "2026-09-12T02:18:19Z"
question: "为什么 Package Skills 会跨提交间歇失败于 test:version-control，而目标提交在等价本地环境可以通过？"
tags:
  - "ci"
  - "repository-tooling"
  - "test-hermeticity"
  - "vibe-check"
relations:
  - type: "复查"
    target: "260911-explain-ci-cold-proof-test-failure"
    summary: "在后续 CI 失败中复查环境分叉与调度边界"
---

## 形成时背景

GitHub Actions 的 `Package Skills` run
[34620634872](https://github.com/zxyycom/skills/actions/runs/34620634872) 在 2026-09-11
对 `main` revision `56e5885fd9b058e38cef75c4424244132fdda4c0` 执行
release cold gate 时失败。62 个 Check 中 59 项通过，唯一直接失败是
`Script: test:version-control`，版本授权与打包因前置未通过而未运行；前一个 revision
`a7c85f8e` 的 run `34612366456` 在相同 workflow 中通过。

这不是首次出现相同节点的红灯：run `34568945023` 在 release test batch 已启用后也只失败于
`test:version-control`；更早的 run `34318765061` 在批处理引入前单独执行该 package script
时同样失败。三个失败由不同提交触发，相关提交都没有修改版本管理实现或测试。

## 调查目的

区分确定性产品回归、CI 环境分叉、release JUnit 投影错误和并行资源敏感性，解释为什么相同
`test:version-control` 节点会在多次 GitHub run 中间歇失败，并选择既降低误报概率、又能在再次失败时
保留直接诊断的最小修复。停止条件是：远端 revision 能在隔离 clone 与匹配工具版本下执行；候选机制
经过对照；调度改动由 Definition、catalog、直接测试和 cold release gate 验证。新的 GitHub-hosted
run 属于修复提交推送后的环境生效证据，不由本地验证替代。

## 调查范围与依据

- 读取 run `34620634872` 的 job、step 和失败日志：安装、metric 前置与前 60 项普通检查均完成；
  `test:version-control` 投影为退出码 1。终端只保留共享 batch transcript 的尾部
  `118 pass / 0 fail`，该尾部来自整个 worker 输出，不能定位版本管理 suite 的具体失败 case；失败后
  workflow 没有上传 invocation artifacts。
- 对照 run `34568945023` 与批处理前的 `34318765061`，二者也只把
  `test:version-control` 结算为失败；因此排除“`56e5885f` 的 trace 功能改动确定性破坏版本管理测试”
  和“JUnit 批处理是相同症状的必要条件”。
- 在 detached worktree 单独运行远端 revision 的 `bun run test:version-control`，30/30 通过；随后建立
  普通独立 clone，使用 Node `24.18.0`、Bun `1.3.14`、pnpm `11.7.0`、Git `2.53.0`，设置
  `CI=true` 与 `GITHUB_ACTIONS=true`，按 workflow 参数运行 cold release gate，62/62 通过。
- 在同一普通 clone 中连续运行版本管理聚合入口 20 次，全部通过；再并发启动 8 份与 release worker
  相同的八文件分区，每份 JUnit 都将版本管理 suite 记录为 30 项、0 失败，suite 总时长为
  12.146–13.216 秒。未能稳定复现某个产品断言，但证明该套件会在压力下显著变慢。
- 把原 release gate 限制到单 CPU 的区分性对照产生了另一种结果：四路 batch 用 46.21 秒完成
  `118 pass / 0 fail`，但 worker 1 JUnit 缺少请求容器，批次整体 fail closed。该结果证明 batch 在极端
  资源竞争下存在独立的报告完整性边界，但与目标 run 只结算一个 failed suite、其余批次 Check 均通过
  的状态不同，不能冒充本轮直接根因。
- 读取 `tools/shared/tests/version-control*.test.ts`、共享 Git fixture、release batch、Definition 和
  资源契约。版本管理入口包含 30 个真实 Git 仓库测试，会密集创建仓库并启动 Git 子进程；现有
  release 调度把它与另外七个容器放在一个 Bun worker，同时与另三个 Bun worker 并发。

## 调查结果与边界

### 已确认事实与主要推断

已确认这是跨提交重复、但在等价本地工具与环境中不能确定复现的 CI 间歇失败；现有远端摘要不足以
确认具体失败 case。当前证据排除了 trace 变更导致的确定性回归、未安装依赖、单纯 `CI` 环境变量
分叉，以及“批处理本身是必要条件”。资源竞争与大量 Git 子进程是仍符合全部观察的主要机制，但由于
20 次独立运行、一次匹配 CI 的完整 cold gate 和 8 路压力对照均未产生目标失败，本报告不把它提升为
已闭合的单一根因。

### 实际修复

修复按风险边界而不是未知断言内容处理：`test:version-control` 仍是原 package script 和原 30 项测试，
Gate Check ID 仍为 `script:test:version-control`，但该 Check 不再登记进 release test batch。Release
Definition 为它声明全部四个 `cpu-work` unit 和一个 `external-process`，使它相对其他声明 CPU 工作的
Release Check 独立运行。这样避免四路 batch 与版本管理 Git 子进程竞争；若再次失败，transcript 直接
属于 `bun run test:version-control`，不会再被共享 worker 尾部遮蔽。

Base Gate 的资源声明、Check ID、测试内容、版本管理产品实现和 Release 质量真值均未改变。批次成功
证明的身份随 catalog 自动变化，命中 proof 也不会省略独立版本管理测试；learned scheduler 的项目
实现身份从 `gate-scheduler-v2` 升至 `gate-scheduler-v3`，避免沿用资源策略改变前的时长历史。

### 验证与重新调查条件

修改后的 `bun run test:check` 为 43/43 通过，`bun run test:version-control` 为 30/30 通过，
Test Evidence 当前 850 个实体的引用检查通过。使用 Node `24.18.0`、`CI=true`、
`GITHUB_ACTIONS=true` 执行 `bun run check -- --tag release --cold --baseline-ref HEAD`，62/62
Check 通过；独立版本管理 Check 用时 2.9 秒，版本授权和打包均完成。该修复尚未提交或推送，不能证明
GitHub-hosted runner 已恢复。如果独立后的远端运行仍失败，新的直接 transcript 应用于定位具体 case；
如果失败转为 JUnit 覆盖不完整，应单独调查 batch 报告边界，不能把两种终态合并为同一根因。
