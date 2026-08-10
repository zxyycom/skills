### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: 无版本仓库时稳定失败且不写工作树
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index reports unavailable version control without working-tree writes`
- `bun test --test-name-pattern="^stage-index reports unavailable version control without working-tree writes$" ./tools/investigation-report/tests/run.ts`
Contract:
- 选择性索引暂存需要版本仓库；仓库不可用属于操作失败，不能退化成工作树文件写入。
Proves:
- 合法调查集合在无仓库目录返回 `revision-read-failed` 与 `state-index.repository-unavailable`，索引和主题 Markdown 字节保持不变。
