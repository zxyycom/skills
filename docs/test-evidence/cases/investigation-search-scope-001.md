### Case INVESTIGATION-SEARCH-SCOPE-001: search 排除非正式文件并拒绝缺失索引

Tests:
- `test:09e6e3b3d93625852dee08d7f3b3602d85a138628bd41f610a6e56c2e127743e`

Tags:
- `investigation-report`

Contract:
- content 只搜索发布范围内的报告 Markdown，不包含候选、资源或索引文件；缺索引必须明确失败。

Proves:
- 只存在于 candidate、资源或索引字节的词均返回 status=ok、空 entries 与精确 matched=0。
- 删除索引后搜索失败，不创建索引文件。
