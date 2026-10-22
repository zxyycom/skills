### Case DECISION-STAGE-DOMAIN-INDEX-STATE-001: 领域暂存保持坏索引字节或删除状态

Tests:
- `test:f819c2bb34812339c482d3dd20accb0a08d9a72305b53166f776a12e1373fdec`

Tags:
- `decision-records`

Contract:
- domain scope 保持 pending 索引的原始字节或缺失状态，不从 HEAD 恢复或修复它。

Proves:
- pending 索引为坏 JSON 或已删除时，领域 A 可刷新，索引坏字节或删除状态均保持。
