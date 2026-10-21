# Design

以既有 receipt 事务与原生条件承接 Markdown 内容检查的精确复用。

## Context

当前运行契约由 `docs/tooling.md` 维护，接入方式由 `docs/gate-check-authoring.md` 维护。实施前基线的完整 Definition 含 64 项，其中 base 61 项；52 项项目命令参与 receipt，环境与八项原生材料每轮执行。原生 lint 的计算事实缓存不等于全仓成功证明。

## Goals / Non-Goals

目标是补齐 lint 完整输入并复用既有成功证明；不改变规则、质量阈值、链接检查、release 事务或 CI 全执行，不承诺硬秒数收益。

## Decisions

### Intended Change

已确认：lint 保留原生 Check 身份，由现有工具能力与 catalog 声明证明契约，通过原生 `enabledByFlags` 选择。Markdown selection 使用单一 owner，与原生磁盘选择一致；快照联合全部被 lint 消费的 Markdown，包含 ignored、根和额外目录材料。沿用现有起止重采集、passed 核验与原子发布，不另建抽象。

继续使用 `project-tool-receipts-v5` / `formatVersion: 2`；新增 `markdown-lint` 契约 version 为 `1`，订阅 `markdown-content`，selection owner 为 `impact-paths.ts#maintainedMarkdownFiles`。

### Resulting Impacts

- 原有每轮执行政策形成 lint 的精确例外；其余七项原生材料与环境仍每轮执行。53 项可复用 Check 共享同一事务，完整 Definition 数量不变。
- 输入闭包含 source 集合、path/kind/mode/bytes、selection、规则、limits/policy、构造实现、manifest/lock 与必要工具链；无法闭合时保守执行。
- 验证覆盖首次、精确命中、MD 变化、ignored/root/额外目录、失败、漂移及 CI/release；Case 与长期 owner 随行为同步。
- 实际 unchanged smoke 发现基线已有四个领域测试输入未归属，导致全体 fallback、不能发布 receipt。已按实际 wrapper 加载闭包将其补入现有 record/query 能力，并在既有 routing 节点与 Case 中验证；未新增能力、改领域代码、检查范围或 unknown 保护。该补齐是使本次精确复用在真实仓库成立的必要影响，由任务 1.2 承接。

## Risks / Trade-offs

磁盘 selection 和散列仍有成本；共享 flag 与成功前置可能带入已有精确 receipt 的检查，须如实执行。起止漂移只拒绝发布 receipt，不额外改变本次 Gate 结果。链接消费目标存在性与类型，本轮继续每轮验证。

## Open Questions

无。

## Implementation Observations

完整输入闭合后，实际 base Gate 61 项通过并发布 53 项 receipt；不变输入 smoke 为 0 execute / 53 reuse，共享源码及其两个生成副本变化为 7 execute / 46 reuse，lint 均精确复用，links 均实际通过。根目录与 ignored 目录的违规 Markdown 均触发 lint 执行失败且不发布证明，既有 receipt 字节保持不变。冷 release Gate 64 项实际通过且不读写 receipt；详细证据与未覆盖边界由 `tasks.md` 承接。
