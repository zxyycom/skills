# Tasks

本清单先闭合两个白名单 Check 的真实输入与实施基线，再按指纹、内容寻址存储、adapter、CLI/owner 的顺序实现，最后用真实性和端到端性能证据验收。

## Readiness

- [x] 0.1 核对权威 Gate 的 CLI、default/full 能力目录、package-script adapter、static `maxParallel: 4`、all aggregate、machine publication、diagnostic logging 和 release 终结依赖，确认缓存只进入 package-script adapter，不建立第二调度器或 renderer。
- [x] 0.2 用 Bun scanner/resolver 原型恢复五个慢入口的仓库内静态运行时闭包，并以独立 bundler metafile 对照；确认 runtime import/export、字面量 dynamic import 和 require 可恢复，type-only 不属于 Bun test runtime，opaque edge 与非模块访问必须另行处理。
- [x] 0.3 确认用户授权 default/full 默认 read-write，`--no-cache` 同时禁读禁写；首批只缓存 `test:change-plan-cli` 与 `test:decision-records-cli` 的真实 passed，native duplicate cache、release terminal、`hash:skills` 和 `pack:skills` 始终不缓存。
- [x] 0.4 核对输出职责：machine publication 使用 `.log/vibe-check/publication/`，diagnostic logging 默认关闭，package-script cache 使用 sibling `.log/vibe-check/cache/`；确认缓存状态通过当前 Check message/data 进入 publication，不主动开启日志。
- [ ] 0.5 对两个入口的完整运行时闭包审计 non-literal import/require、`fs`、目录枚举、glob、生成物、fixture、Node/Git/sh/compiler 子进程、Git config 和环境访问；至少闭合 proposal 点名的生成 `.mjs`/map、decision declarations/SDK/Schema/fixture 与实际 `node_modules` runtime 文件，无法闭合的 Check 标为暂无缓存资格。
- [ ] 0.6 固化两项最小 cache policy 的入口、command/args、runtime inputs、外部 executable 与环境字段，并用只读原型证明所有 resolved workspace/`node_modules` 模块、package manifest、路径类型/mode/symlink/目录成员/字节都能稳定编码；任何 opaque、未解析、越界、缺失或探测失败得到 bypass。
- [ ] 0.7 在同一工作树/index snapshot、固定 runtime、无额外负载下，对 pre-change default/full 与两个候选脚本各成功运行至少三次并记录 median、runner 调用和测量命令，作为 proposal 阈值的实施基线。
- [x] 0.8 识别稳定 owner：active `use-vibe-check-as-authoritative-project-gate` decision 及其派生索引、`docs/tooling.md`、Gate/项目配置测试，以及 `skills/test-evidence-review/SKILL.md`、`repository-tooling` cases、topic 表与统一派生索引。

## Implementation

- [ ] 1.1 在 `scripts/lib/` 实现单一窄指纹模块和两项固定 policy：用 Bun scanner/resolver 递归恢复实际 workspace/`node_modules` runtime 模块，忽略 type-only，合并 package manifest、runtime inputs、配置和 Bun/Node/Git/sh/compiler/platform 环境身份；AbortSignal 或任一不完整边界不得返回部分 key。
- [ ] 1.2 实现 `.log/vibe-check/cache/check-results/<protocol>/<sha256(check-id)>/<key>.json` 的无 manifest 存储：以 unknown 严格解析 payload，使用 path-safe digest、同目录唯一 temp 与原子 rename；读/解析/I/O 故障均按 miss，写失败只返回可观察 warning，不改变真实 passed。
- [ ] 1.3 扩展 package-script adapter：enabled 时在 runner 前 fingerprint/read，hit 时零 runner 调用并返回 passed、稳定 info message 和 machine data；miss/bypass 时真实执行，只在未取消的真实 passed 后尽力写入，failed/unavailable/not-applicable/throw/cancelled 永不写。
- [ ] 1.4 扩展 `scripts/vibe-check.ts` 的 invocation 解析和 Definition 依赖，使 default/full 默认 read-write，单次 `--no-cache` 完全绕过 read/write；保持 baseline 仅属于 full、参数任意合法顺序、usage 与 Vibe 启动前失败边界。
- [ ] 1.5 保持 Vibe duplicate detection cache 显式 disabled，保持 release terminal 无缓存描述；确认 cached prerequisite 仍进入当前 aggregate，而每次 full 仍真实运行 `hash:skills` 和条件式 `pack:skills`。
- [ ] 1.6 演进 `docs/decisions/use-vibe-check-as-authoritative-project-gate.md`，记录项目 adapter 缓存 passed 的信任、fail-safe 与 release 排除，并通过 Decision Records owner 命令同步 `docs/decisions/decision-index.json`，不得手工编辑派生索引。
- [ ] 1.7 更新 `docs/tooling.md`，只沉淀默认缓存、`--no-cache`、首批白名单、输入/bypass、三个目录职责、本地信任、手动清缓存、cache-hit 可观察性和 release 永不缓存等稳定规则。
- [ ] 1.8 按受影响的最小原生测试入口更新或新增 `repository-tooling` cases，维护 `docs/test-evidence/test-evidence-topics.json`，并用 test-evidence catalog 统一入口同步 `docs/test-evidence/test-evidence-index.json`；同步 Gate CLI/definition/adapter/full packaging 与必要的项目配置 validator 测试。

## Verification

- [ ] 2.1 用 CLI 单元测试证明 default/full 默认 read-write、单次 `--no-cache` 零 read/write、flag 合法顺序，以及重复/未知/缺值/default baseline 参数在 Vibe 启动前失败且不恢复环境变量开关。
- [ ] 2.2 用隔离 fixture 证明 runtime import/re-export、字面量 dynamic import/require、实际 workspace 与 `node_modules` 模块字节、package manifest、runtime directory 成员、配置、script/args 和环境身份进入 key；type-only 与闭包外无关文件变化不改变 key。
- [ ] 2.3 用 mutation matrix 分别改变入口、测试、传递共享模块、实际解析的 `node_modules` 模块、change-plan 生成 mjs/map、decision mjs/map/declarations/SDK/Schema/fixture、config/lock/runtime 版本，证明相关 Check 失效；改变无关文档或其他 tool 文件仍命中。
- [ ] 2.4 证明 non-literal import/require 未声明、specifier unresolved、路径越界、symlink 逃逸、runtime input 缺失、环境探测失败和指纹读取失败都 bypass 并真实执行且不写；不得丢弃问题边后产生部分 key。
- [ ] 2.5 证明首次真实 passed 写入、二次 hit 零 runner 调用；failed/unavailable/not-applicable/throw/cancelled 不写；指纹和命中返回前取消不启动 runner；缓存 write failure 不反转真实 passed 且产生 warning。
- [ ] 2.6 证明严格 payload 拒绝 unknown/多余字段、协议/Check/script/key/status 不符及半写 JSON；同 key 跨 invocation 并发经唯一 temp/原子 rename 后只留下完整可读记录，且不产生共享 manifest。
- [ ] 2.7 证明 hit 使用 Vibe info message 和 machine data 区分 hit/miss/bypass/disabled，不伪造 exitCode；machine publication 仍只写 publication 文件，diagnostic logging 仍默认关闭，cache 不污染 publication、dist 或 Git。
- [ ] 2.8 用 full 测试证明普通白名单 prerequisite 可命中，但 release terminal 每次仍真实调用 `hash:skills` 并仅在版本通过后调用一次 `pack:skills`；任一前置、版本或打包失败继续阻断。另证明 native duplicate cache 仍 disabled。
- [ ] 2.9 按 Readiness 0.7 方法各至少三次取 median，测 `--no-cache`、空 cache cold miss、seed 后 warm default/full，以及 eligible Check fingerprint/hit；验证 proposal 的回归和收益阈值、runner 零调用，并用 machine data 核对命中而非用耗时猜测。
- [ ] 2.10 运行受影响的 Gate、项目配置、Decision Records 和 Test Evidence 原生入口，再运行 `bun run check --full --no-cache`，确认完整无缓存门禁、决策索引和派生证据一致。
- [ ] 2.11 使用编码规范审阅全部实现，使用 AI-ready docs 审阅 `docs/tooling.md`、Decision、Change artifacts 与 Test Evidence；逐项核对 proposal Success Criteria、稳定 owner 和任务证据后再申请归档。
