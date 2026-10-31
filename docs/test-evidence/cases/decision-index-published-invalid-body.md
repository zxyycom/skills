### Case DECISION-INDEX-PUBLISHED-INVALID-BODY-001: 发布查询不以坏当前正文替换持久投影

Tests:
- `test:13aaf38bffc5e35b4d41de64bfd25131ad8486ac89a6d1b3b9ff122bd390badd`

Tags:
- `decision-records`

Contract:
- 发布查询不以坏当前正文替换持久投影。

Proves:
- 删去当前正文目的段后 list/trace 仍读取已发布成员，而严格检查指出正文错误。
