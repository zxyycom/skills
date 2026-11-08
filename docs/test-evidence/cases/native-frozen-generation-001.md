### Case NATIVE-FROZEN-GENERATION-001: 候选生成拒绝缺失或漂移的冻结输入

Tests:
- `test:6860a5724f1bd780ceb71c117f424d76e8822296b0415aaa6bcaedf847cadbff`
- `test:f44a52056588d7e086dff0741dc5361981ccf7474f6f259ac001f7d1a857d419`

Tags:
- `repository-tooling`

Contract:
- 候选生成必须消费已捕获且经独立摘要核对的 delivery 源码，缺失 worker 或来源漂移不得生成制品。
- 候选 lock 仅包含 updater 可达的冻结依赖及其原始完整性记录，缺失或不支持的依赖记录必须拒绝。

Proves:
- 隔离目录缺少冻结 worker、预期摘要错配和暂存内容被修改时均拒绝；不证明成功生成或可安装。
- 基于真实旧 lock 保留四个直接依赖及其传递依赖，排除不可达条目，并拒绝缺失的传递记录。
