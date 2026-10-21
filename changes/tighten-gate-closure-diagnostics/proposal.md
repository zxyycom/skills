# Proposal

收紧现有 Gate 输入闭包的维护反馈，并基于证据审查可避免成本；本文件是本轮临时实施计划。

## Why

现有 Gate 已支持完整输入精确命中后的成功证明复用，但并行新增的领域输入尚需按真实消费归入既有能力，保守回退的终端提示也需要帮助维护者定位路径与原因。此前 shared 与 unchanged 各一次路由 smoke 仅能说明当次选择结果，不能据此归因热点或承诺固定耗时。

## Outcome

新增输入具有可核对的既有能力归属；输入未闭合时，维护者可从安全、有界的终端与 machine 诊断定位相对路径及回退原因；剩余触发与 Run 外成本均有必要性结论，只有有证据支持的冗余才被消除。

## Scope

### Intended Change

补齐当前新增输入的真实 wrapper/import 所属能力，改进既有回退诊断，并审查剩余触发及 Run 外成本；仅在完整依赖与实测证据充分时收窄现有 patterns 或去重。

### Resulting Impacts

同步受影响的项目测试、Case/index 和最小稳定文档；验证保守执行、脱敏、有界输出、共享 flag、成功前置与发布保护。保留链接检查、CI/release 全量与其他任务改动，不新增 Gate、runner、cache 或调度抽象。

## Success Criteria

1. 当前新增输入按真实加载闭包归入既有能力，未知或错误输入仍触发保守执行，不产生部分证明。
2. 终端与 machine 回退信息给出可行动的相对路径及原因，同时保持脱敏、有界与失败安全。
3. 每个审查热点均有必要性或证据缺口结论；优化只在已证明冗余时实施，并报告同机工作量与 Run 内外成本，不承诺固定秒数。
4. 最小项目测试、Case 与选择性索引同步齐备；适用 Gate、独立正确性审查以及最终 AI-ready 与编码规范复核通过。
5. 仅保存本任务改动；全部任务有验收证据后保存最终全勾 Plan，再由已获授权的主代理公开 finalize 结项。

## Affected Owners

- `scripts/lib/vibe-gate/`：既有能力输入、输入采集与证明、回退诊断及接线。
- `scripts/vibe-check*.ts` 与项目 Gate 测试：现有终端/machine 输出和回归证据。
- `docs/tooling.md`、按需 `docs/gate-check-authoring.md`：运行反馈与编写义务的稳定说明。
- `docs/test-evidence/cases/` 与 `test-evidence-index.json`：测试证据与派生索引；本任务只改可归因的内容。
- 当前 Change 的四项制品：范围、设计、进度与临时计划基线。
