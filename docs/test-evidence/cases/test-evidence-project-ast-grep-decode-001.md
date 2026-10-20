### Case TEST-EVIDENCE-PROJECT-AST-GREP-DECODE-001: ast-grep JSON 只接受可归属的 match 与合法 capture

Tests:
- `test:3ba6bac4665953fa9865d72400c170101e9b1949f4dce91f8594ab0530184267`
- `test:6dab7fadce94bfb8d86cc93cad84c18c3bf2f68f152031549b4ab0ed679ea31f`
- `test:cfbf42d548e2af352eb94b1ea48bfa96a684f67dff0f1bde6f7ad2de535710ec`

Tags:
- `repository-tooling`

Contract:
- 项目快照必须严格解码 ast-grep match 数组、来源文件与 capture 结构；可省略的 metaVariables 和 single 表示无 capture，不改变合法 capture 文本。多规则 scan 必须成功执行且每个 match 都归属于声明规则，不能把失败或未知规则结果当成完整注册。

Proves:
- 省略 metaVariables、空 metaVariables 与空 single 都得到空变量集合；NAME capture 文本按原值保留。
- 非数组、非对象 match、空文件、expected source 外文件及非法 metaVariables、single、capture 被拒绝，诊断区分出失败的结构或变量。
- scan 返回未知 ruleId 时以 unexpected rule ID 拒绝；scan 非零退出即使输出空数组，也以 scan failed 阻断快照发布。
