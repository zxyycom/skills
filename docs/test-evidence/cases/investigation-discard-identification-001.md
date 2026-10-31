### Case INVESTIGATION-DISCARD-IDENTIFICATION-001: discard 识别正式报告并拒绝缺失目标

Tests:
- `test:9f13bc8f9859af329016e56e04d494bbbc1b13b0fef85d9e25fb0be44c6fb215`

Tags:
- `investigation-report`

Contract:
- 统一 `discard` 以共享稳定 ID 空间定位目标：正式报告走正式删除门禁，候选走候选删除门禁，二者不能同时命中同一语义名。

Proves:
- 正式报告被准确选中，缺失目标返回 missing 诊断。
