### Case DECISION-CANDIDATE-DISCARD-GATES-001: Discard 拒绝已建立、不完整、无效或仍被引用的候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard rejects established, incomplete, invalid, or referenced candidates without mutation`
- `bun test --test-name-pattern="^discard rejects established, incomplete, invalid, or referenced candidates without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- Discard 只能删除显式、完整且关系结构合法的未建立候选；目标仍被其他候选引用时必须拒绝。候选指向活动已建立目标本身是合法前瞻关系，不阻止丢弃关系来源候选。
Proves:
- 已建立记录、非法生命周期组合、缺少必需正文和指向无效扫描目标的候选均被拒绝，拒绝路径保留文件与索引。
- 指向活动已建立目标的合法候选可以删除，正式索引保持不变。
- 被另一个候选引用的候选目标不能删除；删除引用来源后，目标正文保持可继续处理。
