### Case IR-RESOURCE-SAMPLE-REUSE-001: 采样范围互斥并复用已读头部

Tests:
- `test:06bdd86c2b5e6cd63e7a9032b5b7289aab32177d477fc1e4821c6c4d398febdc`
- `test:5636435fb429eacdd3033bad3f2cfc389455a9916175e45b82f22cde50498abc`
- `test:c807b607845380a10c245324ef44829d87936a11f8b5915622e77dffb56b254c`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 采样窗口按文件大小缩减到互不重叠的有效范围，后续读取复用已取得的头部，避免重复消耗读取预算。

Proves:
- 纯规划对空、一字节、短文件及 u64 最大大小验证范围；原本请求四个 8192 字节窗口的 10000 字节文本在 10000 字节预算内完成，预留读取量与压缩输入均为 10000；独立 Read/Seek 计数器以非均匀字节验证完整缓存、部分缓存和间隔读取，实际底层读取分别仅 10000 与 9192 字节。
