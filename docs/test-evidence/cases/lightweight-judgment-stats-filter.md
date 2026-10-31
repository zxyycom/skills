### Case LIGHTWEIGHT-JUDGMENT-STATS-FILTER-001: UTC 窗口与参数绑定筛选

Tests:
- `test:690203c9a02a709f327563cb5f3dc051ca7dd569324fc0cce36aa22b794caed2`

Tags:
- `lightweight-judgment`

Contract:
- 按 started_at UTC [from,to) 与组合精确字段／标签 AND 筛选，不执行输入 SQL。

Proves:
- 只改变时间的四条样本区分 [from,to) 两端；response_model、request_model、endpoint、status 与 tag 各有单变量不匹配样本，组合筛选仅选中两条且 elapsed 合计为 110。
- endpoint 和 tag 注入文本匹配空集，数据库仍保留九条记录。
