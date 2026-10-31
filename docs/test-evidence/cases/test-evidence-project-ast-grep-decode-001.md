### Case TEST-EVIDENCE-PROJECT-AST-GREP-DECODE-001: ast-grep JSON 只接受可归属的 match 与合法 capture

Tests:
- `test:e4433b41865010956547162eb3201e1afdd41e5ef855fb7d208dc6504e8d8755`
- `test:e57207ba71c261bb91a203ecf60894df37a81264144b7c3e4be71a0ffa7e9f5a`
- `test:ff692d7b69b9e3d0a8c46fd85f0dd18162e7f2a951c82593eb3d67b8aacc741d`

Tags:
- `repository-tooling`

Contract:
- 项目快照必须严格解码 ast-grep match 数组、来源文件与 capture 结构；可省略的 metaVariables 和 single 表示无 capture，不改变合法 capture 文本。多规则 scan 必须成功执行且每个 match 都归属于声明规则，不能把失败或未知规则结果当成完整注册。

Proves:
- 省略 metaVariables、空 metaVariables 与空 single 都得到空变量集合；NAME capture 文本按原值保留。
- 非数组、非对象 match、空文件、expected source 外文件及非法 metaVariables、single、capture 被拒绝，诊断区分出失败的结构或变量。
- scan 返回未知 ruleId 时以 unexpected rule ID 拒绝；scan 非零退出即使输出空数组，也以 scan failed 阻断快照发布。
