### Case LIGHTWEIGHT-JUDGMENT-STATS-DATABASE-001: 缺失外来未知与变形库拒绝

Tests:
- `test:1da6b7ef3f3457f95ad72ab9204d4e668bb70264c81f18a53f648c83f494d602`

Tags:
- `lightweight-judgment`

Contract:
- stats 不建库且拒绝外来库、未知版本与变形 schema；读取失败与空 cohort、持久化写失败分别表达。

Proves:
- 缺失父目录没有创建；foreign application ID、未知版本与 extra 列库均 storage/4 且原文件不变、无 persistence。
