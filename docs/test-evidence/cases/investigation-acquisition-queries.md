### Case INVESTIGATION-ACQUISITION-QUERIES-001: 快照发现不获取正式或候选来源

Tests:
- `test:16e710173720078954182b3726640eb438d40352a5dfcb06937b4970a06002b2`

Tags:
- `investigation-report`

Contract:
- 纯索引查询只要求发布索引合法，不探测正式或候选正文健康。

Proves:
- 正式来源删除且无关候选非法时 list、trace、metadata 成功；观察器确认零 Markdown 与候选读取，只有 limit warning。
