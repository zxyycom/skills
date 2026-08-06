# Tasks

本清单按“锁定文本输入与依赖 → runtime → 存储事务 → CLI 与分发 → 文档和证据 → 完整验证”排序。0.1–0.4 记录已完成的实施前审计；其余任务只在产物与对应验证实际完成后勾选。

## Readiness

- [x] 0.1 已核对 proposal、design 和 tasks：三者只改变 task-graph 的 runtime 与短事务存储层，权威 JSON、领域 schema、执行租约、默认 `~/.tools/task-graph`、`TASK_GRAPH_TOOL_HOME` 和局部 `.gitignore` 目标一致。
- [x] 0.2 已确认 `use-native-locks-for-json-transactions` 与 `install-native-runtime-in-user-tool-home` 均为 `active + unaligned`；既有权威 JSON、显式拓扑和事务 claim 决策继续适用，design 没有开放问题。
- [x] 0.3 已按正式 npm/GitHub 版本核验 `fs-native-extensions@1.5.0` 的 `tryLock`/`unlock` 与 Apache-2.0、`write-file-atomic@8.0.0` 的异步 API、默认文件 `fsync`、ISC 和 Node engine，并据此固定轮询、兼容性与分发边界。
- [x] 0.4 已对照当前 `store.ts`、CLI、生成器、公开声明、测试入口、Git ignore、tooling、调查与测试证据建立文件级实施矩阵；没有需要实现者临场选择的 owner 或第二方案。

## Implementation

- [ ] 1.1 运行 `pnpm add --save-dev --save-exact fs-native-extensions@1.5.0 write-file-atomic@8.0.0 @types/write-file-atomic@4.0.3`，更新根 `package.json` 与 `pnpm-lock.yaml`；确认安装不会运行本项目新增的 native lifecycle script，也不会产生 tracked 二进制。
- [ ] 1.2 新建 `tools/task-graph/references/runtime/package.json`，只精确依赖 `fs-native-extensions@1.5.0`；在该目录运行 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` 生成 lockfile v3，检查根依赖、resolved、integrity 和传递依赖后提交两个文本文件。
- [ ] 1.3 新建 `tools/task-graph/src/runtime.ts`，实现固定 Node engine 校验、文本资产定位、lockfile 语义摘要、`v1-<sha256>` runtime ID、默认 tool home、非空 `TASK_GRAPH_TOOL_HOME` 覆盖、runtime 路径和只读 `missing|installed|invalid` 状态投影。
- [ ] 1.4 在 `runtime.ts` 实现动态 `createRequire(runtime/package.json)` 加载、`tryLock`/`unlock` API 收窄和 OS 临时文件真实探针；只从目标 runtime 解析，不回退根依赖、全局依赖或其他 runtime ID。
- [ ] 1.5 在 `runtime.ts` 实现 300 秒有界的 `runtime install`：唯一临时目录、精确文本输入、非 Windows 直接 spawn `npm`、Windows 直接 spawn `cmd.exe` 并固定 `/d /s /c npm.cmd` 前缀、固定 `npm ci` 参数、8 KiB 凭据清理后输出尾部、真实探针、规范 `runtime.json` 与同目录 rename 发布。
- [ ] 1.6 让重复安装在既有 runtime 通过 marker 与探针后返回 `reused`；让并发安装在发布竞争后验证最终目录并收敛；既有无效目录返回 `RUNTIME_INCOMPATIBLE`，不自动覆盖、删除或建立 bootstrap 锁。
- [ ] 1.7 在 `types.ts` 与 `errors.ts` 增加 runtime state/data 和四个固定 runtime error，按 design 固定 retryable 与 details；删除 `LOCK_RECOVERY_REQUIRED`、`LOCK_LOST` 及其 retryable 映射。
- [ ] 1.8 在 `cli.ts` 的 help catalog 与 dispatch 中增加无参数 `runtime info|install|check`，维持一个 LF JSON envelope、预期失败退出 1 和空 stderr；明确只读命令不加载 runtime，所有 mutation 在工作区副作用前失败关闭。
- [ ] 1.9 在 `store.ts` 以稳定普通锁文件、`fs.open("a+")`、普通文件 stat、`tryLock()` 单调时钟轮询、5 秒期限和 finally 中 unlock/close 替换锁目录；保留最小内部 native binding 注入，不公开 provider 抽象。
- [ ] 1.10 从 `store.ts`、service 内部 options 和测试 helper 删除 hostname、PID、process state、owner metadata、heartbeat、generation、reclaimer、quarantine、stale recovery、storage UUID 及其专属 hooks、常量和错误；确认锁文件释放后不 unlink。
- [ ] 1.11 在 `store.ts` 用 `writeFileAtomic(indexPath, candidateText, { encoding: "utf8", fsync: true })` 替换自研临时写入、rename 和目录 `fsync`；每个目标只调用一次，并保留一个不进入公开 API 的 `atomicWrite` 故障注入点。
- [ ] 1.12 把 commit 回读改为完整原文分类：候选原文视为成功、完整 previousText 或 init 时仍缺失视为 `WRITE_FAILED`、其他或不可读视为 `WRITE_OUTCOME_UNKNOWN`；成功返回前也核对完整候选原文。
- [ ] 1.13 调整 `index init` 顺序：先校验 runtime 和索引不存在，再在锁文件创建前幂等维护索引目录 `.gitignore`；保留已有字节、换行风格和规则顺序，写入或回读失败时不创建索引 runtime artifact，并在锁内重检并发创建。
- [ ] 1.14 新增本仓库 `docs/task-graph/.gitignore`，内容覆盖 `/task-graph-index.json.*`；从根 `.gitignore` 删除旧 lock directory、`.tmp-*` 与 quarantine 规则，确认索引仍可跟踪且锁文件与 atomic temp 被忽略。
- [ ] 1.15 更新 `TaskGraphService` 的内部组装，仅传递 runtime/native/atomic 测试所需的窄 options；`TaskGraphServiceOptions` 公开面继续只包含 `clock|indexPath|root`，不增加通用 runtime manager 或 storage backend。
- [ ] 1.16 更新 `tools/task-graph/api/task-graph.d.mts` 的 runtime data、错误联合、Node 兼容说明和 CLI 结果类型；确保内部 binding、安装 runner、store hooks、tool-home 测试覆盖和第三方类型不进入公开声明。
- [ ] 1.17 更新 `scripts/build/task-graph.ts`，把 runtime `package.json` 与 `package-lock.json` 纳入生成检查并同步到 `skills/task-graph/references/runtime/`；重新生成 CLI、声明、source map 与 Schema，证明 native 包保持外部动态加载而 `write-file-atomic` 已内联。
- [ ] 1.18 新增 `tools/task-graph/tests/runtime.test.ts` 并从 `tests/run.ts` 导入，覆盖默认/环境目录、稳定 ID、info 无副作用、Node 不支持、缺失/无效/兼容 runtime、npm 失败与超时、输出清理、重复安装、并发发布和真实探针。
- [ ] 1.19 重写 `store.test.ts` 的存储边界：保留 CAS 与完整候选校验，删除 stale/reclaimer/owner 内部算法 cases，新增真实 native 互斥、活跃持有者超时、持锁子进程退出后释放、finally 关闭句柄和单次 atomic write 的 old/candidate/unknown 分类。
- [ ] 1.20 更新 `cli.test.ts`、`scope-repository.test.ts` 与 `generated-artifacts.test.ts`：覆盖 runtime JSON 命令、mutation 缺 runtime 不写工作区、进程级竞争、init 局部 ignore、无 Git stage/commit、runtime 文本生成一致性、import-safe 和 tracked/zip 无 `.node`。
- [ ] 1.21 更新 `skills/task-graph/SKILL.md` 与 `docs/skills/task-graph.md`：在首次 mutation 前引导 `runtime info`/`install`/`check`，说明 Node engine、tool home 覆盖、显式网络副作用、稳定锁文件、失败恢复和不再存在 stale owner 手工恢复；提高 skill 独立版本。
- [ ] 1.22 更新 `docs/tooling.md` 和必要构建说明，把 task-graph 描述为“包内自包含 ESM 加由同一 skill 显式安装的 native runtime 扩展”，并保持通用 skill updater、其他工具和仓库分发边界不变。
- [ ] 1.23 在 `file-lock-and-atomic-write-libraries.md` 追加新的最新调查结论：旧“不采用”只适用于 owner/stale recovery 硬约束；当前约束变化后采用 `fs-native-extensions@1.5.0` 与 `write-file-atomic@8.0.0`，保留 advisory、Node engine、realpath、目录 fsync 和探针边界，再同步调查索引。
- [ ] 1.24 按实际删除、改名和新增的每个最小 `test()` 入口更新 `docs/test-evidence/task-graph/`，移除旧 recovery 算法 case、增加 runtime/native/atomic/Git ignore case，并同步 `test-evidence-index.json`。

## Verification

- [ ] 2.1 运行 runtime 文本资产与生成检查，证明源/skill 两份 manifest 和 lockfile 字节一致、runtime ID 在 CRLF/LF checkout 下相同、npm lock 根依赖精确且 `runtime install` 只消费分发文本。
- [ ] 2.2 在隔离 `TASK_GRAPH_TOOL_HOME` 下验证 `runtime info|install|check` 的 missing、installed、invalid、unsupported、install-failed 与 incompatible 状态，以及 install 的 installed/reused 动作；确认每次只有一个 LF JSON、stderr 为空且普通命令没有网络或文件副作用。
- [ ] 2.3 使用真实子进程与 `fs-native-extensions` 验证两个 mutation 串行化、排斥 claim 只有一个赢家、活跃持有者达到 5 秒返回 `LOCK_TIMEOUT`、被终止持有者的 OS 锁自动释放且稳定 lock 文件不被删除。
- [ ] 2.4 注入 atomic writer 各失败阶段，验证提交调用计数恒为一次；完整旧原文、完整候选原文、不同/损坏原文和回读失败分别得到 `WRITE_FAILED`、成功、`WRITE_OUTCOME_UNKNOWN`、`WRITE_OUTCOME_UNKNOWN`，且调用方不会自动重放。
- [ ] 2.5 在临时 Git 仓库验证首次 init 创建或扩展局部 `.gitignore`、保留已有规则与换行、索引可跟踪、锁及 atomic temp 被忽略、Git HEAD 与 index 不被 CLI 修改；ignore 写入失败时没有索引或 runtime artifact。
- [ ] 2.6 验证 Node engine 边界、addon 实际加载和探针在当前受测平台成立；未受测平台只依靠 `runtime check` 失败关闭，不在 skill 文档中外推为已验证支持。
- [ ] 2.7 验证模块导入、help、version 与全部只读命令在空 tool home 下成功；验证生成 ESM 从隔离 runtime 路径加载 addon，安装完成后断网仍能 mutation，且不会回退根 `node_modules`。
- [ ] 2.8 检查 Git tracked files、`skills/task-graph/`、skill hash 和最终 zip：不得出现 `.node`、用户 runtime、npm cache 或 `.install-*`，必须包含两个精确 runtime 文本资产、更新后的 CLI、声明、source map、Schema 和 updater。
- [ ] 2.9 运行 `bun run test:task-graph-cli`、`bun run sync:task-graph-cli` 后的无漂移检查、`check:test-evidence-catalog`、`check:investigations`、`check:decisions`、`validate`、`typecheck`、`hash:skills`、`pack:skills` 与 `bun run check --full`，记录全部实际结果。
- [ ] 2.10 对照 proposal 的每条 Success Criteria 审计最终源码、skill、生成制品和文档；全部成为当前事实后，把两条 task-graph 决策标记为 aligned，并在获得明确授权后单独归档本 change。
