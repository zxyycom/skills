# Design

本设计暂定把领域目录项纳入 `stage` 的显式目标构造，使新领域与首批决策在不吸收其他 `filesystem` 变化的前提下形成同源 `pending` 快照。

## Context

- 已对齐决策 [`stage-selected-decisions`](../../docs/decisions/decision-records/stage-selected-decisions.md) 明确规定：已有决策基线时使用 `revision` 中的领域目录表，只有首次建立整个决策集合时才从 `filesystem` 读取目录表；依赖目录表之外领域的目标必须失败。
- [`Decision Records`](../../skills/decision-records/SKILL.md) 目前据此要求 `stage` 以 `revision` 决策集合为基线，并让目标领域目录表、全部目标 Markdown 与完整索引来自同一目标来源。
- `tools/decision-records/src/decision-stage-service.ts` 的 `readDecisionBaseline` 在 `revision` 已有决策范围时读取并返回该版本的目录表，`buildDecisionStageTarget` 只叠加显式选择的决策路径；当前输入模型没有领域条目选择。
- `tools/decision-records/tests/stage.test.ts` 中 `stage rejects invalid candidate domain and relationship targets before pending writes` 已把“工作区目录表新增领域、所选决策属于该领域时拒绝写入”固定为回归证据，对应测试证据为 [`DECISION-STAGE-TARGET-VALIDATION-001`](../../docs/test-evidence/decision-records/stage-rejects-invalid-candidate-domain-and-relationship-targets-before-pending-writes.md)。
- 按本次操作记录，两条决策与新 `engineering-guidance` 领域需要进入同一个提交，手工选择目标领域表、两条决策和由它们重建的完整索引已经核对为正确快照；本 draft 没有复验该具体快照。该操作没有经过 `stage` 的目标构造与写入门禁，交付时应明确标为例外。

## Goals / Non-Goals

目标：

- 为“新增一个或多个领域目录项，并同时暂存这些领域的首批显式选择决策”提供 Decision Records 原生入口。
- 让目标目录表由 `revision` 基线与显式选择的 `filesystem` 领域条目构造，目标决策继续由 `revision` 基线与显式选择的决策路径构造，再从两者生成并验证完整索引。
- 保留当前 `stage` 的隔离保证：未选择的目录表变化、未选择的决策变化、`filesystem` 内容和决策范围外既有 `pending` 内容不被带入。
- 在任何 `pending` 写入前拒绝缺少领域条目、遗漏必要关系成员、非法领域边界或其他不能形成完整合法集合的选择。

非目标：

- 不把手工编辑或手工暂存派生索引确立为受支持流程。
- 不让 `stage` 自动吸收整个 `filesystem` 领域表或所有同领域决策。
- 不改变候选、激活、演进、归档和对齐等生命周期命令的 `filesystem` 责任。
- 不在本 draft 中承诺领域修改、领域删除或领域重命名的选择语义；这些操作的影响面不同于新增领域，需要在确认 plan 前单独裁定。

## Decisions

- **暂定采用显式领域选择。** 调用方除决策路径外还要明确选择需要从 `filesystem` 叠加的新领域 ID；不能只因决策路径的第一段属于新领域就静默扩展目标。具体 CLI 拼写在 plan 前确定。
- **暂定按领域条目叠加目录表。** 目标目录表从完整 `revision` 目录表开始，只加入显式选择且存在于 `filesystem` 的新领域条目；不直接采用整份 `filesystem` 目录表，避免把并行领域变化带入当前提交。
- **保持同源构造和单次替换。** 目标领域表、显式选择后的完整决策集合和派生索引必须在内存中作为一个目标验证，并继续通过共享版本管理层一次性替换完整 `pending` 决策范围。
- **把现有行为视为需演进的长期方向。** 实施前需要按 Decision Records 契约为 [`stage-selected-decisions`](../../docs/decisions/decision-records/stage-selected-decisions.md) 建立合法后继，而不是原地改写已对齐历史；只有新方向确认后才推进本 Change 到 plan。
- **不把本次手工结果当作能力证据。** 该结果只证明这个具体目标快照可以正确构造，不证明 CLI 已支持该场景，也不替代新增领域隔离、失败原子性和回归测试。

## Risks / Trade-offs

- `decision-domains.json` 是完整目录表而不是按领域分文件；实现必须提供条目级合成和确定性序列化，否则会重新引入聚合文件的并行暂存冲突。
- 新领域的首批决策可能互相引用，或引用未选择的候选与既有记录；显式选择不会自动保证闭合，完整集合校验仍可能要求调用方补齐选择或修正关系。
- 只支持领域新增可以用较小责任面补上已观察缺口，但会让修改、删除和重命名仍有不同入口边界；若一次性泛化全部目录表变化，则领域删除对既有未选择决策的影响会显著扩大设计和验证范围。
- 扩展现有已对齐行为需要同步长期决策、Skill 契约、可分发 CLI、版本和测试证据；只修改工具实现会造成行为 owner 与运行结果不一致。
- 最后一次成功 `stage` 仍会决定完整 `pending` 决策范围。新领域选择不能改变现有的覆盖、并发前提和恢复语义。

## Open Questions

1. CLI 应使用重复的 `--domain <domain-id>`、单独的领域选择参数组，还是其他能够与决策路径清楚区分的显式语法？
2. 首个实现是否只接受 `revision` 中不存在的领域新增，还是同时定义既有领域条目的修改、删除与重命名语义？
3. 当显式选择了新领域但没有选择该领域的任何已建立决策时，应允许只暂存空领域，还是按本 Change 的“新领域及首批决策”边界拒绝？
