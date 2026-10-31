### Case DECISION-FAST-REVISION-001: 快速来源 revision 跟踪无效 Markdown 与来源路径

Tests:
- `test:dc6e5d24c4f3086b630cafb8a7e7c2b7d0474134b381bce00e6cb2bbae4d208b`

Tags:
- `decision-records`

Contract:
- 快速 revision 可以对原始 Markdown 取指纹而不解析其合法性，并必须将 `sourcePath` 纳入身份。

Proves:
- 相同无效正文从根目录移动到 archive 后得到不同 entry revision。
