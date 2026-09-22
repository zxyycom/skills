### Case INVESTIGATION-DISCARD-IDENTIFICATION-002: 同名候选与正式报告要求完整 ID

Tests:
- `test:9962ea1f8248806c449ff21fba2622ccb23deefdc695fc3bdd5c4f6c20b23156`

Tags:
- `investigation-report`

Contract:
- 同一语义名同时命中候选与正式报告时，`discard` 不得静默选择删除范围，必须要求完整 Investigation ID。

Proves:
- 同名调用返回 matches both 诊断，候选与正式报告来源文件逐字节保留。
