### Case INDEX-RUNTIME-DEFINITION-002: 拒绝非法的封闭查询字段描述

Tests:
- `test:7c7627d49cc307681045f67ca5880dd1f66f55c5e2ffa9c4991649ea967c27c4`

Tags:
- `index-runtime`

Contract:
- Definition 必须声明唯一非保留字段名、非空封闭 source、合法 path/each/instant 组合和有效 state parser，且不接受任意 transform。

Proves:
- 重复字段、保留 `id`、缺失 parser、路径边界非法、instant mode 不匹配和额外 callback 属性都在 definition 构造时失败。
