### Case INVESTIGATION-STAGE-INDEX-DRIFT-001: 领域索引验证拒绝可变发布索引漂移

Tests:
- `test:1d84c1d2129a73413968d72e51e2d1c466137d2715df0d554bd86560972219d2`

Tags:
- `investigation-report`

Contract:
- 领域索引验证须独立比较当前可变发布索引，固定历史快照不能替代此检查。

Proves:
- `verifyDomainIndex` 接受未变的真实发布索引；修改其 title 后返回 stage-source-drift 诊断，并说明 published workspace index changed。
