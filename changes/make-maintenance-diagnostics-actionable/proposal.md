# Proposal

本 Change 为共享版本控制边界和两套记录维护 CLI 建立可分类原因、可定位操作、可追踪 mutation scope/outcome 且能指导下一步的错误诊断契约。

## Why

当前 Decision Records、Investigation Report、index-runtime 和共享 Git adapter 的失败路径混用原始异常字符串、宽泛 `operation-failed` 和领域自写前缀。部分 Git 调用在捕获时丢弃 cause，pending 写入会把权限失败压成普通 replacement failure；两套集合 mutation lock 又把任何取锁失败都解释为并发事务。用户因此无法可靠判断是权限不足、Git index 正忙、仓库不可用、来源漂移还是恢复失败。

错误结果还不总是说明有没有写入、是否完整回滚或是否已经跨过提交点。调查关系的未记录前序检查甚至会吞掉全部 Git 异常，使“没有产生 warning”无法证明历史检查已经完成。新增候选预演和选择性发布前，需要先让这些边界能够传递真实、可行动且不泄露敏感值的诊断。

## Outcome

- 共享版本控制错误保留稳定 operation event、cause category、目标和受控 detail，不再在底层无条件丢弃 cause，也不越权推断整个上层事务结果。
- 权限不足、真实锁/并发冲突、Git 工具或仓库不可用、revision 问题、普通命令失败、pending 恢复失败拥有可区分的用户结果；无法可靠分类时明确保持 unknown，而不是给出错误建议。
- Decision Records 与 Investigation Report 的全部用户可见失败都说明失败对象、原因、由事务 owner 确认的 mutation scope/outcome 和下一步动作；相同底层错误不再被多层重复包装。
- Git 历史检查失败不会伪装成“目标未记录”或“无需警告”：阻断式维护 fail closed，非阻断式调查关系检查明确报告未完成的 warning。
- 诊断使用稳定 code 和结构字段供测试与上层映射，测试不依赖整段自然语言。

## Scope

### Intended Change

- 扩展共享 `VersionControlError` 与错误 detail 边界，用独立的 operation event 与 cause category 表达 access denied、busy/conflict、tool/repository unavailable、revision unavailable、command failure 和 pending recovery；保留受控 fallback。
- 为用户可见操作采用统一诊断组成：稳定 code、operation、target、cause category/detail、由事务 owner 设置的 mutation scope/outcome 和 recovery steps，并提供一致的文本 renderer。
- 审计 Decision Records 与 Investigation Report 的参数、集合读取、索引、Git 历史、staging、mutation lock、关系事务、discard、资源和恢复失败，修复丢失对象、错误原因、写入结果或下一步的提示。
- 让 index-runtime staging 保留共享 Git 诊断的可操作差异，不把权限、冲突和恢复失败再次压成同一个 `pending-write-failed`。

### Resulting Impacts

- 共享版本控制 API、index-runtime diagnostic code/state、两套领域结果映射和生成分发物可能发生类型调整；全部直接消费者必须盘点并保持编译与行为一致。
- 事务实现需要在实际状态转换点为明确 scope 产生 `no-change`、`rolled-back`、`partial-or-unknown` 或 `committed-cleanup-pending`，不能由底层 Git error 或 CLI 根据错误文案猜测整个命令结果。
- 两套 skill 契约、恢复指南和人类说明需要固定严重性与操作建议；长期错误/恢复方向达到 Decision 门槛时建立对应记录。
- 权限、锁、Git stderr、回滚和清理测试需要使用可注入 adapter/hook，避免依赖以 root 运行时不可靠的 chmod 模拟；新增或修改测试同步 Test Evidence。
- `prepare-record-candidates-before-establishment` 的新命令必须复用本 Change 的分类与 renderer，不建立平行错误协议。

## Success Criteria

- 对 `.git` 或工作区的 `EACCES/EPERM` 明确报告当前进程访问被拒、受影响目标，以及由事务 owner 确认的 mutation scope/outcome；在获得相应读/写权限后重试同一命令，不建议 `sudo`，也不误称为并发事务。
- 只有可确认的 `EEXIST`/pending conflict 才报告 busy 或 concurrent change；消息区分正在运行的 Git 操作与可能的遗留锁，并要求先确认没有活动进程。
- Git executable、worktree discovery、safe-directory/仓库策略、HEAD/revision 损坏与普通 Git command stderr 至少保留可区分类别或受控原始 detail；未知错误不被过度推断。
- Decision lifecycle/history 与 destructive discard 在无法完成必要 Git 检查时 fail closed 且声明零写入；Investigation 的非阻断前序历史提示在检查不可用时输出“未完成” warning，而不是静默返回空结果。
- 每个工作树/index/pending 事务失败都能从结果判断作用范围，以及该范围未写入、已回滚、可能部分更新或主事务已提交但清理待处理；恢复不完整不会声称原范围已保留。
- 两套 CLI 的用户可见失败完成清单式审计，不再使用缺少对象和 recovery 的裸 `unavailable`、`could not be inspected` 或多层 `failed: operation failed` 作为最终提示。
- 错误 detail 经过长度、换行和敏感值边界处理；稳定 operation event、cause category、scope/outcome 和 recovery 分支有定向测试，生成物、测试证据及 `bun run check` 一致。

## Affected Owners

- 共享版本控制：`tools/shared/src/version-control/`、`tools/shared/tests/version-control.test.ts`
- 通用索引诊断：`tools/index-runtime/src/`、`tools/index-runtime/tests/`
- 决策领域：`tools/decision-records/src/`、`tools/decision-records/tests/`、`skills/decision-records/`、`docs/skills/decision-records.md`
- 调查领域：`tools/investigation-report/src/`、`tools/investigation-report/tests/`、`skills/investigation-report/`、`docs/skills/investigation-report.md`
- 长期决策、生成和证据：`docs/decisions/`、两套 skill 生成物与版本、`docs/test-evidence/` 及其派生索引
