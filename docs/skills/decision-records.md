# Decision Records

`decision-records` 用于恢复、形成和演进会长期影响后续选择的判断。它保存采用方向、理由、生命周期与演进关系，让后续工作能够区分当前基线、已确认的未来方向与历史判断；它不保存任务进度、执行日志或当前实现快照。

## 何时使用

当一项判断会持续影响行为、owner、边界、兼容性、风险处理或验收，且缺少记录将使后续维护难以恢复取舍理由时，使用 Decision Records。普通事实、一次性任务、进度和执行结果不属于它的记录对象。

最小模型如下：

1. `candidate` 是内容完整、等待审核的候选判断，尚未进入正式集合。
2. `active + aligned` 是已核对并成为当前事实的基线。
3. `active + unaligned` 是已确认但尚未成为当前事实的未来方向。这是正常状态，不表示失败、待办或实施授权；只有当前任务明确纳入相应交付时才实施。
4. `archived` 退出当前依据，但保留最后对齐状态和演进历史。
5. 持久索引只是从已建立 Markdown 重建的查询辅助；它不定义或替代决策事实，候选也不进入其中。

## 入口

agent 的触发、读取路径、动作选择与验收由 [Skill 入口](../../skills/decision-records/SKILL.md) 承接。写入、生命周期、关系、对齐和索引维护的语义规则由 [决策记录规则](../../skills/decision-records/references/decision-record-rules.md) 承接；CLI 的当前参数与输出通过 `bun run decision-records -- --help` 查询，索引或写入异常按 [维护恢复](../../skills/decision-records/references/maintenance-recovery.md) 处理。
