### Case DECISION-SHOW-OUTPUT-001: Show 返回元数据并报告正文读取失败

Tests:
- `test:c5c37382a86b650ade735fe2ef9cbeb3f45e2954aff08edffc47c39fd9902315`

Tags:
- `decision-records`

Contract:
- show 返回稳定 ID/sourcePath 元数据；正文读取失败时不输出部分结果。

Proves:
- 模拟读取失败，断言空 stdout、定位诊断和单次读取。
