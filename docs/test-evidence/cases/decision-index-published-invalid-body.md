### Case DECISION-INDEX-PUBLISHED-INVALID-BODY-001: 发布查询不以坏当前正文替换持久投影

Tests:
- `test:ec8d99d675e791e1bbda8cacd26022feb53e9436e1750489d6b7b693f43ec628`

Tags:
- `decision-records`

Contract:
- 发布查询不以坏当前正文替换持久投影。

Proves:
- 删去当前正文目的段后 list/trace 仍读取已发布成员，而严格检查指出正文错误。
