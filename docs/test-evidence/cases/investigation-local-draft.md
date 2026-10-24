### Case INVESTIGATION-LOCAL-DRAFT-001: 缺索引的已有正式集合必须显式恢复

Tests:
- `test:784278276ea7b7bb3215284cc2bfc091a5067b46cc9bf23dd5239d69bcfb623c`

Tags:
- `investigation-report`

Contract:
- 真正缺索引且已有正式成员时，new 与 show-candidate 不隐式读取正式 header 或建立空基线。

Proves:
- 无关正式来源有合法 header 但正文非法时，new 与 show-candidate 返回错误，正式来源的 fs.open 计数为零。
