### Case DECISION-RENAME-STRICT-SOURCES-001: 真实改名隔离未选正文损坏

Tests:
- `test:43f065dc70ac9a3dee9168544c3ddae775eea6e8137d7c00976d4347d8e134f1`

Tags:
- `decision-records`

Contract:
- 真实 rename 同样使用发布索引与所选、实际改写来源；无关正式正文不作为局部门禁。

Proves:
- 无关正式正文新增非法重复章节后，所选身份实际改名成功，旧路径退出，新路径保存新 ID；未选正文和其发布条目保持。
