### Case DECISION-SHOW-OUTPUT-001: Show 返回元数据并报告正文读取失败

Tests:
- `test:06159ddfa5abca71ed6803d47bf2c8744562994ac9a07e0e2b4ae1cf45443d5f`

Tags:
- `decision-records`

Contract:
- show 返回稳定 ID/sourcePath 元数据；正文读取失败时不输出部分结果。

Proves:
- 模拟读取失败，断言空 stdout、定位诊断和单次读取。
