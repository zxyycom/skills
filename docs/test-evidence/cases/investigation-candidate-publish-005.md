### Case INVESTIGATION-CANDIDATE-PUBLISH-005: publish rechecks candidate formal source and index drift

Tests:
- `test:c3d9433a9abfa9dcb7c513502712106b798e0824a5a339f5e5b066fe4fdf22e1`

Tags:
- `investigation-report`

Contract:
- 普通 publish 在提交前必须重新验证 selected candidate、正式来源与当前索引；任一事实漂移时不改名 candidate 或写入正式报告、索引。

Proves:
- selected candidate、正式 Markdown 或索引在准备后变化时，写入器不会执行，candidate 保持在 authoring workspace。
