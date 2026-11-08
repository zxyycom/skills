### Case INVESTIGATION-REPORT-VALIDATION-SCOPE-001: 调查检查的部分覆盖与聚合诊断

Tests:
- `test:45bcc3e6a72baeb54b20a069f8ed5b66bac8984524604a227343fae706f8a1b1`

Tags:
- `investigation-report`

Contract:
- 报告来源无效时 check 保留聚合诊断，不声称已检查索引。

Proves:
- 真实 CLI 在两个无效报告下失败，诊断数量为二，scope 为 partial，indexChecked 为 false。
