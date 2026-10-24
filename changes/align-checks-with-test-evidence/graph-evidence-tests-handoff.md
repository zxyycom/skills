# Task Graph / Test Evidence 测试整改交接

## 范围与结果

- 唯一写入 owner：`tools/task-graph/tests/**`、`tools/test-evidence/tests/**`，排除 `checks/*.ts` 与 `run.ts`；本 handoff 位于本 Change 内，结项时随 Change 清理。
- 未改产品源码、skill 分发物、Case/index、长期 docs、Gate wrapper/run、其它 owner 测试；未安装、生成、提交、推送或调用真实外部服务。沿用现有 leaf，无新增/删除 leaf；现有包 runner 已实际注册并执行全部后继节点。
- D-T1–D-T5 与 D-tests 全部调整候选按最终 review-tests 限定实施；多断言仅在具有独立失败责任时拆，不按断言数机械拆。没有为旧测试改变产品语义、canonical 硬门槛或添加新生产抽象。

## 证明责任与 Case 处理建议

1. **分发**：删除 SDK 私有声明文件名完整名单及固定 barrel export 拼写断言。保留实际公开 tsgo consumer（含拒绝私有导出/构造注入/字段的 `@ts-expect-error`）、全部当前声明的私有 API 泄漏扫描、相对引用可访问、生成头、schema bytes/Ajv。原混合入口拆成 API/version、声明 consumer、metadata、schema 四意图。原 Case 建议由 API/version 延续，其余拆 Case；不对 schema helper 内每个断言再拆。
2. **schema 与 graph**：原 strict-schema Case 保留，error.details 协议独立新 Case；原 cycles/dangling Case 保留，ancestor lineage 新 Case。serializer 同名 Case 保留，tasks 字典反向插入后验证排序，引用 alpha/zebra 乱序仍保留。8000 深链仍保留且比较完整 nearest-first lineage；Task Graph 层级无固定产品深度上限，此规模是既有栈回归样本，不声称 8000 为公开容量或本次已验证真实 Node 栈。shared relation-graph 的真实 Node 12000 深链不属本 owner，未改。
3. **lease**：原 lease-lifecycle 混装意图拆为 UUID 冲突、mutation precondition XOR、duration bounds、release、renew/expiry、expired recovery、active recovery refusal。每个节点从自己的健康合法初态开始，不把其它意图的断言藏在 setup；duration 60/86400、expiry 所有 lease-bound writes、recovery lease/revision/attempt 与 active lease 拒绝证据全部保留。建议原 Case 由 renew/expiry 延续，其它六意图新 Case。
4. **core stage**：selection-before-Git 与 pending-conflict 分别独立；原 Case 建议延续 selection，pending 另 Case。bootstrap、unchanged、missing selected IDs、empty target 四意图各独立；原混合 Case 建议由 bootstrap 延续，其它三个新 Case。pending/workspace bytes、Git HEAD baseline、selected overlay、outside pending 保护等真实边界不删除。
5. **Case 非法成员**：duplicate ID 的旧名与 Case 保留，仅承担 duplicate；unsupported filename、invalid UTF-8、catalog root unsupported member 各新节点/Case，分别从合法 fixture 改一个目标因素，核各自精确 diagnostic。
6. **名称收窄**：help discovery 不再称实际 batch remove；callRawCli 不再称 empty stderr；append 只证明 show index-stale revision drift；三个单故障不称 priority；revision 回退不称复数 watermarks；import 只承诺实际 stdout/stderr/home 范围而非全局零副作用。各原 Case 按意图连续保留并收窄 Proves，不新增生产机制测试。
7. **usage 降层**：TG 普通 extra positionals 从12000缩到两个（合法ID+extra），原协议 Case 保留。TE 四行 usage 矩阵迁到既有 source CLI；分发保留一个 unknown-option 真实 Node smoke，API limit0 单独保留。建议原 mixed Case 的 usage 意图以 source矩阵+Node smoke Tests 延续，API-invalid-options 单独 Case；不再为四行 Commander 错误各启动 Node。
8. **生命周期**：TE 支持文件采用仓库已有的 tool-local afterEach 模式；fixture/commitFixture 与 bare roots 在创建后立即登记，afterEach await rm。保留1001 Case分页、query上限1000、2MiB Case和稀疏64MiB snapshot；没有以资源上限名义缩水。native-store close Promise 在 spawn 后即注册；ready 有100次10ms上界，close 5s deadline，finally kill 并 await close、清 timer。未声称旧 kill/listener 顺序已复现正常路径竞态。
9. **D-T5**：portable-build 去掉不具实际有/无对照的 ambient optional peer fixture/marker，保留不同绝对路径临时checkout真实 build 与入口/声明/runtime逐字节比较，原 Case 收窄为路径可复现。自建临时制品无需新生成 provider。项目脚本 inode cache 节点不属此 owner：inode保持只证明文件未替换，Case owner 需撤回“零注册/零重复工作”，非本实现新增注册计数。
10. **分发树**：同名 tree/no-install-artifact Case 保留并补目录身份断言，空 `references/runtime`、`node_modules`、`npm-cache`、`.install-*` 目录不能靠仅遍历 files 逃过；不另造一套制品扫描框架。

## 实际验证与首次失败

所有命令均使用：`TMPDIR=/var/tmp`、`PATH=/home/dev/.local/share/mise/installs/bun/1.4.2/bin:/home/dev/.local/share/mise/installs/node/24.18.0/bin:$PATH`、`CI=true`。

- 首批 `bun test`：TG schema/graph/lease/help/failures/removal/staging-conflicts 38 pass；TE core+public 43 pass（stage额外拆分前）；分发9 pass；portable1 pass；`node --test tools/task-graph/tests/native-store.test.ts` 3 pass。TE 五类 core root before/after 新增残留 `[]`。
- 随后 stage/query 补精确 index-stale 与独立 selection/pending 后：18 pass；native 再3 pass。
- `node_modules/.bin/oxfmt --write <17 changed test files>` 成功。
- 首次 `node_modules/.bin/oxlint --type-aware <17 changed test files>` 发现拆分 stage unchanged 后残留未使用 `indexPath`；删除该局部未用变量后相同命令 **exit0**。没有规则豁免。
- 首次全包验证在 type-aware lint 与 E 的 Novel负载有重叠窗口：TG 95 pass/1 fail，SDK tsgo consumer 命中 Bun 默认5000ms timeout；同次portable 9825ms。TE 42 pass/2 fail，public sync 命中5000ms timeout，其后 Bun `killed 1 dangling process` 且上个异步callback收到null退出码的断言出现在后继节点结算。未把这些失败删掉、放宽断言或提高预算。并发资源争用是**候选解释**，没有测系统负载来闭合操作系统根因。
- 待 root/E 确认全部 runner/lint结算后，**独占且串行** `bun run test:task-graph-cli`：**96 Bun pass/0 fail + 3 Node native pass/0 fail**，Bun 8.98s；SDK1423ms（此前独立1352ms/并发5007ms timeout），portable2708ms（此前独立1839ms/并发9825ms）。
- 随后独占 `bun run test:test-evidence-cli`：**44 pass/0 fail**，9.73s；此前public sync超时节点此次1016ms。包入口包括全部1001分页/2MiB/64MiB/Git/Node分发边界。以 Python 对六类 `/var/tmp/test-evidence-{core,empty,search,resource,query,public}-*` 根做 before/after，**新增残留 `[]`**；只观察并未删除其它历史根。
- `bun test tools/task-graph/tests/lifecycle-lease.test.ts --test-name-pattern '^expired claim recovery rejects the wrong previous lease and preserves replacement attempt evidence$'`：最终收窄名称独立选择 **1 pass / 7 filtered / 0 fail**（77ms）。
- 两次独占通过支持争用候选，但不把重试通过替代首次失败解释；完整保留上述失败和观察。未调整产品或测试时间预算。

## 未验证及整合者后续

- 未执行全仓 `check:changed`、release Gate、Windows、全量 typecheck、Case sync/index/reference/coverage；由 root/Case/Gate owner 集中完成。目标 type-aware lint和真实 tsgo consumer已验证，不冒充全项目typecheck。
- 未做产品变异、native-ready失败故障注入、每个新增节点逐一 name-filter 运行；实际包runner已单独报告所有新增意图节点；recovery 名称在通过后进一步收窄为实际观察的 wrong previous lease / replacement attempt，随后以精确 name filter 独立选择并报告 1 pass / 7 filtered / 0 fail（77ms），最终实体ID以项目真实采集为准。没有复现 native child 泄漏或旧正常路径竞态。
- 以下 old/new ID 按项目 `sha256(JSON.stringify([file,name]))` 算法列出，并给旧 Case 路径帮助语义维护；它们不是替代最终 snapshot 的采集结果。原名保留节点的 ID 不变。Case 归属建议不代替 Case owner 的正式审查。

## 精确入口变更（old → new）

### `tools/task-graph/tests/cli-failures.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `CLI maps path failures to JSON exit one with empty stderr`
  - `test:f3600694876855f568e566464ab796057a157901ea178e998d61dcb7bb629f40`
  - 旧 Case：`docs/test-evidence/cases/task-graph-cli-path-001.md`

新节点：
- `CLI maps path failures to JSON exit one`
  - `test:4ffa68ba8f380643a83d7ae522ef98b9966104f0ad9c3e4eb153868e38a71747`

### `tools/task-graph/tests/generated-artifacts-distribution.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `generated distribution matches current source API, schema bytes, and metadata`
  - `test:8c3e7d65b49480978dd036c80ac0ed0489720cfeb441671986a89dec173ffc75`
  - 旧 Case：`docs/test-evidence/cases/task-graph-distribution-001.md`

新节点：
- `generated distribution exposes the source runtime API and matching CLI version`
  - `test:0bebe9087059f724355b3fe04631234d6359417d752862f47d8efad46b444aa6`
- `generated SDK declarations support public type consumers without leaking private APIs`
  - `test:cde71e33c8ea0892fe1e58d5a31370a9a655e18db34e3c3b1e2472f8b49821da`
- `generated runtime metadata identifies source and rebuild without local paths or debug artifacts`
  - `test:8ecd22aa5e7da34679a898faa9ac41eb39943e7b4792d0078485e49e3a611109`
- `distributed schema matches source bytes and validates consumer boundary values`
  - `test:71b0ee584a573c08d32d17eecb0234fb3e7d87f26c280fc1c63fbb45c434ebc4`

### `tools/task-graph/tests/generated-artifacts.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `generated module import is side-effect free in an empty tool home under supported Node`
  - `test:f8ed57a0d6895d9009559c4dac78fd84a8ead32970ea6e462df3cde1def63c68`
  - 旧 Case：`docs/test-evidence/cases/task-graph-distribution-import-001.md`

新节点：
- `generated module import keeps stdout and stderr empty without creating the tool home under supported Node`
  - `test:1ba5c204dde11245a176f012dcf53b4abc194c9de218f245a9ca676fe3077552`

### `tools/task-graph/tests/graph-projection.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- 无删除名称；新增意图从同文件旧混装节点中分离，原节点继续保留。

新节点：
- `ancestor traversal returns the complete nearest-first lineage for an 8000-level chain`
  - `test:4b4b27a02a78e47e4f984022c1f345e3e28e94bb7d4b3940500bdd10f7e8b5b4`

### `tools/task-graph/tests/lifecycle-lease.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `lease lifecycle enforces duration, renewal, expiry, and explicit claim recovery`
  - `test:8a14afbf9656634900e6000381787055a4cc65b588a007bddd6525301575233e`
  - 旧 Case：`docs/test-evidence/cases/task-graph-lease-001.md`

新节点：
- `claim rejects duplicate lease UUIDs without changing the existing claim`
  - `test:65aa58944ed029447f353aaa43804f4b06816250fc4c31a94440205bb6469765`
- `complete and cancel require exactly one mutation precondition`
  - `test:d4553d81144e782235b88dc5da33b1b9c4d8a9a6be3436f3e2013f5af2b9e0e9`
- `claim accepts inclusive lease duration bounds and rejects values outside them`
  - `test:3a0c19089bda176fea348b4c099f74cfe28b8a4d2145ad09c1af3876818757b5`
- `release clears the matching active lease and applies validated local control`
  - `test:873f207e550365893a63f43176c298b0f64db164cf9d812beb0540afbf54adfc`
- `renewal updates expiry and expired leases reject every lease-bound write`
  - `test:82af19bdc6cc31c52ad1875ecb00d6d469be1de8cc6c1692a76a50c7e6ae8115`
- `expired claim recovery rejects the wrong previous lease and preserves replacement attempt evidence`
  - `test:21a484de21f65c3f12c39d4fe278d4e486025cd6a9c5da06b8fe31431639c052`
- `claim recovery cannot replace an unexpired active lease`
  - `test:34174629b1c6427b37b20fe1b3823d11c0961d657c57cc8b733141e94597f684`

### `tools/task-graph/tests/portable-build.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `generated task graph artifacts ignore checkout path and ambient optional peers`
  - `test:af7a2e17efcbdcea706fcf2e566475847a5b3bbdc48ef68c31c5ed41b35f2c29`
  - 旧 Case：`docs/test-evidence/cases/task-graph-distribution-004.md`

新节点：
- `generated task graph artifact bytes are reproducible across checkout paths`
  - `test:1e7b3db48fec225e1222ad5ca91bdaa58ff1c7ee087bf3ab08715b2d5abdb4fd`

### `tools/task-graph/tests/schema-index.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- 无删除名称；新增意图从同文件旧混装节点中分离，原节点继续保留。

新节点：
- `task graph error details preserve boolean JSON values in a prototype-free record`
  - `test:1c0dadd6cdb74511c7f493f8c85ff005eddd28b1448daddbd28d7bee66f7ccba`

### `tools/task-graph/tests/staging-conflicts.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `rejects regressing workspace watermarks without changing pending content`
  - `test:fbdb718fe87ca3e42bade88a8aba1cffd5a046f735bc15c6124492197a8cb5fe`
  - 旧 Case：`docs/test-evidence/cases/task-graph-stage-watermark-conflict-001.md`

新节点：
- `rejects a regressing workspace revision without changing pending content`
  - `test:cbdee5c1661865c13c9641651beb6ec3acca4e53fad29ca4c644ca12beb91d35`

### `tools/task-graph/tests/task-removal.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `CLI exposes batch task removal and no scope command`
  - `test:7bebdb3e86affc30555abd398f88344c812493207e26c104503aa96111b406af`
  - 旧 Case：`docs/test-evidence/cases/task-graph-cli-cleanup-001.md`

新节点：
- `CLI help discovers task removal and rejects the removed scope command`
  - `test:5e7c0ed60613ba35c65748a1e5b2a9c4afafd244f31c4c701978541b4f4e8ec3`

### `tools/test-evidence/tests/core-cli-search.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `snapshot failure priorities reject malformed input, source mismatch, and unknown selection`
  - `test:66d35d8fc37a3b36db5726792d11eda84023c2c0da21adcdc51adc8e28bfb186`
  - 旧 Case：`docs/test-evidence/cases/test-evidence-snapshot-inputs-001.md`、`docs/test-evidence/cases/test-evidence-ledger-schema-strict-001.md`、`docs/test-evidence/cases/test-evidence-ledger-entity-schema-001.md`

新节点：
- `snapshot validation reports malformed input, source mismatch, and unknown selection`
  - `test:44e497b1c1b311e49165d61a7bfe5126dc8b881867f5d4ab6b0837eed3b78968`
- `source CLI rejects unknown, missing, repeated, and malformed usage through stderr`
  - `test:eacb4bb4481a47eb9cef84ec267eaa21e77230f2cd9626ce716f0c96f88b6f51`

### `tools/test-evidence/tests/core-query.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `show detects source replacement and search reads authoritative Case text`
  - `test:25033a05ccf872e620f16c36b6c54dbe64f2ecc4379e4228484dbb8558c7b4e9`
  - 旧 Case：`docs/test-evidence/cases/test-evidence-core-show-001.md`、`docs/test-evidence/cases/test-evidence-ledger-api-show-001.md`

新节点：
- `show rejects Case revision drift after an in-place append`
  - `test:4b1dc4fdfd3d91f5b91b0df6fbb4ef1d85458acb4eb8e731ec3b0ba188d5c1e3`
- `Case validation rejects unsupported Case filenames`
  - `test:fa8afa78a560b5352b74d2d3648e74f3dc23baf2e5cbb73397e6b8ac7e7713a1`
- `Case validation reports an unreadable UTF-8 Case source`
  - `test:fcc028ba4ac7d337bd4123e98601400267708e58f9faaaeef6bad7a38181bab7`
- `Case validation rejects unsupported catalog root members`
  - `test:6d089a966c5e9f9c493f872ccbd21349ddc50c0e5770bbe1c711c2db4d9e26d0`

### `tools/test-evidence/tests/core-stage.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `stage validates selection before Git and preserves an existing pending index`
  - `test:f3b1110c73debadbd2d84ffd038d1ab62f42bde9b514c6257d16d2c87abd0fa5`
  - 旧 Case：`docs/test-evidence/cases/test-evidence-stage-repository-001.md`、`docs/test-evidence/cases/test-evidence-stage-conflict-001.md`、`docs/test-evidence/cases/test-evidence-stage-input-001.md`
- `stage supports bootstrap, unchanged selections, missing IDs, and an empty target`
  - `test:e7e84d2636a2ad9742ff612fbf3e712eb8ddd2956926c85f55fb408078c1f583`
  - 旧 Case：`docs/test-evidence/cases/test-evidence-stage-empty-001.md`、`docs/test-evidence/cases/test-evidence-stage-missing-001.md`、`docs/test-evidence/cases/test-evidence-stage-bootstrap-001.md`、`docs/test-evidence/cases/test-evidence-stage-unchanged-001.md`

新节点：
- `stage validates selection before consulting Git or creating an index`
  - `test:66653188816321ebabc8b845da4b0def39c3b6e4ca897b37164fbf44106b0eac`
- `stage preserves an existing conflicting pending index`
  - `test:03665cf20e92fb6f3d3046ad07343fc7c5c6ff142491a34b29db0507c1c54f1d`
- `stage bootstraps a missing HEAD index with only selected Cases`
  - `test:42ea02a5d05acdedec5d637aadfa7e5813f1fe700e3c5c1028e584af21049489`
- `stage reports unchanged selection without modifying the Git index`
  - `test:b874f6e47971bf0e4a401f6f35a72cd180ad2c69e36af69bd3c5486345ad7a68`
- `stage rejects missing selected Case IDs without changing working or pending bytes`
  - `test:05afecfd3b3eb8578b346c488252b43085c19c63dd4b287a48e5dc86ab047589`
- `stage removes all selected Cases from the Git index when the catalog becomes empty`
  - `test:3fa6c46a0e760f773083b335c253d49ccc4917cae627074824214bd2bbe46a0e`

### `tools/test-evidence/tests/public-boundary.test.ts`

旧节点（重命名/拆分，后继为下列新节点；同名保留节点见证明责任）：
- `distributed TS imports in Node without side effects and exposes only the current public API`
  - `test:51b392c2f95b0c5d2ac92fe8e12ff4ce047023212c58da5394a8f99f0650c1ad`
  - 旧 Case：`docs/test-evidence/cases/test-evidence-ledger-cli-node-smoke-001.md`、`docs/test-evidence/cases/test-evidence-distributed-cli-001.md`
- `public CLI usage errors and API invalid options retain separate structured failures`
  - `test:e9a1ab88fdf23ef343e1b640ea22d320690ea69e6256035033dc358ac865aaef`
  - 旧 Case：`docs/test-evidence/cases/test-evidence-ledger-cli-args-001.md`、`docs/test-evidence/cases/test-evidence-ledger-api-options-001.md`

新节点：
- `distributed TS imports in Node without running CLI output and exposes the current public API`
  - `test:b1e01a7911c501a975edad8a983f443526e5bb5b7bec2551ae16521f19381a2c`
- `distributed Node CLI writes usage failures only to stderr with exit two`
  - `test:6046b9f35c3490d6a013f060ea8254aaf760ff4333a89adf7393ebeeefe70b84`
- `public query API returns schema-valid diagnostics for invalid options`
  - `test:50016a4b60a971fbf0dbab619bec2f78062b328c0541e785743ff60da23ff032`
