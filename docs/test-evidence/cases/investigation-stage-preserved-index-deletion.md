### Case INVESTIGATION-STAGE-PRESERVED-INDEX-DELETION-001: W 恢复不覆盖未选 P 删除

Tests:
- `test:03edab97b1dec97558a8c9f3ad2de486bd80e3d1fcb59dd93e6341e9cfc9b453`
- `test:b280aae137ee482c65174523c496961fb1eb1f0f6aed9c4c0362eba92770dcb1`

Tags:
- `investigation-report`

Contract:
- index/all 以 P 而非 HEAD 组合，未选对象的 P 删除不受当前 W 恢复影响。

Proves:
- 先选择 B 暂存删除，再在 W 恢复 B 并更新 A，选 A 只刷新 A；B 仍不在 pending 索引，all 也保留正文 staged 删除。
