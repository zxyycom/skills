### Case INVESTIGATION-LOCAL-DRAFT-001: 缺索引的已有正式集合必须显式恢复

Tests:
- `test:ef0287e5c381a5ebcda555a4c4c758b9643e62b1a1e6d2fde252db472e915652`

Tags:
- `investigation-report`

Contract:
- 真正缺索引且已有正式成员时，new 与 show-candidate 不隐式读取正式 header 或建立空基线。

Proves:
- 无关正式来源有合法 header 但正文非法时，new 与 show-candidate 返回错误，正式来源的 fs.open 计数为零。
