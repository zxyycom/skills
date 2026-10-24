# A/F 仓库维护与共享工具测试交接

## 范围与状态

- 在 root 保存 Plan 提交 `a661d059` 并授权后实施。仅修改本代理 owner 的测试与 fixture，共 22 个文件（下列列表）；没有产品源码、长期文档、Case、index、wrapper/run 或 package 修改，没有提交。
- RC1 leaf 已由 Gate owner 接入 Change Plan 的 public-distribution wrapper/run；`scripts/validate.test.ts` 已由 Gate owner接入既有 `test:environment`。没有新增 Gate Check。
- F 非 retain 发现全部已处置；必要 256 MiB blob 预算、12,000 深链真实 Node、两方向 mode/symlink 证明及真实 frozen 安装节点保留。未为降成本改变产品阈值、读取语义或新增生产抽象。

## 改动文件

```text
scripts/environment-check.test.ts
scripts/environment-commands.test.ts
scripts/environment-test-tools.ts
scripts/publish-skills.test.ts
scripts/validate.test.ts
scripts/validators/project-config.test.ts
tools/change-plan/tests/repository-command.test.ts
tools/index-runtime/tests/prepared.test.ts
tools/index-runtime/tests/protocol-query.test.ts
tools/index-runtime/tests/reader-load.test.ts
tools/index-runtime/tests/record-staging.test.ts
tools/shared/tests/file-text-search-matching.test.ts
tools/shared/tests/record-text-search.test.ts
tools/shared/tests/version-control-pathspec-query.test.ts
tools/shared/tests/version-control-pending.test.ts
tools/shared/tests/version-control-prefix-integrity.test.ts
tools/shared/tests/version-control-snapshot.test.ts
tools/shared/tests/version-control-workspace.test.ts
tools/skill-updater/tests/installation.test.ts
tools/skill-updater/tests/public-contract.test.ts
tools/skill-updater/tests/release-validation.test.ts
tools/skill-updater/tests/support.ts
```

## 处置与保留证明

| 发现 | 实施与必要观察 |
| --- | --- |
| A1 / RC1 | 原名真实 `bun run --silent change-plan -- --help` 节点迁入 CP 新 leaf；自有 execFileSync、固定仓库 cwd 和局部 30s 子进程边界，不 import environment helper。通过 exit success 与独有命令表面证明分发启动。 |
| A2 CAS | 不改 auto-push 产品或测试。当前没有可复用稳定 reservation 阶段 seam；双 helper 正常结束、恰一 push 和真实 bare remote revision 观察保留；它没有证明两个 helper 先读同一旧 ref 或实际 CAS 冲突命中。交整合者准确表述 Case，不新增 hook 或大输入假造交错。 |
| A4 formatter | 对 `formatPackageScripts` 增加独立字面预期 `oxfmt --write/--check '{scripts/**/*.{ts,js},tools/**/*.ts}'`，不再仅从生产常量导出覆盖预期；保留 validator 错误接线断言。 |
| A 环境零安装 | fake tool 增加可选命令 log，并以 fake npm/corepack/go 避免误入真实安装器；check、gate、缺 SCC setup 的对应节点检查没有 pnpm install/npm/corepack/go 调用。其他真实 setup 的 fake pnpm install 不受影响。日志按行首识别工具，不把 pnpm 子串误作 npm。 |
| F 跨行准入 | 文件仅 `Alpha\nbeta\n`，all 命中行 1/2、any 命中行 2、phrase 零 hit；无同一行同时包含两词的干扰行。 |
| F 显示耗尽取消 | 原资源/UTF-8节点保留、移出预先 abort 子场景；新增独立节点在 b.md validator abort，外层确认已依序验证 a.md/b.md，a 的匹配已消耗 1 字符显示预算，最终精确 aborted。 |
| F Git bytes drift | 对已经存在的 `docs/staged.bin` 写新 bytes 并 stage；没有新增 member。保留 bytes/mode/member/head 四节点和完整 index bytes 零变更、index.lock缺席断言。 |
| F prefix | 原节点改真实含 NUL/FF/FE 二进制，精确 prefix bytes/complete/full bytes；随后截断对应 loose blob 的压缩尾部，prefix 已足够仍必须拒绝 operation-failed，证明 API 不以 retained prefix 代替完整 payload acquisition。 |
| F 纯路径与 mock Git | 路径节点改同步 path.resolve 根，无临时目录、无建仓/发现；两个 raw mock 节点使用既有 createGitClient(现存 cwd) 后替换 raw，不建仓、不读 cwd 的 Git 历史。真实 union、alternate index、discovery 证据保留。 |
| F mode 两方向 | `version-control-representation` 和 `version-control-replacement` 均保留；审计最终复核已指出方向不同，不能直接合并删除。 |
| F Index Runtime 物化 | 删除 Date.parse 内建 patch/2/4/6次数锁；保留 fixture 自有 metadata/state parser、collection validator、read/revisionRead 计数以及 query/get/all结果、overlay局部解析和raw坏输入拒绝。prepared名称只承诺复用已验证快照；不宣称直接观测所有私有时间字段提取次数。 |
| F 其他名称/字段 | 非法 text source 节点只称拒绝；empty sourceRevision 增加独立具体预期；domain stage 名称改为跳过索引投影；pending prewrite只称保留范围与净化诊断，真实写后readback恢复节点保留。 |
| F updater export | 删除 export type / async function / const 三项源码写法锁；维护来源生成头、真实 tsgo 公共类型 consumer、模块 URL 外部 Node importer 保留。 |
| F updater 规则降层 | 版本不一致、错误 remote owner、alias path、invalid manifest 四节点改已有 source API（loadRemoteSkillFiles/resolveRemoteSkillPackage）直接拒绝；node:test mock.method控制 fetch，并 finally 恢复，兼容 Bun fetch 附加属性。invalid release 仍保留一条真实 Node CLI 失败状态/诊断代表；installation/TS自覆盖/MJS旧包升级/外部importer均保留真实 Node。下沉节点不再宣称逐条真实 CLI 目标目录零写。 |
| P1 有更新 --check | unversioned目标保留真正需更新状态；原SKILL bytes+custom二进制bytes+递归目录成员前后完全相等；请求日志确认release/manifest请求，零zip请求。此为目标状态不变证据，不声称从系统调用层观测所有零写操作。 |
| P2 publisher upload failure | fake gh zip upload精确注入exit7并记录命令；外层核CLI失败且包含注入诊断，完整命令序列只到zip upload，不含manifest upload/stale delete/edit；去注入同fixture可成功重试并按序发布manifest/delete/edit。没有真实GitHub调用。 |
| F orphan validate | 临时仓库先补齐必需路径、复制健康package/Oxc配置、合法skill版本，断言errors=[]基线；独立坏链接仍errors=[]/skillCount=1；独立空description精确唯一结构错误。配置错误不掩盖目标观察。 |

## 原生节点与 Case 后继

下表是迁移、重命名、拆分、新增及证明范围变化；未列的既有节点原名和证明责任保留。整合者负责采集最终实体 ID、Case Tests/index，本代理没有写账本。

| 文件 / 原入口 | 最终入口 | Case处理建议 |
| --- | --- | --- |
| `scripts/environment-commands.test.ts` / `repository short command change-plan invokes its owned skill CLI` | `tools/change-plan/tests/repository-command.test.ts` / 同名 | 保留 `repo-short-cli-001.md` 的意图/Proves，只更换实体引用。 |
| `tools/index-runtime/tests/protocol-query.test.ts` / `extracts closed query sources and rejects invalid source values` | `rejects invalid values for declared text query sources` | `index-runtime-key-value-001.md` Tests更新；Proves只称非法boolean text source拒绝。 |
| 同文件 / `materializes an empty state and source-revision record` | 同名 | `index-runtime-empty-record-001.md` 可明确entries={}和sourceRevision={entries:{},metadata:'source:metadata'}。 |
| `tools/index-runtime/tests/prepared.test.ts` / `prepared readers consume strict field materialization once without weakening raw boundaries` | `prepared readers reuse validated snapshots without weakening raw boundaries` | 保留 `index-prepared-reader-001.md` 意图；Proves改“reader操作不增加metadata/state parser或集合validator调用，prepared交接不重验；raw仍拒绝坏字段”，删除直接“字段提取次数”承诺。 |
| `tools/index-runtime/tests/reader-load.test.ts` / `reuses loaded snapshot preparation for repeated reader operations` | 同名 | `index-runtime-reader-load-reuse.md` 第二条删除“时间字段提取次数”，保留结果、parser/validator/read计数及overlay隔离；不声称内建解析方式。 |
| `tools/index-runtime/tests/record-staging.test.ts` / `record stage domain reuses immutable deterministic target after two fresh acquisitions` | `record stage domain skips index projection after two fresh acquisitions` | `record-stage-target-equivalence.md` 更新domain实体；原Proves已准确区分index/all build与domain不build，可继续。 |
| `tools/shared/tests/record-text-search.test.ts` / `record search preserves required reads resource failures and cancellation after display exhaustion` | `record search preserves required reads and resource failures after display exhaustion`；新增 `record search observes cancellation after an earlier hit exhausts the display budget` | `record-search-required-failures.md`可由两个最小入口共同承接，或按独立取消意图拆Case；明确后续UTF8/total byte失败与第二文件validator取消阶段。 |
| `tools/shared/tests/version-control-pending.test.ts` / `restores the original range after a pending write failure` | `preserves the original range and sanitized diagnostics after a pending prewrite failure` | 保留 `version-control-pending-write-failure-001.md`，Tests更新，Proves称prewrite故障而非已写后恢复；readback恢复Case不动。 |
| `tools/shared/tests/version-control-prefix-integrity.test.ts` / `revision prefixes preserve binary bytes and completeness while draining all full payloads` | 同名补强 | `version-control-revision-prefix-content.md`可明确binary prefix/full complete与坏压缩尾拒绝，不再只是ASCII观察。 |
| `tools/skill-updater/tests/installation.test.ts` / `updater check reports an unversioned installed skill` | `updater check reports an unversioned installed skill without zip downloads or file changes` | `skill-updater-unversioned-001.md`新增需更新时零zip请求、递归成员和全部fixture文件bytes不变。 |
| `tools/skill-updater/tests/release-validation.test.ts` / 版本不一致、错误owner、非规范路径、invalid manifest四个原名 | 原名保留，边界下沉 | `skill-updater-manifest-version-001.md`、`skill-updater-remote-owner-001.md`的Proves改源API拒绝具体版本/身份错误而未返回可安装文件，不再称“真实CLI目标未替换”；`skill-updater-canonical-path-001.md`称解包返回前拒绝alias；`skill-updater-manifest-payload-001.md`保持schema诊断。invalid release CLI代表Case仍保留。 |
| `scripts/publish-skills.test.ts` / 新增 | `rolling publication stops after zip upload failure and can be retried` | 新独立Case；Proves为命中zip失败、后续mutation缺席、同fixture下一次成功完成；不混成成功顺序节点。 |
| `scripts/validate.test.ts` / orphan `repository validation skips skill links while preserving skill structure failures` | `repository validation skips missing skill links in an otherwise healthy repository`；`repository validation preserves skill structure failures independently of link checks` | 两个独立原生节点现在被既有test:environment发现，分别新Case，或由一个准确Case共同承接结构/link职责。旧orphan原本没有注册实体，不要凭审计行生成旧引用。 |
| `scripts/auto-push.test.ts` / 并发节点 | 未改 | `auto-push-concurrency-001.md`现有Proves仅双helper/单push/remote结果，可保持；不要升级成已命中相同旧ref CAS碰撞的证明。Contract描述产品CAS规则不等于该节点覆盖全部交错。 |

其余补强对应既有Case：`file-text-search-modes-001.md`、`version-control-selected-snapshot-cas.md`、`repo-format-scripts-001.md`；环境三个原名节点的Case可补命令日志零安装观察。updater类型consumer Case继续证明公共类型，不声明export写法。

## 实际验证

以下最终通过的目标运行均为 `PATH=/home/dev/.local/share/mise/installs/bun/1.4.2/bin:$PATH`、`TMPDIR=/var/tmp`、`CI=true`；没有实际安装或联网。

| 命令 | 结果 |
| --- | --- |
| `bun run test:environment` | 23 pass / 0 fail，包含新增validate两节点与独立format政策。 |
| `bun run test:index-runtime` | 86 pass / 0 fail。 |
| `bun run test:file-text-search` | 23 pass / 0 fail。 |
| `bun run test:skill-updater -- -t '^(?!updater load failures).*'` | 19 pass / 1 filtered / 0 fail；**filtered为真实frozen安装恢复节点，本轮没有运行它**。最终版本含4个source规则与1个Node release错误代表。 |
| `bun run test:version-control -- -t 'converts absolute\|Git .*queries\|Git path-query\|pending snapshot\|revision prefixes preserve\|representation\|pending .*failure\|pending readback'` | 28 pass / 61 filtered / 0 fail；保留双方向representation与真实Git读取/冲突/恢复。没有跑256MiB规模节点。 |
| `bun run test:change-plan-cli -- -t '^repository short command change-plan invokes its owned skill CLI$'` | 1 pass / 54 filtered / 0 fail；从已接入的CP聚合入口发现并报告迁移后节点。 |
| `bun test ./scripts/publish-skills.test.ts` | 7 pass / 0 fail。 |
| Oxfmt对以上22文件 `--check` | 全部通过。 |
| 限定owner路径 `git diff --check` | 通过。 |

### 首次失败与解释（不能被最终通过覆盖）

1. 第一轮多leaf小跑33pass/2fail：新mock context用不存在`/repo`触发simple-git构造拒绝，目标merge还没执行。已改现存cwd，仅构造client，raw完全mock，未读取Git历史。最终聚合Git28pass覆盖修正。
2. 直接一次 `bun test` 多个Git/updater leaf引发原有共享after生命周期：首leaf结束删共享template/tempRoot，后续leaf复用缓存引用而ENOENT，共18fail。现有公开聚合wrapper一次import所有leaf不受影响；按root决定不扩任意多leaf组合契约，改用公开聚合+名称选择。最终上述聚合通过。
3. 第一轮environment：新增无行首regex把`pnpm:`中的`npm:`误匹配，3节点失败。已按log行首定位工具，最终环境全过。该轮邻近原lint preflight因并行负载约5.68s超过既有5s runner边界；未提高超时或改产品，后续环境全过且该节点约1.26s。没有把一次超时当成产品Bug。
4. 一次未带`./`直接`bun test tools/skill-updater/tests/run.ts`未发现测试；已改稳定`bun run test:skill-updater`并实际发现19节点，未把零发现当通过。
5. 一次shell链在第二条命令丢失临时PATH，updater跑成Bun1.4.4；不将其作固定运行时证据，已export环境并用1.4.2完整重跑19pass。
6. 本代理一次全项目 `tsgo --noEmit --incremental false`发现新增直接赋值fetch缺Bun `preconnect`属性；已改node:test mock.method，不再替换成不完整typeof fetch。**该修正后的全项目Typecheck尚未重跑，交root集中验证**；同修正后的运行测试已通过。

## 尚未覆盖与整合义务

- 本代理未写Case/index，整合者须按上表更新最终实体、Proves及覆盖；未执行check:changed/full/release/远端Windows，也未宣称整个Change完成。
- 真实 frozen 安装节点、256MiB预算、深链Node与全量Git由root统一调度，本轮目标选择明确未执行，不删除或缩小原证明。
- 未进行动态mutation；跨行fixture、失败注入命中、日志与明确错误谓词已作静态反事实复核，不能冒充变异执行。
- 新环境fake dispatcher同时维护POSIX/Windows分支；本轮只实际运行Linux，Windows行为仍需对应平台验证。
- auto-push未取得受控CAS碰撞证据；没有为了旧Case扩大产品hook或承诺。
- Typecheck修正后待root集中重验；root现有其他会话docs/investigations和candidate资源均未触碰。

## 公共快照接入补修（2026-10-24）

- Case 整合实际发现第一段测试名的条件表达式不被现有 collector 定位（旧 index 名 found 0）。本代理仅将 `tools/index-runtime/tests/record-staging.test.ts` 第一段拆为 index/all 原模板 literal loop 和独立字面 domain test；三个最终节点名称、helper 调用及行为不变，后两段 loop 没有改动。未扩 collector 或生产抽象。
- `CI=true TMPDIR=/var/tmp`、固定 Bun 1.4.2 执行 `bun run test:index-runtime -- -t '^record stage (index reuses immutable deterministic target|all reuses immutable deterministic target|domain skips index projection) after two fresh acquisitions$'`：3 pass、88 filtered、0 fail；Oxfmt 单文件通过。
- 实际执行公开 `bun run snapshot:test-evidence -- --output .log/vibe-check/audits/test-design-census-20261024-wx9KzT/record-stage-snapshot-20261024T170031.json` 成功退出，产物为 `completeness: complete`，1688 entities，source revision `9a52df18cb0160b97a6c94fd9bdbdc7bfcafb11ee061cca90068d3181dd3e2c2`。已从真实 JSON 核对三个节点均有实体；这是当前源码登记完整快照，不证明所有测试本轮运行成功。
- 本轮公共 snapshot 没有后续阻断；产物留在既有 ignored 审计目录供 Case 整合消费，后续任何相关源码改变均需重新核 source/revision。本代理未改 Case、共享 index 或其他会话 owned-envelope/src。
