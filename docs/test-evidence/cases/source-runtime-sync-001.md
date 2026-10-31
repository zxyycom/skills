### Case SOURCE-RUNTIME-SYNC-001: TS 闭包同步只读检测漂移并保留未受管文件

Tests:
- `test:5e80df22275545af6ffa4ff2c7ac0b136cfeaf0eaac5f9fd5e35aea7917a9fb7`

Tags:
- `runtime-source`
- `tooling`

Contract:
- TS 闭包的 sync/check 共用预期文件集合，只清理带受管生成标记的过期副本。

Proves:
- Check 检测漂移但不改写或删除；write 修正目标并删除已知过期副本；无标记的本地文件保留。
