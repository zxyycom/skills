### Case LIGHTWEIGHT-JUDGMENT-STATS-NULL-TAGS-001: 当前记录缺标签与原型隔离

Tests:
- `test:6c177d58e388169aae7a59cb3127434c0bfee658f8e531941ef467a2d30bc968`

Tags:
- `lightweight-judgment`

Contract:
- 当前结构中未记录本地标签的行只表达标签缺失，不继承对象原型字段或输出非法 JSON。

Proves:
- 当前库按 constructor／toString／__proto__ 组合分组仅产生一个三字段 null 组；新增未带标签的调用后仍为同一组且分母为 2，JSON 没有 undefined。
