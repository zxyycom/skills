### Case CHANGE-PLAN-CATALOG-002: Show 通过当前 checker 读取 artifacts

Tests:
- `test:0eeda9b7c26b12bf0115332af4829c2f766562fed3060b355c74a6d59733b881`

Tags:
- `change-plan`

Contract:
- Show 只面向当前 Change，返回其 checker 结果及可读取的固定 artifacts，不提供 archived raw reader。

Proves:
- 合法 Plan 的 show 结果包含当前 Change 身份、成功的 check 与可读取 proposal artifact。
