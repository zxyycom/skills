### Case RESOURCE-INDEX-ROUNDTRIP-001: 深层记录写前可读取

Tests:
- `test:ebc0662ee8e39309d3b15594979a5db0a078851cd47948af9ad06d71c7331830`

Tags:
- `resource-records`

Contract:
- 同步不得发布自身无法读取的索引。

Proves:
- 132 层 specs 先拒绝且不创建，或同步成功后 check 可读；不要求特定实现策略。
