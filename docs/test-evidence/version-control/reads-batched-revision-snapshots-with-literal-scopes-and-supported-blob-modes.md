### Case VERSION-CONTROL-REVISION-BATCH-001: 批量读取受范围约束的 revision 快照

Entry:
- `tools/shared/tests/version-control.test.ts > reads batched revision snapshots with literal scopes and supported blob modes`
- `bun test --test-name-pattern="^reads batched revision snapshots with literal scopes and supported blob modes$" ./tools/shared/tests/version-control.test.ts`

Contract:
- `readRevisionFiles` 按字面仓库相对路径范围读取整个或选定 revision 快照；路径中的 Git pathspec 元字符不扩展，并以规范路径稳定排序返回文件字节。

Proves:
- 全 revision 读取保留普通文件、可执行文件和符号链接 blob 的字节与排序。
- 单路径、多路径、重叠文件/目录范围和无匹配范围分别返回精确、去重或空的结果；`docs/*.md` 只匹配名称含星号的文件，不匹配普通 Markdown 文件。
