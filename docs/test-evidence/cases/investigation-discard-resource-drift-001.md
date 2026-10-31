### Case INVESTIGATION-DISCARD-RESOURCE-DRIFT-001: discard 发布前复核 owner 资源成员漂移

Tests:
- `test:072c3239701301aff7dafeb17be1e3cd0f9e4f078c97daafe58889672e01b984`

Tags:
- `investigation-report`

Contract:
- discard 在发布前必须重新比较 owner 资源成员，防止预演后的资源变化进入递归删除。

Proves:
- 沿用 discard 的 beforePublish 回调新增普通 owner 成员，结果 changed=false 并报告 owned resources changed before discard publication；报告与原资源保持存在。
