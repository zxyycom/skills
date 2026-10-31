### Case INVESTIGATION-STAGE-PENDING-INDEX-DELETION-001: 拒绝以已删除的 pending 索引组合

Tests:
- `test:4d86601fce54018f38571bf89ec07d6d0b50339b6349e050575aee58c02ca713`

Tags:
- `investigation-report`

Contract:
- HEAD 索引存在但 pending 索引被删除时，index/all 不从 HEAD 重建组合基底，必须先显式恢复删除。

Proves:
- 删除 pending 索引后 index 返回恢复诊断，完整 staged entries 在失败前后不变。
