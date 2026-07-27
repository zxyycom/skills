### Case VERSION-CONTROL-REVISION-001: 发现仓库根并读取修订快照
Entry:
- `tools/shared/tests/version-control.test.ts > discovers the repository root and reads revision snapshots`
- `bun test --test-name-pattern="^discovers the repository root and reads revision snapshots$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 版本控制适配器必须从嵌套路径发现仓库根，并按修订列举和读取文件。
Proves:
- 当前修订、路径范围、二进制内容和已确认缺失的修订文件均返回准确结果。
