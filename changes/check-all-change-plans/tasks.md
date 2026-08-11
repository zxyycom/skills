# Tasks

本 change 先固定集合选择与失败语义，再实现聚合结果和 CLI，最后同步行为 owner、生成制品、测试证据与长期决策。

## Readiness

- [x] 0.1 核对 change-plan 行为入口、固定契约、基础生命周期决策、工具链、编码规范和测试证据维护规则。
- [x] 0.2 确认聚合检查复用现有 catalog 发现和单 Change checker，不建立第二套目录或 artifact 规则。
- [x] 0.3 确认 `check-all` 默认检查 active，`--archived` 与 `--all` 显式扩大或切换集合，且不支持 stage 过滤。
- [x] 0.4 确认任一成员无效或根级错误使聚合检查失败，同时保持 `list` 的非门禁退出语义。

## Implementation

- [x] 1.1 在 Change Plan 类型与 catalog owner 中实现聚合检查选项、计数、逐项结果和 `valid` 派生。
- [x] 1.2 在 CLI 中实现 `check-all` 参数边界、生命周期集合选择、文本诊断、JSON 输出和 `0/1/2` 退出码。
- [x] 1.3 同步 `SKILL.md`、固定契约和人类说明，使单项检查、聚合门禁、archived 显式审计和 list 发现边界各自清楚。
- [x] 1.4 提升 change-plan 独立版本，并从工具源码同步自包含 MJS 与 source map。
- [x] 1.5 建立聚合门禁的长期决策，并在实现与文档全部成为当前事实后标记为 aligned。
- [x] 1.6 新增聚合函数与 CLI 原生测试，覆盖集合选择、成功、成员失败、根级失败、诊断通道和参数冲突；同步对应测试证据 case 与索引。

## Verification

- [x] 2.1 运行新增聚合函数和 CLI 的可独立测试入口，确认逐项结果、计数、文本/JSON 通道和退出码。
- [x] 2.2 运行完整 Change Plan 测试、类型检查、生成制品漂移检查和 skill 结构校验。
- [x] 2.3 运行测试证据与决策严格检查，并确认全部 active Change 能通过新增默认聚合门禁。
- [x] 2.4 运行 `bun run check` quick 门禁并完成 AI-ready 文档与编码规范审阅。
- [x] 2.5 对照 proposal 成功标准完成语义审阅；归档需要另行确认时保持已完成 implementation Change，不自行归档。
