### Case DECISION-RENAME-STRICT-SOURCES-001: 真实改名隔离未选正文损坏

Tests:
- `test:ba80d9f6f39c534c7d34da6da23fbb318b644f48581dfb2ecb068c258850bab2`

Tags:
- `decision-records`

Contract:
- 真实 rename 同样使用发布索引与所选、实际改写来源；无关正式正文不作为局部门禁。

Proves:
- 无关正式正文新增非法重复章节后，所选身份实际改名成功，旧路径退出，新路径保存新 ID；未选正文和其发布条目保持。
