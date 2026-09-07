### Case INVESTIGATION-SNAPSHOT-REVISION-001: list filters reports at an inclusive formedAt range

Tests:
- `test:7e46c5ac31555d94044eff461f5b74ba39ecf28097f643b36bf75ddb2a3dc785`

Tags:
- `investigation-report`

Contract:
- list 的 formedAt 起止筛选包含两个端点。

Proves:
- 起止时刻的报告被返回；范围外的报告被排除。
