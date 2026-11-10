### Case NATIVE-RECORD-SOURCE-WRITE-DEFAULT-001: 未传 key 的写操作保持工作区单源

Tests:
- `test:ef29e3bfad0dbabf96dfd7771cbfafc49ddf36e31cca32aa98a3ed43679a4829`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 未显式传 --key 的写操作仍作用于当前工作区，defaultKey 只隐式影响读取，不重定向写入。

Proves:
- 配置含双来源 defaultKey 时，真实 new 未传 key 仍成功创建 docs/investigations 下的候选，两配置来源均无该候选。
