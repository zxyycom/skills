# DR 同阶段 frontmatter 复用：本次落地补证

本资源记录 2026-10-24 本次实现的验证做法，不更改旧原型样本，也不是新的产品工具。详细数据与实际取得时间在同目录 `implementation-verification.json`。

## 比较条件

- 对照基线 `a661d059`。Node v26.8.2 的同步 `registerHooks` 在内存中把七个任务改变的 DR 域模块替换成该 revision 的完整源码；其余依赖与当前实现使用同一工作区模块。JSON 中保留两边源码 SHA-256。
- 当前 source CLI 为 `tools/decision-records/src/cli.ts`；generated CLI 为 `skills/decision-records/scripts/decision-records.ts`，生成由仓库 owner 先同步。本次没有把原型 optional 参数形态应用到源码。
- 使用 `tools/decision-records/tests/fixtures/valid` 的两份真实记录和既有关系。先通过 `syncDecisionIndex` 建立合法索引，再为每个命令和版本复制独立夹具；changed/preflight 仅在 active 来源末尾附加 `\nPost-acquisition body evidence.\n`。
- check、full sync unchanged、changed、preflight 各运行 baseline/source/generated 三个真实 Node 进程，共 12 次。各组比较完整 exitCode/stdout/stderr 和最终全部普通文件 SHA-256、mode。没有独立索引 oracle，没有用时间比较主张收益。

## 计数方法

加载 hook 只在 `tools/shared/src/markdown/frontmatter.ts` 中把下面实际调用改成同语义的计数表达式；generated runtime 使用相同后缀匹配：

```ts
// 原调用
const values = parseYaml(match[1]) as unknown;
// 仅本次测量进程的调用
const values = (globalThis.__drYaml++, parseYaml(match[1])) as unknown;
```

来源打开计数包装 `fs.promises.open`，仅累计路径包含 `/docs/decisions/` 且以 `.md` 结尾的调用。它不缓存、不改变参数或结果；两记录夹具未触发 worker 分支。本次所有这些读取均成功，没有以打开计数冒充失败或大规模 worker 的正文读取证明。

12 次进程实测：check baseline YAML 4 / source opens 2，source/generated YAML 2 / opens 2；其余三个同步场景 baseline 6/4，source/generated 4/4。JSON 保留逐次完整输出和起止文件快照。计数不能外推为 wall、CPU、RSS 或生产容量收益。

## 定向变异

同一加载 hook 在独立测试进程内改写当前 `decision-metadata.ts`，不写工作区。每组先运行未变异对照，再运行变异；完整命令与 TAP 输出保存在 JSON。三组对照都通过，三个变异都使目标节点失败。

| 变异 | 内存替换 | 目标观察 |
| --- | --- | --- |
| `mutant-membership` | 在 `identity()` 先调用正式 parse；任何字段错误就返回空身份 | tags 为空的记录仍须参与重复 ID 判定，而重复 ID 不能成为关系目标 |
| `mutant-yaml` | 把正式 parse 的 `if (frontmatter.error !== null)` 改为 `if (false)` | 非 mapping、坏 YAML 和重复 key 的首项诊断不能被字段错误替代 |
| `mutant-fresh` | 把原始身份 helper 的新构造改为进程内仅保存第一次身份 | 后续 fresh 必须拒绝当前坏 YAML，不能复用早先合法身份 |

这些是具体错误敏感性证据，不是全面变异分数，也不表示需要产品引入 hook、全局缓存或变异框架。

## 自动化入口与实际结果

新原生测试文件为 `tools/decision-records/tests/source-frontmatter-reuse.test.ts`，6 个入口各有单独 Case。它经既有 DR 聚合入口加载；仓库 Gate、输入清单和索引的集成由项目 owner 完成。

| 实际命令或动作 | 结果 |
| --- | --- |
| `bun test tools/decision-records/tests/source-frontmatter-reuse.test.ts` 首次 | 4 通过 / 2 失败：测试期望把 YAML 的 `Flow sequence` 写成小写；CLI 实际按既有规则返回稳定的 current revision 错误，测试误期待内部身份异常原文。均为预期错误，未修改产品诊断。 |
| 同命令修正后 | 6 通过 / 0 失败。 |
| metadata/source-discovery/candidate-scaffold/scan-index-reuse/sync-preflight-lock/新文件的邻近选择 | 首次 26 通过 / 2 失败，均因 source-discovery 直接观察已经被替换的 `SourceFile.decisionId` 字段；按同份对象更新观察后由完整聚合再次覆盖。 |
| 首次 `tsgo --noEmit` | 找到两处旧来源构造字段、三处旧测试观察、新测试 source union 未收窄，以及独立并行变更中的类型错误；逐项按 owner 处理。 |
| `bun run test:decision-records-cli` 首次 | 394 通过 / 1 失败；唯一失败是生成声明的固定文件列表漏了新真实闭包中的 `decision-metadata.d.mts` 和 `decision-metadata-types.d.mts`。 |
| `bun test tools/decision-records/tests/generated-artifacts.test.ts --test-name-pattern='portable CLI API'` | 修改前复现相同列表失败；核对生成闭包后仅增加两项预期，隔离 TypeScript 消费者编译通过，1 通过 / 0 失败。原有声明 Case 的意图不变。 |
| `bun run test:decision-records-cli` 最终 | 395 通过 / 0 失败；包括新 6 节点、独立 fresh、事务/恢复、物理采集、Node 协议及隔离声明消费者。 |
| `tsgo --noEmit` 最终 | exit 0；全仓当时源码通过类型检查。 |
| 定点 `oxfmt --check`、`oxlint --type-aware --deny-warnings`、`git diff --check` | 本任务源码及新旧相关测试通过；不把定点检查写成全仓 lint 结果。 |
| 新文件 `bun test ... --pass-with-no-tests --test-name-pattern='a^' --reporter=junit ...` | exit 0；JUnit 实际报告 6 节点、6 skipped、0 failures。只证明发现，不能计为运行通过。未带 `--pass-with-no-tests` 的初始发现探测 exit 1，原因是有意不匹配任何测试；不是产品失败。 |

上述 `bun` 为固定 Bun 1.4.2；源码/生成 CLI 对照与变异由真实 Node 运行。最终领域聚合不证明 Windows 或所有宿主，也不代替全仓 `check:changed`、联合生成、版本与 Case/index 检查；这些由项目 owner 汇总交付。

## 最小性与证据边界

本次新增的是已有解析 owner 内的局部不可外部注入 frontmatter 的对象，而非新的 SDK 请求模式。它把身份、原始文本和解析状态带在一起；正式 raw 入口仍只信任自身新解析。旧 SourceFile 身份预填去除，维护入口对所选 ID 的漂移检查保留。无需维护等价 text 的额外比较分支、全局缓存、跨调用复用或无效化框架。

额外 frontmatter 对象在本次 scan 的来源数组中存活，允许合理常数开销；扫描结果不携带解析对象。不据本次小夹具声称新版本在所有命令、正文形态或平台上更快，也没有取得当前实现的 retained-heap 精确归因或容量上界。旧隔离原型的 RSS、wall 和 CPU 只保留为当时观察。
