### Case INVESTIGATION-RESOURCE-PATH-001: 不安全的随附资源路径被拒绝

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation rejects unsafe attached resource paths`
- `bun test --test-name-pattern="^validation rejects unsafe attached resource paths$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告资源链接只能原样书写为 `../_resources/<resource-id>`，不能借助 Markdown 转义或字符实体形成解码别名；资源 ID 必须命中显式字符白名单、保持规范、不越界且不含查询、片段或百分号编码。

Proves:
- 上级路径与未放行的 emoji 分别命中包含原链接目标的非规范 ID 诊断，绝对路径、query、fragment、百分号编码和反斜杠分别命中包含原链接目标的固定前缀诊断。
- 字符实体解码目标、Markdown 转义目标与尖括号包裹目标均命中原始目标必须按字面书写的专用诊断。
- 已布置可达的同名目标，且断言拒绝 `does not exist` 诊断，防止路径语法校验失效被后续缺失检查掩盖。
