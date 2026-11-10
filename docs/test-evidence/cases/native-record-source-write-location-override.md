### Case NATIVE-RECORD-SOURCE-WRITE-LOCATION-OVERRIDE-001: 显式定位覆盖默认写源

Tests:
- `test:90dd6bce27f279d5d88ae3cc77cda936c2ea7ce24cc31798c4facf8c0bc25c8e`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 写操作显式提供 root 或 investigations-dir 时，使用该位置而非 defaultWriteKey，即使显式值等于内置默认值。

Proves:
- 写默认指向 first 时，new --root . 在当前工作区 docs/investigations 创建候选；new --investigations-dir custom/reports 在当前工作区自定义集合创建候选。
- 两个独立 fixture 的 first 来源目录成员和文件字节均保持调用前状态。
