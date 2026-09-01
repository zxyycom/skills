# Design

本设计以稳定的契约边界组织 Vibe Gate：Check 是可行动的证明单元，profile 是交付层级选择，release terminal 是受依赖保护的发布动作。

## Context

实施开始时，仓库通过 Vibe Check 并行调度 native checks 与 package-script checks。`releaseRequiredPackageScripts` 当时列出 30 个 script，部分工具完整测试被 `fullOnlyGatePackageScriptSet` 按成本放到 full；`pack:skills` 当时在同一终结 Check 中等待全部 release-required checks 后运行 hash/version 与打包。Vibe scheduler 的并发上限和执行顺序始终只是运行时策略，不能承载领域含义。

测试证据 owner 规定 case 对应 runner 可独立报告的最小原生入口，而测试文件、runner、package script 与 CI job 是执行容器。现有证据 topic 已按领域 owner 分区，并已覆盖 decision records、change plan、task graph、investigation report、test evidence、index runtime、relation graph 和 version control 的最小入口。因此 Check 应引用这些容器和入口集合，不替代 case 身份。

Change Plan、Decision Records、Task Graph 与 Investigation Report 分别拥有持久 Change、长期判断、当前协调事实和形成时调查；本 Change 只规划 Vibe Gate 交付，不将缓存策略 Change 的设计并入本计划。

## Goals / Non-Goals

目标：

1. 让每个 Check 的名称、稳定 ID、证明对象、测试范围和失败 owner 可由单一 catalog 恢复。
2. 让真实不同的领域模型、查询投影、生命周期事务、Git pending-stage、CLI/协议、分发制品和共享基础能力分开报告。
3. 让 Check 语义不由 profile 或运行时间定义，同时保持 default 日常反馈与 full 完整发布覆盖的既有选择关系。
4. 保持最小原生测试入口与 test-evidence case 的一对一关系，并用最小必要的容器调整实现 Check 可选。

非目标：

1. 不以缩短 wall-clock、填满四个 worker、固定每组文件数或平均测试时间为目标。
2. 不把每个测试文件或每个 `test()` 都变成 Check；同一完整契约的测试文件保持同组。
3. 不改变各领域产品契约、测试 case 粒度、缓存策略或发布资产格式，除非为 catalog/入口实现所必需。
4. 不在本 Change 实施缓存 Vibe Gate 结果；与 `cache-vibe-gate-script-results` 的衔接只在实施时作为独立后续 Change 处理。

## Decisions

### Intended Change

建立由 `scripts/lib/vibe-gate.ts` 拥有的语义 Check catalog。每条运行时定义只包含形成 Check 所需的稳定 ID、显示名、固定 executable/arguments 和 profile；证明陈述与失败 owner 由稳定 ID、所选测试文件和 `docs/tooling.md` 共同说明，不在代码中复制说明性元数据。package scripts 仍可作为可直接调用的维护入口，但不再是 catalog 的语义模型；Vibe definition 从 catalog 派生普通 Checks 与 release prerequisites，测试断言 catalog 的完整性、唯一性与展开结果。

领域 catalog 采用下列层级，实施时以当前源码与测试证据再次核对具体文件：

| owner | Check 类别 | 证明边界 |
| --- | --- | --- |
| decision records | record-and-graph、query-and-index-projection、lifecycle-and-recovery、pending-stage、public-distribution | 分别证明记录/关系有效性、持久投影读取、生命周期事务恢复、按 ID 的 Git pending 投影、CLI 与生成制品。 |
| change plan | artifact-and-active-plan-gates、lifecycle-archive、public-distribution | 分别证明 artifact/目录/距离门禁、plan/archive 写入、CLI 与可分发运行时。 |
| task graph | index-and-projection、task-lifecycle、runtime-and-store、native-store、CLI-rendering、pending-stage、public-distribution | 分别证明 schema/投影、状态收敛、Bun runtime/store、Node 原生 store、输出协议、Git 暂存和分发树。 |
| investigation report | collection-and-resources、index-and-query、transactional-maintenance、pending-stage、CLI-contract | 分别证明报告/资源/关系、索引查询、关系与 discard 事务、按报告 ID 暂存和 CLI。 |
| test evidence | catalog-contract、ledger-source-and-relations、ledger-index-and-query、ledger-CLI、pending-stage | 分别证明现行 catalog、ledger 来源关系、索引查询、协议和按 case ID 暂存。 |
| shared owners | index-runtime、relation-graph、version-control、repository tooling | 分别证明派生索引、关系语义、Git/Pending 操作和项目级门禁；保持独立 Check，领域源码消费关系不转换为 Gate `dependsOn`。 |

同一 Check 内的测试文件必须共同回答该表中的同一证明陈述。例如 Decision Records 的 `stage.test.ts` 独占 pending-stage，因为其失败直接归 `decision-stage-service`；生命周期测试不因同属 CLI 工具而合并。Decision Records CLI 参数测试和 generated-artifacts 测试同属 public-distribution，因为二者共同面向调用者公开表面。Task Graph 的 native store 继续作为 node-native 环境 Check，而不与纯 TypeScript schema/renderer 合并。

为实现独立运行，拆解现有聚合容器但不改变原生 case：Change Plan、Decision Records、Task Graph、Investigation Report 的 `run.ts` 仅导入测试文件，可由新的语义 runner 或 package script 选择文件；Task Graph 的 native-store 继续使用 `node --test`。Test Evidence 的 `run.ts` 同时声明 catalog cases 并导入全部 ledger tests，实施必须先把自身 catalog cases 迁入专用文件或专用 runner，再建立总 runner，保证 catalog Check 不隐式执行 ledger Check。

profile 不定义 Check 责任：语义拆分前由 default 执行的测试入口仍投影到 default，原 full-only 入口仍只由 full 追加；full 继续包含 default 和全部 release-required 普通 Check。生成物与公开分发测试沿用其原聚合测试的 profile，本 Change 不以耗时或新的抽象分类改变覆盖集合。`release:skill-version` 直接依赖全部 full 普通 Check；`pack:skills` 只依赖该版本 Check，并在其可信 passed 后调用一次 packaging。

machine publication 以 catalog Check ID 作为稳定记录键；显示名、Vibe 调度顺序、`scheduler.maxParallel`、缓存命中或未命中均不改变 ID、依赖或证明陈述。发布结果要能回链到 catalog 和底层 package script/runner，诊断仍引导直接命令。

性能只作防退化验证：记录 catalog 展开后的唯一入口集、每个入口被选择次数与依赖图；验证无真实共享理由的重复执行不存在。可采集耗时用于观察，但不能成为组边界、profile 选择、成功标准或调度依赖。

### Resulting Impacts

1. 新 catalog 会替换 `releaseRequiredPackageScripts` 与 `fullOnlyGatePackageScriptSet` 作为领域分组真相；package script 列表、项目配置 validator、Vibe tests、CLI usage 与 CI 必须引用同一投影或校验其一致性。
2. 仓库内不存在普通 Gate 结果之外的旧聚合 Check ID 消费者；新语义 Check 使用新 ID，旧 `script:test:<tool>` ID 从 Gate publication 有意退出，但对应 package script 保留为人工聚合入口。该身份演进进入 Gate Decision Record，不增加无执行意义的兼容空 Check。
3. `pack:skills` 的 `dependsOn` 必须改为新 catalog 的 release prerequisite projection；version/hash 成功与 asset packaging 仍是两个可定位步骤，失败消息说明未开始的原因。
4. 测试 runner 变化会影响 test-evidence 的 `Entry:` 命令。保留或新增的最小原生入口逐一更新 case，并同步派生索引；不得将 catalog 或 package script 注册成 case。
5. `docs/tooling.md` 应说明人类维护入口、default/full 语义、直接重跑故障 Check 的命令与 release 链；领域 `SKILL.md`/references 仅在其自身 CLI、分发或测试入口契约实际改变时更新。跨 Change 可持续的 catalog/profile/identity 取舍达到门槛时建立或演进 Decision Record。
6. 缓存 Change 可在后续把 catalog ID 作为缓存边界的输入，但本 Change 不引入缓存读写、缓存命中解释或缓存失效策略。

## Risks / Trade-offs

- 过细的 catalog 会把测试文件变成 Check，造成维护面与 machine publication 噪声；以“单一证明陈述和直接 owner”审查每项，无法说明独立失败处置时合并回同一契约。
- 过粗的领域 Check 会让公共 CLI、交易恢复、pending-stage 和 bundle drift 互相遮蔽；表中这些边界因调用者、失败恢复或副作用不同而保留分离。
- 新 stable IDs 可能影响现有机器消费者；实施前需搜索 publication/CI/cache 读取点、选择迁移策略并以兼容测试证明。
- runner 重组可能遗漏或重复入口；以 test-evidence case 查询、runner discovery 与“每个原生入口恰好一次”的验证交叉确认。
- 某些原生/系统依赖失败与领域失败不同；Task Graph native runtime、shared version-control 和外部指标工具必须报告 unavailable/owner 边界，不能被重标为领域行为失败。
- 拆分增加进程启动和 publication 项目数量；保持原 profile 覆盖并核对入口恰好一次，以性能观测发现意外重复，但不能用耗时重新划分语义组。

## Open Questions

无。仓库搜索未发现普通 Gate publication 之外的旧聚合 Check ID 消费者；新 ID 作为有意 machine identity 演进处理。分发测试保持原 profile 覆盖。catalog 由 `scripts/lib/vibe-gate.ts` 的 TypeScript 常量唯一承接，不生成独立 JSON 或第二份运行时列表。

## Implementation Observations

- 最终 catalog 将五个领域的 58 个原聚合测试文件投影为 `3/5/5/7/5`，共 25 个语义 Check；其中 16 个多文件 Check 使用窄 runner。独立期望测试同时解析窄 runner 与五个保留聚合 runner，证明每个底层文件恰好出现一次。Test Evidence 的 38 个 catalog case 从聚合 `run.ts` 移到 `catalog.test.ts`，其余 case 身份未改变。
- 窄 runner 与 Check 准入顺序只处理启动开销和调度尾部；测量用于确认没有无理由的重复执行或性能退化，不构成 catalog 分组、profile、Check ID 或依赖的依据，也不形成未来执行时间基线。
- 缓存仍只属于独立的 `cache-vibe-gate-script-results` Change。本 Change 未启用缓存读写，也未定义缓存命中、失效或结果解释。
