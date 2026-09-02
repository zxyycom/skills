# Proposal

本 Change 让 Decision Records 可以先由 CLI 建立元数据完整、正文待补的候选脚手架，并在不继承确认或写入正式集合的前提下重复预检最终建立条件。

## Why

当前 `decision-records` 只接受正文和摘要完整一致的 reviewable candidate。维护者必须先手写完整 frontmatter 与正文，之后才能通过现有候选查询和 `activate/evolve` 得到关系、索引与 Git 历史反馈；机械输入错误和最终事务阻断暴露较晚。

脚手架创建、正文机械 readiness、语义审核、事务预检和正式建立是不同结果。CLI 应尽早提供可由显式 metadata 和当前集合确定的反馈，但不能填造正文、保存 receipt、替代语义审核，或让创建时的参数成为稍后建立的确认。

## Outcome

- `decision-records new` 根据显式 Decision ID、摘要、tags 和直接关系参数，以不覆盖且原子可见的方式写入规范 candidate scaffold；正文固定章节允许暂时为空。
- `new` 的退出状态只表达输入与 scaffold 创建结果。创建成功后，即使正文尚未 ready、可选预检需要 attention 或预检不可用，命令仍成功并分别报告 `creation`、`body readiness` 与 `preflight`。
- `new` 可选接收只服务当次预览的 alignment；未提供时明确报告 alignment 尚未选择，不把它写入 candidate，也不伪造完整索引投影。
- 候选查询和严格检查区分合法 scaffold 与 mechanically body-ready candidate；两者都排除于正式索引和正式关系图，CLI readiness 不代表正文语义已审核或已经取得建立授权。
- `activate` 与 `evolve` 增加使用同一最终参数和准备服务的显式只读 preflight 模式。它可以重复运行并以门禁退出状态报告当前建立条件，但不写文件、不保存确认，真实命令仍重新读取并执行全部门禁。
- 只有非 preflight 的 `activate/evolve` 才能建立候选；它们继续要求本次显式 alignment、关系覆盖、Git 历史确认和当前维护授权。

## Scope

### Intended Change

- 增加 `new` 的参数解析、规范 scaffold writer、集合锁内身份复核和原子不覆盖发布，并使用当前诊断 renderer 分开展示创建、正文 readiness 和辅助预检。
- 扩展候选扫描与验证模型，使结构合法但正文未完成的 candidate scaffold 可以被发现、展示、继续编辑和 `discard`；最终生命周期入口只接受 mechanically body-ready candidate。
- 为 `activate/evolve` 增加只读 preflight 模式，复用真实关系、最终图、索引和 Git 历史准备逻辑；preflight 参数、attention 或确认不传递到后续命令。
- 保持语义审核、alignment 判断、正式建立授权、Git pending 与提交行为在现有 owner 中，不为预检增加持久状态。

### Resulting Impacts

- 现行“candidate 必须完整可审核”的长期判断需要 successor Decision，将 candidate lifecycle 的结构合法 scaffold 与正文审核边界分开，同时保持正式集合边界不变。
- `candidates`、`show-candidate`、严格 `check`、扫描计数、公开结果类型和恢复说明需要用 `scaffoldValid`、`bodyReady` 等机械事实替代会暗示语义完成的状态名。
- `new` 的写入失败需要消费当前 Decision Records mutation diagnostics；创建成功后的 readiness/preflight 诊断不是 mutation 失败，不附会 `scope/outcome`，也不得诱导调用方重跑 `new`。
- 两套 preflight 与最终命令必须共享准备逻辑但保持读取和授权独立；任一时刻的预检结果都不能成为 receipt、revision token 或确认凭据。
- Skill 行为、固定契约、人类说明、维护源码、公开声明、生成 CLI/Schema、版本、测试和 Test Evidence 需要同步。

## Success Criteria

- `new` 从规范且不重复的显式参数生成字段顺序稳定的 candidate scaffold；非法参数、身份冲突、符号链接、锁失败或原子发布失败不产生目标文件，也不覆盖既有 candidate、active 或 archived 身份。
- Scaffold 创建成功时命令退出 `0`，stdout 明确报告创建路径；正文不完整、alignment 未提供或辅助预检 attention/unavailable 分别显示且不把整体命令伪装为创建失败，恢复文本明确后续应编辑、查询或运行 preflight，而不是重跑 `new`。
- 合法 scaffold 可以被发现、展示、编辑和显式 `discard`，不会进入正式索引、正式关系图或被 `activate/evolve` 正式模式建立；补全正文后同一 Decision ID 成为 mechanically body-ready。
- CLI readiness 只证明固定章节、非空正文、至少一个 `采用` 和其他机器可验证条件；skill 仍要求在真实建立前完成语义审核和授权判断。
- `activate/evolve` 的只读 preflight 能覆盖当前关系目标、最终图、索引投影和 Git 历史门禁，成功与 attention/error 都零写入；真实建立不读取 preflight 状态并要求重新提供全部本次参数。
- 创建与生命周期/同步/丢弃并发时不会暴露半写 scaffold、吸收无关工作或覆盖竞争者；失败诊断符合当前共享原因、领域范围和 mutation outcome 契约。
- 对应 successor Decision 在行为落地并验证后建立；生成物、skill 版本和一入口一 case 的测试证据同步，定向测试及 `bun run check` 通过。

## Affected Owners

- 决策行为与规则：`skills/decision-records/SKILL.md`、`skills/decision-records/references/decision-record-rules.md`、`skills/decision-records/references/maintenance-recovery.md`、`docs/skills/decision-records.md`
- 领域实现与公开类型：`tools/decision-records/`
- 生成与分发：`scripts/build/decision-records.ts`、`skills/decision-records/scripts/`、`skills/decision-records/references/decision-index.schema.json`
- 长期判断与索引：`docs/decisions/`、`docs/decisions/decision-index.json`
- 验证证据：`tools/decision-records/tests/`、`docs/test-evidence/decision-records/`、`docs/test-evidence/test-evidence-index.json`
