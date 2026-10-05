### Case LIGHTWEIGHT-JUDGMENT-STATS-INDEX-LAYOUT-001: 固定日志索引布局

Tests:
- `test:ecbddfed1aaae9c4170418712937a510d5bf0458131d52936835a402d54812d1`

Tags:
- `lightweight-judgment`

Contract:
- 日志库普通索引为非 unique、非 partial 的固定定义；批次索引为固定 unique、partial 定义与谓词。列名相同但其他布局不符的库仍须拒绝，stats 与 writer 不修正或迁移它。

Proves:
- 合法当前结构先能读取；普通索引的 partial、unique、降序／collation 变体，以及批次索引的 nonunique、nonpartial、不同谓词与降序变体均使 stats／writer 返回 storage／退出4且不发送，原库字节和版本保持。
