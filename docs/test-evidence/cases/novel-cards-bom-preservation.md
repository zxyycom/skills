### Case NOVEL-CARDS-BOM-PRESERVATION-032: BOM完整旧卡保护

Tests:
- `test:895e5b3678a3117e3441cb214dad8e5c8c918a3ca0656ca8b51277e86ef9175a`

Tags:
- `novel-cards`

Contract:
- 合法UTF-8开头BOM不能在来源读取、快照或失败恢复时被静默丢弃。

Proves:
- BOM 卡同步成功；外层确认第三 writer 故障命中且至少发生三次调用，失败恢复后完整 Buffer（含 BOM）等于原文；成功快照也完整保留 BOM。
