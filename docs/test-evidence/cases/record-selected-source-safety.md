### Case RECORD-SELECTED-SOURCE-SAFETY-001: Decision 局部来源安全与编码边界

Tests:
- `test:876f7605ffddd4b33d5c9ae5808e14c1a2001ccc30ce6d7d730e437f28efe96d`
- `test:ddc6bc32caf655dc4e099bea61603c6cf6a1b4b8cdf8a06cf0ee7a8180daabab`

Tags:
- `decision-records`

Contract:
- Decision selected sync 只接受安全普通文件与严格 UTF-8 来源。

Proves:
- 真实 CLI 普通来源控制成功；所选路径替换为外部 symlink 或非法 UTF-8 时，分别以安全/编码类诊断拒绝，索引不变。
