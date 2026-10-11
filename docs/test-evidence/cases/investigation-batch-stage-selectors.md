### Case INVESTIGATION-BATCH-STAGE-SELECTORS-001: 整批暂存选择保留身份解析义务

Tests:
- `test:b3746fe99040065a8ef9cd2415310c6e63e0fed90dd3eb5e364c83dc0b99a855`
- `test:f099508975f2ff9113aa7f5f9d79557ba17e3ab72c7733d6aaf988e4f013acba`

Tags:
- `investigation-report`

Contract:
- 暂存选择从baseline与workspace最终ID/name集合解析；标准ID优先，重复选择仍交原下游约束。

Proves:
- 同ID的workspace name覆盖基线，基线-only与新增项均可选；dated未知ID不误作name解析，重复alias保留重复ID。
- 缺失与歧义诊断按selector输入顺序保留，完整候选ID按UTF-16顺序输出。
