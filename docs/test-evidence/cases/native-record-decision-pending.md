### Case NATIVE-RECORD-DECISION-PENDING-001: 决策身份操作保护 Git pending

Tests:
- `test:124190f5575c7b94adda23d009430cd65bcd96b59142f05406a4bfe20dd5f20c`

Tags:
- `record-rust`

Contract:
- 决策身份操作须识别域内暂存冲突且保留无关暂存。

Proves:
- 真实 Git 验证域外 pending、域内冲突、历史不可用、unborn 和 CLI 诊断。
