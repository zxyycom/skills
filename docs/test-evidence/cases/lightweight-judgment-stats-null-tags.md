### Case LIGHTWEIGHT-JUDGMENT-STATS-NULL-TAGS-001: 旧记录缺标签与原型隔离

Tests:
- `test:2e73a61eea5c105ed3242a907c9fb4a630513cd156d85580c36fc7a19ab060c0`

Tags:
- `lightweight-judgment`

Contract:
- 未记录本地标签的旧行在 v1 读取与 v2 迁移后均只表达标签缺失，不继承对象原型字段或输出非法 JSON。

Proves:
- 真实 v1 与 writer 升级的 v2 库按 constructor／toString／__proto__ 组合分组均仅产生一个三字段 null 组；包含升级后新调用时分母为2，JSON 合法且没有 undefined。
