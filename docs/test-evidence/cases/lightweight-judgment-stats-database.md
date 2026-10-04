### Case LIGHTWEIGHT-JUDGMENT-STATS-DATABASE-001: 缺失外来未知与变形库拒绝

Tests:
- `test:dfb899a4f6dffff8d9f4272f9b310ca091ee57d250e2294bbd56e15d8a0df0ff`

Tags:
- `lightweight-judgment`

Contract:
- stats 不建库且拒绝外来库、未知版本与变形 schema；读取失败与空 cohort、持久化写失败分别表达。

Proves:
- 缺失父目录没有创建；foreign application ID、未知版本与 extra 列库均 storage/4 且原文件不变、无 persistence。
