### Case DECISION-SOURCE-SYNC-GUARD-001: 同步不能以早先解析覆盖 fresh 失败

Tests:
- `test:5a9a775f6a7cab8a3df7d79e9628b8001f1da6164db8c6888c540b74d9ac08da`

Tags:
- `decision-records`

Contract:
- 完整索引同步的 fresh 读取失败时不得发布先前已验证来源形成的索引，也不得回写并发变化的来源。

Proves:
- 在真实源码 CLI 的第二次来源打开前注入坏 YAML，实际触发 fresh 读取、命令返回失败、索引字节不变，且保留并发写入的坏来源。
