### Case DECISION-TRACE-EVENT-ADMISSION-001: Decision Trace 原子接纳关系事件

Tests:
- `test:32ca9e1c00fe41bb4045e5cdd5aafad912bb5ff5efb307a4409a6415b00ef076`
- `test:b284980dc4bce81314b172f19af07ff88f199f4f8ca5d618a3ef0da59e7f1dd4`
- `test:e9111654edd7f74770843241cad251263f96c1fc5f6b56911888c1ced5b45f8c`

Tags:
- `decision-records`

Contract:
- Decision Trace 必须把完整拆分、纯归并和稀疏重划事件作为原子接纳单元；未直接跨越的同事件成员只作为 context。

Proves:
- 预算足够时，拆分、纯归并和稀疏重划均保留直接成员，且把非直接成员投影到 contextIds。
- 预算不能容纳完整事件时，只保留 anchor，不部分接纳任何成员，并返回 event kind、完整 recordIds 与最小 requiredMaxRecords。
