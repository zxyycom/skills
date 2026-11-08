### Case INVESTIGATION-STAGE-DOMAIN-REPORT-DELETION-001: stage --scope domain stages report deletion with the owner tree for a baseline-only ID

Tests:
- `test:a8e662b1b943b525eefa370760c6f635b5344e5a5d50a13b556e6d88fb27b430`

Tags:
- `investigation-report`

Contract:
- baseline-only 报告 ID 在 domain scope 暂存报告与 owner 资源删除。

Proves:
- 真实 Git 中 HEAD 报告和 owner 资源均从 pending 删除，未选报告 pending 保持。
