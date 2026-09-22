### Case INVESTIGATION-DISCARD-IDENTIFICATION-001: discard 按稳定 ID 识别正式报告与缺失目标

Tests:
- `test:97e28b4d6fdca495f482e147ac7c39e11384eb5336127006821c9830ca38a407`

Tags:
- `investigation-report`

Contract:
- 统一 `discard` 以共享稳定 ID 空间定位目标：正式报告走正式删除门禁，候选走候选删除门禁，二者不能同时命中同一语义名。

Proves:
- 指向正式报告的 ID 完成正式删除并移除来源文件。
- 不存在的 ID 返回 does not exist 领域错误且零写入。
