### Case INVESTIGATION-RESOURCE-REVISION-001: 资源池变化保持 List 新鲜，报告链接变化使条目失效

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource pool changes leave list fresh while report link changes invalidate its entry`
- `bun test --test-name-pattern="^resource pool changes leave list fresh while report link changes invalidate its entry$" ./tools/investigation-report/tests/run.ts`

Contract:
- v5 来源 revision 只指纹主题 Markdown；资源字节、未引用资源的增删和资源文件改名不使派生索引过期。
- 报告内资源链接的变更属于主题内容变更，必须使其索引 entry 过期。

Proves:
- 修改、增加、删除或改名资源文件后 revision、查询、完整检查与同步均保持新鲜。
- 报告改为引用改名资源后，仅相应主题 revision 改变，查询和检查拒绝旧索引；同步后查询恢复。
