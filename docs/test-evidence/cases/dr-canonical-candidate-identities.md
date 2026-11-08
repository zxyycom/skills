### Case DR-CANONICAL-CANDIDATE-IDENTITIES-001: 完整日期身份的新建与局部候选定位

Tests:
- `test:5113ec12f3117487b9cea441786d11241e985654cd49462431dd8ea361e6042b`

Tags:
- `decision-records`

Contract:
- 新建采用完整日期身份并允许跨日及 legacy 同名；冲突不覆盖，转正保留 ID 和路径。

Proves:
- legacy、跨日及当日同名候选共存；重复新建失败且字节不变，name 歧义而完整 ID 可选；发布后索引保留创建时 ID/path，legacy 内容和另一候选保持。
