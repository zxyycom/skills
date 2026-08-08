### Case DECISION-STAGE-ISOLATION-001: Stage 隔离显式选择并重建完整 pending 索引

Entry:
- `tools/decision-records/tests/stage.test.ts > stage isolates one selected filesystem decision and rebuilds the complete pending index`
- `bun test --test-name-pattern="^stage isolates one selected filesystem decision and rebuilds the complete pending index$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- `stage` 只把显式选择的 filesystem 决策叠加到 revision 基线，以同一目标来源重建完整 ID-keyed pending 索引，并整体替换 pending 决策范围。

Proves:
- 选择 A 后，pending 包含 filesystem A 与 revision B，先前 pending 中的 filesystem B 被移出决策范围。
- Pending 索引对象键包含完整 A/B 集合，且结构化 `sourceRevision` 与同一 pending 领域目录和逐路径 Markdown 来源一致。
- 决策范围外的 pending 文件和完整 filesystem 决策范围保持不变。
