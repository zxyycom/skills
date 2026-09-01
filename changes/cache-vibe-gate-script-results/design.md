# Design

本设计把首批 package-script 缓存限定为“声明入口、自动恢复实际运行时模块、显式补足非模块输入、无法证明即 bypass”，并使 default/full 默认复用本地可信 `passed`、`--no-cache` 同时禁读禁写。

## Context

当前事实 owner 是 `scripts/vibe-check.ts`、`scripts/lib/vibe-gate.ts`、`docs/tooling.md` 和 active `docs/decisions/use-vibe-check-as-authoritative-project-gate.md`：

- `bun run check` 是唯一权威 Gate CLI；default/full 从同一能力目录构造，使用 Vibe static `maxParallel: 4`、progress 和 `all` aggregate。
- 普通 package-script Check 由 adapter 运行 `bun run <script>` 并映射 passed、failed 或 unavailable。full 的 `pack:skills` 是唯一 release 终结 Check，依赖 36 个普通 prerequisite，随后真实调用 `hash:skills`，通过后再真实调用 `pack:skills`。
- Vibe machine publication 默认写 `.log/vibe-check/publication/run.json` 与 `records.ndjson`。Diagnostic logging 默认关闭，启用时在 `.log/vibe-check/` 写 invocation log。Vibe 原生 duplicate detection 的 cache 当前显式 disabled，且其写失败语义不满足本 Change 的 best-effort 要求。
- Gate 的普通 Checks 消费当前项目 worktree；release terminal 的 hash/pack 消费 Git `pending` 快照。缓存普通脚本不能把前者替代成后者。

只读原型已经证明：对当前五个慢测试入口，`Bun.Transpiler.scanImports` 与 `Bun.resolveSync` 恢复的仓库内运行时闭包与独立 bundler metafile 逐项一致。Scanner 发现 runtime import/export、字面量动态 import 和 require；type-only 不参与 Bun test 的运行时闭包。Scanner 不会把 `import(expression)` 变成可解析边，也不能发现 `fs`、glob、目录枚举、生成物、fixture、子进程和环境输入。该原型是设计证据，不表示缓存已经实现或两个首批 Check 的全部输入已经闭合。

本设计中的缓存命中只表示：在同一缓存协议下，该白名单 Check 曾对同一套已证明输入真实 `passed`。它不是本次 runner 执行证据、跨机器证明、测试账本或 release artifact。

## Goals / Non-Goals

**Goals**

- 在不改变 Vibe scheduler、aggregate、Check ID 和 release 依赖的前提下，跳过输入身份未变的两个长脚本。
- 让 import/re-export 演进自动进入指纹，同时把运行时模块真实解析到仓库或 `node_modules` 文件字节，而不是以 lockfile 假定安装内容。
- 对非模块输入、外部命令和环境采用逐 Check 的小型显式 policy；任何未闭合边界都真实执行且不写缓存。
- 让 cache hit、miss、bypass、disabled 和缓存故障在 Vibe 当前结果边界内可验证，不恢复旧 renderer 或主动开启 diagnostic log。

**Non-Goals**

- 不缓存首批白名单之外的 package script，不启用 Vibe 原生 duplicate cache，也不缓存 release terminal、`hash:skills` 或 `pack:skills`。
- 不建立任意 package script 的入口推导、插件系统或通用 shell 分析器；package script 是 shell 字符串，首批入口由 policy 明确声明。
- 不实现 syscall 跟踪、容器沙箱、远端/共享缓存、跨仓库缓存、预热服务、CI 分片、复杂 GC 或 mutable manifest。
- 不把 type-only 图纳入 Bun test 的运行时键，不声称 AST 覆盖网络、时间、随机数或外部服务。
- 不改变四槽并发、default/full Check 集合、失败后独立 Check 继续结算、Git pending 打包语义或现有测试行为。

## Decisions

### Intended Change

#### 1. Invocation 默认 read-write，`--no-cache` 同时禁读禁写

`GateInvocation` 对 default/full 都携带 cache mode。省略 flag 时为 `read-write`；出现一次 `--no-cache` 时为 `disabled`。合法形式为：

```text
bun run check [--no-cache]
bun run check --full [--baseline-ref <ref>] [--no-cache]
```

`--no-cache` 可出现在 full 合法参数序列中的任意位置。重复 `--no-cache`、重复 profile/baseline、未知参数、缺少 baseline 值、非法 baseline，或 default 携带 `--baseline-ref` 都返回 usage 且不启动 Vibe。Disabled mode 不实例化缓存读取或写入行为；它不是“忽略命中后刷新缓存”。不增加环境变量开关。

default 与 full 共享同一普通 Check 缓存身份；profile 不影响脚本命令时不进入 key。full 仍可让两个白名单普通 prerequisite 命中，不能让 release terminal 获得缓存资格。

#### 2. 首批资格由两个窄 policy 完整声明

缓存描述是 Gate 能力目录旁的固定只读 policy，不是通用注册系统。每项声明 `checkId`、script、精确 runner args、入口、runtime inputs、外部命令和需签名的环境字段。首批固定为：

| Check | 入口 | 实施前必须闭合的非模块输入下限 |
| --- | --- | --- |
| `script:test:change-plan-cli` | `tools/change-plan/tests/run.ts` | `skills/change-plan/scripts/change-plan.mjs`、`skills/change-plan/scripts/change-plan.mjs.map`；测试调用的 Node、Git 及相关环境。 |
| `script:test:decision-records-cli` | `tools/decision-records/tests/run.ts` | `skills/decision-records/scripts/decision-records.mjs`、`.mjs.map`、`decision-records.d.mts`、`decision-records-sdk/` 全部声明成员、`skills/decision-records/references/decision-index.schema.json`、`tools/decision-records/tests/fixtures/valid/` 全部成员；测试调用的 Node、Git、sh、`@typescript/native-preview` compiler 及相关环境。 |

表中的目录按递归、排序的成员集合建模；成员增加、删除、改型、改 mode、改 symlink 或改字节都会改变 key。测试运行后才在隔离临时目录创建的仓库外文件不是预运行输入；其生成逻辑仍通过静态模块闭包进入 key。实施 Readiness 必须逐项审计 `fs`、目录枚举、glob、非字面量 import/require、子进程、Git config、`PATH`/`HOME` 等环境读取，并把结论落实为 policy、受控测试环境，或“该 Check 暂无缓存资格”。

以后新增白名单必须建立独立证据：入口闭包可完整解析；持久 runtime inputs 和外部环境已闭合；没有未签名的网络、时间、随机或可变服务；mutation matrix 能同时证明相关变化失效和无关变化不失效。相似性不是证据。

#### 3. 指纹覆盖身份、实际运行时模块、非模块输入和环境

指纹使用带领域标签和长度边界的稳定编码，再计算内容 digest；不得拼接无边界文本。输入分四层：

1. **执行身份**：缓存协议、Check ID、script、`package.json` 中该 script 的原始命令、精确 runner command/args、入口、scanner loader/resolve 条件。Profile 本身不进入普通脚本 key。
2. **运行时静态模块闭包**：从入口开始，用 `Bun.Transpiler.scanImports` 枚举 runtime import/export、字面量 dynamic import 和 require，再以 `Bun.resolveSync(specifier, dirname(importer))` 解析。仓库内与实际解析到的 `node_modules` 模块均递归扫描并按逻辑路径去重；Node/Bun builtin 不对应文件，以 runtime/platform 签名代表。每个 `node_modules` 模块还纳入拥有它且参与解析的 package manifest。Type-only edge 不进入 Bun test 运行时键。
3. **显式文件输入和配置**：展开逐 Check runtime inputs，并合并 `package.json`、`pnpm-lock.yaml`、`tsconfig.json` 与实施审计确认的 resolver/runtime 配置。Lockfile 是额外失效项，不替代实际安装模块。文件身份包含 project-relative logical path、类型、可执行/权限 mode、symlink target/chain、目录排序成员和原始字节；实际模块还保留解析后的路径身份。
4. **环境身份**：`process.platform`、`process.arch`，以及本次 `PATH` 解析到的 Bun、Node、Git、sh 绝对路径与稳定版本输出。sh 等没有可移植 version flag 时，以解析路径、symlink chain 和 executable 原始字节作为版本等价身份。Decision Records 的 compiler 还纳入实际解析的 tsgo 路径、版本/包 manifest 和执行所读 runtime/标准库文件。任何规定探测无法完成都 bypass。

所有路径读取先 `lstat`，符号链接身份和实际目标均进入记录；runtime input 或解析模块逃出允许的项目根/`node_modules` 边界时 bypass，外部 executable 只通过上述显式环境签名进入。目录按稳定排序递归记录成员，空目录与缺失目录不同。缓存实现不跟随未声明路径来提高命中率。

每个扫描源还必须接受保守的不透明边审计。发现非字面量 `import()`/`require()`、静态 specifier 未解析、Bun 扫描/解析异常、未知 loader、路径越界、runtime input 缺失/歧义、环境探测失败或无法证明读取集合完整时，结果为 `bypass`：真实执行 Check，且即使真实通过也不写缓存。不得丢弃问题边后计算部分 key。

#### 4. 内容寻址记录无共享 manifest

缓存根固定为：

```text
.log/vibe-check/cache/check-results/<protocol>/<sha256(check-id)>/<cache-key>.json
```

Check ID 含冒号，不直接作为路径片段；目录使用完整 path-safe hex digest。Cache key 同样是固定长度 hex digest。每个 key 的 payload 只允许协议规定字段：protocol、Check ID、script、cache key 和固定 `passed` 状态；以 `unknown` 读取并用 runtime schema 严格拒绝缺失、多余、类型错误、身份不符和非 passed 状态。

读取只定位当前 key 的精确文件，不扫描或更新共享 index/manifest。首次真实 passed 时，在目标同目录创建带随机/UUID 的唯一临时普通文件，完整写入并关闭后原子 rename 到 key path；同 key 并发允许任一完整可信 writer 成为最终内容，不允许半写 JSON 成为命中。写临时文件、mkdir、rename 或清理失败只产生 warning，不改变真实 `passed`。

第一版不删除旧 key、不做复杂 GC。缓存仅有两个白名单，可由用户删除 `.log/vibe-check/cache/` 回到冷状态。缓存根已被 Git 忽略；不得上传或恢复不受信缓存。Digest 是寻址，不是防伪签名。

#### 5. Adapter 只复用 passed，并服从取消

白名单 Check execution 的顺序固定为：

```text
检查 AbortSignal
→ disabled：直接真实执行
→ 构建指纹；普通缓存故障则真实执行，取消则 cancelled
→ 读取并严格验证当前 key；命中前再次检查 signal
→ hit：零 runner 调用，返回 passed + info message + machine data
→ miss/bypass：真实执行；只有未取消的真实 passed 才尽力写入
```

命中 data 至少包含 script、`cache.status: "hit"`、protocol 和 key，不包含暗示本次子进程完成的 `exitCode`；同时返回稳定 info message，例如 `package-script-cache-hit`。真实执行 data 区分 `miss`、`bypass` 或 `disabled`，并保留当前 exitCode/diagnostic。Cache read、payload、fingerprint 或环境故障不是 Gate finding/unavailable，而是 bypass/miss 后真实执行；可行动的 warning 进入当前 Vibe message/data，不开启 diagnostic logging。

取消不是普通缓存故障。指纹阶段、读取后、命中返回前和写入前都检查 signal；已取消则使用现有 `package-script-cancelled` unavailable，且不再启动 runner 或写缓存。真实 runner 的 failed、unavailable、not-applicable、throw 或取消不写。真实 passed 后写失败仍返回 passed，并附 cache write warning；不得为补偿写失败再次运行脚本。

Machine publication 自动保存当前 Check final data/message，是 cache 来源的机器消费边界；不得复制旧 renderer。`.log/vibe-check/publication/`、默认关闭的 invocation diagnostic log 和 `.log/vibe-check/cache/` 是三个不同职责。

### Resulting Impacts

#### 6. Release 和 Vibe 原生缓存边界保持原样

`test:change-plan-cli` 在 default/full 可共享同 key；full-only 的 `test:decision-records-cli` 在 full 可命中。二者仍在本次 Definition 中结算为普通 `passed` dependency；`pack:skills` 无需识别另一种 dependency status。

Release terminal 本身永不缓存，每次检查所有 36 个当前 dependency 结果，真实运行 `hash:skills --baseline-ref ... --quiet`，且仅在版本校验 passed 后真实运行一次 `pack:skills`。缓存记录不保存 baseline、Git pending/index、版本结果、dist 或制品身份。任一 prerequisite、版本或打包失败继续按当前规则阻断。

Vibe duplicate detection 的 `cache: { enabled: false }` 保持显式关闭。本 Change 的“默认缓存”只指项目 package-script passed-result cache；不能顺手启用 Vibe 0.0.1 自带 cache，因为其写失败会改变 Check 终态，与 best-effort 设计冲突。

#### 7. 输出、长期决策和测试证据同步

`docs/tooling.md` 作为稳定行为 owner，说明默认 read-write、`--no-cache`、首批白名单、输入边界、hit/真实执行含义、三个输出目录职责、故障回退、手动删除缓存和 release 永不缓存。实现细节、临时模块数量和单次时间不复制进长期说明。

默认复用改变 Gate 的信任契约，因此优先演进现有 active `docs/decisions/use-vibe-check-as-authoritative-project-gate.md`，说明 Vibe aggregate 可消费由项目 adapter 证明的缓存 passed、其 fail-safe 与 release 排除；随后只通过 Decision Records 命令同步 `docs/decisions/decision-index.json`。

测试证据遵循 `skills/test-evidence-review/SKILL.md`：每个保留的最小原生 test 入口恰好一个 `repository-tooling` case。扩展现有 `scripts/vibe-check.test.ts` 时更新 CLI、definition catalog、package adapter 和 full packaging 等既有 cases；若新增独立原生入口，则分别为 fingerprint/mutation、cache storage/concurrency 等入口建立 case。`docs/test-evidence/test-evidence-index.json` 只由 catalog 统一入口派生，不手改。

#### 8. 性能验收比较真实 Gate wall time

实施 Readiness 先在同一工作树/index snapshot、固定 runtime、无额外负载下建立 pre-change default/full 基线。每个场景至少三次成功运行并取 median；调查时约 14.4 s/31.7 s 的数字只用于量级参考，不直接代替实施基线。

完成后使用隔离 cache root 依次测量：

1. `--no-cache` default/full，证明禁读禁写且非缓存路径没有显著回退；
2. 每次从空 cache 开始的 cold miss default/full；
3. 先 seed、再至少三次测量的 warm default/full；
4. 两个 eligible Check 各自的 fingerprint/hit，并用注入 runner 记录证明零调用。

判定阈值：`--no-cache` median 不超过 `max(基线 + 0.5 s, 基线 × 1.05)`；cold miss median 不超过 `min(基线 + 1.5 s, 基线 × 1.10)`；warm default/full 分别不高于同 profile `--no-cache` median 的 90%；每个 eligible Check 的 warm fingerprint/hit median 同时不超过 500 ms 和该脚本真实执行 median 的 20%。使用真实 Gate wall time而非 service sum，使用 machine publication 的 cache data 核对命中而非从时间猜测。

## Risks / Trade-offs

- 自动模块闭包仍不能证明所有运行时输入；白名单和 bypass 将错误建模转成性能损失，但首批 policy 的完整性仍需逐项审计与 mutation 证据。
- 复用 passed 会跳过相同输入下的偶发失败，因此只允许输入确定且不依赖可变外部服务的 Check。调用方可用 `--no-cache` 完整重跑，但 full 不隐式例外。
- 递归纳入实际 `node_modules` runtime 文件比只 hash lockfile 成本高，但能识别本地修改、损坏、symlink 和条件解析差异；500 ms/20% 双阈值限制其不能吞噬收益。
- 无 GC 的内容寻址目录会在不同 key 间增长；首批只有两个 Check，接受由手动删除缓存根恢复的简单性，不为第一版引入 mutable manifest 或清理器。
- 本地 payload 不具备防伪；方案明确依赖受信 workspace，不支持共享或导入缓存。扩大信任范围需要独立 Change。

## Open Questions

无。用户已确认 default/full 默认启用缓存并以 `--no-cache` 显式同时禁读禁写；首批白名单、实际模块字节、显式非模块输入、内容寻址存储、fail-safe、输出与 release 排除均已收敛。实施 Readiness 仍需完成逐 Check 输入审计和性能基线，但不会改变本设计的授权边界。
