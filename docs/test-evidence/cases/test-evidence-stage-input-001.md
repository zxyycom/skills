### Case TEST-EVIDENCE-STAGE-INPUT-001: 暂存入口在仓库访问前校验固定 Case ID

Tests:
- `test:8a8c1b1b6e6df7a6da169731c2830eb5ad2d0aadce5cca1331b45dc9562405ee`

Tags:
- `test-evidence`

Contract:
- stage 只接受合法 Case ID，并在访问 Git 前完成选择校验。

Proves:
- 非法 ID 返回 selection-invalid，且不会创建 Git 仓库。
