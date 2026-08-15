# Proposal

本 Plan 将 Decision Records 从“领域目录同时决定分类、身份与定位”改造为“稳定 Decision ID 决定身份、记录级 tags 决定分类、派生索引决定当前定位”的目录无关模型，并以不兼容的手工切换让新契约成为 Decision Records 的唯一当前模型。

## Why

当前 `decision-domains.json`、领域目录和 `<domain-id>/<semantic-slug>.md` 路径共同承担领域定义、唯一归属、记录身份、关系目标、查询入口和选择性暂存边界。分类调整会连带修改文件路径、关系、索引键、CLI 参数与仓库引用；新增领域还必须先修改聚合领域表，才能让首批记录进入合法快照。分类变化因而被放大为身份和存储迁移。

记录级 tags 可以让一条决策同时表达多个分类维度，并让分类维护只改变该记录及其派生索引。为了让 tags 取代领域目录而不形成第二分类源，Decision ID、当前路径和生命周期必须分离：关系与维护命令使用稳定 ID，索引保存当前路径，物理目录只表达当前与归档边界。

Decision Records 还需要落实已经确认但尚未对齐的物理归档方向。若身份继续等同于路径，决策移入归档目录时就会改变标识；稳定 Decision ID 因而同时是标签化和物理归档的前置契约。

## Outcome

每条决策由 basename（含 `.md`）形式的稳定 Decision ID 标识。目录移动不改变 ID；basename 改变才是显式身份迁移。每条权威 Markdown 必须直接保存至少一个 tag。统一派生索引以 Decision ID 为键并保存唯一 `sourcePath`；关系、查询、生命周期事务和选择性暂存均使用 Decision ID。

active 与 candidate 记录直属 `docs/decisions/`，archived 记录直属 `docs/decisions/archive/`。Markdown 中的 `status` 是生命周期权威，物理位置与索引是必须一致的受检投影。默认列表仍只返回 active 记录；重复 `--tag` 使用 AND 语义，目标查询契约不提供 OR 或 NOT。

本 Change 采用不兼容切换。目标 Skill、CLI 和 Schema 只支持新模型；不保留旧路径 ID、`--domain`、双读 Schema、重定向或升级入口。本仓库现有记录和链接通过普通文件编辑与版本控制移动逐项更新，不编写公开或临时的辅助升级脚本。

## Scope

纳入范围：

- Decision ID、非空 tags、`sourcePath`、当前/归档布局和状态—位置一致性契约。
- Decision Records 的 Markdown parser、扫描、索引、查询、关系、生命周期、选择性暂存、恢复与诊断行为。
- 本仓库 274 条现有决策及其关系目标、派生索引、当前维护链接和领域表的手工一次性更新。
- 现行领域长期决策的合法后继、物理归档方向的落实，以及稳定事实 owner、Skill 契约、分发产物与测试证据同步。

不纳入范围：

- Investigation Report、Test Evidence 或其他资源的标签化、文件命名、查询与迁移。
- 统一资源索引、跨资源全局文件名规则、通用 CRUD 或跨资源生命周期。
- 旧 domain 布局、路径 ID、`--domain` 或旧索引 Schema 的运行时兼容。
- 公开或仅供本仓库使用的迁移命令、升级脚本、临时转换脚本、重定向、symlink 或双写适配。
- 把 status、alignment、关系类型、生命周期位置或当前事实编码成普通 tag。
- 预先登记全部合法 tags 的集中注册表、层级、别名、OR/NOT 查询或自动标签推断。

## Success Criteria

- 274 条现有记录在更新前后逐条一一映射；目标 Decision ID 使用各记录现有 basename，除另行批准外不改 basename，标题、摘要、正文、生命周期、对齐、建立时间和关系图语义保持不变。
- 每条 Decision Markdown 至少包含一个合法、唯一且有序的 tag；手工更新时至少把原 domain ID 写为初始 tag，额外 tag 只在记录内容提供依据时增加。
- Decision ID 在整个 Decision Records 集合内唯一，不能同时出现在当前与归档位置；统一索引的 `sourcePath` 能唯一定位全部已建立记录，status、位置与索引相互一致。
- 默认查询只返回 active 决策；重复 `--tag` 只返回同时包含全部指定 tags 的记录；candidate、show、trace、activate、evolve、mark-aligned、archive、discard 和 stage 均围绕 Decision ID 工作。
- 领域表、领域目录身份、路径关系目标、`domains`、`--domain` 和旧索引 metadata 从当前入口与分发产物中删除；当前维护链接已手工更新，形成时资源和归档历史按各自 owner 保留，仓库外旧链接明确不受支持。
- 仓库和分发物中没有兼容 reader、旧格式双写、迁移命令或辅助升级脚本；普通维护命令也不承诺读取或转换旧工作区。
- 归档、重新激活、关系演进和选择性暂存继续满足完整集合预检、原子写入、并发漂移拒绝、失败恢复和索引读回校验。
- Skill 源码、构建适配、分发产物、Schema、项目文档、长期决策、测试实现和测试证据与同一目标契约一致，并通过目标测试与 `bun run check`。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| [`skills/decision-records/`](../../skills/decision-records/) | 更新 agent 行为入口、记录格式、索引 Schema、CLI 说明、生成产物和 skill 版本，只说明新模型。 |
| [`tools/decision-records/`](../../tools/decision-records/) 与相关构建适配 | 实现稳定 ID、非空 tags、定位、物理归档、AND 查询、事务与诊断；不实现兼容或升级入口。 |
| [`docs/decisions/`](../../docs/decisions/) | 手工更新权威 Markdown、关系目标、位置和派生索引；删除领域表，不从索引反向补造来源。 |
| Decision Records 的长期决策 | 用合法后继演进现行领域身份与查询契约；实现完成后核对物理归档方向及新方向的 alignment。 |
| [`docs/navigation.md`](../../docs/navigation.md)、[`AGENTS.md`](../../AGENTS.md) 与直接引用方 | 只同步实际改变的 Decision Records 路径模式、owner 路由和当前维护链接；形成时资源与归档历史遵循各自保存契约。 |
| Decision Records 测试与 [`docs/test-evidence/`](../../docs/test-evidence/) | 证明身份、tags、查询、生命周期、暂存、原子性和恢复边界；只维护受影响测试的证据 case，不改造 Test Evidence 模型。 |
