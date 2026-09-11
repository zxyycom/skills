### Case DECISION-TRANSACTION-FILESYSTEM-DIAGNOSTIC-001: 事务访问拒绝按稳定诊断输出并净化 detail

Tests:
- `test:ddbf87e496754578cbc2108016e9313b2d7f81c777f5e4a4d596510c9ef28a25`

Tags:
- `decision-records`

Contract:
- Decision transaction 预检遇到直接文件系统访问拒绝时，必须 fail closed，并以稳定 reason、`access-denied` 和受控 detail 说明失败。

Proves:
- 注入 EACCES 来源检查失败后事务返回 error 而不进入写入。
- 诊断 detail 对 password 与绝对路径做净化，reason 不复述原始异常消息。
