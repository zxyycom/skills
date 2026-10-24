### Case DR-INDEX-PAYLOAD-CONSUMPTION-001: Stage 各 scope 仅读取所选 pending payload

Tests:
- `test:63ee8ed60a6c5d6ecf517fdfe7563b67be8bf64caf9040cb947ccd61ae3f1f40`

Tags:
- `decision-records`

Contract:
- 所有 scope 保留完整 pending 路径、mode、OID；未选 payload 的即时可读性不作为本次验收责任。

Proves:
- 删除未选正文 Git 对象后，all/domain/index 均成功，未选成员 mode/OID 保持；所选索引投影更新，重复 index 操作 unchanged。
