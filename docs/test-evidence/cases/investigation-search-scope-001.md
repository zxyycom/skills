### Case INVESTIGATION-SEARCH-SCOPE-001: search 排除非正式文件并拒绝缺失索引

Tests:
- `test:db93bed253bdccff83ac136808c35d706d742454c3c98e4059a9820308c0ac2d`

Tags:
- `investigation-report`

Contract:
- content 只搜索发布范围内的报告 Markdown，不包含候选、资源或索引文件；缺索引必须明确失败。

Proves:
- 只存在于 candidate 或资源文件的词零命中。
- 删除索引后搜索失败，不创建索引文件。
