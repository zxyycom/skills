# Proposal

本 proposal 只承接该 change 的实施计划：保持 task-graph 的权威 JSON、领域状态和 CLI 结果协议不变，只把自研锁恢复与原子提交替换为原生文件锁、成熟原子写库和显式安装的用户级 runtime。

## Why

当前 `tools/task-graph/src/store.ts` 同时承担 JSON 事务和一套自研锁恢复协议。后者包含锁目录、owner metadata、heartbeat、进程存活探测、generation、reclaimer、quarantine 与 ABA 防护；相应代码和测试量很大，但不会增加用户可观察的 task-graph 能力。

Task graph 的短事务只需要在同一主机的本地文件系统上串行化协作写入。现在已经确认可以使用 native addon，也接受用户在首次 mutation 前显式安装 runtime，因此可以让操作系统文件锁拥有进程崩溃后的释放责任，让 `write-file-atomic` 拥有临时写入、文件 `fsync` 和原子替换责任。Task-graph 仍负责获锁后重读、完整校验、revision CAS、领域变换和写入结果核验。

## Outcome

完成后，`docs/task-graph/task-graph-index.json` 继续是唯一权威状态，现有 schema、任务拓扑、状态机、执行租约和 JSON-only CLI 保持兼容。所有 mutation 通过一个长期存在的 `task-graph-index.json.lock` 普通文件取得原生排他锁，再以 `write-file-atomic@8.0.0` 提交规范 JSON；进程退出或文件句柄关闭后由操作系统释放锁，不再存在陈旧锁恢复协议。

Task-graph skill 不携带 `.node`。用户显式运行 `runtime install`，把锁定的 `fs-native-extensions@1.5.0` 安装到默认 `~/.tools/task-graph/runtimes/<runtime-id>/`；非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖默认 tool home。`index init` 在创建索引前维护目标仓库的 `docs/task-graph/.gitignore`，使锁文件和原子写临时文件默认不进入 Git。

## Scope

纳入范围：

- 增加 `runtime info`、`runtime install`、`runtime check` 三个 JSON-only 命令，以及确定性的 runtime 路径、状态、安装和错误契约。
- 在 skill 中分发文本形式的精确 npm manifest 与 lockfile；runtime 安装显式联网，普通命令、模块导入和 skill updater 不联网。
- 用 `fs-native-extensions.tryLock()` 的有界轮询和稳定旁路文件替换锁目录及全部陈旧锁恢复代码。
- 用内联到生成 ESM 的 `write-file-atomic@8.0.0` 替换自研临时写入和 rename，同时保留单次提交与旧版本、候选版本、未知结果的回读分类。
- 让 `index init` 幂等维护目标 `docs/task-graph/.gitignore` 中的 `/task-graph-index.json.*`，并把本仓库现有根级 task-graph ignore 规则迁移到该局部 owner。
- 更新源码、公开声明、skill、生成产物、构建输入、调查结论、测试证据和版本，并删除只证明旧锁恢复算法的实现与证据。

不纳入范围：

- 改用 SQLite、后台服务、跨设备同步、跨主机协调或网络文件系统。
- 修改 task index schema、任务状态、父子、依赖、排斥、执行租约或 scope 生命周期。
- 建立通用 storage backend、lock provider、runtime manager、按平台 release artifact 或第二套锁实现。
- 在 Git、Git LFS 或 skill zip 中保存 `.node`，让普通命令静默下载，或由 updater 自动安装、修复、升级或清理用户 runtime。
- 承诺本机恶意路径替换防护或突然断电后的目录级持久性。

## Success Criteria

- Task index schema 与全部领域事务测试保持通过；只替换存储和 runtime 边界，不增加数据迁移。
- 默认 tool home 精确为 `path.join(os.homedir(), ".tools", "task-graph")`，非空 `TASK_GRAPH_TOOL_HOME` 可确定性覆盖，runtime ID 与锁定 npm 清单确定性绑定。
- 在固定 Node 兼容范围和干净 tool home 中，模块导入、help、version 和所有只读命令仍可运行；任何 mutation 在触碰工作区前返回 `RUNTIME_MISSING`，且普通命令不会联网或隐式安装。
- `runtime install` 使用精确 lockfile、`npm ci --ignore-scripts --omit=dev --no-audit --no-fund`、唯一临时目录、真实 lock/unlock 探针和同目录原子发布；重复及并发安装收敛到同一 runtime ID。
- `runtime check` 只把能够从目标 runtime 路径加载并通过真实 lock/unlock 探针的安装报告为兼容；无静默 fallback。
- `index init` 在首次索引创建前确保局部 `.gitignore` 含 `/task-graph-index.json.*`，保留已有内容；规则写入失败时不创建索引、锁文件或索引临时文件。
- 每次 mutation 都在原生排他锁内重读最新索引、完整校验、执行领域变换并只调用一次原子提交；并发 claim、排斥和 revision CAS 保持现有结果。
- 活跃持锁者只造成最长 5 秒的 `LOCK_TIMEOUT`；持锁进程退出后下一进程无需 owner metadata 或 stale recovery 即可取得锁。
- 原子写失败后，完整候选按成功处理，完整旧版本返回 `WRITE_FAILED`，其他或不可读状态返回 `WRITE_OUTCOME_UNKNOWN`；提交调用不会盲目重试。
- `tools/task-graph/src/store.ts` 不再包含 owner、PID、heartbeat、generation、reclaimer、quarantine 或 stale recovery；没有用 adapter 层重新包装同等复杂度。
- Git tracked files、生成 skill 目录和打包 zip 均不包含 `.node`；skill 内 runtime `package.json` 与 lockfile、公开声明、source map 和生成 CLI 保持同步。
- Task-graph 测试、生成检查、决策与调查检查、测试证据检查、类型检查、skill 校验、hash 和 `bun run check --full` 全部通过。

## Affected Owners

- `tools/task-graph/src/runtime.ts`（新增）拥有 tool home、runtime ID、安装、状态检查、native addon 加载和探针。
- `tools/task-graph/src/store.ts` 拥有稳定旁路锁、短事务和原子提交结果分类。
- `tools/task-graph/src/cli.ts`、`types.ts`、`errors.ts`、`service.ts` 与 `tools/task-graph/api/task-graph.d.mts` 拥有命令、类型、错误和公开契约。
- `tools/task-graph/references/runtime/`（新增）拥有精确 npm `package.json` 与 `package-lock.json`；`scripts/build/task-graph.ts` 负责同步到 `skills/task-graph/references/runtime/`。
- `skills/task-graph/` 拥有 agent 行为入口、生成 CLI、公开声明、Schema、runtime 文本资产、source map、updater 与独立版本。
- `docs/task-graph/.gitignore` 是本仓库 task-graph runtime artifact 的局部 ignore owner；根 `.gitignore` 不再重复这些规则。
- `docs/tooling.md` 和根 `package.json`、`pnpm-lock.yaml` 拥有构建依赖与“自包含 ESM 加显式 native runtime”这一 task-graph 分发例外。
- `docs/investigations/task-graph/file-lock-and-atomic-write-libraries.md` 记录约束变化后的当前库判断；两条 active task-graph 决策继续拥有长期方向。
- `tools/task-graph/tests/` 与 `docs/test-evidence/task-graph/` 分别拥有测试实现和一 case 一文件的证据账本。
