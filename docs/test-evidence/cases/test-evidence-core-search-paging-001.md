### Case TEST-EVIDENCE-CORE-SEARCH-PAGING-001: 搜索涵盖索引查询分页边界后的匹配

Tests:
- `test:72bbfe13c26e76dbfdad692c508014102d840eb433b3175abf0891cc77c9b02b`
- `test:f7cfcb1fefb6f0f38c1cbef63df59f62110876699a0ad4e3efe4ee97b0e28952`

Tags:
- `test-evidence`

Contract:
- D3 全文搜索必须检查全部已筛选索引候选，不得在生产者或查询分页边界静默截断。

Proves:
- 第 1001 个候选作为唯一匹配时仍被搜索结果返回。
- API 的零、负数或非整数 limit，以及负数 offset，返回 `query.options-invalid`、默认 `20/0` 和空结果。
