### Case INVESTIGATION-LEGACY-IDENTITY-001: legacy 身份只按索引自有成员定位

Tests:
- `test:3440d1d65229fa845099ca3c24335fbab34e570e9675bee5ea7c8764dc01bb5e`
- `test:59f63ce8ece87507f1674fdafebaeff5100613683a3b35a9c08f9baf09ce76a5`
- `test:d8f38b211fbb0a29e1938fa0aa78d8922a3aeedbdd686c680f9f1e4b7d1a6c72`

Tags:
- `investigation-report`

Contract:
- 合法 Investigation ID 可以与对象原型成员同名；只把索引 entries 的自有键作为命中，不把继承成员当作来源或 owner。

Proves:
- 未发布的 constructor 正式报告可由局部身份发现检查，indexChecked=false。
- 未索引的 constructor 正式 owner 不从当前正文发现，候选共享资源 readiness 明确为 false，不把对象继承成员当作 owner。
- 纯 domain selection 将当前索引没有自有成员的 constructor 归为 deletedIds，reportIds 与 resourceIds 为空；真实 baseline-only 删除接线由 domain stage 集成入口承接。
