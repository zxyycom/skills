### Case TASK-GRAPH-SERIALIZATION-001: 规范文本按键排序，往返解析不丢失事实且 entry 不重复保存 ID

Entry:
- `tools/task-graph/tests/schema-index.test.ts > canonical serialization keeps dictionary identity, sorting, LF, and round trip`
- `bun test --test-name-pattern="^canonical serialization keeps dictionary identity, sorting, LF, and round trip$" ./tools/task-graph/tests/run.ts`

Contract:
- task index 以 scope/task 字典键承接身份，并使用确定性排序、LF 与尾换行规范序列化。

Proves:
- 规范文本按键排序，往返解析不丢失事实且 entry 不重复保存 ID。
