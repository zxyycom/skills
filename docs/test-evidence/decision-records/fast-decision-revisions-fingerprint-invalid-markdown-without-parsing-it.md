### Case DECISION-FAST-REVISION-001: 快速决策 Revision 不解析无效 Markdown

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > fast decision revisions fingerprint invalid Markdown without parsing it`
- `bun test --test-name-pattern="^fast decision revisions fingerprint invalid Markdown without parsing it$" ./tools/decision-records/tests/state-snapshot.test.ts`

Contract:
- 决策快速 revision 读取必须直接指纹化已发现来源，不调用决策 Markdown parser 或完整快照构建。

Proves:
- 无效决策 Markdown 仍产生对应路径的 SHA-256 来源指纹，而完整状态快照读取拒绝该文档。
