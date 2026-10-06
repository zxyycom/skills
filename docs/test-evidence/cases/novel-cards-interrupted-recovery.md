### Case NOVEL-CARDS-INTERRUPTED-RECOVERY-026: 中断事务恢复

Tests:
- `test:5addf554a549d02bc44c4c1b20e475a0237264040be969fe1d31491cec702b5f`

Tags:
- `novel-cards`

Contract:
- 存在未结算journal时查询阻断，显式recover仅恢复事务前后字节，不覆盖外来修改。

Proves:
- 外来文本或能被非致命解码误读为事务后U+FFFD的非法UTF-8字节均使恢复拒绝，诊断定位原文件且原字节与journal保留；换回事务后合法字节后缺write仍拒绝，显式write恢复原卡与当前索引。
