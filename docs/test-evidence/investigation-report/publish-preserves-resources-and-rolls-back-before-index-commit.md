### Case INVESTIGATION-CANDIDATE-PUBLISH-003: publish preserves resources and rolls back before index commit

Entry:

- `tools/investigation-report/tests/publish.test.ts > publish preserves candidate resources and rolls renamed candidates back when index publication fails`
- `bun test --test-name-pattern="^publish preserves candidate resources and rolls renamed candidates back when index publication fails$" ./tools/investigation-report/tests/run.ts`

Contract:

- publish 不移动或改写 candidate resource；索引提交点前写入失败必须恢复 candidate，资源字节本身不构成 publish 漂移。

Proves:

- 注入索引写入失败时 candidate 与资源字节保留，且结果为 `rolled-back`。
- 准备后以新文件替换同一资源路径时，成员 identity 漂移在写入前阻断 publish，candidate 保留。
- 准备后只改变同一资源文件的字节仍可发布，报告正文链接原样成为正式内容。
