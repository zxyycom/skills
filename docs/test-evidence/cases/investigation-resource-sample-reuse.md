### Case IR-RESOURCE-SAMPLE-REUSE-001: 采样范围互斥并复用已读头部

Tests:
- `test:06bdd86c2b5e6cd63e7a9032b5b7289aab32177d477fc1e4821c6c4d398febdc`
- `test:c807b607845380a10c245324ef44829d87936a11f8b5915622e77dffb56b254c`
- `test:e23e842b8fb408201b2bb06082c561ab500b1a290534f88ddfa3a67d5f90619f`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 采样窗口按文件大小缩减到互不重叠的有效范围，后续读取复用已取得的头部，避免重复消耗读取预算。

Proves:
- 纯规划对空、一字节、短文件及 u64 最大大小验证窗口数量、宽度、首尾覆盖、互斥与均匀分布，不锁定具体中间偏移。
- 原本请求四个 8192 字节窗口的 10000 字节文本在 10000 字节预算内完成，预留读取量与压缩输入均为 10000。
- Cursor 支撑的 Read/Seek 计数器以非均匀字节验证完整缓存、部分缓存和间隔读取，Read 接口累计返回字节分别为 10000 与 9192；该观察不衡量磁盘 I/O 或系统调用次数。
