### Case LIGHTWEIGHT-JUDGMENT-STATS-FILTER-001: UTC 窗口与参数绑定筛选

Tests:
- `test:ef30442b36bbaa25795d8d5475a5961156c9a4c413b666625912e192e4f7c6a0`

Tags:
- `lightweight-judgment`

Contract:
- 按 started_at UTC [from,to) 与组合精确字段／标签 AND 筛选，不执行输入 SQL。

Proves:
- 只改变时间的四条样本区分 [from,to) 两端；response_model、request_model、endpoint、status 与 tag 各有单变量不匹配样本，组合筛选仅选中两条且 elapsed 合计为 110。
- endpoint 和 tag 注入文本匹配空集，数据库仍保留九条记录。
