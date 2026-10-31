### Case INVESTIGATION-DISCARD-SHARED-FRESH-001: 删除的领域新鲜来源与共同保护共享安全观察

Tests:
- `test:d04a4e215717861cf7df5f17e172f630d12b1c881e2445c431b748ce2440b328`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- IR 正式 discard 的 transaction fresh 必须以真实父目录事务根安全采集，并完成完整图和资源验证；随后共同保护可复用本阶段事实，写后仍独立观察。

Proves:
- 直接 publication fixture 中，领域 fresh 已取得未变来源；shared preverify 对它新增打开为零，shared postwrite 新增为一，删除实际完成。本测试隔离来源交接，不声称验证公开删除索引投影，也不固定领域 post collection 的总读取数。
