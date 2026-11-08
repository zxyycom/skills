### Case INVESTIGATION-RENAME-SELECTOR-001: dated source 精确匹配且 name 歧义报错

Tests:
- `test:1f3582ba2a47817bb29d520da0781f7410e5974d644891e49551fee38a400eb3`
- `test:e06b9f36fcea339561836d2509411bc1559f02bfa2db7956bfec7aa33d4450ab`

Tags:
- `investigation-report`

Contract:
- Investigation rename 的日期 ID 精确匹配，名称歧义不得静默选择，缺失日期 ID 不回退为名称。

Proves:
- 共用 identity selector 的纯测试以两个日期同名 locator 核对完整 ID 加 .MD 精确选择、名称歧义和不存在日期拒绝。
- 真实 IR CLI 以完整 ID 成功预检并执行候选 rename；解析与服务按源码将 source 原样交给共用 identity selector。本组合不声称真实 CLI 执行所有 selector 变体。
