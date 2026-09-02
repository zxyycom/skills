### Case DECISION-STAGE-FILESYSTEM-DIAGNOSTIC-001: Stage 访问拒绝按稳定诊断输出并净化 detail

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > stage classifies access denial and redacts filesystem error detail`
- `bun test --test-name-pattern="^stage classifies access denial and redacts filesystem error detail$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision Stage 读取选中 filesystem 来源遇到访问拒绝时，必须保留 `access-denied` 原因类别并仅输出受控 detail，不能泄露路径或凭据。

Proves:
- 注入 EACCES 后 Stage 返回 error 和稳定 filesystem reason。
- detail 中的 password 与绝对路径被净化，不保留原始敏感值。
