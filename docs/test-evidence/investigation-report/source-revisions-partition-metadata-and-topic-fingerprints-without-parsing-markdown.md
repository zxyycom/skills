### Case INVESTIGATION-SOURCE-REVISION-001: 调查来源 Revision 分离 Metadata 与逐 Topic 指纹

Entry:
- `tools/investigation-report/tests/index-query.test.ts > source revisions partition metadata and topic fingerprints without parsing Markdown`
- `bun test --test-name-pattern="^source revisions partition metadata and topic fingerprints without parsing Markdown$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查完整快照与快速读取必须共享结构化 revision；单份报告变化只影响对应路径指纹，快速路径不解析 Markdown。

Proves:
- 完整与快速 revision 相同，且不受来源输入顺序或 CRLF 影响。
- 修改或删除一份报告只改变或移除对应 entry，其他 entry 与 metadata 保持不变。
- 无效报告仍可快速指纹化，而完整快照读取拒绝其 Markdown 结构。
