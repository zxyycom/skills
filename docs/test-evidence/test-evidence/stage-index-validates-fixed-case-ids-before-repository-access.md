### Case TEST-EVIDENCE-STAGE-INPUT-001: 暂存入口在仓库访问前校验固定 Case ID

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index validates fixed case ids before repository access`
- `bun test --test-name-pattern="^stage-index validates fixed case ids before repository access$" ./tools/test-evidence/tests/run.ts`

Contract:
- `stage-index` 只接受至少一个符合固定协议且不重复的 Case ID，并在访问版本仓库前完成领域校验。

Proves:
- 空选择、非法 ID 与重复 ID 返回可区分的 `selection-invalid` 诊断。
- 执行入口以显式 `invalid-arguments` 失败类型承接 Case ID 输入错误。
- 输入失败不会创建或读取目标工作区。
