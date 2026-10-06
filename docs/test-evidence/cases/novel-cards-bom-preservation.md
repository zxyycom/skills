### Case NOVEL-CARDS-BOM-PRESERVATION-032: BOM完整旧卡保护

Tests:
- `test:895e5b3678a3117e3441cb214dad8e5c8c918a3ca0656ca8b51277e86ef9175a`

Tags:
- `novel-cards`

Contract:
- 合法UTF-8开头BOM不能在来源读取、快照或失败恢复时被静默丢弃。

Proves:
- BOM人物卡同步成功；发布第三文件失败后原字节完整恢复；再次成功应用后原快照内容仍包含BOM。
