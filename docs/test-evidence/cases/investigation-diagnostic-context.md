### Case INVESTIGATION-DIAGNOSTIC-CONTEXT-001: 共同诊断适配器保留相同历史来源

Tests:
- `test:5299eaa3239d31662424cc2423a3a6d44552ef474ea7ca00f4fc0258d1c097dc`

Tags:
- `investigation-report`

Contract:
- 已知领域问题、系统异常和 Index Runtime 诊断适配到同一 InvestigationDiagnostic 类型，保留已知固定来源与调用方的恢复语义。

Proves:
- 三种实际适配器保留同一 source 的 kind、revision、path 与 recovery；领域适配器同时保留 causes，系统适配器将 EACCES 识别为 access-denied。
