### Case TASK-GRAPH-LIST-TRACKS-001: Track label 至少两位且没有两位上限

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list track labels keep at least two digits without a two-digit limit`
- `bun test --test-name-pattern="^task-list track labels keep at least two digits without a two-digit limit$" ./tools/task-graph/tests/run.ts`

Contract:
- Track 从 T01 起至少使用两位编号，数量超过 99 时自然增长；完整文本只以一个 LF 结束。

Proves:
- 100 个孤立 task 产生 T01 到 T100，最后一个定位实际 task-000100，末尾没有额外空行。
