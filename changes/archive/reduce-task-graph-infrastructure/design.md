# Design

本设计把 task-graph 收回到“任务图语义 + 短事务 JSON 存储”的产品边界，并为每项被删除的基础设施指定唯一替代路径。

## Context

本 change 延续三个长期方向：权威 JSON 索引、原生文件短锁、事务 task lease。它只撤回为这些方向附加的安装监督、工作区配置管理和边缘恢复精度。

## Goals / Non-Goals

目标是删除内置 native runtime 安装监督、工作区锁与 Git ignore 管理、原子写回读分类、重复 CLI 命令和 Service 薄封装，同时保持任务图、revision CAS、事务领取与原生短锁行为完整。

本 change 不修改 task index Schema，不改用 SQLite 或后台服务，不建设通用 runtime manager、command registry、storage backend 或跨工具抽象，也不扩大 task-graph 的权限边界。

## Decisions

### Runtime

1. Native 包固定为 `fs-native-extensions@1.5.0`；默认 tool home 仍为 `path.join(os.homedir(), ".tools", "task-graph")`，非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖。
2. Runtime ID 固定为 `fs-native-extensions-1.5.0`，目录为 `<tool-home>/runtimes/<runtime-id>/`。不再读取 skill 内 manifest/lockfile，不使用 `runtime.json`。
3. 唯一公开命令 `runtime info` 返回 runtime 路径、`missing|compatible|incompatible` 状态、兼容布尔值、失败原因，以及缺失时的结构化安装命令：

   ```json
   {
     "command": "npm",
     "args": [
       "install",
       "--prefix",
       "<runtime-path>",
       "--ignore-scripts",
       "--no-audit",
       "--no-fund",
       "--save-exact",
       "fs-native-extensions@1.5.0"
     ]
   }
   ```

4. `runtime info` 不创建持久文件、不联网；目录存在时从该目录解析直接包，验证 `package.json#version`、`tryLock`、`unlock`，并在系统临时目录执行真实探针。Mutation 使用同一加载路径，缺失和不兼容分别返回 `RUNTIME_MISSING` 与 `RUNTIME_INCOMPATIBLE`。
5. 删除 `runtime install`、`runtime check`、`RUNTIME_INSTALL_FAILED`、runtime marker、文本资产、进程 runner、安装并发收敛和安装 GC。Skill 在取得授权后自行调用返回的 shell argv，再重新调用 `runtime info`。

### 临时目录短锁

1. `TaskGraphStore` 用 `path.resolve(indexPath)` 生成稳定绝对路径；Windows 对该字符串转为小写，再计算 SHA-256。
2. 默认锁根目录是 `path.join(os.tmpdir(), "task-graph-locks")`，锁文件是 `<hash>.lock`。内部测试可以注入 lock root；该选项不进入公开声明。
3. Mutation 取锁前幂等创建锁根目录，再打开稳定普通文件并使用现有 `tryLock` 有界轮询。工具从不删除锁文件。
4. 同一主机但使用不同路径别名访问同一文件、网络文件系统和绕过 CLI 的写入不属于支持范围。Task-graph 不再逐级拒绝符号链接。

### 原子写

1. 候选仍在锁内完成完整 schema/graph 校验、revision 单次递增和规范序列化。
2. `writeFileAtomic(..., { fsync: true })` resolve 后立即成功，不执行提交回读。
3. 调用 reject 时不再次提交、不猜测旧值或候选是否已经落盘，统一返回 `WRITE_OUTCOME_UNKNOWN`，details 保留 `indexPath`、`possibleRevision` 和重读恢复动作。
4. 目录创建、锁文件打开、索引读取等在提交点前可明确判断的失败仍使用 `WRITE_FAILED` 或既有读取错误。
5. `index init` 不读取、创建或修改 `.gitignore`；原子库的短命临时文件及崩溃残留不属于权威状态。

### 命令收缩

1. `index info` 返回 revision、schemaVersion、计数、nextIds、`valid: true`、`canonical` 与 diagnostics；无效索引继续通过稳定错误 envelope 报告。删除 `index check`。
2. `scope list` 的每项 summary 增加 `close` 投影。`scope close --scope <id>... --expected-revision <n> --results-delivered` 原子关闭显式选择集合；一个布尔确认覆盖本次全部显式选择。删除 `scope gc-query` 和 `scope gc`。
3. `claim` 增加可选的 `--recover-lease <id> --expected-revision <n> --reason <text>` 三元组。普通 idle claim 不接受该三元组；过期 running task 只有旧 lease 匹配且 revision 最新时才能直接写入新 lease；活动 lease 永不被该入口覆盖。删除 `recover`。
4. Help catalog 保持普通硬编码对象，dispatch 保持显式分支；不新建 typed registry 或通用 CLI framework。

### Service 与领域入口

1. 保留 `TaskGraphService.apply()` 作为内容、scope 与关系 mutation 的统一领域入口。
2. 删除只包装单个 apply operation 的 `createScope`、`setScopeBinding`、`createTask`、`updateTaskContent`、`updateTaskControl`、`setParent`、`setDependency`、`setExclusion` 公共 convenience methods；CLI 直接构造 request。
3. 保留查询、执行 lease、完成、失败、重试、取消和 scope close 等具有独立领域行为的方法。
4. 不修改 task index JSON Schema；过期重新领取只改变 mutation 路径和投影 nextAction，不新增持久字段。

### Removal Matrix

| 删除 | 替代 |
| --- | --- |
| 内置 npm 进程监督 | 调用方执行 `runtime info` 返回的 npm argv |
| `runtime install`、`runtime check` | `runtime info` 状态、探针和安装指引 |
| runtime manifest、lockfile、marker | 固定直接包版本和真实加载探针 |
| 工作区 `.lock`、`.gitignore` 管理 | 系统临时目录稳定锁 |
| 符号链接逐级封锁 | 已解析索引路径和受限本机支持边界 |
| old/candidate/unknown 回读分类 | 任意 atomic reject 都是 unknown |
| `index check` | 扩展后的 `index info` |
| `scope gc-query`、`scope gc` | `scope list` close 投影与批量 `scope close` |
| `recover` | 带恢复三元组的 `claim` |
| Service 单操作 wrappers | `apply` |

## Risks / Trade-offs

- npm 安装超时、输出安全和进程清理由当前 shell/agent 环境负责；task-graph 只提供 argv。
- 不再锁定或运行时验证完整传递依赖闭包；精确直接版本和真实 API 探针是当前兼容门禁。
- 系统临时目录可能在重启后清理；重启后没有存活旧锁持有者，因此下次 mutation 可以重建。
- Atomic reject 的错误精度降低，但统一重读不会把不确定提交误判为安全重试。
- 删除活动 lease 强制接管后，存活 lease 只能由 owner 正常操作或等待过期，换取更小且更明确的恢复协议。

## Open Questions

无。
