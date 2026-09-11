### Case TEST-EVIDENCE-STAGE-INPUT-001: 暂存入口在仓库访问前校验固定 Case ID

Tests:
- `test:f3b1110c73debadbd2d84ffd038d1ab62f42bde9b514c6257d16d2c87abd0fa5`

Tags:
- `test-evidence`

Contract:
- stage 只接受合法 Case ID，并在访问 Git 前完成选择校验。

Proves:
- 非法 ID 返回 selection-invalid，且不会创建 Git 仓库。
