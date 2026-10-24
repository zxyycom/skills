### Case INVESTIGATION-UNIFIED-DISCARD-CANDIDATE-RELEASE-001: 候选删除后解锁失败保留真实结果

Tests:
- `test:c936e79570472b1c7e21230ddb2cca5abba7ecb5ba904852822b6d573b3d6726`

Tags:
- `investigation-report`

Contract:
- 统一入口按已分类kind映射解锁失败，不能将candidate DTO伪装成带indexPath的formal结果。

Proves:
- 候选已退出后注入锁清理EIO，返回changed、真实ID、candidate scope与committed-cleanup-pending。
- 失败包含release诊断且不伪造indexPath，正式index字节保持不变。
