### Case INVESTIGATION-STAGE-PENDING-INDEX-DELETION-001: 拒绝以已删除的 pending 索引组合

Tests:
- `test:89e1853fd766f4824423073ac4be030a63d3ea0c6607bea7d3cf9d16626b54ee`
- `test:a3426d83577a67fb80d0cf707ac3d30563f057ab844824f28645c044b2cc2543`

Tags:
- `investigation-report`

Contract:
- HEAD 索引存在但 P 索引被删除时，index/all 不从 HEAD 重建组合基底，必须先显式恢复删除。

Proves:
- 删除 P 索引后 index/all 返回恢复诊断，完整 staged entries 在失败前后不变。
