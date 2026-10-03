### Case RECORD-SEARCH-WARNING-001: 正常预览限制不要求修复当前来源

Tests:
- `test:3e2081fb0711ffbd399861224fb6b8a5dc12194914b8eb9711195ffc83fd93f7`

Tags:
- `record-search`

Contract:
- search 预算 warning 与来源 warning 分工明确；已验证当前来源上的片段省略不诊断来源问题或要求恢复索引。

Proves:
- 真实分发 Decision CLI 在 current、非 fallback 且扫描与返回完整时，只因范围预算显示 previews=limited。
- stderr 恰为带领域前缀的一条 match-previews warning，不包含 source problem、Decision query source、sync-index 或修复来源动作。
