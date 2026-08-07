# Proposal

本 change 收缩 task-graph 的非领域基础设施：保留权威 JSON、任务拓扑、状态投影、revision CAS、事务领取和原生文件锁，只删除不会增加任务编排能力的内置 npm 安装器、工作区 Git ignore 管理、过度精细的写入分类、重复命令与单操作 Service 包装。

## Why

上一轮事务简化把自研 stale lock 协议替换为操作系统锁，但为了下载一个已经带 prebuild 的 npm 包，又新增了 runtime 文本资产校验、marker、唯一临时目录、并发发布、跨平台进程树终止、输出截断和凭据清理。锁算法的责任已经交给库，整体源码与测试规模却没有实质下降。

Task-graph 是短期任务图工具，不应同时充当 npm 安装器、进程监督器、用户 `.gitignore` 编辑器或本机依赖防篡改器。安装 native 包可以由 skill 在取得授权后交给当前 shell 显式执行；锁文件可以放在用户系统临时目录；原子写抛错可以保守地统一要求重读。

## Outcome

- `runtime info` 成为唯一 runtime 命令：缺失时返回精确 `npm` argv，存在时直接加载并执行真实 lock/unlock 探针；CLI 本身不运行 npm。
- Native runtime 使用固定直接依赖版本目录，不再分发 manifest、lockfile、marker、安装事务或进程监督代码。
- 锁文件迁到 `<os.tmpdir()>/task-graph-locks/<index-path-sha256>.lock`，目标仓库不再产生稳定 lock 文件，CLI 永不修改 `.gitignore`。
- `write-file-atomic` resolve 即成功；reject 统一返回 `WRITE_OUTCOME_UNKNOWN`，不再通过回读推断提交点。
- `index info` 同时返回规范性诊断；删除 `index check`。
- `scope list` 返回关闭门禁；`scope close` 同时支持一个或多个显式 scope；删除 `scope gc-query` 与 `scope gc`。
- 过期 lease 由携带旧 lease、最新 revision 和原因的 `claim` 直接重新领取；删除 `recover` 与活动 lease 强制接管。
- CLI 继续使用直接分支，不建立 command framework；现有 `apply` 直接承接单项领域 mutation，删除对应 Service convenience wrappers。

## Scope

纳入范围：

- 收缩 runtime、store、CLI、service、engine、graph、types、错误和公开声明。
- 删除 runtime 文本资产、内置安装器、进程监督代码及其专属测试证据。
- 删除 `.gitignore` 写入、符号链接全路径封锁、原子提交回读分类及其专属测试证据。
- 合并 runtime、index、scope 和 lease 恢复命令，更新 skill、项目说明、调查、决策演进、生成产物和测试证据。

不纳入范围：

- 修改 task index schema 中的 task、scope、content、control、execution、relations 或 ID 结构。
- 删除 revision CAS、批量 `apply`、任务租约、依赖、排斥、父子继承、actionable 或 trace。
- 改用 SQLite、后台服务、网络锁、长期任务管理或按平台二进制发布流水线。
- 建立通用 runtime manager、CLI registry、storage backend 或跨工具抽象。

## Success Criteria

- Task-graph CLI 不 spawn npm，不捕获 npm 输出，不管理安装临时目录；缺失 runtime 时返回可直接交给 shell 的结构化安装命令。
- Runtime 安装目录只从固定包版本、默认 tool home 与 `TASK_GRAPH_TOOL_HOME` 得出；兼容性只由直接包版本、API 形状和真实探针判断。
- 所有 mutation 使用系统临时目录中的稳定原生锁；同一规范索引路径映射到同一 lock path，锁文件不进入工作区且不被工具主动删除。
- `index init` 不读取或写入 `.gitignore`，合法 symlink workspace 不因 task-graph 自身路径策略被拒绝。
- 原子写抛错只产生保守的 `WRITE_OUTCOME_UNKNOWN`，调用方重读后决定下一步；成功调用不再做提交回读。
- 合并后的命令 help、声明、skill 工作流和实现一致；删除的命令不再出现在公开面或测试证据中。
- 领域图、生命周期与并发 claim 回归保持通过；专项测试、生成检查、声明、skill 校验、测试证据、决策索引和 `pnpm check --full` 全部通过。

## Affected Owners

- `tools/task-graph/src/runtime.ts`：只拥有 runtime 路径、安装指引、直接 addon 加载和真实探针。
- `tools/task-graph/src/store.ts`：拥有临时目录锁、索引事务和保守原子写失败。
- `tools/task-graph/src/cli.ts`、`service.ts`、`engine.ts`、`graph.ts`、`types.ts`、`errors.ts` 与公开声明：拥有合并后的命令和执行契约。
- `skills/task-graph/`：拥有 agent 安装授权、shell 执行、恢复和调度工作流，并随行为变化提升独立版本。
- `docs/decisions/task-graph/`：记录对 native runtime、JSON 短锁和事务领取既有决策的演进。
- `tools/task-graph/tests/` 与 `docs/test-evidence/task-graph/`：只保留当前行为的最小原生测试与证据。
