### Case NATIVE-FROZEN-GENERATION-001: 候选生成拒绝缺失或漂移的冻结输入

Tests:
- `test:f44a52056588d7e086dff0741dc5361981ccf7474f6f259ac001f7d1a857d419`

Tags:
- `repository-tooling`

Contract:
- 候选生成必须消费已捕获且经独立摘要核对的 delivery 源码，缺失 worker 或来源漂移不得生成制品。

Proves:
- 隔离目录缺少冻结 worker、预期摘要错配和暂存内容被修改时均拒绝；不证明成功生成或可安装。
