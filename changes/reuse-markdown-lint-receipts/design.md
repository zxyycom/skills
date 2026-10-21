# Design

以既有 receipt 事务与原生条件承接 Markdown 内容检查的精确复用。

## Context

当前运行契约由 `docs/tooling.md` 维护，接入方式由 `docs/gate-check-authoring.md` 维护。完整 Definition 含 64 项，其中 base 61 项；当前 52 项项目命令参与 receipt，环境与八项原生材料每轮执行。原生 lint 的计算事实缓存不等于全仓成功证明。

## Goals / Non-Goals

目标是补齐 lint 完整输入并复用既有成功证明；不改变规则、质量阈值、链接检查、release 事务或 CI 全执行，不承诺硬秒数收益。

## Decisions

### Intended Change

已确认：lint 保留原生 Check 身份，由现有工具能力与 catalog 声明证明契约，通过原生 `enabledByFlags` 选择。Markdown selection 使用单一 owner，与原生磁盘选择一致；快照联合全部被 lint 消费的 Markdown，包含 ignored、根和额外目录材料。沿用现有起止重采集、passed 核验与原子发布，不另建抽象。

### Resulting Impacts

- 原有每轮执行政策形成 lint 的精确例外；其余七项原生材料与环境仍每轮执行。53 项可复用 Check 共享同一事务，完整 Definition 数量不变。
- 输入闭包含 source 集合、path/kind/mode/bytes、selection、规则、limits/policy、构造实现、manifest/lock 与必要工具链；无法闭合时保守执行。
- 验证覆盖首次、精确命中、MD 变化、ignored/root/额外目录、失败、漂移及 CI/release；Case 与长期 owner 随行为同步。

## Risks / Trade-offs

磁盘 selection 和散列仍有成本；共享 flag 与成功前置可能带入已有精确 receipt 的检查，须如实执行。起止漂移只拒绝发布 receipt，不额外改变本次 Gate 结果。链接消费目标存在性与类型，本轮继续每轮验证。

## Open Questions

实现完成后核对实际契约版本、receipt 路径与 selection owner，再将精确事实同步到稳定文档；不存在待用户决定的范围问题。
