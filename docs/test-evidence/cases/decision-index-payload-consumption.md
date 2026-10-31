### Case DR-INDEX-PAYLOAD-CONSUMPTION-001: Stage 各 scope 仅读取所选 pending payload

Tests:
- `test:eba0a5f812a08381f8ea7de02242888760a50895f5efcb500f0dfb261d8fce45`

Tags:
- `decision-records`

Contract:
- 所有 scope 保留完整 pending 路径、mode、OID；未选 payload 的即时可读性不作为本次验收责任。

Proves:
- 删除未选正文 Git 对象后，all/domain/index 均成功，未选成员 mode/OID 保持；所选索引投影更新，重复 index 操作 unchanged。
