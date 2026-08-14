### Case INVESTIGATION-RESOURCE-IGNORE-REFERENCE-001: 显式引用 ignore 排除的未跟踪资源时失败

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation rejects explicitly referenced ignored resources`
- `bun test --test-name-pattern="^validation rejects explicitly referenced ignored resources$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告不能把 Git ignore 排除的未跟踪本地文件作为可分发调查证据；存在但不受管的目标必须与真正缺失资源区分诊断。

Proves:
- 局部检查对磁盘上存在且被 ignore 的 JSON 资源返回版本控制忽略诊断。
- 同一结果不包含 `does not exist`，证明失败来自受管成员边界而不是文件缺失。
