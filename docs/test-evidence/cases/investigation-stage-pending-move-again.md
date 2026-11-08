### Case INVESTIGATION-STAGE-PENDING-MOVE-AGAIN-001: 保留失去索引定位的旧 pending 路径

Tests:
- `test:3c17c60e7fc532b4845e02492c2f2b6d71feed66d78ac5159c0bf645fe115d72`

Tags:
- `investigation-report`

Contract:
- domain 使用可信索引或所选 locator 定位旧位置，不认领无可信定位的 pending 路径。

Proves:
- 真实 Git 中 P 有 middle 但 P 索引未声明该路径，W 索引指向 current；domain 保留 middle pending、暂存 current，HEAD 旧路径退出。节点不计数 blob 读取。
