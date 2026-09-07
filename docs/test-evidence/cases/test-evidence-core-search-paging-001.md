### Case TEST-EVIDENCE-CORE-SEARCH-PAGING-001: 搜索涵盖索引查询分页边界后的匹配

Tests:
- `test:b7a3573568d94e9f9765f905b8b421ebbbd8018266bb400171e7bf899bb69921`

Tags:
- `test-evidence`

Contract:
- D3 全文搜索必须检查全部已筛选索引候选，不得在生产者或查询分页边界静默截断。

Proves:
- 第 1001 个候选作为唯一匹配时仍被搜索结果返回。
