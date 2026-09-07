### Case CHANGE-PLAN-GIT-EXCLUDE-001: Git 距离排除仅修改当前 Change 的提交

Tests:
- `test:4cf268724a9ee45b7fd487bf9df116d37658f1636b7a5704d10f6fa10a1300ae`

Tags:
- `change-plan`

Contract:
- Git 距离只衡量当前 Change 目录之外的项目推进。

Proves:
- 只修改被评估 Change 制品的提交不增加提交数或变更行数，返回零提交、零变更行的 measured evidence。
