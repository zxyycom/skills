### Case DECISION-LIFECYCLE-MOVE-001: 归档与重新激活保持 Markdown 语义

Entry:
- `tools/decision-records/tests/lifecycle-relations.test.ts > archive and reactivate move one Decision ID while preserving its Markdown semantics`
- `bun test --test-name-pattern="^archive and reactivate move one Decision ID while preserving its Markdown semantics$" ./tools/decision-records/tests/run.ts`

Contract:
- archive/reactivate 只能移动同一 ID 的 root/archive sourcePath，并保留 Markdown 语义和索引投影。

Proves:
- 归档后 root 消失且 index 指向 archive；重新激活后正文和 sourcePath 恢复。
