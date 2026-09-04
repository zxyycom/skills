### Case INVESTIGATION-RENAME-RECOVERY-001: rename 拒绝来源漂移并在索引失败后恢复

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename rejects source drift before writing and restores its report and index after index publication failure`
- `bun test --test-name-pattern="^Investigation rename rejects source drift before writing and restores its report and index after index publication failure$" ./tools/investigation-report/tests/run.ts`

Contract:
- Investigation rename 在提交前必须回读来源；索引发布失败时必须恢复旧 report/sourcePath 和旧索引，且不保留新路径。

Proves:
- 准备后的 source 漂移返回 `no-change`，不会创建 target report。
- 注入索引写失败后结果为 `rolled-back`，旧 report、owner resource 与 index 字节恢复且 target report/owner 不存在。
