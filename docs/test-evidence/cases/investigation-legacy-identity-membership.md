### Case INVESTIGATION-LEGACY-IDENTITY-001: legacy 身份只按索引自有成员定位

Tests:
- `test:19cadd404cf31c4d32e34517246796dcdee6c569b4d2cdaad8c92de0c6538d12`
- `test:58d1e977c66b0e70adcc820cb7155a5a81739e8432c703d87e347a0700a4faaf`
- `test:9266655bfbf40d4eb8608c51749663cefeb83a2d74f6ce48ff15ee0d9ccb1742`

Tags:
- `investigation-report`

Contract:
- 合法 Investigation ID 可以与对象原型成员同名；只把索引 entries 的自有键作为命中，不把继承成员当作来源或 owner。

Proves:
- 未发布的 constructor 正式报告可由局部身份发现检查，indexChecked=false。
- 未索引的 constructor 正式 owner 不从当前正文发现，候选共享资源 readiness 明确为 false，不把对象继承成员当作 owner。
- 纯 domain selection 将当前索引没有自有成员的 constructor 归为 deletedIds，reportIds 与 resourceIds 为空；真实 baseline-only 删除接线由 domain stage 集成入口承接。
