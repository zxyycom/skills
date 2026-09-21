# Proposal

本 Plan 统一 Decision Records 与 Investigation Report 在派生索引陈旧时的查询、同步和严格门禁。

## Why

正式 Markdown 是权威来源，提交进 Git 的 JSON 索引是可重建投影。来源变化后，两个 CLI 对 `list`、`search`、`show` 和 `trace` 采用不同的继续服务或停止规则，维护文档也没有先区分“已知合法变化”和“未知集合异常”。调用者因此无法从当前事实直接判断应同步、检查还是停止。

## Outcome

两个领域采用同一状态路由：已审阅的来源变化先同步再严格检查，未知异常先检查再恢复；只读查询按数据来源降级并说明结果边界，写入和交付动作只在持久索引与权威来源一致时继续。

## Scope

### Intended Change

- 为索引快照查询、单实体读取、内容搜索和 mutation 定义共同的陈旧状态行为。
- 让 `sync-index` 默认写入完整派生索引，以 `--preflight` 提供零写入预演，并统一全量与选择性同步。
- 统一诊断类别、恢复动作和 skill 中的维护顺序。

### Resulting Impacts

- 两个查询层、同步入口、mutation 前置门禁和 CLI 输出需要采用同一状态模型。
- `tools/index-runtime/` 仅在领域层无法稳定表达共同诊断时补充能力。
- 两个 skill、本仓库人类入口、生成制品、版本和相关 Test Evidence 需要同步。

## Success Criteria

1. `list`、metadata search 和 `trace` 在陈旧索引上返回持久快照并报告边界；`show` 额外验证当前文件身份；内容搜索使用已验证的当前来源投影。
2. 严格 `check`、发布、关系与生命周期 mutation、删除和 staging 在索引陈旧时以一致诊断停止。
3. `sync-index` 全量和选择性调用都写入完整有效索引；`sync-index --preflight` 保持零写入；公开同步语法统一为默认写入与显式预演。
4. 两个 skill 都先按已知状态选择同步或检查；已知来源变化的规范顺序是同步后执行严格检查。
5. 目标测试、生成漂移检查、领域检查和完整仓库检查通过，相关 Test Evidence 与实际测试入口一致。
6. `sync-index` 默认写入，只有显式 `--preflight` 才零写入；被移除的 `--write` 不保留兼容或迁移特判，只按普通无效参数处理。

## Affected Owners

- `tools/decision-records/` 与 `skills/decision-records/`
- `tools/investigation-report/` 与 `skills/investigation-report/`
- 按需使用的 `tools/index-runtime/`
- `docs/skills/decision-records.md`、`docs/skills/investigation-report.md`
- `docs/test-evidence/cases/` 与 `docs/test-evidence/test-evidence-index.json`
- 记录该公共维护方向的 `docs/decisions/`
