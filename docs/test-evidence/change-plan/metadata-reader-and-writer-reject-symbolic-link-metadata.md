### Case CHANGE-PLAN-METADATA-SYMLINK-001: Metadata 边界拒绝符号链接
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata reader and writer reject symbolic-link metadata`
- `bun test --test-name-pattern="^metadata reader and writer reject symbolic-link metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- `.change-plan.json` 的读取和内部生命周期写入都只接受普通文件；writer 发布时不解析或写入符号链接的外部目标。
Proves:
- Reader 与 writer 对链接 metadata 均返回 `invalid-path`，且链接目标内容保持原样。
- 写入检查后 metadata 路径才变为链接时，外部目标保持原样，最终 metadata 是完整普通文件。
