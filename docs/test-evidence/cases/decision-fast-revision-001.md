### Case DECISION-FAST-REVISION-001: 快速来源 revision 跟踪无效 Markdown 与来源路径

Tests:
- `test:2b92717a430fd4d45f9a76dea76d4398cfd752d79d23182301294f7645eed22d`

Tags:
- `decision-records`

Contract:
- 快速 revision 可以对原始 Markdown 取指纹而不解析其合法性，并必须将 `sourcePath` 纳入身份。

Proves:
- 相同无效正文从根目录移动到 archive 后得到不同 entry revision。
