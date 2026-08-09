### Case DECISION-UNRECORDED-COLLAPSE-REFERENCE-001: Evolve 折叠拒绝仍被其他候选引用的前序
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapse rejects a predecessor referenced by another candidate`
- `bun test --test-name-pattern="^evolve collapse rejects a predecessor referenced by another candidate$" ./tools/decision-records/tests/run.ts`
Contract:
- 被其他决策记录或候选引用的中间前序不能自动折叠，调用者必须先明确处理引用关系。
Proves:
- `evolve` 发现另一个候选仍引用折叠目标时，返回明确的不可折叠诊断、引用路径和退出码 1。
- 命令失败不会修改后继候选、引用候选、中间记录或派生索引。
