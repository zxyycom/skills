# Gate Check 类型接入

本文承接按类型实施 Gate Check 的精确接入步骤；先按[编写与接入](gate-check-authoring.md)确定证明责任、类型、公共契约及交付验收。

## 语义命令 Check

按证明义务选择最小充分层级：规则矩阵由纯函数或轻量领域函数验证，真实接线、失败与恢复由必要集成测试验证。
同进程 CLI、真实 Node 和 Git fixture 的边界见[工具链](test-maintenance.md#工具-cli-与-git-fixture-测试边界)。
调整测试层级时，确认每项证明由哪个保留入口继续承担并更新 Case/index；成本按同机实际工作量另行报告。

1. 确认精确测试入口和实际加载边界。共同协议归共同 owner，两域 adapter 各自保留；源码 CLI 矩阵与真实生成 Node smoke 分别归位。多个文件共同证明同一契约时，可建立只导入这些文件的 `tests/checks/<contract>.ts` 容器；Test Evidence 登记框架可独立选择与报告的最小原生测试入口，而非容器。
2. 在 `semanticGateChecks` 增加声明，例如消费分发制品的 Check：

   ```ts
   {
     checkId: "test:<owner>:public-distribution",
     toolIds: ["<existing-capability-id>"],
     displayName: "<Owner> public distribution",
     requiredTag: undefined,
     command: bunTest("./tools/<owner>/tests/checks/public-distribution.ts"),
     generationSkillNames: ["<consumed-skill-name>"],
     dependsOn: ["script:check:skill-updaters"]
   }
   ```

3. 为该 ID 核对能力订阅与统一领域声明的 `kind`、`files`、`additionalInputs`；精确 runner/路径直接来自实际 `command`，Bun 与 Node 均独立执行。上例的能力 ID 须替换为已声明的实际能力，`generationSkillNames` 列出该消费者实际读取的 skill，用于显式范围的生成前置。显式质量类别、完整输入闭包与领域代码范围分别按[领域声明契约](gate-check-authoring.md#领域范围与检查订阅)核对。
4. 更新 `scripts/vibe-check-catalog-fixture.ts` 的 ID、runner、命令与前置期望；catalog 测试从 wrapper 的磁盘 imports 推导 leaf，并核对领域聚合入口，不另维护逐文件副本。
5. 当前数量变化时同步[工具链 catalog 事实](gate-execution.md#catalog-与选择)，测试变化按 Test Evidence owner 同步 Case/index。

## 包脚本 Check

1. 在 `package.json#scripts` 建立或确认稳定维护命令，将名称加入 `releaseRequiredPackageScripts`。
2. 适配器构造独立 `commandCheck`；需要生成物时在 `packageScriptDependencies` 声明统一 provider，并在相邻生成消费元数据中声明实际 skill。
3. 在 `packageScriptToolSubscriptions` 声明能力订阅，核对统一领域类别、输入投影与 Definition/package-adapter/catalog 测试期望。显式 `code` 或 `declarations` 领域带入 `typecheck`、`lint`、`format:check` 时，仍保留这些命令的完整实际输入；`validate` 由 `repository-validation` 或 `skill-validator` 选中，不加入公共 quick 基线。

已有语义 Checks 完整覆盖的 `test:*` 聚合 script 保留人工领域回归入口，不重复登记 Gate leaf。统一生成入口已覆盖的领域生成命令也保留人工入口，由统一 Gate Check 承接。

## 原生 Check

1. 读取对应随包文档，确认完整 patterns、默认排除、finding policy、限制、waiver、工具及 unavailable 边界。
2. 在原生 Check owner 中调用 package-root 构造器，加入环境与资源声明；项目质量 finding 显式 blocking。
3. 新增项将稳定 ID 加入 `vibeNativeCheckIds`；调整 options 时保留 ID，并核对完整 Definition 与 release-required 集合。
4. 全部原生维护材料复用[项目文件政策](gate-policy.md#原生材料范围与质量政策)，不能只给指标补例外而让 JSON、Markdown 或密钥检查继续漏扫同一维护目录；新增 selection 时保留显式默认排除开关与完整保护。维护范围变化同时复核安全上限与历史材料边界。文件/函数指标的 selected 材料只从 `kind: code` 领域的 `files` 派生维护代码投影，不另建路径表；各领域独立排除后取并集，额外输入不扩大投影。`declarations` 不启动空代码指标，已选 `code` 材料意外为空仍严格失败。重复检测保持 `repository-code` 订阅及完整维护代码比较。changed/full/CI/release 保留完整原生材料范围，其余原生检查不按领域收窄。自动 changed 将 Markdown 内容检查的完整磁盘 source 集合纳入输入证明，覆盖 ignored、根目录与额外目录材料，精确命中才可省略。quick/显式范围不使用此证明；适用原生材料每轮结算，计算事实缓存只复用执行中的计算，不充当 passed receipt。
5. 使用现有 selection、blocking、metrics 或 Definition 测试验证项目配置、范围与阻断义务。

## 自定义与 release DAG Check

1. 只有原生材料或独立命令不能表达领域契约时，才使用 `defineCheck`；领域实现保留直接 owner，`definition.ts` 只组合。
2. 明确 options、context needs、取消、data/Records/handoff 和可信终态；只在需要验证/准备时增加 `prepare`。
3. release prepare → authorization → pack 传递同一 private snapshot。依赖声明、provider 原对象、跨 Run 隔离与 machine 摘要边界须保持；pack 不重读 index。
4. 需要必达清理的调用方资源使用自身 `try/finally`，不把 scheduler terminal effect 当作 `finally`。
