### Case INVESTIGATION-RENAME-FORMAL-001: formal rename 闭合关系资源和索引

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename moves the report and owner resources while rewriting managed relations and links`
- `bun test --test-name-pattern="^Investigation rename moves the report and owner resources while rewriting managed relations and links$" ./tools/investigation-report/tests/run.ts`

Contract:
- formal Investigation rename 必须在同一事务更新 formal/candidate relation、受管 resource link、owner tree、report sourcePath 与正式索引。

Proves:
- 旧 report 和 owner 路径消失，新 owner 文件、candidate/formal relation 与资源链接都使用新 ID。
- formal、candidate 与索引 relation 在改写 target 时逐字保留各自 summary。
- 正式索引只投影新 ID/sourcePath，严格同步检查通过。
