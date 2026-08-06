# Decision Records

`decision-records` 帮助 agent 在长期判断形成或出现冲突时恢复当前决定、区分当前基线与未来方向、判断当前任务如何使用相关方向，并维护能够继续使用和回放的决策记录。受控领域与稳定路径表达责任归属，自包含 Markdown 保存完整判断，持久 JSON 索引提供常规查询快照。

它关注“项目已经决定往哪里走、方向是当前基线还是未来输入，以及后续选择应如何受其影响”。通用知识、任务日志、细粒度进度、实施授权和当前实现事实继续由各自 owner 承接。

## 核心内容

1. Skill 入口面向 agent，承接决策恢复、相关性判断、候选门槛、动作选择和交付验收。
2. 领域契约承接决策内容、稳定身份、生命周期、关系、版本快照和维护不变量，不复述索引运行时或完整 CLI 协议。
3. `decision-domains.json` 与决策 Markdown 是权威来源；持久索引提供可重建、面向千级集合的常规查询快照。
4. `status: candidate` 表示 Markdown 已经拥有完整结构和可审核内容，但尚未建立；写入候选不表示方向已经获准。它通过源码查询发现、由严格检查计数，并始终排除在正式索引外。审核通过时，`activate` 才选择对齐状态并写入建立时间；不再需要时可以直接删除工作区文件，是否已经提交不改变可删除性，也不会改写 Git 历史。
5. `active + unaligned` 表示已经确认但尚未成为当前事实的未来方向，相关工作把它作为选择输入，但它不保证将来一定实施，也不会自动创建任务或授权；`active + aligned` 表示完整方向已经成为当前事实并核对为必须遵守的基线。对齐始终作用于完整决策，不使用部分对齐状态。
6. 编辑性修正保留原记录；决策语义变化时创建能够独立使用的新记录，并通过单次 CLI 事务归档直接前序、保存关系和建立新记录。
7. 过粗决策中的子判断能够分别演进或对齐时，使用 `split` 在一次事务中归档一个前序并建立至少两个自包含后继；每条后继以 `拆分` 指向前序并独立保存 `aligned` 或 `unaligned`，完整后继集合不能静默遗失前序含义。
8. Git `HEAD` 不决定决策生命周期，但会在归档未提交记录前触发无写入预警；调用者可以显式保留历史，或由 `evolve` 折叠一个简单中间前序并声明完整最终关系集合。
9. `activate` 与 `evolve` 是单后继的并行 agent 入口，可以共享同一演进事务；后者额外支持折叠未记录中间前序。`split` 独立承接闭合的一对多演进。
10. 独立的 `stage` 命令从已提交 `revision` 基线叠加显式选择的 `filesystem` 决策，并用同一目标来源重建完整 `pending` 索引；它不修改磁盘决策文件，也不执行生命周期动作。

## 审核候选

普通 `list`、`show` 和 `trace` 继续只读取正式索引。需要查看尚未建立的完整候选时，使用源码入口：

```text
node scripts/decision-records.mjs candidates --root <workspace-root>
node scripts/decision-records.mjs show-candidate <decision-path> --root <workspace-root>
```

候选源码查询按文件容错：单条非法 Markdown 会被跳过并产生 warning，其他合法候选仍可查看；显式查看该非法目标时失败。决策根、根目录成员、领域目录表或领域目录布局存在集合级错误时不返回部分结果。这个容错只服务于发现和审核，不会放宽严格 `check`：合法候选可以等待后续审核并被计数，但结构不完整、状态组合错误或与正式成员冲突的文件仍然阻断检查。半成品内容应保留在 change 或其他草稿 owner 中，而不是放宽候选结构。

## 选择决策进入 pending

`revision` 表示当前已提交基线，`filesystem` 表示磁盘上的当前决策集合，`pending` 表示准备进入下一版本的快照。需要从并行磁盘变化中只选择一组决策时，从 skill 目录运行：

```text
node scripts/decision-records.mjs stage <decision-path...> --root <workspace-root>
```

每个路径都相对决策根目录，并且必须显式给出；重命名同时给出旧路径和新路径。已有集合使用 `revision` 的领域目录表，首次集合才使用 `filesystem` 中的完整领域目录表。最后一次成功调用会替换整个 `pending` 决策范围，同时保留范围外既有 `pending` 内容和全部 `filesystem` 状态；未选择的决策范围内变化不会与本次选择合并。

选择集、候选、领域或关系无效时先修正输入。版本管理不可用，或构造期间 `revision` 或受控 `pending` 已变化时，命令不接受部分结果；重新读取当前状态后重试。当前分发实现需要可用的 Git 工作区，但 CLI 只暴露项目级快照、路径与失败语义。生命周期命令仍直接操作磁盘决策文件，没有 `pending` 分支，也不提供 `--stage`。

## 内容入口

- [`SKILL.md`](../../skills/decision-records/SKILL.md) 是 agent 的行为入口。
- [`decision-record-rules.md`](../../skills/decision-records/references/decision-record-rules.md) 是 agent 写入前读取的决策领域契约。
- [`maintenance-recovery.md`](../../skills/decision-records/references/maintenance-recovery.md) 只处理工具、索引和中断写入的故障恢复。
- [`decision-index.schema.json`](../../skills/decision-records/references/decision-index.schema.json) 是索引精确机器结构的 owner。
- 随包 CLI 的 `--help` 提供当前命令参数；实现和校验承接精确输出、退出状态和索引操作。
