# Proposal

本 Change 恢复已确认但在上一轮 trace 重构中遗漏的双输出 CLI 契约。

## Why

`decision-records trace` 与 `investigation-report trace` 当前无条件输出 JSON，遗漏了已确认的默认终端文本关系图；这使交互式使用无法直接阅读事件、图层和截断边界。

## Outcome

两个 trace CLI 默认输出稳定、可读的终端文本关系图，传入 `--json` 时保持当前 JSON envelope 不变；两种输出消费同一份 trace 查询成功结果。终端图不是旧的平铺文本，也不是 Mermaid。

## Scope

### Intended Change

恢复两个 trace CLI 的双 renderer：默认终端文本关系图，`--json` 输出既有 envelope；同步直接受影响的契约、help、版本、生成制品、测试和 Test Evidence。

### Resulting Impacts

文本输出必须由已完成的 trace result 派生，覆盖事件、context、summary 与截断边界；JSON、selection、默认限制、错误诊断和退出状态保持不变。

## Success Criteria

- 两个 trace CLI 默认输出稳定文本关系图，`--json` 输出现有 JSON shape。
- 测试证明 renderer 不重算 selection，并覆盖稳定图层、事件、context、summary 和边界。
- 受影响 owner、版本、生成制品和 Test Evidence 已同步，全部规定验证通过。

## Affected Owners

- `skills/decision-records/` 的行为入口、固定关系规则和分发 CLI。
- `skills/investigation-report/` 的行为入口、固定报告契约和分发 CLI。
- 两个领域对应的 `tools/` 源码和测试，以及 `docs/test-evidence/` Case-only 账本。
