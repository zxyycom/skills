### Case INVESTIGATION-STAGE-DOMAIN-BUSY-001: stage --scope domain reports a busy pending boundary without workspace writes

Tests:
- `test:636251d03f078cdfef096264c371b2454b1f7539a306efb308802b136c696c3b`

Tags:
- `investigation-report`

Contract:
- pending 边界忙时 domain scope 以 pending-conflict 失败且无工作区写入。

Proves:
- 持有 index.lock 时返回错误 state pending-conflict。
