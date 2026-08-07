### Case TASK-GRAPH-LOCK-RELEASE-001: close 成功时 unlock 失败不改变提交结果

Entry:
- `tools/task-graph/tests/store.test.ts > successful close preserves a committed mutation when native unlock fails`
- `bun test --test-name-pattern="^successful close preserves a committed mutation when native unlock fails$" ./tools/task-graph/tests/run.ts`

Contract:
- unlock 失败但 FileHandle close 成功已释放 OS 锁，不得把成功 mutation 改写为失败。

Proves:
- 注入 unlock 异常后 create scope 正常返回 revision 1，索引可读。
