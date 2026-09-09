# Design

本设计以“标签用于组织影响，完整有效输入指纹与最近通过证据决定是否执行”为主线，避免把路径相邻误当成无关证明。

## Context

- 当前日常 Gate 不按变更选择：无 release tag 时仍执行三十五项 Check。
- 热运行追踪中，七项原生 Check 分别重复进行 Git 工作区枚举；大量无关集成测试又在临时仓库中产生真实 Git 工作。
- Vibe 已拥有 flags、effective aggregation、named resources、学习调度和 caller-keyed JSON cache 原语；项目拥有领域特有的路径、owner、Check 目录和本地缓存位置。
- 当前工作区已有本任务第一阶段的 test-evidence ast-grep 批处理改动，后续实现必须延续而不覆盖。

## Goals / Non-Goals

- 目标：为日常 Gate 建立保守、可审计、可失效的增量相关性与通过证据，减少重复文件发现、解析和无关测试运行，并满足用户给出的延迟目标。
- 目标：新依赖和间接影响默认扩大执行范围，不因规则遗漏静默跳过。
- 非目标：不把 release 写入、外部服务状态或不可重放副作用伪装成可缓存的确定性检查；不在项目层复制 Vibe scheduler 或 Check 生命周期。
- 非目标：第一版不承诺自动推导所有语言和动态运行时依赖；显式 owner 依赖和保守 fallback 先形成可信边界。

## Decisions

### Intended Change

1. 每次 invocation 形成一个不可变工作区快照。每个快照只枚举一次版本控制可见文件并为每个普通文件形成内容身份；固定配置、Git 版本与配置、Node/Bun、已安装依赖图、实际使用的工具版本、声明进程环境和 Gate 影响契约版本进入同一身份边界，纯父 shell 记账变量不进入身份。必要探测失败时不形成可缓存的 unavailable 身份。
2. 路径规则为文件派生一个或多个直接影响标签。标签表示稳定 owner 或共享输入责任，不直接表示 Check 状态，也不写回源文件。
3. 显式标签依赖形成有向影响图。上游共享实现、配置或工具链标签变化向所有声明的消费者传播；未分类、冲突或无法读取的输入进入 `global`，使日常 Gate 保守执行全部 base Checks。
4. 每个 Check 声明影响它的标签集合和缓存策略。其有效输入指纹覆盖 Check ID、影响契约版本、Check 配置/实现版本、所有可到达上游标签的内容摘要以及声明的环境状态。
5. “无关”严格定义为：当前有效输入指纹与一份本地、通过解析且记录该 Check 最近成功的证据完全一致。只满足“直接目录没改”不构成无关；没有证据或 Check 上次未通过时必须执行。
6. 日常 Gate 通过内部 activation flags 把需要执行的 Check IDs 交给 Vibe；复用证据的 Checks 保留稳定身份并结算为未激活，同时由 invocation 级事实明确列出。release 激活全部要求的 Checks，不使用日常结果跳过执行，但可以复用不会改变质量真值的精确解析事实。
7. 成功 invocation 在最终工作区快照未漂移时，保留指纹仍精确匹配的旧证明，并为本次实际通过的 Checks 形成新证明，再原子替换当前 manifest；失败、取消、输出失败或漂移均不发布更新。
8. test-evidence catalog snapshot 作为确定性事实按完整来源 revision 缓存；当前五次完整来源指纹收敛到缓存命中两次、缓存未命中最多三次，并继续保留形成期间与覆盖检查后的漂移检测。

### Resulting Impacts

- 需要新增项目级 impact contract、snapshot/receipt 存储边界与 CLI activation preparation；这些属于 Gate owner，不进入通用 skill 或测试账本 owner。
- 直接标签规则采用稳定路径/owner 分组；跨组依赖必须在同一 impact contract 声明。后续可以用静态 import 审计验证声明完整性，但不让未验证的自动推断单独决定跳过。
- Git 配置、声明进程环境、Bun 报告的已安装依赖图和所需工具版本摘要进入每项有效输入指纹，纯父 shell 记账变量被明确排除；当前环境测试验证确定性行为，在这些状态完全一致时允许复用，任一声明状态变化使全部证明失效。原始 `node_modules` 字节仍以 pnpm frozen-lock 安装为受信前提，不把 receipt 表述成依赖防篡改证明；后续若新增无法由指纹表达的 live 状态观察，再建立 always-run sentinel。
- 原生 Check 仍由 Vibe helper 形成 finding 和 Records；共享文件 inventory 若当前公共 API 无法注入，第一阶段先以 activation/事实缓存去除整项执行，随后把跨 Check inventory 复用反馈到 Vibe owner，而不修改 `node_modules` 作为长期源码。
- 机器与人读输出需要给出 executed/reused/first-run/conservative-fallback 数量和原因；全部 base Check 都有精确证明时，经过完整 catalog 校验的空 effective aggregate 明确为 passed，其他空选择继续失败。缓存不可用只降低性能，不改变质量失败为成功。
- 这一变化修订当前“base 固定执行全部非 release Checks、无跨运行缓存计划”的项目决策，需在完成前更新长期决策 owner。

## Risks / Trade-offs

- 最大风险是漏写依赖后错误复用通过证据。通过未分类全局 fallback、共享配置全局扩散、首次无证据必跑、显式跨 owner 边以及测试中的间接影响反例降低风险。
- 内容 hash 一次扫描仍有固定成本，但它替代多次枚举和读取，并为全部缓存提供共同事实源；后续可在不改变身份语义的前提下用 Git blob identity 优化。
- 工具链版本探测和依赖图读取增加每次 invocation 的固定成本；它换取跨运行证明的环境失效边界，不能为了更低热耗时恢复成可缓存的 unavailable 占位值。
- 将缓存证明显示为未激活而不是本次通过会改变人读统计；必须在 invocation summary 中明确复用数量，不能把 `not-applicable` 冒充实际执行。
- 环境型 Check 保守执行会限制热运行下界；需要以真实观察义务拆分，而不是直接缓存不完整状态。

## Open Questions

无。用户已确认以一次文件收集和标签驱动推进；实现中以完整有效输入指纹和最近通过证据补足标签本身不能证明无关的边界。
