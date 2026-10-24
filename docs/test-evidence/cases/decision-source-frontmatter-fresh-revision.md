### Case DECISION-SOURCE-FRESH-REVISION-001: 独立 fresh 重新读取并解析来源

Tests:
- `test:b6a01affa5135a2cbe8b29c8edcf3e7c5a632658b28fae516e1a735c577d6ea3`

Tags:
- `decision-records`

Contract:
- 同阶段来源解析复用不跨越 fresh 边界；后续来源 revision 读取必须独立观察实际文本与当前身份合法性。

Proves:
- 采集后修改实际正文不改变既有扫描的来源文本，但新的 revision 改变；再写入坏 YAML 或删除所选来源时，独立 fresh 各自报错而不复用早先合法身份。
