# Proposal

本 proposal 规划 Vibe Gate 的本地 package-script 通过结果缓存：default 与 full 默认复用输入身份相同的可信 `passed`，并以 `--no-cache` 为单次调用同时关闭缓存读取和写入。

## Why

权威 Gate 已使用 Vibe 的静态四槽并行调度，调度耗时接近当前 Check 集合的并行下界；`test:change-plan-cli` 与 `test:decision-records-cli` 仍是确定的长任务。继续调整声明顺序不能消除它们在真实输入未变时的重复执行成本。

完整工作区快照也不能解决这一问题：任一无关文件变化都会让所有 Check 失效。只手写源码目录则会遗漏共享模块、重导出、第三方运行时文件和生成制品。只读原型已证明，`Bun.Transpiler.scanImports` 与 `Bun.resolveSync` 可以从入口恢复运行时静态模块闭包，并与独立 bundler metafile 对照一致；该证据只覆盖运行时 import/export、字面量动态 import 与 require，不覆盖 type-only 依赖、非字面量导入、文件系统读取、目录枚举、子进程或环境状态。

因此本 Change 不建立任意脚本缓存框架，而为两个已知长任务建立窄白名单：自动恢复实际运行时模块，显式补足非模块输入，并在任何输入无法闭合时绕过缓存、真实执行 Check。

## Outcome

- `bun run check` 与 `bun run check --full` 默认读写两个白名单 Check 的本地通过缓存；`bun run check --no-cache` 与 `bun run check --full --no-cache` 不读取也不写入任何 package-script 结果缓存。
- 首批只缓存 `test:change-plan-cli` 与 `test:decision-records-cli` 的真实 `passed`。Vibe 原生 duplicate cache 保持 disabled；其他原生 Check、其他 package script、release 终结 Check、`hash:skills` 与 `pack:skills` 始终真实执行。
- 缓存身份覆盖 Check/script/arguments、实际解析的仓库内与 `node_modules` 运行时模块字节、显式非模块输入、项目配置、协议版本，以及解析到的 Bun、Node、Git、sh 和平台身份。相关输入变化使对应 Check 未命中，无关工作区变化不使其失效。
- opaque 或未解析模块边、越界或缺失输入、环境探测失败、损坏缓存和缓存 I/O 故障都不能产生缓存通过；除取消外，这些情况回退真实执行。只有真实执行取得的 `passed` 可以尽力写入缓存，写失败不反转该结果。
- 缓存命中在当前 Vibe Check 中以 info message 和稳定 machine data 明确呈现，并作为 `passed` 进入当前 aggregate；它不声称本次启动过 runner，也不建立第二套 renderer 或日志协议。

## Scope

### Intended Change

- 扩展权威 Gate invocation：default/full 默认 cache enabled，单次 `--no-cache` 将 cache mode 设为 disabled；baseline 仍只属于 full，CLI 不增加环境变量开关。
- 在 `scripts/lib/` 增加由 package-script adapter 独占的窄实现。白名单 policy 明确声明 Check、package script、入口、非模块输入和外部命令；Bun scanner/resolver 只负责自动恢复其传递运行时模块闭包，不从 shell script 文本猜入口。
- 为每个输入项记录有边界的身份，包括路径、文件类型、mode、符号链接、目录成员和文件原始字节；实际解析到 `node_modules` 的运行时模块及其 package manifest 进入闭包，`package.json` 与 lockfile 只作为额外失效项，不能替代已安装内容。
- 将严格的内容寻址记录写到 `.log/vibe-check/cache/check-results/<protocol>/<check-id-hash>/<cache-key>.json`。记录不依赖共享 manifest；写入使用同目录唯一临时文件和原子 rename，损坏或身份不符视为 miss。第一版不做自动 GC，可通过删除 cache 根恢复冷状态。
- 首批 runtime inputs 至少覆盖 change-plan 的生成 `.mjs`/`.mjs.map`，以及 decision-records 的生成 `.mjs`/`.mjs.map`、`.d.mts`、SDK 声明树、Schema 和持久 fixture；实施前还需闭合两套测试的 Git、Node、sh、TypeScript compiler 与环境输入。

### Resulting Impacts

- package-script `passed` 新增 `hit`、`miss` 和 `disabled` 来源。Machine publication 继续只负责 `.log/vibe-check/publication/run.json` 与 `records.ndjson`，diagnostic logging 继续默认关闭；缓存是 `.log/vibe-check/cache/` 下的独立本地状态，三者不得互相冒充或共用文件层级。
- full 可以复用两个普通白名单 prerequisite，但 `pack:skills` 每次仍等待本次 aggregate 的全部 prerequisite，再真实运行 `hash:skills` 和 `pack:skills`。普通脚本缓存只证明已声明 worktree 输入，不证明 Git `pending`/index 快照，也不保存或重放 release 副作用。
- 缓存是受信本地 workspace 的性能状态，不是测试证据、发布制品或可移植证明；第一版不上传、下载或共享缓存。内容 digest 用于寻址和失效，不作为对不受信 payload 的真实性证明。
- 默认 Gate 的信任与执行契约发生变化，需演进 active `docs/decisions/use-vibe-check-as-authoritative-project-gate.md` 并通过 Decision Records owner 同步索引；`docs/tooling.md`、Gate 行为/配置测试和 `repository-tooling` Test Evidence 同步承接稳定行为与证据。
- 缓存实现必须在指纹计算、读取、命中返回和写入边界检查 `AbortSignal`。取消直接沿用 cancelled/unavailable 语义且不再启动 runner；非取消缓存故障只造成真实执行，写失败最多增加 warning。

## Success Criteria

1. default 与 full 省略参数时默认读写缓存；两个 profile 均接受一次 `--no-cache`，该模式可由测试证明零缓存读取、零缓存写入。重复/未知参数、缺失 baseline 值及 default 携带 baseline 继续在 Vibe 启动前失败。
2. 只有 `test:change-plan-cli` 与 `test:decision-records-cli` 的真实 `passed` 可写入或复用；Vibe duplicate cache 保持 disabled，release terminal、`hash:skills`、`pack:skills`、failed、unavailable、not-applicable 与取消结果永不缓存。
3. 两个缓存键覆盖 Check ID、script 与实际 command/args、协议、解析器配置、实际解析的仓库和 `node_modules` runtime 文件、声明的 runtime inputs、项目配置，以及 Bun/Node/Git/sh 的解析路径和版本等价身份、platform/arch。Type-only 依赖不影响运行时键；opaque、未解析、越界、缺失或无法读取的输入使该 Check bypass 且不得写缓存。
4. `test:change-plan-cli` 的非模块输入至少包含 `skills/change-plan/scripts/change-plan.mjs` 与 `.mjs.map`；`test:decision-records-cli` 至少包含生成 `.mjs`/`.mjs.map`、根 `.d.mts`、`decision-records-sdk/` 声明树、`decision-index.schema.json` 和 `tools/decision-records/tests/fixtures/valid/`。Git、Node、sh、TypeScript compiler 与相关环境访问完成逐 Check 审计并进入签名、被测试隔离，或使该 Check 暂无缓存资格。
5. 缓存路径使用 path-safe Check ID hash 与 cache key，不使用共享 manifest。Payload 以 unknown 读取并严格验证 protocol、Check、script、key 和固定 `passed` 状态；唯一临时文件加原子 rename 保证同键并发只能留下完整记录，非法或半写记录不能命中。
6. 缓存命中不调用 runner，以 Vibe info message 和 machine data 报告 hit/protocol/key；miss 与 disabled 的真实结果保留现有 exit、取消和诊断语义。读/解析/指纹故障回退 runner；写失败不反转真实 `passed`。Machine publication、diagnostic log 与 cache 的目录和职责保持分离。
7. full 命中普通白名单 prerequisite 后，release 终结 Check 仍在每次 invocation 真实调用 `hash:skills`，并仅在版本校验通过后真实调用一次 `pack:skills`；现有 worktree 与 Git `pending` 双输入边界、四槽 scheduler、all aggregate 和失败后独立 Check 继续结算均不改变。
8. 在实施时先以同一 snapshot、环境和无额外负载各运行至少三次并记录 median 基线。完成后，`--no-cache` median 不超过基线的 `max(基线 + 0.5 s, 基线 × 1.05)`，冷 miss median 不超过 `min(基线 + 1.5 s, 基线 × 1.10)`；warm default 与 warm full median 均不高于各自 `--no-cache` median 的 90%。每个白名单 Check 的 warm fingerprint/hit median 同时不超过 500 ms 和其真实脚本 median 的 20%，且 runner 调用记录为零。
9. 受影响的 Gate/配置/Test Evidence 原生测试、`bun run check --full --no-cache` 与 AI-ready/编码规范审阅通过；active Gate decision、Decision index、`docs/tooling.md` 和 Test Evidence owner 已按实际行为同步。

## Affected Owners

- Gate CLI、Definition、package-script adapter 与窄缓存实现：`scripts/vibe-check.ts`、`scripts/lib/vibe-gate.ts`、新增的 `scripts/lib/` 模块。
- Gate 行为和公开配置契约：`scripts/vibe-check.test.ts`、`scripts/validators/project-config.ts`、`scripts/validators/project-config.test.ts`、`package.json`、`pnpm-lock.yaml`、`tsconfig.json`。
- 首批真实输入：`tools/change-plan/tests/`、`tools/decision-records/tests/`、对应 `tools/*/src/` 与共享运行时闭包、实际解析的 `node_modules` 文件、`skills/change-plan/scripts/`、`skills/decision-records/scripts/`、decision-records Schema 与 fixture。
- 权威 Gate 决策及其派生索引：`docs/decisions/use-vibe-check-as-authoritative-project-gate.md`、`docs/decisions/decision-index.json`；索引只通过 Decision Records owner 流程更新。
- 稳定工具说明：`docs/tooling.md`。
- 测试证据契约与账本：`skills/test-evidence-review/SKILL.md`、`docs/test-evidence/repository-tooling/` cases、`docs/test-evidence/test-evidence-topics.json` 及统一入口派生的 `docs/test-evidence/test-evidence-index.json`。
