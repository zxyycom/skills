### Case INVESTIGATION-RENAME-OWNER-RACE-001: rename 不覆盖并发出现的 resource owner target

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename never overwrites an owner target that appears after final validation`
- `bun test --test-name-pattern="^Investigation rename never overwrites an owner target that appears after final validation$" ./tools/investigation-report/tests/run.ts`

Contract:
- owner target 在最终预检后出现时，rename 必须以 exclusive owner claim 拒绝迁移并回滚自身 report/index 写入；不得用目录 rename 覆盖空或非空目标，也不得清理并发创建的内容。

Proves:
- 结果为 `rolled-back`，旧 report、index 和旧 owner 内容恢复。
- 并发 target 的 `external.txt` 保留，rename 不留下新 report 路径。
