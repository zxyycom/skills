# Gate Check 编写与接入

本文指导维护者在本仓库新增、修改或移除 Gate Check。完成一次接入，需要同时得到可归因的 Check 声明、完整的增量影响契约、对应测试证据和通过的项目门禁。

[项目工具链](tooling.md#权威-vibe-门禁)拥有 Gate 的当前运行时架构、增量证明、调度、输出和 release 行为；本文拥有编写与接入流程；Vibe Check 公共 API 的精确字段和生命周期由当前安装版本的随包文档与类型声明承接。

## 推荐工作流

开始编辑前检查主仓库状态，阅读 [编码规范](coding-style.md)，并确认目标 catalog、测试和 Test Evidence Case 可以安全延续。然后按顺序执行：

1. 写出 Check 的证明契约、直接失败 owner、完整输入、稳定重跑命令、成功前置和 base/release 归属。
2. 选择原生、语义、包脚本、自定义或 release DAG Check 中责任最小的类型。
3. 在对应 owner 模块实现并接入完整 Definition。
4. 同步 impact contract、catalog 测试期望，以及适用的 Test Evidence Case。
5. 运行直接入口、Gate 测试和项目权威门禁，并分别报告结果。

以下输入必须在实施前明确：

| 输入 | 完成标准 |
| --- | --- |
| 证明契约 | 可以独立陈述并验收一个结果。 |
| 失败 owner | 失败能直接定位到一个领域 owner。 |
| 输入范围 | 已列出会改变结论的现有 impact tags，或明确需要建立的新 owner tag。 |
| 重跑入口 | 一条 Bun 或 Node 命令可以独立重现结果。 |
| Check 关系 | 已区分成功前置、任意终态观察和纯调度关系。 |
| Gate profile | 普通产品验证进入 base；只有真实交付事务进入 release-only。 |

新验证与已有 Check 证明相同契约且拥有相同失败 owner 时，扩展已有 Check。形成独立证明契约或不同失败 owner 时，再建立新的稳定 Check 身份。

## 选择 Check 类型

| 目标 | 类型 | 声明位置 |
| --- | --- | --- |
| 配置 Vibe 提供的重复、指标、JSON、Schema、Markdown 或密钥检查 | 原生 Check | `scripts/lib/vibe-gate/checks/native.ts` |
| 用精确 Bun/Node 测试命令证明项目契约 | 语义 Check | `scripts/lib/vibe-gate/checks/semantic.ts` |
| 将已有稳定 `package.json` 维护命令作为独立门禁 | 包脚本 Check | `package.json`、`scripts/lib/vibe-gate/checks/package-script.ts` |
| 需要自定义 options、preflight、结构化 data、Records 或非命令式生命周期 | 自定义 Check | 直接 owner 模块，由 `scripts/lib/vibe-gate/definition.ts` 组合 |
| 捕获、授权或消费同一 release snapshot | release DAG Check | `scripts/lib/vibe-gate/checks/release.ts` |

项目测试默认使用语义 Check。包脚本 Check 保留稳定的人工聚合或维护命令身份，不作为语义 Check 的替代容器。

当前 release-only 契约只包含 snapshot prepare、version authorization 和 packaging。新增 release-only Check 会改变[增量 Vibe Gate 决策](decisions/incremental-vibe-gate.md)保存的长期交付边界；实施前必须按 Decision Records 流程演进该决策，并复核 release DAG、snapshot 一致性和失败恢复。

## 按需读取 Vibe Check 随包文档

项目通过 TypeScript Definition 使用 `@zxyycom/vibe-check`，不维护额外 Gate 配置文件或第二套 runner。完成依赖安装后，按任务读取当前 lockfile 所安装版本的文档：

| 任务 | 随包文档 |
| --- | --- |
| 查看内置 Check 和最小 `defineCheck` / `defineConfig` 示例 | `node_modules/@zxyycom/vibe-check/README.md` |
| 判断 Definition、Run controls、selection、aggregation 和结果边界 | `node_modules/@zxyycom/vibe-check/docs/api-mechanics.md` |
| 编写 lifecycle、terminal outcome、Records 或取消协作 | `node_modules/@zxyycom/vibe-check/docs/guides/extending-check-lifecycle.md` |
| 使用 `dependsOn`、`observes` 和类型化 provider data | `node_modules/@zxyycom/vibe-check/docs/guides/check-dependencies.md` |
| 配置资源、并发、调度或输出 | `node_modules/@zxyycom/vibe-check/docs/guides/scheduling.md`、`node_modules/@zxyycom/vibe-check/docs/guides/run-outputs.md` |
| 配置内置 Check | `node_modules/@zxyycom/vibe-check/docs/checks/<check-name>.md` |
| 读取 machine publication | `node_modules/@zxyycom/vibe-check/docs/output.md` |
| 核对精确签名、泛型和 JSDoc | `node_modules/@zxyycom/vibe-check/types/**/*.d.ts` |

随包文档必须与当前安装版本一致；上游分支文档只用于了解候选变化，不能替代本仓库实际依赖的 API 契约。

## Check 编写契约

### 身份与粒度

1. `checkId` 是稳定 machine-facing 身份。显示名、声明顺序、资源配置、耗时或测试容器变化不改变其语义身份。
2. 语义 Check 使用 `test:<owner>:<contract>`；`owner` 对应领域 owner，`contract` 描述稳定证明契约。
3. 包脚本 Check 由适配器派生为 `script:<package-script>`。
4. `displayName` 使用简短英文描述检查对象，稳定身份和契约仍由 `checkId` 与测试责任表达。
5. 一个 Check 聚合同一契约和失败 owner 下的测试。多个测试文件可以由 `tests/checks/<contract>.ts` 容器导入；Test Evidence 只登记 runner 能独立选择和报告的最小原生测试入口。

### 执行与终态

1. 普通 Bun/Node 命令通过现有 command adapter 以参数数组执行，声明的命令同时作为稳定重跑入口。
2. 自定义 `execution` 用 `passed` 表示结论成立，用 `failed` 表示规则被违反，用带稳定 `reason.code` 的 `unavailable` 表示无法形成可信结论，用 `not-applicable` 表示当前没有适用工作。
3. `passed` 和 `failed` 返回 object-shaped `data`；Records 只保存不决定终态的补充事实。
4. 可等待的 I/O 或子进程接收取消 signal；取消后的部分结果按 `unavailable` 处理。
5. 完整或敏感诊断写入 Check-owned artifact；终端 message 保持有界、单行并给出可执行的下一步。

### 关系、选择与资源

1. `dependsOn` 声明成功前置：所有直接 provider 都 `passed` 后才执行 consumer。消费 provider data 时仍通过 dependency reader 和 provider parser 校验边界。
2. `observes` 等待并审计 provider 的任意终态。纯执行顺序由 scheduler 处理，逻辑互斥使用 `mutex`，可计数并发压力使用 `resourceClaims`。
3. command Check 通常使用一个 `external-process`；原生全仓扫描通常使用一个 `repository-scan`；同时真实消耗两类资源时才组合 claims。
4. 每次 invocation 构造相同的完整 Check ID 集合。base 增量执行由项目生成内部 activation flags，不通过动态删除 Definition 成员实现。
5. 当前唯一公开 tag 是 `release`。新增 tag 属于 Gate 产品契约变化，需要独立设计与验证。

### 增量影响契约

每个 base Check 都必须进入 `scripts/lib/vibe-gate/impact-catalog.ts` 形成的完整 impact contract 集合。直接输入范围覆盖不足会错误复用旧证明；边界尚未明确时使用现有较宽 tag，确认 owner 后再收窄。

| Check 类型 | impact contract 接入 |
| --- | --- |
| 原生 Check | 在 `nativeContracts` 声明直接输入 tags。 |
| 包脚本 Check | 在 `packageContracts` 显式声明直接输入 tags。 |
| 语义 Check | 由 `semanticImpactTags(checkId)` 按 owner 前缀派生；未映射 owner 保守使用 `global`。 |

新增 owner tag 时，同步 tag 类型与全集、tag 依赖、`impact-paths.ts` 的路径分类和传播行为测试。`dependsOn` 表达本次运行的成功前置，impact tag dependency 表达跨运行的输入变化传播，两者分别维护。

## 按类型接入

### 语义 Check

1. 建立或确认精确测试入口。多个测试文件共同证明同一契约时，建立只导入这些文件的 `tests/checks/<contract>.ts` 容器。
2. 在 `semanticGateChecks` 增加稳定声明：

   ```ts
   {
     checkId: "test:<owner>:<contract>",
     displayName: "<Owner> <contract>",
     requiredTag: undefined,
     command: bunTest("./tools/<owner>/tests/checks/<contract>.ts")
   }
   ```

3. consumer 真实依赖生成物或包脚本 Check 成功时，增加精确前置：

   ```ts
   dependsOn: ["script:check:<owner>-cli"]
   ```

4. 核对 `semanticImpactTags(checkId)` 的 owner tag。
5. 更新 `scripts/vibe-check-catalog-fixture.ts` 的 Check、命令路径与前置期望，以及 catalog 测试中明确断言的 owner 或文件数量。
6. 更新 `docs/tooling.md`、Gate Definition 测试和 Test Evidence Case 中明确承接 catalog 数量的当前事实。

没有生成前置的 Bun 语义 Check 自动进入 release 测试批次；Node Check 和带 `dependsOn` 的 Bun Check 保持独立执行。批次资格服从真实 runner 与依赖关系。

### 包脚本 Check

1. 在 `package.json#scripts` 建立或确认稳定维护命令。
2. 将 script 名加入 `releaseRequiredPackageScripts`，由适配器生成 `script:<script-name>`。
3. 在 `packageContracts` 声明完整直接 input tags。
4. 命令为可直接批量执行的 `bun test <files...>` 时，在 `releaseBunTestPackageFiles` 登记与 `package.json` 完全一致的文件列表；其他命令保持独立进程。
5. 更新 Definition、package adapter、release batch 和 impact contract 测试期望。

已有语义 Checks 完整覆盖的 `test:*` 聚合 script 保持人工领域回归入口，无需重复登记为 Gate leaf。

### 原生 Check

1. 阅读随包 `docs/checks/<check-name>.md`，确认文件选择、finding policy、限制、waiver、外部工具和 unavailable 边界。
2. 在 `createVibeNativeChecks()` 使用 package-root helper 配置；项目质量 finding 显式选择 blocking policy。
3. 新增项时，将 helper 的稳定 ID 加入 `vibeNativeCheckIds`，并在 `nativeContracts` 声明输入 tags；调整现有 options 时保持 ID。
4. 复用已有 selection 与 exclusion；维护范围变化时同步审查 impact path、安全上限和历史内容排除。
5. 用 native selection、blocking、metrics 或 Definition 测试证明配置和阻断行为。

### 自定义或 release DAG Check

1. 现有三类接入无法表达目标时，按随包 lifecycle、dependency 和 scheduling 指南使用 `defineCheck(...)`。
2. 规则可以直接测量并结算时只实现 `execution`；需要验证或准备 invocation-local options 时增加 `preflight`。
3. consumer 读取 provider 业务 data 时，由 provider 提供 `parseData` 并在消费边界解析。
4. 领域实现保留在直接 owner 模块，`definition.ts` 只负责组合。
5. release Check 明确 snapshot 的产生者、授权者、消费者、内存状态清理和失败恢复，并让整个 DAG 消费同一 snapshot。

## 验证与交付

按改动范围依次验证：

1. 运行新 Check 声明的 Bun/Node 命令。
2. 修改 Definition、catalog、adapter、impact 或调度实现时运行：

   ```sh
   bun run test:check
   ```

3. 修改测试及 Test Evidence Case 时，先按 [Test Evidence Review](../skills/test-evidence-review/SKILL.md) 审查最小原生测试入口，再同步和检查：

   ```sh
   bun run sync:test-evidence-catalog
   bun run check:test-evidence-catalog
   ```

   `sync:test-evidence-catalog` 写入派生索引；`check:test-evidence-catalog` 取得或重新生成项目测试快照，并检查 Case 引用和实体覆盖。需要人工交接快照时，使用 `bun run snapshot:test-evidence -- --output <new-file>`。

4. 运行项目唯一权威门禁：

   ```sh
   bun run check
   ```

5. 改变 release DAG、release 测试批次、version authorization 或 packaging 时，运行冷 release Gate：

   ```sh
   bun run check --tag release --cold
   ```

交付前确认 Check 身份与证明契约一致，重跑命令有效，关系与资源表达真实责任，完整 Definition、impact contract、catalog fixture、release batch 和 Test Evidence 保持一致。交付报告分别列出直接命令、Gate 测试、base Gate 与 release Gate 的实际结果；未执行的入口明确保留为未验证边界。
