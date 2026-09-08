# Proposal

恢复本仓库归档决策的历史对齐状态，使每次回填有可复核依据，并为已建立记录统一非空契约准备数据。

## Why

旧归档行为曾主动清空 alignment；更早归档的记录则从未保存该字段。基线中的 92 条空值不能通过
当前代码、后继状态或默认值统一推断。已有调查为其中 31 条找到归档前明确值，其余 61 条需要
结合当时仓库状态召回，详见 [召回线索](recall-evidence.md)。

## Outcome

本仓库所有 active/archived 记录具有明确 alignment；历史空值逐项完成召回、复核和来源修复，
派生索引与 Markdown 一致，逐条证据进入可独立读取的调查报告。

## Scope

### Intended Change

- 对当前归档空值集合按明确旧值恢复、历史事实召回两条路径处理。
- 只修复经审计的 alignment；保持 ID、路径、归档状态、createdAt、正文、摘要、tags 与关系不变。
- 形成单份召回调查报告，保存逐项依据、最终结果及全量非空验证。

### Resulting Impacts

- 由领域 CLI 同步受影响决策及调查报告的派生索引。
- 向严格契约升级交接报告 ID、验证基线与剩余空值数量，避免后续工作依赖已删除的 Change。
- 无充分证据的记录阻断本 Change 完成及下游正式切换；不通过猜测、删除或修改采用方向满足验收。

## Success Criteria

1. 实施基线中的每条目标都有最终结论、历史时点和可定位的证据；新增或消失的目标已逐项对账。
2. 回填值由历史登记或当时完整方向的证据支持；不存在把“未找到证据”当作 unaligned 的项。
3. 每条目标只有 alignment 发生批准的修复，非目标记录不变，决策索引由 CLI 同步且严格检查通过。
4. 当前全部 active/archived 的 alignment 均为 aligned 或 unaligned；候选的合法 null 保持不变。
5. 单份调查报告已建立并通过检查，能够脱离本 Change 恢复逐项依据和交接结果；全仓检查通过。

## Affected Owners

- `docs/decisions/archive/`：目标记录的权威历史字段。
- `docs/decisions/decision-index.json`：由 CLI 派生的决策投影。
- `docs/investigations/`：按 Investigation Report 契约保存的召回结论及派生索引。
- 本 Change：任务进度及调查线索；完成后按 Change Plan 契约删除。
