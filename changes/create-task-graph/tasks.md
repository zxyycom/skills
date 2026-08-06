# Tasks

Readiness 门禁已经通过；实施按机器契约、纯图语义、事务存储、JSON CLI、skill 集成和验证顺序推进，完成出口是行为 owner、生成产物、测试证据和长期决策全部对齐。

## Readiness

- [x] 0.1 完整读取 proposal、design、tasks 与五条活动未对齐 `task-graph` 决策，确认目标、范围、owner、实施输入和长期方向一致。
- [x] 0.2 固定 `docs/task-graph/task-graph-index.json` 默认位置、显式 root/index 入口、嵌套 scope/task 字典、scope key、binding 和跨 scope 隔离规则。
- [x] 0.3 完成 `index-runtime`、共享文件操作和 `version-control` owner 调查，确认第一版由 `tools/task-graph/` 承接专用 mutable-state store，不扩展现有派生索引或 Git pending owner。
- [x] 0.4 固定跨进程短事务锁、revision CAS、临时文件原子替换、30 分钟默认执行租约、续租、过期与强制恢复协议。
- [x] 0.5 固定最小 control/execution/effective 状态、真实父子任务完成门禁、JSON-only CLI、scope 级清理和 Git 边界，并确认 design 无阻塞开放问题。
- [x] 0.6 通过 AI-ready 实施审计门禁：实现 agent 能仅凭本 change 恢复状态判定优先级、actionable 下一动作、终态拓扑保护、递归取消、陈旧锁回收、原子提交点、skill 运行流程和实施自由度，并可直接开始任务 1.1。

## Implementation

- [x] 1.1 在 `tools/task-graph/` 建立类型化源码与收窄后的公开领域 API，固定全部 JSON request/result 判别联合、字段限制、blocker/trace/actionable 结构、稳定 error code 与 retryable 映射、CLI 退出码和可注入 clock；store、process、generator、hook 与故障注入只留在内部模块，不进入分发声明。
- [x] 1.2 实现 task index Valibot Schema、生成 JSON Schema 的单一真源、嵌套 scope/task 字典、至少六位且可扩展的稳定递增 ID、严格大于现有 ID 的 `nextIds` 分配语义、不可变 scope key、可更新且唯一的 binding、持久字典 key 的 80 字符上限与原型保留字拒绝、task 安全默认值、control/execution 判别联合、严格解析、规范字段与 key 顺序、LF 序列化和完整 round-trip 校验。
- [x] 1.3 实现 scope 内父子森林、展开后依赖 DAG、对称排斥、跨 scope 与悬空引用拒绝、祖先 control/依赖/排斥继承、反向关系和完整 blocker 来源投影。
- [x] 1.4 实现 control 与 execution 状态转换的固定判定优先级、叶子 `claim` 与父任务 `complete` actionable 投影、真实父任务完成门禁、保留已有终态的递归取消、失败重试、终态不可 reopen，以及运行中有效 control 与终态或运行拓扑证据不可被普通编辑改写的规则。
- [x] 1.5 实现专用 mutable-state store、5 秒锁等待、owner metadata staged 原子发布、fresh incomplete lock 重试、generation-bound owner/claimed-owner/reclaimer 精确认领与双重隔离复验的 60 秒陈旧候选回收、原子 release isolation、expectedRevision CAS、只清理本次成功创建路径的同目录 `wx` 临时文件、同步与原子替换、替换抛错后的旧/新/未知 revision 三分支判定、提交点前无变更、提交点后未知结果恢复、读回验证和符号链接边界拒绝。
- [x] 1.6 实现 claim、renew、release、complete、fail、retry、cancel、匹配当前过期 lease ID 的 recover 和活动租约强制恢复，覆盖全索引 lease ID 唯一性、complete/cancel 前置条件 XOR、过期后普通 lease 操作拒绝、release 的合法下一 control、retry 保留 attempt、默认 30 分钟及 1 分钟至 24 小时租约输入边界。
- [x] 1.7 实现 JSON-only CLI 的 index、scope（含 binding 更新）、task、relation、actionable、trace 和执行命令，保证完整逐命令 help 参数目录、version、usage、成功与协议内失败各输出一个 LF 结尾 JSON 对象及固定退出码，并实现 stdin/file `apply` 批量事务与可安全使用原型名称的 alias 映射。
- [x] 1.8 以同一 `closeScopes` 领域原语实现单 scope close、全部 scope closable/blocker 查询与显式非空多 scope GC，验证顶层终态、完整 scope 无失败或租约、逐 scope 结果交付确认、批量 all-or-nothing 原子删除以及 revision 只增加一次与 `nextIds` 保留，不实现单 task 或后台 GC。
- [x] 1.9 创建空的 `docs/task-graph/task-graph-index.json` 权威索引，更新 `docs/navigation.md` 中的任务路由和内容 owner，并在 `.gitignore` 排除相邻锁、临时文件与隔离残留；工具不得自动 stage 或 commit 索引。
- [x] 1.10 创建 `skills/task-graph/SKILL.md`、必要 references、生成后的 CLI、声明、source map、task index Schema 和 updater，兑现明确触发与简单线性 near miss、scope 恢复、查询—选择—领取—续租—收敛流程、权限边界及稳定 owner/subagent 交接，使 skill 与工具形成完整独立分发单元。
- [x] 1.11 更新 `docs/skills/task-graph.md`、`README.md`、`AGENTS.md` 以及实际需要的 build、package scripts、检查、打包和发布集成，不在非 owner 文档复制机器协议。
- [x] 1.12 汇总各实现步骤同步建立的最小原生测试入口，并同步 `docs/test-evidence/test-evidence-topics.json`、对应单 case 文件和统一派生索引；不把测试集中延后到实现结束后补写。

## Verification

- [x] 2.1 运行 schema、未知字段、原型保留 own key、嵌套字典、key 长度与 pattern、`nextIds` 严格大于现有 ID、分配与失败不消耗编号、ID 扩展、scope key 不可变、binding 更新与唯一性、重复 running lease、task 安全默认值、control/execution 判别联合、规范排序、确定性序列化、标准 JSON Schema consumer 和 round-trip 测试，证明运行时与生成 Schema 拒绝同一非法输入且字典 key 是唯一身份。
- [x] 2.2 运行父子环、继承展开依赖环、跨 scope 与悬空引用、排斥对称、祖先继承、局部 control 覆盖、同对关系冲突和反向投影测试。
- [x] 2.3 运行有效状态优先级、叶子 claim、父任务 actionable 与完成门禁、全部子任务取消、失败重试、保留已有终态的递归取消、终态不可 reopen、祖先 control 影响运行后代拒绝，以及关系编辑或在排斥目标下新建子任务导致终态或运行拓扑证据变更的拒绝测试。
- [x] 2.4 运行并发领取、全局 revision 冲突、短锁竞争、fresh incomplete lock 重试、metadata publish 故障、owner/claimant 存活保守拒绝与失效接管、stale claimed generation 上双回收者精确 rename 与 fresh owner ABA 屏障、directory 观察后 generation 重读、reclaimer token EEXIST 不误删、非法或符号链接 generation、恢复 errno 稳定映射、旧 token 写入拒绝、release isolation 故障、重复或错误 lease、过期后普通 lease 操作拒绝、匹配 lease ID 恢复、排斥任务竞争、foreign 临时文件不误删、提交点前失败、替换抛错后的旧/新/未知 revision 分支、提交点后未知结果、原子替换读回、符号链接、租约续期、过期和强制恢复测试。
- [x] 2.5 运行 JSON-only CLI 全部 32 个逐命令 help 目录、version、usage、成功、schema、状态、冲突、路径与恢复失败输出和退出码测试，以及批量 apply 全部成功或全部回滚、`constructor` alias、长度拒绝、LF 结尾和 stdout 无混合文本测试。
- [x] 2.6 运行 scope 终态门禁、结果交付确认、活动与待恢复租约拒绝、单 scope close、全量 closable/blocker 查询、显式多 scope GC 全成或全回滚、成功 revision 只增加一次、`nextIds` 不回退、无单 task清理、运行态辅助路径被 Git 忽略和 Git 不自动变更测试。
- [x] 2.7 使用现实请求验证 skill 的自然触发、简单线性 near miss、多个顶层任务、任务追加、真实父子分解、并行排斥、上下文恢复、缺少 subagent-orchestration 时降级及持久 change 交接。
- [x] 2.8 运行 task-graph skill 结构验证、工具类型检查与全部原生测试、生成物逐字节检查、索引 schema 校验、打包验证和 `bun run check`。
- [x] 2.9 将完整实现与五条 task-graph 决策逐项核对；只有全部方向已经成为当前事实时才标记为 aligned，并运行决策集合严格检查。
