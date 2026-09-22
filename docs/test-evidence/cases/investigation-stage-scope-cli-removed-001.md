### Case INVESTIGATION-STAGE-SCOPE-CLI-REMOVED-001: CLI treats the removed stage-index entry as an unknown command

Tests:
- `test:5d3c05d6493c2362966f963adfac4474281f13f868fd39980709e29921998942`

Tags:
- `investigation-report`

Contract:
- 被移除的 stage-index 不保留兼容入口或迁移特判。

Proves:
- 调用 stage-index 返回退出码 2 与 unknown command 诊断。
