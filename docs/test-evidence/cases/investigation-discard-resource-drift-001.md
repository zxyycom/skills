### Case INVESTIGATION-DISCARD-RESOURCE-DRIFT-001: discard 发布前复核 owner 资源成员漂移

Tests:
- `test:0e5b71c36a9689f7b5ba93cbb9b69659c88fd4eeea3147308ea5a0200a5c2545`

Tags:
- `investigation-report`

Contract:
- discard 在发布前必须重新比较 owner 资源成员，防止预演后的资源变化进入递归删除。

Proves:
- 沿用 discard 的 beforePublish 回调新增普通 owner 成员，结果 changed=false 并报告 owned resources changed before discard publication；报告与原资源保持存在。
