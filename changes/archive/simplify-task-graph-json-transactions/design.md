# Design

本文固定该 change 的文件落点、接口、事务顺序、失败分类和验证出口；长期方向以所链接的 active 决策为准，未列入 `Open Questions` 的选择不再作为待决项。

## Context

### 权威关系

- [`use-authoritative-json-index-for-short-lived-tasks`](../../docs/decisions/task-graph/use-authoritative-json-index-for-short-lived-tasks.md) 继续规定 task index 是唯一权威状态；本 change 不修改 schema。
- [`coordinate-task-execution-with-transactional-claims`](../../docs/decisions/task-graph/coordinate-task-execution-with-transactional-claims.md) 继续规定 revision、事务 claim 和 task execution lease；原生短锁不跨越实际任务执行。
- [`use-native-locks-for-json-transactions`](../../docs/decisions/task-graph/use-native-locks-for-json-transactions.md) 规定使用稳定旁路文件上的原生排他锁和成熟原子写库。
- [`install-native-runtime-in-user-tool-home`](../../docs/decisions/task-graph/install-native-runtime-in-user-tool-home.md) 规定 `.node` 不进入 Git 或 skill 包，runtime 由 task-graph 显式安装到用户 tool home。
- Proposal 定义本 change 的结果、范围和成功标准；本文只决定如何兑现，不扩张长期方向。

### 当前实现事实

- `tools/task-graph/src/store.ts` 的 `TaskGraphStore.withLock()` 包围 `init()` 与 `mutate()`；`mutate()` 已经在锁内重读索引、克隆输入、校验候选并要求 revision 只增加一次。该主线保留。
- 当前 `acquireLock()` 到 `removeQuarantine()` 承担锁目录、owner、stale recovery、generation 和隔离；这些符号、专属 hooks、错误与测试全部删除。
- 当前 `commit()` 自行创建临时文件、文件 `fsync`、rename、目录 `fsync` 和回读。新实现把临时写入到 rename 委托给 `write-file-atomic`，仍由 store 承担完整候选校验和提交结果回读。
- CLI 在 `tools/task-graph/src/cli.ts` 的 help catalog 与 `dispatch()` 中登记命令，并由 `runTaskGraphCli()` 统一写一个 LF 结尾 JSON envelope。新增 runtime 命令沿用同一入口，不新增文本输出模式。
- `scripts/build/task-graph.ts` 从 `tools/task-graph/src/cli.ts` 生成单文件 ESM、声明、source map 和 Schema；新增 runtime 文本资产也由该生成器同步，不直接编辑生成副本。

### 已核验的库事实

- [`fs-native-extensions@1.5.0`](https://github.com/holepunchto/fs-native-extensions/tree/v1.5.0) 以 CommonJS 导出 `tryLock(fd)`、`waitForLock(fd)` 与同步 `unlock(fd)`；锁是 advisory。`waitForLock()` 没有取消参数，因此 5 秒门禁必须使用 `tryLock()` 轮询，不能用 `Promise.race()` 留下仍在等待的原生请求。
- [`write-file-atomic@8.0.0`](https://github.com/npm/write-file-atomic/tree/v8.0.0) 的异步函数写同目录临时文件，默认执行文件 `fsync` 后 rename，并在同一进程内串行化同路径调用；它不提供跨进程锁、目录 `fsync` 或提交后回读。
- `write-file-atomic@8.0.0` 声明 Node engine 为 `^22.22.2 || ^24.15.0 || >=26.0.0`。Task-graph 生成 CLI 尊重这一最低兼容范围；Bun 只用于本仓库构建和测试，不是分发 CLI 的受支持执行器。
- `fs-native-extensions` 的平台可用性由锁定包内容和真实探针确定，不从包名或 N-API 推断。Node engine 不满足时为 `RUNTIME_UNSUPPORTED`；安装存在但 addon 无法加载或探针失败时为 `RUNTIME_INCOMPATIBLE`。

## Goals / Non-Goals

目标：

- 保持 JSON、Git diff、revision、task lease、所有图语义和 JSON envelope 不变，只缩小存储层维护面。
- 让 native runtime 的文本输入、位置、身份、安装副作用、兼容性、缺失路径和并发安装成为可检查契约。
- 固定文件落点和任务顺序，不把锁 API、超时算法、runtime 目录、安装命令、临时发布协议、ignore 规则或写入分类留给实施阶段决定。
- 保留必要的内部测试 seam，但不建立可替换 storage backend、通用 lock provider 或仓库级 runtime manager。

非目标：

- 不修改 task graph 领域 API 或索引结构，不提供 JSON/SQLite 双后端。
- 不让普通查询、模块导入、skill updater 或 `index init` 静默联网；只有显式 `runtime install` 可以调用 npm。
- 不重建按平台 artifact、签名、自动更新、自动修复或 GC 流水线。
- 不支持绕过 CLI 的并发手工写入、网络文件系统、本机恶意路径竞争或断电级 durability。

## Decisions

### 固定值

| 契约 | 固定值 |
| --- | --- |
| Runtime 协议版本 | `1` |
| Native 锁包 | `fs-native-extensions@1.5.0` |
| 原子写包 | `write-file-atomic@8.0.0`，构建进生成 ESM |
| 原子写类型包 | `@types/write-file-atomic@4.0.3`，仅开发依赖 |
| Node 兼容范围 | `^22.22.2 || ^24.15.0 || >=26.0.0` |
| 默认 tool home | `path.join(os.homedir(), ".tools", "task-graph")` |
| Tool home 覆盖 | 非空 `TASK_GRAPH_TOOL_HOME` 经 `path.resolve()` 后完整覆盖默认值；不展开 `~` |
| Runtime ID | `v1-<sha256>`；`sha256` 是对已解析 `package-lock.json` 执行 `JSON.stringify()` 后所得 UTF-8 文本的 64 个小写十六进制字符 |
| Runtime 目录 | `<tool-home>/runtimes/<runtime-id>/` |
| Runtime 安装临时目录 | `<tool-home>/runtimes/.install-<runtime-id>-<uuid>/` |
| 稳定锁文件 | `<index-path>.lock` 普通文件，长期保留且内容为空 |
| 锁等待 | 最长 `5_000ms`，默认每 `50ms` 调用一次 `tryLock()`，用单调时钟计时 |
| npm 安装超时 | `300_000ms`；超时后立即停止采集输出，以真实 `close` 作为管道关闭证据，并在独立 `2_500ms` 总期限内终止进程树或销毁本地管道后返回结构化 `RUNTIME_INSTALL_FAILED`；Windows `taskkill` 本身也必须有界 |
| npm 诊断 | stdout/stderr 分别只保留经凭据清理后的最后 `8KiB`，不转发到 CLI 输出流 |
| 局部 ignore 文件 | `<index-directory>/.gitignore` |
| 局部 ignore 规则 | `/task-graph-index.json.*` |

### 源码、依赖与生成文件

1. 新建 `tools/task-graph/references/runtime/package.json`，内容为 private、不可发布的 runtime 包，只以精确版本 `1.5.0` 依赖 `fs-native-extensions`。在该目录运行 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` 生成并提交 lockfile v3；不得手写 integrity 或从根 `pnpm-lock.yaml` 转换。
2. 根 `devDependencies` 以精确版本加入 `fs-native-extensions@1.5.0`、`write-file-atomic@8.0.0` 和 `@types/write-file-atomic@4.0.3`。前者只让本仓库运行真实 native 测试；后两者供 TypeScript 与 Bun 构建。根 `node_modules`、任何 `.node` 和 npm 缓存仍不跟踪。
3. 新建 `tools/task-graph/src/runtime.ts`，只拥有 runtime 文本资产定位、tool home、ID、状态、安装、native 加载与探针。`store.ts` 只消费一个窄的内部 `NativeLockBinding`：`tryLock(fd): boolean` 与 `unlock(fd): void`；该类型不是通用 provider，也不进入生成声明。
4. Runtime 文本资产使用 `new URL("../references/runtime/", import.meta.url)` 定位。它在源码执行时解析到 `tools/task-graph/references/runtime/`，在打包后解析到 `skills/task-graph/references/runtime/`；不得依赖当前工作目录或 skill 的固定绝对路径。
5. `scripts/build/task-graph.ts` 把两个 runtime JSON 文件作为生成 artifact 原样同步到 skill。生成 CLI 通过目标 runtime 目录中的 `package.json` 创建 `createRequire()` 并动态加载 native 包；构建不得把 `fs-native-extensions` 或其 `.node` 内联到 ESM。
6. `write-file-atomic` 可以连同纯 JavaScript 依赖内联到 ESM。模块导入不得读取 tool home、加载 native addon、创建文件、运行 npm、写 stdout/stderr 或改变 `process.exitCode`。

### Runtime 状态与命令

公开 JSON data 使用以下语义：

- `runtime info` 返回 `{ runtimeId, protocolVersion, toolHome, runtimePath, toolHomeSource, state, nodeVersion, platform, arch }`。`toolHomeSource` 是 `"default"` 或 `"environment"`；`state` 是 `"missing"`、`"installed"` 或 `"invalid"`。该命令只读取文本资产、runtime 目录和 `runtime.json`，不加载 addon、不创建目录、不联网。
- `runtime install` 无参数。成功 data 在 info 字段之外增加 `action: "installed" | "reused"`。有效的既有 runtime 先通过真实探针再返回 `reused`，不运行 npm；缺失时执行安装事务。
- `runtime check` 无参数。它要求既有 runtime marker 有效，动态加载 addon 并执行真实 lock/unlock；成功 data 在 info 字段之外增加 `compatible: true`。它不安装、不修复、不联网。
- Help、version、`index info`、`index check`、scope/task 查询、`actionable` 与 `trace` 不需要 runtime。`index init`、`apply` 和所有创建、关系、control、claim、lease、完成、失败、重试、取消、恢复与 GC mutation 都在触碰工作区前加载当前 runtime；缺失时返回 `RUNTIME_MISSING`。
- 所有命令继续只向 stdout 写一个 LF 结尾 envelope，预期失败退出 `1`、stderr 为空；非法的进程级未捕获错误仍沿用现有退出 `2` 边界。

新增错误与恢复动作：

| Code | 触发条件 | retryable | 必需 details |
| --- | --- | --- | --- |
| `RUNTIME_MISSING` | 当前 runtime 目录不存在 | `false` | `runtimeId`、`runtimePath`、`installCommand: ["runtime", "install"]` |
| `RUNTIME_UNSUPPORTED` | 当前 Node 不满足固定 engine | `false` | `nodeVersion`、`supportedNodeRange`、`platform`、`arch` |
| `RUNTIME_INSTALL_FAILED` | npm 缺失、超时、非零退出、临时目录、探针或发布失败 | `true` | `phase`、`runtimeId`、`runtimePath`，有子进程时再含 `exitCode`、`signal`、清理后的输出尾部 |
| `RUNTIME_INCOMPATIBLE` | marker 无效、依赖解析错误、addon API 不匹配或探针失败 | `false` | `runtimeId`、`runtimePath`、`reason`；不得自动删除既有 runtime |

`LOCK_RECOVERY_REQUIRED` 与 `LOCK_LOST` 从公开错误联合和 retryable 集合删除。锁文件打开、stat 或取锁调用的非竞争错误映射为 `WRITE_FAILED` 并在 details 标明 `phase: "lock-open" | "lock-acquire"`；释放结果按“原生短锁事务”处理。`LOCK_TIMEOUT` 保留且 details 包含 `lockPath` 与 `waitMilliseconds`。

### Runtime 安装事务

1. 在任何写入前校验 Node engine，读取并解析分发的 `package.json` 与 `package-lock.json`，校验根依赖精确为 `fs-native-extensions@1.5.0`，计算 runtime ID 和最终目录。
2. 最终目录存在时，校验 `runtime.json`、从该目录解析 addon 并运行探针。全部通过即返回 `action: "reused"`；任一步失败返回 `RUNTIME_INCOMPATIBLE`，不删除、不覆盖，也不退回全局包或根 `node_modules`。
3. 最终目录缺失时，在 `runtimes/` 下创建唯一临时目录，把分发的两个 JSON 文件写入其中。非 Windows 平台以 `shell: false`、`windowsHide: true` 直接 spawn `npm`；Windows 的 `.cmd` 不能直接执行，因此以 `shell: false` spawn `process.env.ComSpec ?? "cmd.exe"`，固定参数前缀为 `/d /s /c npm.cmd`。两条路径都只传固定参数数组，不把 tool home、工作区路径或其他用户输入拼进命令字符串。
4. npm 参数固定为 `ci --ignore-scripts --omit=dev --no-audit --no-fund`，cwd 为临时目录。捕获输出并执行 300 秒超时；超时后立即停止采集，进程终止、Windows `taskkill`、真实 `close` 等待和必要的管道销毁共同受独立总期限约束，且不得把 timeout 后到达的后代输出加入结果。诊断清理至少移除 ANSI/control 字符、URL userinfo，以及 `_authToken`、`token`、`password` 键的值，再分别保留最后 8 KiB。任何失败都映射为单一 JSON 错误并尽力删除本次临时目录。
5. npm 成功后，只能通过临时目录的 `package.json` 创建 `createRequire()`；在独立 Node 子进程中校验 `tryLock` 与 `unlock` 是函数，在 OS 临时目录创建普通探针文件，执行 `tryLock(fd) === true`、`unlock(fd)` 和关闭句柄，再删除探针目录。探针非零退出、信号退出或超时时，`RUNTIME_INSTALL_FAILED` 保留与 npm 失败相同的 `exitCode`、`signal`、`timedOut` 和已清理输出尾部。
6. 探针成功后写入规范 `runtime.json`：`schemaVersion`、`runtimeId`、`packageLockSha256`、`packages.fs-native-extensions`、`installedAt`、`nodeVersion`、`platform`、`arch`。marker 写完后把整个临时目录 rename 到最终目录。
7. 并发安装各自使用独立临时目录。发布 rename 因最终目录已出现而失败时，校验并探针最终目录；有效则清理自己的临时目录并返回 `reused`，无效则返回 `RUNTIME_INCOMPATIBLE`。不为 bootstrap 再实现文件锁。
8. 进程崩溃遗留的 `.install-*` 不被当作已安装 runtime。第一版没有自动修复或 GC；用户只有在明确判断后才手工删除工具报告的精确目录。

### 原生短锁事务

1. `TaskGraphStore` 延迟取得当前 runtime 的 `NativeLockBinding`；同一实例可以缓存成功加载结果。只读路径不调用 loader。
2. Mutation 先检查索引和锁路径不跨越已存在的符号链接，再以 `fs.open(lockPath, "a+")` 创建或打开稳定旁路文件，并通过 `FileHandle.stat()` 确认它是普通文件。锁文件不会在释放时 unlink，内容不写 owner、PID、时间或权威状态。
3. 以单调时钟计算 5 秒期限；立即调用一次 `tryLock(fd)`，失败后按最多 50ms 的剩余间隔 sleep 并重试。达到期限后关闭句柄并返回 `LOCK_TIMEOUT`。不得调用不可取消的 `waitForLock()`，也不得通过 stale 时间抢锁。
4. 获锁后才调用 `read()` 取得最新索引。领域 transform、revision 单次递增和完整候选校验继续沿用现有 `mutate()` 主线；短锁只覆盖这次事务，不覆盖实际 task execution。
5. 所有退出路径都先尝试 `unlock(fd)`，再无条件尝试 `FileHandle.close()`。任一操作成功即已释放 OS 锁：`unlock` 失败但 close 成功，或 unlock 成功但 close 失败，都不改变原操作结果。两者都失败时，未提交路径保留原操作错误；已提交路径返回带 `phase: "lock-release"` 的 `WRITE_OUTCOME_UNKNOWN`，禁止调用方盲目重放。
6. 原生锁是 advisory；只有遵守 task-graph CLI 的写入者参与互斥。第一版只支持同主机本地文件系统，不对 NFS/SMB 或绕过工具的写入作一致性承诺。

### JSON 原子提交

1. `mutate()` 在锁内保存当前规范原文 `previousText`，将 transform 结果交给 `parseTaskIndex()`，验证 revision 恰好为当前值加一，再用 `serializeTaskIndex()` 得到唯一 `candidateText`。
2. `commit()` 对索引路径再次执行现有符号链接边界检查，然后只调用一次 `writeFileAtomic(indexPath, candidateText, { encoding: "utf8", fsync: true })`。不在 task-graph 外层重试，不再自行创建索引临时文件或执行目录 `fsync`。
3. 保留一个仅供内部测试注入的窄 `atomicWrite` hook，其签名与本次调用所需参数一致；删除 `replaceFile` 和所有 stale/release hooks。该 hook 不进入公开声明，不形成第二种生产 backend。
4. 原子调用成功后回读一次；只有原文与 `candidateText` 完全相等才返回成功。无法读取、解析失败或内容不等均返回 `WRITE_OUTCOME_UNKNOWN`。
5. 原子调用抛错后只回读一次且不再次提交：原文等于 `candidateText` 时按成功处理；原文等于 `previousText` 时返回 `WRITE_FAILED`；初始化时索引仍不存在等价于旧状态；其他内容或不可读状态返回 `WRITE_OUTCOME_UNKNOWN`。
6. `WRITE_OUTCOME_UNKNOWN` details 保留 `possibleRevision`、`observedRevision` 与 `indexPath`；调用方继续通过 info/check 和实体查询恢复。目录 `fsync` 与断电级 durability 不再宣称由本实现保证。

### `index init` 与 Git ignore

1. `index init` 是 mutation，先校验并加载 runtime。随后创建索引父目录，确认索引当前不存在；已存在时保持现有 `INDEX_EXISTS` 行为，不借 init 改写已有仓库文件。
2. 首次创建索引时，在创建锁文件前读取同目录 `.gitignore`。若文件不存在，写入 `# task-graph runtime artifacts` 与 `/task-graph-index.json.*`；若存在且没有完全相同的规则，则保留原文、原换行风格和原顺序，在末尾追加该注释与规则；已存在规则时不写文件。
3. `.gitignore` 更新使用原子写并在错误后回读规则。规则已经完整存在时继续；否则返回 `WRITE_FAILED`。失败时不得创建索引、锁文件或索引临时文件。规则成功但后续 init 失败时允许保留无害的 `.gitignore` 更新。
4. 两个并发 init 可以在锁文件创建前幂等写出相同 ignore 规则；随后由稳定原生锁串行化索引创建，一个成功，另一个在锁内重检后返回 `INDEX_EXISTS`。
5. `.gitignore` 是目标仓库可提交配置，但 CLI 不运行 Git，也不 stage 或 commit。本仓库实施时新增 `docs/task-graph/.gitignore`，并从根 `.gitignore` 删除旧的 lock directory、`.tmp-*` 与 quarantine 规则。

### 删除、保留与文件落点

| 文件 | 直接实施结果 |
| --- | --- |
| `tools/task-graph/src/runtime.ts` | 新增固定 runtime 契约、安装事务、状态查询、动态 addon 加载和真实探针 |
| `tools/task-graph/references/runtime/package*.json` | 新增可审阅、精确锁定的 npm 安装输入 |
| `tools/task-graph/src/store.ts` | 保留 read/check/init/mutate、路径边界、候选校验和结果分类；删除全部 owner/stale/generation/quarantine 代码，接入 native binding 与 `write-file-atomic` |
| `tools/task-graph/src/cli.ts` | 增加 runtime help 与 dispatch；在 mutation 前失败关闭，维持单 JSON 输出 |
| `tools/task-graph/src/types.ts`、`errors.ts` | 增加 runtime data/error，删除旧锁恢复错误并固定 retryable |
| `tools/task-graph/src/service.ts` | 只传递必要的内部 runtime/native/atomic 测试选项；不创建 runtime manager class |
| `tools/task-graph/api/task-graph.d.mts` | 同步公开 runtime data、错误联合和兼容性说明；不暴露内部 binding、installer hook 或 store hook |
| `scripts/build/task-graph.ts` | 同步两个 runtime 文本资产并证明 native 包未被 bundle |
| `tools/task-graph/tests/runtime.test.ts` | 新增 runtime 路径、状态、安装、并发发布、探针与错误协议测试，并由 `tests/run.ts` 导入 |
| `tools/task-graph/tests/store.test.ts` | 删除 stale/reclaimer/owner 算法测试；保留并改写 CAS、锁超时、崩溃释放和 old/candidate/unknown 提交测试 |
| `cli.test.ts`、`scope-repository.test.ts`、`generated-artifacts.test.ts` | 覆盖 runtime CLI、进程竞争、局部 ignore、无 Git 副作用、生成资产和 zip 无 `.node` |
| `skills/task-graph/` 与项目文档 | 同步显式安装流程、读取/写入能力边界、Node 兼容性、当前调查结论和独立版本 |

测试可以为 runtime installer、native binding 与 atomic writer 保留最小内部注入点，以便稳定覆盖失败阶段；这些类型不得进入 `TaskGraphServiceOptions`、生成声明或 skill 的公开契约。真实互斥与崩溃释放必须另用实际 `fs-native-extensions` 和子进程证明，不能只依赖 fake。

## Risks / Trade-offs

- 首次 mutation 增加 Node、npm、网络和用户 tool home 写权限前置。显式命令、精确 lockfile、禁用 lifecycle scripts、真实探针、结构化错误和安装后离线可用限制该风险；没有静默 fallback。
- `write-file-atomic@8.0.0` 收窄了生成 CLI 的 Node 兼容范围。Skill frontmatter、help、runtime check 和人类说明必须公布固定 engine，不能让旧 Node 到 mutation 时才得到不相关语法错误。
- Native addon 可能在某个平台或架构缺少可加载 prebuild。安装与 check 的真实探针是能力门禁；未通过的平台不被文档宣称为支持。
- `write-file-atomic` 会在既有目标上解析 realpath，路径检查与实际打开之间仍有竞争窗口。本 change 延续“非恶意本机路径”的威胁模型；若需要 no-follow 安全，应另立平台级设计。
- 原子库不执行父目录 `fsync`。本 change 接受普通进程崩溃一致性，不承诺突然断电后目录项持久性；未来若需要该级别保证，应重新评估 SQLite。
- 旧 runtime 按不可变 ID 留在用户目录，崩溃安装可能留下 `.install-*`。第一版接受少量磁盘累积，避免未经授权的自动删除与 GC 复杂度。

## Open Questions

无。默认目录、环境变量、精确依赖、Node 边界、runtime ID、命令输出、安装事务、锁 API、超时、提交分类、Git ignore、删除范围和验证出口均已固定，实施没有待决项。
