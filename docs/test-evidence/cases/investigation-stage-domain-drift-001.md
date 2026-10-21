### Case INVESTIGATION-STAGE-DOMAIN-DRIFT-001: 阶段比较拒绝 owner 资源字节漂移

Tests:
- `test:13e48bbaee4eb256fdd1a2521a21305255d88d26ac37ade95d7ee3e4ae26af35`

Tags:
- `investigation-report`

Contract:
- 领域写计划比较须拒绝两个阶段中所选来源或 owner 资源字节的漂移。

Proves:
- 对真实 owner 资源先后采集 after 与 drifted 字节，`verifyDomainWrites` 返回来源/owner 字节漂移，现场 drifted 字节不被覆盖。
