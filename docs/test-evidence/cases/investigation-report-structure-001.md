### Case INVESTIGATION-REPORT-STRUCTURE-001: 报告核心正文的就绪边界

Tests:
- `test:631231617ba3f42b37e3446d8546e6d93389636e4582f4983997eee4757e4e06`

Tags:
- `investigation-report`

Contract:
- 已建立报告的必需正文节不能为空，候选可以保留未就绪正文。

Proves:
- 四个非空正文节通过，移除背景正文后正式模式报告错误，而候选模式不报告该正文错误。
