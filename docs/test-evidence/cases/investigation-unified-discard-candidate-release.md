### Case INVESTIGATION-UNIFIED-DISCARD-CANDIDATE-RELEASE-001: 候选删除后解锁失败保留真实结果

Tests:
- `test:19d2805c63968a65b4822e0fd8c5095b9a19c818164606f4c2e22680b7eee8cd`

Tags:
- `investigation-report`

Contract:
- 统一入口按已分类kind映射解锁失败，不能将candidate DTO伪装成带indexPath的formal结果。

Proves:
- 候选已退出后注入锁清理EIO，返回changed、真实ID、candidate scope与committed-cleanup-pending。
- 失败包含release诊断且不伪造indexPath，正式index字节保持不变。
