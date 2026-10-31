### Case INVESTIGATION-SNAPSHOT-REVISION-001: list filters reports at an inclusive formedAt range

Tests:
- `test:76aa1068b92c08d41e343d6fc8f327739370e1fcbf6522b2a8f9e456092d2ab6`

Tags:
- `investigation-report`

Contract:
- list 的 formedAt 起止筛选包含两个端点。

Proves:
- 起止时刻的报告被返回；范围外的报告被排除。
