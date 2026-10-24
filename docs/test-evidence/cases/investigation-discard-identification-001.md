### Case INVESTIGATION-DISCARD-IDENTIFICATION-001: discard 识别正式报告并拒绝缺失目标

Tests:
- `test:2be7dffb814983d71e6865a9b30cd2524450a728a901cb7d90163b09d2c35319`

Tags:
- `investigation-report`

Contract:
- 统一 `discard` 以共享稳定 ID 空间定位目标：正式报告走正式删除门禁，候选走候选删除门禁，二者不能同时命中同一语义名。

Proves:
- 正式报告被准确选中，缺失目标返回 missing 诊断。
