### Case INVESTIGATION-STAGE-DOMAIN-PRESERVE-STAGED-DELETION-001: stage --scope domain keeps unrelated staged deletions when staging another report

Tests:
- `test:d89f8c88666a1266ab975ece86836beb7fb80304afddfb79ab7e0793bee86881`

Tags:
- `investigation-report`

Contract:
- domain scope 的替换目标从当前 pending 范围出发；无关路径已暂存的删除保持删除，HEAD 内容不得在后续 domain 暂存中重新进入。

Proves:
- 先以 domain 暂存 removed 报告及其 owner 资源删除，再以 domain 暂存 kept 报告；pending 中 removed 报告与资源仍为删除，kept 报告正常更新且 writtenPaths 只含 kept。
- preservedPendingPaths 明确报告两个相对 HEAD 的未选 staged 删除路径，不只包含仍存在的 pending 文件。
