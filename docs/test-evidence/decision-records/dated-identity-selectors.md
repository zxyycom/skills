### Case DECISION-DATED-IDENTITY-001: 普通 selector 先解析日期 ID 再回退名称

Entry:
- `tools/decision-records/tests/queries.test.ts > ordinary selectors use dated IDs first and name fallback without reading paths`
- `bun test --test-name-pattern="^ordinary selectors use dated IDs first and name fallback without reading paths$" ./tools/decision-records/tests/run.ts`
- `tools/decision-records/tests/stage.test.ts > stage resolves a unique Decision name after one Markdown suffix`
- `tools/decision-records/tests/stage.test.ts > stage treats a standard Decision ID as exact instead of falling back to a name`
- `tools/decision-records/tests/stage.test.ts > stage reports ambiguous Decision names before writing pending files`
- `tools/decision-records/tests/stage.test.ts > stage resolves a filesystem-only Decision addition by name`

Contract:
- Decision 普通输入只移除一个 `.md` 后先精确解析 calendar-valid `YYMMDD-name`；仅解析失败才按 name 查找，文件 basename 不参与身份。
- `new` 自动加入当前 UTC 形成日，日期不匹配或将与 legacy 同名冲突时必须零写入失败。

Proves:
- 精确日期 ID（含 `.MD`）可读取；重复 name 的错误按 ID 顺序列出，非法日期前缀仍按完整 name 解析，而不存在的标准 ID 不会回退。
- `stage` 在读取 pending 边界后，于 HEAD 基线和当前工作区可识别来源的并集内解析唯一 name；工作区单侧新增可选择，标准 ID 不会回退，歧义不会写入 pending。
- name 创建的候选保留 UTC 日期 ID 但使用 name 路径；日期不一致与 legacy 同名创建返回对应诊断。
