# Tasks

先恢复 owner 与公共合同，再实施、审查和验收；本轮重新审核文档与代码后，按最新授权提交保存，再精确结项删除当前计划。

## Readiness

- [x] 0.1 检查基线、范围、仓库模型、导航及行为／调查 owner，确认没有重复 Change。
- [x] 0.2 明确源码、生成产物、行为文档、Case/index 与决策索引写入所有权及用户授权边界。
- [x] 0.3 冻结封闭 adapter、图片／长上下文参数、normalized、日志 schema 与统计公共合同。

## Implementation

- [x] 1.1 实现四 adapter 的配置隔离、JEV 载体严格验证、OAI 编译与原生响应／normalized。
- [x] 1.2 接入 PNG/JPEG、JEV Box、长上下文与发送前门禁，维持一次发送及无隐式读取／重试。
- [x] 1.3 实现新日志 schema、显式迁移 SQL、合同分层统计与统一 elapsed。
- [x] 1.4 同步行为／CLI／日志／统计／迁移文档、自包含参考、人类入口、长期决策及 skill 版本。
- [x] 1.5 实现代表性离线／mock 回归并维护最小原生测试 Case/index，构建分发产物。

## Verification

- [x] 2.1 在集成 milestone 完成仅正确性阶段审查，修复阻断问题。
- [x] 2.2 验证配置／编译／模态／响应／日志／迁移／统计和旧配置回归，记录实际执行证据。
- [x] 2.3 在授权及可用条件内完成必要 OpenRouter 文本／图片／Box／长上下文真调用，区分未覆盖通道与质量边界。
- [x] 2.4.1 末期由独立代理按 ai-ready-docs 优化文档，以代表性读取任务核对选路、模态、拒答、恢复与统计；不改变已冻结合同。
- [x] 2.4.2 末期由独立代理按编码规范优化代码；不改变已冻结合同，改义重新审查。
- [x] 2.5 检查 skill 链接／结构、Change 与决策契约、生成产物和包内可移植性，由根统一运行全仓检查。
- [x] 2.6 完成前轮 Outcome 与成功标准验收，报告已验证／未验证；当时按授权边界保留未提交计划。
- [x] 2.7 按最新请求重新进行独立 AI-ready 文档审核，复核实际读取任务与机械检查，修正当前授权事实。
- [x] 2.8 按编码规范重新全局审改本轮代码，完成对应回归、生成产物与最终全仓检查。
- [x] 2.9 完成提交前改动整理与最终验收，核对成功标准、当前验证、owner 交接及完整 Plan 保存后精确结项的路径。

## Evidence

### 前轮实施与验收

真实调用由[独立取证报告](../../docs/investigations/openrouter-decision-live-protocols.md)承接：8 次直接 HTTP 探查与 3 次新版公开 CLI 调用分开记录，合计 11 次真实请求、10 个 200 与 1 个既有 403。公开 CLI 补证覆盖 JEV 图片／局部图片／Box、40,358 input tokens 的首尾标记、raw／normalized、私有临时日志与 stats。只证明所列合同接收与贯通；Box 精度、262k 容量、原生 TypeSafe／OpenAI 在线成功、OR OpenAI 成功与拒答形状、真实历史库迁移均未证。

末期文档验收以随包 `SKILL.md` 和它指向的 reference 为实际文本，未用仓库外调查补足运行步骤。以下为 AI 读取走查，不是新增服务调用或模型效果测试：

| 读取任务 | 最小路径 | 从文档恢复的操作与边界 |
| --- | --- | --- |
| 已点名 skill，选择直接 OpenAI 或 OR OpenAI | 入口 → 接入合同“选择合同／文本与结构化输入” → CLI“配置” | adapter 由可信配置指定，新合同显式提供 endpoint/model/凭据；直接 OAI 自动生成 input/questions，OR 指定 OpenAI 仍为 state/questions，不按 hostname 或模型家族猜 wire |
| 提交局部图片与 Box | 入口 → 接入合同“图片节点／JEV Box／长上下文” | 直接 OAI 和 OR OpenAI 的局部图／Box 整次拒绝，不提升作用域；JEV 选择支持 Box 的 1.14，开启 images、实际含图；OR JEV 图片还须 longContext=true，像素与预览均按正文授权 |
| 消费混合拒答 | 入口 → 接入合同“原答、统一结果与采用” → CLI“技术失败” | 直接 OAI 合法混合可退出 0、ok=true，先看 completion 和逐题 status，refused 无数值；OR map refusal 当前为 invalid_response，不能继承原生数组合同 |
| 保存转换载体并恢复旧日志 | 入口 → 调用日志“当前格式／恢复” → 迁移目录按版本选读 | schema v3；saveRequest 同时控制实际 wire 与必要 carrier，响应存原始字节而非 normalized；未知历史不猜合同，迁移仅显式副本操作；缺原题／离线校验手段时停在已取回未验证，不能正式重发冒充恢复 |
| 比较历史调用 | 入口 → 离线调用统计 | stats 不发请求、不取密钥、不读正文；按 adapterContract/endpoint/实际型号分层，未知合同为 null；succeeded 不等于全答或正确，缺 usage 不作零，费用按 endpoint 隔离，不输出准确率或拒答数 |

文档优化阶段实际机械验证：`bun run validate-skill -- skills/lightweight-judgment`（9 个 Markdown）、`bun run change-plan -- check changes/enable-lightweight-judgment-multi-protocol`、`bun run decision-records -- check`（382 条）、`bun run investigation-report -- sync-index` 后 `check`（64 份）、`git diff --check` 均通过；该阶段未运行全 Gate，最终验收另见下述证据。

最终实施与验证已完成：阶段正确性审查发现的两个 P2（Node 大合法 PNG 的 Base64 校验误拒、结构化 legend 仅对象成员重排误拒）由原实现作者修复，原审查者定向复核 4/4 与构建一致性通过，无剩余阻断。末期独立代码优化按 native OAI 编译／响应、能力预算门禁和图片尺寸职责拆分，保持既定行为合同；21 项函数指标、大文件及 semantic catalog 问题均消除，无阈值豁免。作者验证公开目标 78/78、`test:check` 45/45、1,258 个项目测试实体的引用／覆盖检查及 type／lint／format／构建一致性通过，Bun harness 内独立 Node MJS 大 PNG 与 loopback HTTP 通过。此处不声称另做过额外独立重构审查。

根代理独立运行 `bun run check`，退出 0：68 项中 65 passed、0 failed、3 项 release-only 不适用、0 unavailable，耗时 54.9 秒；现场为 `.log/vibe-check/invocations/20261017T040924923Z-fcc7341e-5258-4c63-a0dd-df9d5916150f/`。最终总验收结合作者证据、原问题独立复核、文档读取走查与完整 Gate，确认 proposal 成功标准在既定授权及账号可用范围内满足；上述线上可用性、精度、容量与真实库未迁移边界不因此消失。

完整方向已在工作树实施并核对，新 Decision `261017-lightweight-judgment-faithful-protocol-adapters` 经公开 CLI `mark-aligned` 保持 active 并标为 aligned，派生索引同步。以上为前轮 15 项任务的验收证据；记录对齐和任务勾选不表示发布、部署或迁移真实用户库。

### 本轮再审核与收尾授权

用户要求重新检查当前未提交变更的 AI-ready 文档与编码规范，已授权必要 Git 提交及正常 hook 自动推送，并明确同意提交保存后结项删除 `changes/enable-lightweight-judgment-multi-protocol/`。当前新增 2.7–2.9 记录此次再审核与提交前验收；完整 Plan 提交保存后，根代理再用 `finalize --preflight` 核对 HEAD 可精确恢复、执行 finalize 并提交删除。本节不预告这些动作已经完成。


本轮文档再审核重新沿上表五条实际读取路径核对，而非沿用前轮通过结论。入口的启用、任务选择与按需读取仍兑现局部判断承诺；本轮重点修正协议表的非自足行、Score／拒答混杂层级、本地输出长句、运行契约中的一次性取证状态，以及 Change 的过期 Git 授权。live 调查改按直接 HTTP 与公开 CLI 两阶段组织，原始资源、计量、稳定 ID、关系和历史边界保留。日志留存、显式迁移、拒答与权限的负向约束有独立当前职责，继续保留。

本轮独立机械验证通过：skill 结构／内部链接（9 个 Markdown）、Change、决策 sync-index／check（382 条）、调查 sync-index／check（64 份）、`git diff --check`。以合成文本和临时无凭据配置执行两次公开 CLI dry-run 均退出 0、attempts=0：直接 OAI 为 input/questions 数组，OR 指定 OpenAI 为 state/questions map；未联网或访问真实日志库，临时配置已清理。独立 `bun run check` 退出 0，68 项中 65 passed、0 failed、3 release-only 不适用、0 unavailable，54.5 秒；现场为 `.log/vibe-check/invocations/20261017T043227002Z-2a4ebdb9-e639-4461-8056-e43e7a2053c1/`。该次检查覆盖文档冻结时的工作树；后续代码规范复审与根代理最终验收证据如下。


本轮代码规范作者已完成整体审核并冻结，按编码规范逐项核对领域建模、边界、类型、数据来源与测试职责，而非只以 Gate 通过代替审核。主要整改为：以 readonly 领域联合表达合法状态；OAI wire 使用显式类型；直接消费已验证响应；请求正文保持单一来源；图片尺寸使用具名字段；构建适配采用表驱动；测试断言与证明范围收窄。既有协议、模态、权限、原答和日志合同保持不变。根代理已审计规范矩阵及代表性领域／调用边界，无剩余阻断。

代码作者验证通过：领域测试 79/79，分发测试 13/13（含独立 Node MJS 大 PNG 与回环 HTTP），`test:check` 45/45，1,259 个测试实体引用／覆盖，以及 type／lint／format／构建一致性／diff 检查。两项文档复审 Case 建议已修正，另收窄 ADAPTER-001 的过度证明并新增尺寸 Case ADAPTER-017。作者末次 Gate 为 65 passed、0 failed、3 release-only 不适用；现场为 `.log/vibe-check/invocations/20261017T044408552Z-797b7342-3093-4d5c-b9dc-709ed1794198/`。本轮代码复审没有新增真实服务调用，也未执行真实库迁移。

根代理独立运行最终 `bun run check`，退出 0：68 项中 65 passed、0 failed、3 release-only 不适用、0 unavailable，48.9 秒；现场为 `.log/vibe-check/invocations/20261017T044626688Z-784a8288-4ef2-4ea9-8016-12220c7d629e/`。随后核对成功标准与 owner 交接，按实际写入归属显式暂存本轮 88 个路径；cached 范围与 diff 检查通过，没有其他 unstaged 或 untracked 内容。技术验收与提交准备已完成，在线可用性、质量、容量及真实库未迁移边界保持不变。接下来保存完整 Plan，经公开 `finalize --preflight` 和 `finalize` 精确结项并提交删除；本条证据不预先声称这些 Git 与删除操作已经完成。
