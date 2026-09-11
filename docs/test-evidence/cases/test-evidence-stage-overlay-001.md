### Case TEST-EVIDENCE-STAGE-OVERLAY-001: 选择性暂存组合新增删除与显式重命名

Tests:
- `test:19adcf9a6fe73884f6fa44f1621c304383aa8ed9b28de46863d5495ce467b4c2`

Tags:
- `test-evidence`

Contract:
- stage 只将所选 Case 的工作区 revision 覆盖到 Git 基线索引。

Proves:
- 两个 Case 同时变化时，pending 仅使用所选 Case 的新 revision，未选择 Case 保留 Git 基线 revision。
