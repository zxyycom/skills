### Case NATIVE-RECORD-GIT-PUBLISH-001: 真实 Git 条件发布和锁竞争

Tests:
- `test:0a73b2e75053ee920c387d5f21d6ba7c41cb653381cf649ecc22427481ffb084`
- `test:15b863f2ab1d69d29f4ee1b617166d019c1e1503df64a7950ed37b8534d8b1ef`
- `test:20ad9f1001408d13e8eb929189f5535672bd3c836d4b0162e88ad6020e39cf32`
- `test:305da211c6e7ea54ab08877458303b8ffefa9aca51fa787e83a8818b6688f385`
- `test:4a95b0fb7360ee43a842a42aafa563140863fc5eeb25f5611a20556631a6ca0a`
- `test:93ac163e715cb209189e59376e4099ef2db76da0c97fc4fb104c1dca07920dcb`
- `test:a4990d60483af484e0ea3a2d71d720d053f31266164b2cb263a00e1098608081`
- `test:bc48ce19bfffdd269ff1d5dc0853c0ee7639432a496877ad324c7da1f5146ebe`
- `test:fbffca0af094cbea7929e9efe9c4fce6675e21dbc034e21ccc1ec9b2139b1874`

Tags:
- `record-rust`

Contract:
- 写入 Git index 时须保留非目标 pending，冲突或锁身份变化时拒绝覆盖。

Proves:
- 真实 Git 锁、竞争者、源 guard、创建删除及 mode 情况按 index 和工作树回读核对。
