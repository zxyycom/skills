### Case INVESTIGATION-RESOURCE-SCOPE-001: 未引用资源池问题仅告警，局部检查不推断 Owner 或全局未引用资源状态

Entry:
- `tools/investigation-report/tests/resources.test.ts > unreferenced resource pool hazards warn only and scoped checks prove neither owner anchoring nor global unreferenced-resource state`
- `bun test --test-name-pattern="^unreferenced resource pool hazards warn only and scoped checks prove neither owner anchoring nor global unreferenced-resource state$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整检查仅把报告实际引用资源的 owner 与可用性问题视为阻断错误；资源池中未引用的路径、非法名称、符号链接或非普通文件只产生告警。
- 按路径的局部检查不扫描资源池，也不宣称全局 owner 锚定或未引用资源状态。

Proves:
- 局部检查成功、没有 warnings，且 `indexChecked` 为 false。
- 完整检查没有 errors，按稳定排序报告未引用资源、非法资源 ID、符号链接和非普通文件的 warnings。
