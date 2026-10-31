### Case INVESTIGATION-RESOURCE-REFERENCE-001: resource links require literal current relative targets

Tests:
- `test:84d74730591b0626f58b21e461b8037a6f17c00cdf53ba14e1551f610f42603c`

Tags:
- `investigation-report`

Contract:
- 附加资源链接使用字面 `./_resources/` 当前相对目标；符合白名单的 ASCII 成对括号合法。

Proves:
- 普通目标和 `evidence(1).txt` 通过；带 fragment 的目标被拒绝。
