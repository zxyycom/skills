# Decision Records

`decision-records` 用于恢复、形成和演进会长期影响后续选择的判断。它保存采用方向、理由、生命周期与演进关系，让后续工作能够区分当前基线、已确认的未来方向与历史判断；它不保存任务进度、执行日志或当前实现快照。

本页是面向人类的定位与理解入口，不是 agent 执行入口或精确格式契约。实际流程、写入规则和 CLI 以文末链接的 owner 为准。

## 何时使用

当一项判断会持续影响行为、owner、边界、兼容性、风险处理或验收，且缺少记录将使后续维护难以恢复取舍理由时，使用 Decision Records。普通事实、一次性任务、进度和执行结果不属于它的记录对象。

最小模型如下：

1. `candidate` 是内容完整、等待审核的候选判断，尚未进入正式集合。
2. `active + aligned` 是已核对并成为当前事实的基线。
3. `active + unaligned` 是已确认但尚未成为当前事实的未来方向。这是正常状态，不表示失败、待办或实施授权；只有当前任务明确纳入相应交付时才实施。
4. `archived` 退出当前依据，但保留最后对齐状态和演进历史。
5. 持久索引只是从已建立 Markdown 重建的查询辅助；它不定义或替代决策事实，候选也不进入其中。

## 怎样发展与保留历史

已建立记录的判断语义发生变化时，创建新的自包含记录，并让后继指向真实的直接前序；不要在原记录上改写历史。编辑性文字修正仍可直接修改原记录。相同 tags、时间相邻或普通引用都不自动形成演进关系。

生命周期、对齐和演进关系分别表达不同事实。维护时直接使用领域 CLI；若工具提示相关历史尚未进入 Git `HEAD`，说明本次操作已零写入暂停，只需转达提示并等待明确确认，不必在运行前自行检查 Git 边界。该提示不改变决策语义，也不替代原有维护授权。

`discard` 统一删除完整且无剩余引用的 candidate、active 或 archived 决策；`evolve --discard <decision-id>` 将同一删除动作放入关系事务。删除对象已经进入 Git `HEAD` 时，首次调用零写入暂停，并要求在重试中加入 `--delete-recorded-decision`；该参数是明确的机械删除选择，不要求事前自行检查 Git。适用条件和影响由固定规则与 CLI 唯一承接。

## 运行时诊断与恢复

CLI 成功信息写入 stdout；失败、暂停和 warning 在 stderr 即时给出。诊断会指出 code、对象、
原因和下一步；只有有可靠系统证据时才补充原因类别和经过净化的 detail。它不保存运行日志、
遥测或 receipt，也不把临时输出写入决策集合。

仅 mutation 失败会说明受影响范围和结果：未改变、已完整回滚、恢复状态未知，或已提交但
cleanup 待处理。范围未知或恢复不完整时先停止并对账；权限不足只授权当前进程，busy 时先
等待或确认活动进程。工具不会建议 `sudo`、自动删除锁或自动重试。精确字段和恢复步骤以
[决策记录规则](../../skills/decision-records/references/decision-record-rules.md)及其[维护恢复](../../skills/decision-records/references/maintenance-recovery.md)为准。

## 入口

agent 的触发、读取路径、动作选择与验收由 [Skill 入口](../../skills/decision-records/SKILL.md) 承接。写入、生命周期、关系、对齐、历史确认和索引维护的语义规则由 [决策记录规则](../../skills/decision-records/references/decision-record-rules.md) 承接；CLI 的当前参数与输出通过 `bun run decision-records -- --help` 查询，索引或写入异常按 [维护恢复](../../skills/decision-records/references/maintenance-recovery.md) 处理。
