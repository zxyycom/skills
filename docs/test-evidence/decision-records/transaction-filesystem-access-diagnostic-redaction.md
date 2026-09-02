### Case DECISION-TRANSACTION-FILESYSTEM-DIAGNOSTIC-001: 事务访问拒绝按稳定诊断输出并净化 detail

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > transaction classifies access denial and redacts filesystem error detail`
- `bun test --test-name-pattern="^transaction classifies access denial and redacts filesystem error detail$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision transaction 预检遇到直接文件系统访问拒绝时，必须 fail closed，并以稳定 reason、`access-denied` 和受控 detail 说明失败。

Proves:
- 注入 EACCES 来源检查失败后事务返回 error 而不进入写入。
- 诊断 detail 对 password 与绝对路径做净化，reason 不复述原始异常消息。
