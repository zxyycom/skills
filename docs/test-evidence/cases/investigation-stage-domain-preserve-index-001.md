### Case INVESTIGATION-STAGE-DOMAIN-PRESERVE-INDEX-001: stage --scope domain preserves staged index pending bytes and reports the preserved scope

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- domain scope 暂存所选来源时不刷新 pending 索引投影。

Proves:
- 真实 Git domain stage 暂存报告与资源，读取 pending 索引仍显示 baseline 的旧标题。
