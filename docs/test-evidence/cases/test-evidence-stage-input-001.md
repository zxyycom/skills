### Case TEST-EVIDENCE-STAGE-INPUT-001: 暂存入口在仓库访问前校验固定 Case ID

Tests:
- `test:66653188816321ebabc8b845da4b0def39c3b6e4ca897b37164fbf44106b0eac`

Tags:
- `test-evidence`

Contract:
- stage 只接受合法 Case ID，并在访问 Git 前完成选择校验。

Proves:
- 非法 ID 返回 selection-invalid，且不会创建 Git 仓库。
