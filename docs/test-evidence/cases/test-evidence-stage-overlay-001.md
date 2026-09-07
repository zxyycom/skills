### Case TEST-EVIDENCE-STAGE-OVERLAY-001: 选择性暂存组合新增删除与显式重命名

Tests:
- `test:d801711512922fb2e06b04b6e31e824648321c287b9924e799a2db57ffcfe5f1`

Tags:
- `test-evidence`

Contract:
- stage 只将所选 Case 的工作区 revision 覆盖到 Git 基线索引。

Proves:
- 两个 Case 同时变化时，pending 仅使用所选 Case 的新 revision，未选择 Case 保留 Git 基线 revision。
