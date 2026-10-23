# 批次 0–3 实现交接

本文件保存批次 0–3 checkpoint 的实现、审查修复与执行证据，不是当前源码清单或最终验收报告。总进度只见 [tasks](tasks.md)，后续实现与三项独立正确性闭合见[批次 4–6 交接](stage-4-6-handoff.md)，性能与最终配对从[证据入口](evidence/README.md)恢复。

## 本阶段接入点

以下记录本阶段的接入责任与接口。当前维护先读[共同操作 owner](../../tools/record-operations/README.md)及其链接的两域适配与 Index Runtime；后续责任拆分不要求保留本 checkpoint 的私有文件布局。

- `tools/record-operations/src/synchronize.ts`：`synchronizeRecordIndex` 拥有完整领域 scan/snapshot 交接后的 selected baseline、selector、一次原生构建和最终同步顺序；DR `decision-query-sync.ts` 与 IR `validation-sync-flow.ts` 只提供领域事实和 DTO/诊断映射。完整来源、未选保护、baseline metadata/revision 与独立 final fresh 没有削减。
- `query.ts`：`loadRecordQuery` 拥有严格 reader、领域投影、实际关系依赖证明顺序；`recordGraphProof` 为同一发布投影惰性验一次完整图；`collectRecordMetadataWindow` 精确全计数、只为窗口建立 DTO；`showPublishedRecord` 拥有 canonical location、选择、同字节安全读取与 fingerprint 比较。无关系发现不附加全图/全域资源 owner 门槛；raw 外部 parse/load/query 的严格结构与字段门槛保留。
- `source.ts`：canonical workspace/collection 包含边界、安全同 handle 全文、全部 source 父目录/文件 inode、字节读取稳定、严格 UTF-8 与同字节 ID。show 不套搜索预算；UTF-8 BOM 与尾随正文都保留。IR 的 header ID 提取在领域适配中忽略 BOM，不改变返回原文。
- `candidate.ts`：`prepareRecordCandidates` 拥有合法发布索引/真缺索引/坏索引分类、安全可见身份映射；`readRecordCandidates` 拥有所选准备、list invalid warning/skip 与显式目标失败；`createRecordCandidate` 拥有发现→输入解析→冲突→分配→写入/readiness。两域独有字段、日期/formedAt、资源 owner、直接依赖和返回 DTO 留在适配器。
- `tools/index-runtime/src/prepared.ts` 是窄内部直接 import 接口，不加入 `index.ts` 公共导出：`prepareStateIndex`、`prepareStateIndexFromSnapshot`、`loadPreparedStateIndex`、`prepareSelectedStateIndexBaseline`、`syncStateIndexPrepared`。opaque proof 绑定 definition 引用及冻结定义、root/path 与 index 对象；selected baseline 另绑定安全读取的真实 bytes，并防御性复制。同阶段 reader 使用严格解析/构建时一次物化的字段；raw 入口不能注入 proof，最终 fresh 不消费旧事实。安全 baseline 读取由 `prepared-baseline-source.ts` 承接，变化接纳与 scope 由 `selection.ts` 承接。

## 本切面结果与退役

- IR trace 在缺 target/非法完整领域图上失败，不再跳过缺失成员伪成功；合法 trace/context 互斥且并集正好等于 entries。
- IR new 已建立文件而解锁失败时，API/CLI 非零但保留真实 candidate/ID/sourcePath/changed，CLI 不输出成功 review。
- G1/G5 正式查询与完整安全 show、G3 候选边界已接入共同流程；未来完整 target ID 只验语法，name 按动作范围唯一。真缺索引 header 仅保证身份/不覆盖，不冒充发布事实；坏/不兼容索引必须显式恢复，publish 最终闭合保持。
- 删除 DR `decision-query-source.ts`、IR `validation-sync-selectors.ts` 及两域旧 selected 准备副本；删除无消费者的 candidate selector、show/stale 读取 helper、旧 reader-from-snapshot helper。每域分发退役文件由公开 sync 自动清除。
- 现有 stage 协调器、两域 CLI/DTO/持久格式和领域生命周期仍独立；未引入跨调用缓存、注册框架或通用事务管线。

## 本阶段同步

- 稳定 owner：关系输入、DR 查询快照与候选生命周期决策；两域规则、操作/恢复契约、help、工具 README；项目 navigation/tooling；共同操作 README。
- Index Runtime 实际消费者有四个：DR、IR、novel-cards、test-evidence-review。后二者只同步生成闭包及独立版本，不修改行为源码。
- 独立版本：DR 90、IR 79、novel-cards 11、test-evidence-review 43。DR 因共同 query 真实使用 neverthrow，按公开生成入口声明依赖并用 `pnpm --dir skills/decision-records install --ignore-workspace --lockfile-only --config.node-linker=isolated --offline` 刷新 lock；没有下载。
- 本阶段 Gate 已识别新 owner 的 src/tests 真实消费关系；两域新原生 candidate/discovery/result-integrity 测试进入各自现有最小检查容器。后续新增输入仍须按实际消费者补齐归属。
- 原生 TestID 随 prepared 测试职责拆文件同步对应 Case；Case 只保存真实测试能证明的当前 Contract/Proves，派生 JSON 由公开 CLI 生成。

## 已执行自验证

- 本阶段稳定 checkpoint 上重新执行 `bun run typecheck`：通过。
- `bun run test:index-runtime`：81 pass。
- `bun run test:decision-records-cli`：322 pass（含审查后新增回归）。
- `bun run test:investigation-report-check`：329 pass（含审查后新增回归）。
- `node --test`：两域 discovery、IR 两纠错共 4 pass；两域候选共同契约另 2 pass，覆盖真实 Node 原生运行时。
- `bun test scripts/lib/vibe-gate/impact-input-ownership.test.ts`：2 pass；共同 owner 与新候选原生入口 incremental、真实消费者执行/无关复用及 warm 零新增激活。
- 两域新 discovery 契约覆盖无关系坏图可用、关系完整门禁、API/CLI >2MiB 全文、BOM、非法 UTF-8、source symlink、inode 替换、同文件 inode/bytes 但父目录替换和 workspace canonical 越界。完整聚合入口已包含新 candidate、result-integrity 契约。
- 首次完整 `bun run check:changed`：58 passed / 3 failed / 3 N/A；原生/实际分发检查通过，失败是 Case 同步期间读取中间态、文件和函数 metrics。Case 已独立检查通过；metrics 按真实职责整改，不加入例外。整改后已完成下一项完整 Gate。
- `sync:*` / `check:*` 已覆盖上述四个实际生成闭包及 skill-updaters；`sync:test-evidence-catalog`、`check:test-evidence-catalog` 通过 1378 entities。全部源码稳定后已经串行重跑四闭包生成、Case sync/check、typecheck 和三套完整原生，均再次通过；该稳定输入已通过完整 Gate。

四 consumer 另在仓库外各自复制仅 `scripts/`、`package.json`、`pnpm-lock.yaml`，执行 `pnpm install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated --offline --ignore-scripts`：四者独立安装、Node `--help` 和实际 query 全通过。DR/IR/test-evidence 对仓库发布快照只读 list limit=1；novel-cards 在受控小 fixture 创建一张合法 detail/plot 卡，sync-index --write 后 show 成功。目录独立、不以仓库 node_modules symlink 作为依赖，检查后删除全部受控副本。

## 本阶段完整 Gate

稳定源码、生成闭包与 Case 均停止写入后，`bun run check:changed`：61 passed / 0 failed / 3 N/A，执行 74.4s，无未知输入。机器证据位于 `.log/vibe-check/invocations/20261023T055422462Z-45b991ca-806b-48e6-bb50-9ef3a02097b3/`；其中 Function/File metrics 与 Case/reference 检查均通过。3 个 N/A 是仅 release 条件下运行的 release snapshot/version/package，不把本阶段 Gate 表述为已完成最终聚合发布。

## 与后续证据的关系

本 checkpoint 已冻结为阶段 after 输入，后续事务、恢复与 G2 接入见[批次 4–6 交接](stage-4-6-handoff.md)。0–3 的 IR new 解锁纠错只证明该故障下的创建事实，不单独证明全部 mutation 的 cleanup/readback/CAS。

baseline、阶段 after、插桩和最终配对的输入及覆盖统一由[证据入口](evidence/README.md)解释；不从本阶段的测试或 Gate 通过推断性能任务完成。共同候选映射、领域 snapshot 与内部 prepared 证明按[同阶段交接规则](../../tools/record-operations/README.md#同阶段证据与后续复核)复用，后续准备、fresh 与 readback 仍分别取证。

## 阶段正确性审查后的定向修复

- DR 候选 scaffold 与正式 scan 明确分开：未来 target 不再使候选结构失效，已存在直接依赖仍按实际范围严格验收；正式 scan/publish 的目标存在性和闭合未放松。共同候选契约补 API/CLI 创建→list/show 连贯性，另补正文已齐但缺未来目标仍不能 publish 的原生证明。
- selected baseline 读取绑定真实 root 至全部父目录 inode 链；新增 root/nested 普通目录 hardlink 替换回归，明确文件 inode/bytes/stats 均不变仍失败。
- strict baseline 证明供 selector 先解析，canonical 接纳移到 native baseline 消费、仍早于 build/fresh；共同 sync 对首次 strict baseline 失败直接保留原错误，不重读后吞错。两域 API/CLI 补非 canonical/未知 selector、坏 JSON/字段和 EACCES 单次读取证明。
- 本节对应修复已串行同步四个生成闭包与 skill-updaters，Case sync 后独立 check 通过 1378 entities；typecheck、Runtime 81 / DR 322 / IR 329 全套原生及 Node 17 个定向测试均通过。原有读取事实取得从 scan-records 分离至既有 scan-collection 来源取得 owner，候选/正式解析共享原管线、正式 scan 仍严格，以真实职责满足文件指标；无例外。修复后的 `bun run check:changed` 已通过：52 passed / 0 failed / 12 N/A（含 9 项有效 receipt 复用及 3 个 release-only），64s。artifact：`.log/vibe-check/invocations/20261023T062105312Z-584401a9-24f4-400e-8769-18ecdfbc9147/`。前次同 Gate 唯一失败为未改动 Task Graph public-distribution 的 5s 超时；未改其代码/预算，重跑同 Gate 及最小原生入口均通过。这些是本阶段修复后的证据，不覆盖后续规范优化输入或最终 1W 配对。
