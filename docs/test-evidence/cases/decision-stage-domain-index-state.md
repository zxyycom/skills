### Case DECISION-STAGE-DOMAIN-INDEX-STATE-001: 领域暂存保持坏索引字节或删除状态

Tests:
- `test:a13a85a9fd6e6a4e0b03510e750b58ce4e140339833bbda0fa393322f466ac04`
- `test:bdf5ac705be28306ee4518f7c130cd9427291580c0e0e7c0bff72a3d937d7b84`
- `test:d2bb30bc8f91cdc442fbb054e4daf8879cb374f5e55613e1104321889284f671`
- `test:d7faee0c17b793aea9f79feb1ae1d41899e4bd5bee8abb1eb4c29428e00cf33b`
- `test:db70257595dc8d13cb25f6bec312401214d4153ee3ba879c9bf5b273e0c2bdd1`

Tags:
- `decision-records`

Contract:
- domain scope 分开所选身份解析与旧位置收集，尝试可用合法 P 索引为所有所选 ID 补充旧 sourcePath，并核对所选 canonical pending 来源身份；不改写 P 索引。
- P 索引不可读或不可解析时，独立 H/W/canonical 已足够定位所选才允许保留其 metadata 与已读 bytes 继续；可用 P 已识别的所选来源读取或身份失败不能被该容错吞掉。

Proves:
- pending 索引为坏 JSON 或已删除时，领域 A 可刷新，索引坏字节或删除状态均保持。
- H/W 已定位所选 ID 时，即使 caller-owned P 索引的实际 Git blob 缺失，领域来源仍刷新成功；P 索引 mode/OID 与 W 索引字节保持。
- canonical P-only 来源在 H/W 均无身份时可删除；P 索引为坏 JSON 或 blob 缺失均不形成强制门禁，不修复或改写其 mode/OID，所选 pending 路径退出。
- H/P/W 中同一 ID 分别位于 head-old、staged-old、current 任意路径时，domain 清除 P 的 staged-old 并暂存 current；P 索引原 bytes/mode/OID、未选部分暂存正文 bytes/mode/OID 与 W 索引均保持。
- 合法 P 索引已定位的所选旧正文 blob 缺失或 header 身份不符时，domain 明确失败；pending 完整成员与 mode/OID、W 索引和当前所选正文均保持。
