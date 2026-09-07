### Case INVESTIGATION-DISCARD-RESOURCE-DRIFT-001: discard rechecks ignored owner resource drift before publishing

Tests:
- `test:c1bd54a0578f703ae525481c602e7b3f651b236698ff8988ec2f074b6e512428`

Tags:
- `investigation-report`

Contract:
- discard 在发布前必须重新比较 owner 资源成员，防止预演后的资源变化进入递归删除。

Proves:
- 预演后新增 ignored owner 资源使发布失败，报告和原资源保持存在。
