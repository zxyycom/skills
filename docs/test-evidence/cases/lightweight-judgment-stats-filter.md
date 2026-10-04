### Case LIGHTWEIGHT-JUDGMENT-STATS-FILTER-001: UTC 窗口与参数绑定筛选

Tests:
- `test:ef30442b36bbaa25795d8d5475a5961156c9a4c413b666625912e192e4f7c6a0`

Tags:
- `lightweight-judgment`

Contract:
- 按 started_at UTC [from,to) 与组合精确字段／标签 AND 筛选，不执行输入 SQL。

Proves:
- 窗口上界样本排除，型号／状态／标签组合只选一条；endpoint 和 tag 注入文本匹配空集且库仍有三条记录。
