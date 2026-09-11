### Case VERSION-CONTROL-DISCOVERY-FAILURE-001: Git 工作树发现故障报告为操作失败

Tests:
- `test:3a2fed5eff25256a9541385a6a17a180411720b5e1306f7e8e3d17bb16faa0c3`

Tags:
- `version-control`

Contract:
- 只有确认起点不在 Git 工作树内时才能返回 `not-repository`；损坏或受限的仓库发现必须保持为操作失败。

Proves:
- 起点存在损坏的 `.git` 工作树元数据时，打开版本控制返回 `operation-failed`，并保留 Git 报告的具体失败原因。
- 仓库发现故障不会被误报为可静默降级的非 Git 目录。
