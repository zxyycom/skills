### Case DECISION-TYPE-PATH-001: 稳定 ID、标签与来源路径不变量

Entry:
- `tools/decision-records/tests/type-path-invariants.test.ts > decision types and paths preserve stable ID tag and sourcePath invariants`
- `bun test --test-name-pattern="^decision\ types\ and\ paths\ preserve\ stable\ ID\ tag\ and\ sourcePath\ invariants$" ./tools/decision-records/tests/run.ts`

Contract:
- 决策类型与路径必须以 Markdown basename 作为稳定 ID，并使标签、`sourcePath` 与生命周期位置保持一致。

Proves:
- 类型和路径辅助函数拒绝不符合稳定 ID 或物理布局的值，并保留可序列化的标签和来源路径。
