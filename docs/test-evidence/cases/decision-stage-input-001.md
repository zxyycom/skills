### Case DECISION-STAGE-INPUT-001: Stage 拒绝无效、重复和缺失 ID 且不改变 pending

Tests:
- `test:8148b195eba80574a0afa4deecf5b91653461e2130e0ca8300ebd00d390e97fa`

Tags:
- `decision-records`

Contract:
- stage 拒绝重复、缺失和越界的纯 ID，并保留既有 Git pending 快照。

Proves:
- 三类非法输入均给出对应的参数或 selected-ID 诊断，选择来源、正式索引与 Git pending index 保持不变。
