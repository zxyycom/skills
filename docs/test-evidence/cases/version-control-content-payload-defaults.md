### Case VERSION-CONTROL-CONTENT-PAYLOAD-DEFAULTS-001: 显式payload范围与完整默认验收

Tests:
- `test:29203e3f3debde471246ea24292a4056ff61bb0850dcc4aa67eca22b7ce80058`
- `test:5f86bdbba9636a33da0e3ea805c58e88a32dd5a52cfd99f6687bacabf063f16c`
- `test:7ed7a9fb7ac2a47f9720cf8258925826295ce791cada867c9128eefe08865ec0`

Tags:
- `version-control`

Contract:
- pending snapshot省略payloadScope或指定scope时验证完整范围payload；只有显式content-paths策略才将payload验收收窄到contentPaths，完整成员身份仍受保护。

Proves:
- 未选对象缺失、腐败或实际类型错误时，content-paths读取、修改与unchanged仍成功且未选条目不变；显式scope、默认snapshot和普通完整读取均失败。
