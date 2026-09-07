### Case INVESTIGATION-RESOURCE-REFERENCE-001: resource links require literal current relative targets

Tests:
- `test:afe0b9b877b6db2fff9a22b192472e98f9e50d87aa3fb25336bc64e913056647`

Tags:
- `investigation-report`

Contract:
- 附加资源链接使用字面 `./_resources/` 当前相对目标；符合白名单的 ASCII 成对括号合法。

Proves:
- 普通目标和 `evidence(1).txt` 通过；带 fragment 的目标被拒绝。
