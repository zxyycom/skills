### Case INVESTIGATION-PUBLISH-BASELINE-RECOVERY-001: 发布基线异常需显式恢复

Tests:
- `test:2eee9b6cb79430df8d38863401ea32fbb06dfc9bd6a68e4774d856270297380b`

Tags:
- `investigation-report`

Contract:
- 已有正式来源时，缺失或损坏发布索引不能隐式作为候选发布基线。

Proves:
- 真实 CLI 在索引缺失、损坏两种情况下分别返回 index-missing、index-invalid；既有正式来源、候选和索引现场保持，未创建测试检查的目标文件。节点不覆盖旧 schema 或显式同步后的发布重试。
