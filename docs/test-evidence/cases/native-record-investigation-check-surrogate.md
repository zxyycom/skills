### Case NATIVE-RECORD-INVESTIGATION-CHECK-SURROGATE-001: 调查检查拒绝孤立代理项

Tests:
- `test:9c979d64a6f98c956b0144db89dea2ddd8d00dc28469fbc6e532866a61acb180`

Tags:
- `record-rust`

Contract:
- 调查源中的孤立 UTF-16 代理项须以结构化错误拒绝。

Proves:
- 私有候选、正式来源与选定来源检查分别返回代理项错误码。
