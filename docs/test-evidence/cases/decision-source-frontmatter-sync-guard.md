### Case DECISION-SOURCE-SYNC-GUARD-001: 同步不能以早先解析覆盖 fresh 失败

Tests:
- `test:e1617d2b3f5cb8f7969b95a9b3a46d2a2008de33dd2bd6943884f75d1fb5c9ba`

Tags:
- `decision-records`

Contract:
- 完整索引同步的 fresh 读取失败时不得发布先前已验证来源形成的索引，也不得回写并发变化的来源。

Proves:
- 在真实源码 CLI 的第二次来源打开前注入坏 YAML，实际触发 fresh 读取、命令返回失败、索引字节不变，且保留并发写入的坏来源。
