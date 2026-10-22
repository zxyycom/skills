# Tasks

按 Readiness → Implementation → Verification 推进；用户已授权实施、验收、结项提交及正常 hook 推送。主要工作委派给 `gpt-6.1-sol` 子代理，勾选必须附实际工作与验收证据。全部任务完成后，保存与 HEAD 精确匹配的完成态，再按 Change Plan 契约预检并 finalize。

## Readiness

- [x] 0.1 复核当前代码／规则与 design 事实基线，确认唯一 Outcome、共同决策矩阵和领域差异仍适用；恢复实施与交付授权。证据：HEAD 仍为 `40431717`，开始时只有本 Change 未跟踪；用户明确接受 index payload 取舍并授权持续实施、验收及结项提交，已分别委派实现、长期 owner 与 1W 验证。
- [x] 0.2 核定内部 record-stage 协调器的最小输入／证据／阶段顺序、领域适配和依赖方向；列出现有直接调用、保留例外、生成／版本／门禁订阅影响，确保不改变通用 Index Runtime stage 默认。证据：内部 `record-staging.ts` 以两域适配取得阶段事实和领域证据，共同持有策略、投影和发布顺序；通用 H-base stage、其他命令不接入。storage 原始读取提取实际进入 D／IR／Novel Cards／Test Evidence 四个现有生成闭包，按影响同步并各升一，构建映射与门禁订阅按实际依赖核对。
- [x] 0.3 实施前核定 index payload 保证变化的长期决策继承方式与文档 owner；确定 1W fixture、baseline、常数选择代表场景、重复／噪声判据、采样与独立后验方法，预算只覆盖有限代表场景。证据：新决策 `261022-scope-record-index-payload-validation` 以修订完整承接 IR-only 前序，先保持 unaligned；1W 方案固定每域 10,000 条、选中 1 条，index 各 3 次对照、all/domain 各 1 个代表样本，独立后验与工作量探针分开；正式计时等待最终代码冻结和其他测试静默，噪声不作为机械允许回退线。

## Implementation

- [x] 1.1 在既有 Index Runtime／shared 分层内实现共同阶段协调和投影接点，集中 scope 策略、P-base 组合、兼容验证、fresh 复核与受保护发布；复用现有底层原语，不新增缓存、通用记录引擎或 provider 协议。证据：`record-staging.ts` 已由两域实际调用，通用 H-base stage 未改，独立正确性审查确认无未解除阻断。
- [x] 1.2 将两个 stage 入口迁到共同协调器与窄领域适配，按 design 对齐 index 的 content-paths payload 策略及同阶段复用；完整保留 all/domain 验收、领域规则、两阶段来源保护、锁内 CAS、写后与 unchanged 保护，清点迁移后直接调用与合理例外。 证据：两域均经共同协调器，fresh 实际内容与完整身份等价后才复用解析／冻结目标；来源、目录与表示仍分阶段获取。坏 P 的具体错误优先级及 fresh 图 source-drift 保持，独立同字节 symlink 反例均拒绝且 pending 未变。
- [x] 1.3 增加两域配对的共同机制契约测试及领域特有边界／故障测试；按最小原生入口更新 Case 与测试证据索引，独立后验不能复用被测 stage 算法。 证据：本次共新增 14 个 Case、调整 4 个既有 Case；最终 Case 覆盖检查 1361 实体通过。新增工作量／字节反例／冻结／兼容入口证明 fresh 读取不减、解析与目标构建可复用，性能后验由独立代理维护。
- [x] 1.4 在实施授权内同步长期决策继承、两域操作契约和共享／领域维护 owner，保持公开 CLI／结果与非目标保证；按实际输入影响同步生成、声明／Schema、hash、版本与必要门禁订阅，不直接手改生成副本或机械全量升版。 证据：共同 payload 后继已按规则 aligned，严格决策检查 394 条通过且其他 3 个 unaligned 未动；所有相关 owner 已按 fresh 等价证明精化。D 89／IR 78／Novel Cards 10／Test Evidence 42 与四包生成检查通过；后二者仅受 storage-load 实际闭包影响，普通 load 语义及公开导出／manifest／Schema 保持。

## Verification

- [x] 2.1 运行两个领域、Index Runtime 与 version-control 的相关测试，覆盖 design 的共同矩阵与领域差异、小 fixture 竞态／故障／恢复／unchanged；核对共同策略确由单一 owner 承接，并完成仅核对正确性的阶段代码审查与修复，不以阶段审查代替最终独立优化。 证据：最终六 suite 共 874 测试通过（D 318、IR 324、Index Runtime 74、version-control 86、Novel Cards 37、Test Evidence 35），另 impact 路由 14 通过。唯一 P2 fresh 图映射已修并独立解除；等价复用追加审查 33/33 加同字节 symlink 反例均通过，无未解除正确性阻断。
- [x] 2.2 以固定 1W 存量完成前后可比的两域代表测量，记录 wall／CPU／峰值 RSS、独立工作量采样与非被测逻辑后验；验证连续 A/B、重选及 scope 保持，据实报告两域成本变化与剩余成本；若发生稳定回退则按 design 处理，数据不足不宣称性能已改善。 证据：[独立调查](../../docs/investigations/record-stage-convergence-10k.md) 已追加最终 v3 完整匹配组并通过全量调查检查（74 份报告、索引当前）。DR wall 中位 6.712542→2.342072s（−65.11%），IR 2.529476→2.148688s（−15.05%），CPU／RSS 均下降；80 次观测、14 次 probe 与三轮连续重选后验通过。v1／v2 证据原字节保留，主结论仅取最终 v3，all/domain 单对样本不作统计承诺。
- [x] 2.3 另派独立优化子代理，以 `docs/coding-style.md` 为权威优化整体变更代码和直接影响边界，周边历史代码仅作参考，不引入无必要抽象；修后必要重验，运行受影响的同步与生成漂移／public distribution／版本检查、Case 账本检查及最终 `bun run check:changed`，如实记录执行、复用与未覆盖，不以 quick check 替代完整验收。 证据：独立规范优化及定向复核完成，13 函数／5 重复／3 文件指标均按真实职责解除，无质量政策或豁免变更；四包生成／Case 检查通过。最终文档快照 `check:changed` 于 `20261022T183338314Z-fcc61e9e-96a5-4939-ab0d-0a2c84b198cb` 实际执行 61 项全部通过，3 项仅 release 范围不适用。
- [x] 2.4 独立完成最终 AI-ready 文档优化与交付审阅：从实际入口可恢复共同保证、领域差异、owner、payload 变化与性能证据边界；确认 artifacts、任务、必要 owner 交接及验证同一 Outcome，修复遗漏并重跑受影响检查，取得覆盖最终快照的门禁证据后如实勾选。 证据：独立 AI-ready 优化与最后定向复核完成，稳定 owner、真实领域差异、DTO 兼容和 v1/v2/v3 边界均可从入口恢复；决策 394、调查 74 且索引 current、Case 覆盖 1361、Change 结构及 whitespace 检查通过。v3 的 951 个指纹仅三份 README 文档差异，非文档文件与通过性能验收的候选一致；最终文档门禁已通过。
