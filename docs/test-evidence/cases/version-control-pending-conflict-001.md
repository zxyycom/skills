### Case VERSION-CONTROL-PENDING-CONFLICT-001: 区分陈旧 Pending 与已存在写入边界

Tests:
- `test:bcb38c71fd4b73debea4fb5348a9af68a6e50d44a11fabed1f70efb57549d1c8`

Tags:
- `version-control`

Contract:
- pending 范围替换只接受仍为当前值的 expected revision；revision 漂移与独占创建锁返回的资源存在必须保持可区分，且冲突不得改写 pending。

Proves:
- expected revision 已变化返回 `pending-conflict` 与 `unknown` 原因，不猜测更具体的竞争来源。
- 注入的锁路径 `EEXIST` 返回同一 event code 但原因为 `busy`，并定位到待替换范围；它不声称存在活动事务。
- 每次冲突后完整 pending 文件集合与调用前一致。
