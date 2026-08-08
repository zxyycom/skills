### Case CHANGE-PLAN-METADATA-SYMLINK-001: Metadata 边界拒绝符号链接
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata reader and writer reject symbolic-link metadata`
- `bun test --test-name-pattern="^metadata reader and writer reject symbolic-link metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- `.change-plan.json` 的读取和内部生命周期写入都只接受普通文件，不跟随符号链接越过 Change 目录边界。
Proves:
- Reader 与 writer 对链接 metadata 均返回 `metadata-symbolic-link`，且链接目标内容保持原样。
