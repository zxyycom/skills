---
title: 以基础环境 Check 阻断 Gate 工具链漂移
id: 260919-require-gate-environment-check-prerequisite
status: active
alignment: aligned
createdAt: 2026-09-19T11:32:52Z
purpose: 让基础工具版本错误直接定位到环境边界，避免扩散成跨 owner 的级联失败。
background: Gate 曾把 Bun 与 SCC 漂移退化为全量执行，产生生成、测试和指标伪症状。
decision: 采用精确 Bun 契约，并让所有业务 Check 依赖复用自举检查的基础环境 Check。
tags:
  - project-tooling
relations: []
---

## 目的

- 让会改变生成字节、测试语义或必需指标可用性的基础工具漂移，在权威 Gate 启动业务验证前得到单一、可行动的失败诊断。
- 保留完整开发环境诊断与 Gate 必需前置的边界，不让 CodeGraph 索引、Git hook 或 task-graph root 等维护便利条件阻断项目质量门禁。

## 背景

- Bun 同时承担 TypeScript 脚本运行与可分发 bundle 生成；以最低版本范围表达兼容性，却在 CI 固定单一版本，会允许本地产生不同 bundle 字节和运行时测试结果。
- SCC 是 file metrics 的外部必需工具。mise shim 存在但未选择活动版本时，`scc --version` 会失败；旧 Gate 先把工具链快照标记为 unavailable 并执行全部 base Checks，随后才在 metrics 中暴露 unavailable，容易让并发出现的生成和测试失败掩盖根因。
- [增量 Gate 决策](incremental-vibe-gate.md)仍需对依赖图、ast-grep、Oxfmt、Oxlint、tsgo 等起始快照探测失败保守回退；这类快照内部失败不同于能够独立验证的基础工具契约。本判断建立独立的 Check 前置边界，不替代增量选择、receipt、调度或 release 方向，因此不形成决策演进关系。

## 决策

- 采用: `package.json#engines.bun` 固定唯一精确 Bun 版本，CI、环境 setup、fixture、生成校验和维护者入口共同消费该版本；升级 Bun 时同步重新生成受影响制品、验证测试语义，并按版本门禁提升发生版本承载变化的 skill。
- 采用: `scripts/environment.js gate` 作为只读基础工具检查 action，只验证 Git、Node、精确 Bun、精确 pnpm 与精确 SCC；完整 `check` 与 `setup` 继续拥有 CodeGraph、依赖、仓库配置和索引责任。
- 采用: `gate-environment` 是完整 Definition 中无 flag、不可 receipt 复用且每次执行的基础环境 Check；除自身外的所有 Check 都显式依赖它。该 Check 直接调用 `node scripts/environment.js gate`，不在 CLI 或 Check 内复制版本判断。
- 采用: 基础环境失败由 Vibe 结算为真实 failed Check，完整探测输出进入 Check transcript，其他 Check 因前置未通过而不执行；activation plan 可以先完成保守选择，但环境失败时不发布成功 receipt。
- 采用: 基础环境 Check 通过后，增量 impact layer 继续指纹化完整工具链；依赖图或其他快照探测失败仍按原决策全量执行，Vibe 继续独占 Check selection、调度、settlement 与 aggregate。
- 采用: 完整自举 `check` / `setup` 继续覆盖基础工具、CodeGraph、项目依赖、索引和仓库配置；Gate Check 只复用其中的窄 `gate` action，避免把开发便利条件或 Gate 自身依赖变成循环前置。尚未安装项目依赖、无法启动 Vibe 的新工作区仍先运行自举入口。
- 采用: SCC 的恢复诊断表达“让精确版本在当前 PATH 活动”，并分别给出 mise 选择和普通安装路径；不能把可执行 shim 的非零退出误写为尚未安装。
