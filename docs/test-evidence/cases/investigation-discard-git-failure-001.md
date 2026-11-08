### Case INVESTIGATION-DISCARD-GIT-FAILURE-001: 不可用历史阻断删除计划

Tests:
- `test:8a884f3dd1b301d3859f85fb1080bd595a8f8476648854f1111291159ab846eb`

Tags:
- `investigation-report`

Contract:
- 历史检查不可用不能视为已记录删除许可。

Proves:
- 纯计划在 History::Unavailable 时返回 HistoryUnavailable。
