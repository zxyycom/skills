### Case IR-UNIFIED-CONFIG-PRECEDENCE-001: 统一配置按字段覆盖与显式替代

Tests:
- `test:6c218bfa19f4386dfa3ab398fb064633e35ae2a59079e8944d97307911a1daef`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 资源策略按内置、项目、本地优先级合并，显式 --config 替代自动层；--root 不阻止读取资源策略。

Proves:
- 本地只覆盖文件大小线而保留项目关闭压缩的字段；显式文件恢复内置压缩并改变大小提示，真实候选查询在两种配置下返回可区分结果。
