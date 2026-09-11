### Case VERSION-CONTROL-REVISION-BATCH-001: 批量读取受范围约束的 revision 快照

Tests:
- `test:47f2db6238d71de79e9d9eb6f13fe735e3096a97a5f9b3e57a58ac755156bbee`

Tags:
- `version-control`

Contract:
- `readRevisionFiles` 按字面仓库相对路径范围读取整个或选定 revision 快照；路径中的 Git pathspec 元字符不扩展，并以规范路径稳定排序返回文件字节。

Proves:
- 全 revision 读取保留普通文件、可执行文件和符号链接 blob 的字节与排序。
- 单路径、多路径、重叠文件/目录范围和无匹配范围分别返回精确、去重或空的结果；`docs/*.md` 只匹配名称含星号的文件，不匹配普通 Markdown 文件。
