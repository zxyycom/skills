# Proposal

本 Change 将共享版本控制调用链与 Decision Records、Investigation Report CLI 的已知用户可见失败收敛为即时、可行动且可测试的诊断；它不保存日志，也不把普通失败伪装成 mutation 结果。

## Why

当前两套记录维护 CLI 及其共享 Git/index 调用链混用原始异常、宽泛 `operation-failed` 与领域自写字符串。部分 `catch` 已丢失 `cause` 或 stderr；pending 替换把权限问题压成普通失败；集合 mutation lock 又把任意取锁失败说成并发事务。用户难以区分权限、真实锁冲突、仓库/Git 不可用、revision 失败、普通命令失败和恢复失败，也无法据此采取安全下一步。

问题不只在版本控制层。Decision Records 与 Investigation Report 的参数、来源、索引、关系、历史、资源、stage/discard、锁和恢复边界仍有裸 `unavailable`、`could not be...` 或多层失败前缀；调查的非阻断前序历史检查还会把检查失败静默成“无 warning”。对 mutation 与纯读取/校验错误使用同一结果模型，会让用户误以为发生了写入或已经回滚。

## Outcome

- Decision Records、Investigation Report 及其共享调用链中大部分已知用户可见失败，均以 CLI 即时输出提供稳定 `code`、失败对象、原因和具体下一步；系统失败在有可靠证据时另外提供 `causeCategory` 与受控 `detail`。
- 只有实际具有 mutation 能力的失败由拥有提交点与恢复证据的领域事务补充 `scope` 与 `outcome`；读取、查询、参数或语义失败不声称写入结果。
- 共享版本控制层只保留它能证明的 operation event、原因、目标和受控 detail；领域层补充领域上下文与 mutation 事实，CLI renderer 组合恢复文本，避免多层重复包装。
- Git 历史检查不可用不会伪装为“没有记录”或“无需 warning”：必要维护继续 fail closed，调查的非阻断关系检查明确报告未完成。
- 现有命令的成功 stdout、失败 stderr 与退出码语义保持不变；诊断不持久化为日志、遥测或 receipt，稳定字段可供测试和上层映射。

## Scope

### Intended Change

- 为共享 `VersionControlError` 和必要的相邻边界增加实现中立的 operation event、可靠 `causeCategory`、安全 target/detail 与保留的进程内 cause；仅按系统错误码、明确命令状态或受控 Git 信号分类，无法证明时保持 `unknown` 或 `command-failed`。
- 为 Decision Records 与 Investigation Report 的 CLI 最终诊断建立最小公共呈现契约：普通错误至少包含 code、对象、原因和下一步；系统错误按证据补充 cause/detail；只有 mutation-capable 失败由领域事务提供 scope/outcome。
- 审计并迁移诊断矩阵所列的参数/内容、读取与查询、索引/关系、Git 历史、锁、staging、资源、mutation 与恢复失败，优先消除用户可见的裸字符串、误分类和静默降级；矩阵是审计边界，不复制实现清单。
- 调整 index-runtime 对共享 Git 失败的映射，使权限、确认的冲突、普通命令失败与恢复失败保留可行动差异；让 `prepare-record-candidates-before-establishment` 只消费本 Change 已建立的分类和 renderer。

### Resulting Impacts

- 共享错误类型、index-runtime 映射、两套领域结果/renderer 和直接消费者需要按兼容需求同步；公共边界只承诺字段语义与输出行为，不预先规定类层次、函数签名或通用诊断框架。
- 事务 owner 必须在自身已知的提交点和恢复边界设置 mutation `scope/outcome`：`no-change`、`rolled-back`、`partial-or-unknown` 或 `committed-cleanup-pending`；共享层和 CLI 不得推断它们。
- 两套 skill 契约、恢复指南与人类说明需要说明阻断/warning、恢复动作和 mutation outcome；若实现后的稳定跨工具契约达到门槛，再由实现 Change 建立 Decision Record，本 Plan 不预建。
- 定向故障注入、公开类型/生成物与 Test Evidence 需要同步；权限测试使用可注入 adapter/hook，避免依赖 root 或 chmod 行为。

## Success Criteria

- 普通参数、内容、查询、读取、索引、关系、历史、资源和领域校验失败的最终 CLI 输出至少含稳定 code、可定位对象、原因和下一步，且不附加并不存在的 mutation scope/outcome。
- 对 `.git` 或工作区 `EACCES/EPERM` 明确报告当前进程访问被拒和受影响目标；只有锁的 exclusive create 确认 `EEXIST` 或等价已证实冲突才报告 busy。busy 提示先确认活动进程、再检查遗留锁；不自动删锁、不建议 `sudo`。
- Git executable、worktree discovery、HEAD/revision 与普通 Git command failure 至少保留可区分原因或受控 detail；没有稳定机器信号的仓库策略文本按 `command-failed` 或 `unknown` 与净化 detail 呈现，不单列 `repository-policy`；未知错误不作权限、并发或全事务结果的推断。
- 对每个 mutation-capable 工作树、索引或 pending 事务失败，结果仅在 owner 能证明时说明其明确 scope/outcome；恢复不完整不宣称未改动，提交后清理失败不否定已提交主事务。
- Decision 生命周期/history 与两套 destructive discard 在必要 Git 检查失败时 fail closed 并声明 `no-change`；Investigation 非阻断前序检查不可用时发出明确的未完成 warning。
- 诊断矩阵列出的类别均有字段与输出策略，并有适当的单元或 CLI 集成验证；detail 经单行、长度和敏感值边界处理；测试锁定 code/结构字段与必要文本，不依赖整段自然语言或平台 strerror。
- 保持现有成功 stdout、失败 stderr 和退出码语义；不写入持续日志、遥测、远程上报或通用诊断平台。生成物、测试证据与 `bun run check` 一致。

## Affected Owners

- 共享版本控制：`tools/shared/src/version-control/`、`tools/shared/tests/version-control.test.ts`
- 通用索引诊断：`tools/index-runtime/src/`、`tools/index-runtime/tests/`
- 决策领域：`tools/decision-records/src/`、`tools/decision-records/tests/`、`skills/decision-records/`、`docs/skills/decision-records.md`
- 调查领域：`tools/investigation-report/src/`、`tools/investigation-report/tests/`、`skills/investigation-report/`、`docs/skills/investigation-report.md`
- 分发、长期判断与证据：两套 skill 的生成物与版本、`docs/decisions/`、`docs/test-evidence/` 及其派生索引
- Change 内审计边界：[`diagnostics-matrix.md`](diagnostics-matrix.md)
