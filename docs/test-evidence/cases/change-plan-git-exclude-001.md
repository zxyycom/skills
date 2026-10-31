### Case CHANGE-PLAN-GIT-EXCLUDE-001: Git 距离排除仅修改当前 Change 的提交

Tests:
- `test:b3d97eff9b0d8a47f3b0d3f8b4b3c917cc185370cee1421e00ee2d3d8a3e29e8`

Tags:
- `change-plan`

Contract:
- Git 距离只衡量当前 Change 目录之外的项目推进。

Proves:
- 只修改被评估 Change 制品的提交不增加提交数或变更行数，返回零提交、零变更行的 measured evidence。
