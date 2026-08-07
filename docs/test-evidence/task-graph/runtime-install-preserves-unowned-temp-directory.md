### Case TASK-GRAPH-RUNTIME-TEMP-OWNERSHIP-001: 安装不删除未创建的 UUID 碰撞目录

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime install never removes a pre-existing UUID-collision directory it did not create`
- `bun test --test-name-pattern="^runtime install never removes a pre-existing UUID-collision directory it did not create$" ./tools/task-graph/tests/run.ts`

Contract:
- 安装 finally 只能清理本次成功创建的唯一临时目录。

Proves:
- 预建同名目录导致 prepare 失败，其 sentinel 保持不变且 command runner 未启动。
