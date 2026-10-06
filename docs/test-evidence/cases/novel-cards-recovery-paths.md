### Case NOVEL-CARDS-RECOVERY-PATHS-034: 恢复路径边界

Tests:
- `test:9ef0a3254cdb1cdbb3dad970446c19683b2b1c40cb6d531ae96dd1cfec03df62`

Tags:
- `novel-cards`

Contract:
- 恢复根、父链与journal目标须为受控真实路径，不能沿链接或越界修改卡片。

Proves:
- linked root、../目标和linked snapshot父链均拒绝，真实原卡及外部目标字节不变，journal保留。
