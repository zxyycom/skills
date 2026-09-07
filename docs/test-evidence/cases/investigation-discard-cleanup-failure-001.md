### Case INVESTIGATION-DISCARD-CLEANUP-FAILURE-001: discard reports a committed result when safe tombstone cleanup cannot finish

Tests:
- `test:eccf1698feacf273ec35ac6fa226e6f5d191a51ca71b9ab90c80b1f527ee27c0`

Tags:
- `investigation-report`

Contract:
- 新索引发布是 discard 的领域提交点；提交后的 tombstone 清理不能删除未预演成员，无法安全完成时必须保留残留并明确报告操作已经提交。

Proves:
- 索引发布后注入未预演目录会返回 `changed: true`、`committed-cleanup-pending` outcome 与 cleanup 诊断 code，报告已退出集合且完整检查通过。
- 未预演目录保留在诊断指向的 tombstone 中，没有被递归删除。
