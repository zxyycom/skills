# Gate 执行

本文承接项目 Gate 的执行选择与证明边界；验证责任见[项目验证模型](validation-model.md)，精确政策见 [Gate 政策](gate-policy.md)。

## 权威 Vibe 门禁

`check`、显式能力 scope、`check:changed`、`all` 与 release 共用同一权威 Gate。日常使用 quick 基线，按任务实际责任追加能力组；changed/all 供影响不明或全工作区验收时兜底。根开发依赖与锁文件固定 `@zxyycom/vibe-check@0.0.4`，`pnpm-workspace.yaml` 保留其精确 release-age 例外。

验证职责、证明与复用条件见[验证模型](validation-model.md)；新增、修改或移除 Check 时读 [Gate Check 编写与接入](gate-check-authoring.md)。以下记录公开选择、质量政策与运行边界。

日常从快速基线开始，按当前任务追加能力组：

```bash
bun run check
bun run check -- --list-scopes
bun run check -- --scope gate-tests
bun run check -- --scope mcpshell --scope generated-file
```

`scope` 决定执行范围；能力组是 `--list-scopes` 返回的订阅名，可重复传入并合并去重。选择只决定运行哪些检查；检查仍读取自身契约要求的真实输入，包括共享代码和全仓材料。

### Catalog 与选择

每次 invocation 构造相同的 69 项 Definition：环境 1 项、原生材料 8 项、维护脚本 20 项、语义测试 37 项、release 交付 3 项。base 范围为前四类共 66 项；普通产品验证属于 base，只有 snapshot prepare、version authorization 和 packaging 由 `release` tag 独占。

`gate-environment` 无 flag、每轮执行，复用 `node scripts/environment.js gate` 检查 Git、Node、可运行的 Bun、精确 pnpm 与精确 SCC；其余所有 Check 都显式依赖它。该窄 action 的工具版本 owner 和恢复路径见[环境自举](tooling-environment.md#环境自举)。环境失败作为真实 failed outcome 保留 transcript，其他 Check 因前置未通过而不启动。

CLI 使用以下执行范围；所有范围保持同一完整 Definition，实际执行由原生条件、flags 与成功前置决定：

| 范围 | 证明责任与执行选择 |
| --- | --- |
| quick（默认） | 执行固定基线：`gate-environment`、`secret-detection`、`json-validation`、`json-schema-validation`、`markdown-link-validation`、`markdown-lint`、`script:typecheck`、`script:lint`、`script:format:check`、`script:validate`。不预采集全工作区指纹或使用项目 receipt。 |
| selected（显式能力组） | quick 基线，加上与所选能力相交的 Check 及其传递成功前置；合并去重。直接执行，不采集全域指纹或读取/发布项目 receipt；其他工作区变更不自动增加组。 |
| changed | 完整 base 的变更相关验收。环境与除 Markdown 内容外的七项原生材料每轮结算；57 项项目命令与 Markdown 内容共 58 项按完整输入证明、共享工具 flag 与成功前置选择。 |
| full / CI base | 全部 66 项 base 实际执行，不使用 receipt；CI 将 quick/selected/changed 提升到 full，显式组不缩小 CI。 |
| release | 全部 66 项 base 与 3 项发布事务实际执行，不使用 receipt；版本授权与打包消费同一快照。 |

各 Check 独立验收；精确命令由失败重跑提示和 catalog 提供。显式选择以任务责任为依据，自动 changed 则根据共享输入变化带入其他订阅者；成功前置均须实际通过。局部成功只证明所选范围，未运行或复用与本轮实际通过分别报告。

CLI 只有 Run `completed`、严格有效 aggregate `passed`，且[适用性能政策](#性能报告与快速预算)通过才退出 0。有效集合中的 failed、unavailable 或意外 not-applicable 均阻断；rejection、取消、配置、planning、execution 或原生 output 失败在所有范围均退出 1。quick/selected 不发布成功证明；changed 的发布前提见[项目输入与成功证明](#项目输入与成功证明)。

Check 复用同一能力订阅声明。CLI 在执行及输入采集前校验以下参数：

- `--scope <能力组>`：可重复；取并集、去重并追加 quick 基线。未知或缺值失败，不降级为自动/全量。
- `--list-scopes`：只列出能力组，不构造或执行 Gate。
- `--scope quick|changed|full`：选择一个整体模式，与能力组、release 互斥。`selected` 是显式选组的内部模式名，通过能力名调用；CI base 的有效模式为 full。
- `--tag release`：唯一公开 tag，每次最多一次，与 `--scope` 互斥。
- `--full`：`--tag release` 的兼容别名，不能与该 tag 同用；全 base 使用 `--scope full`。
- `--baseline-ref <ref>`：仅 release 可用。值须已 trim、非空，不以 `-` 开头且不含 NUL、CR、LF；默认 `HEAD`。CLI 校验形状，Git revision 由 release prepare 解析。
- `--cold`：仅 release 可用，每次最多一次；release 本身已全执行，用于显式声明冷运行。
- `--diagnostic-log`：每次最多一次，只开启本次 diagnostic channels。

### 性能报告与快速预算

quick 须满足总墙钟 < 30s、P90 < 10s、mean < 5s；其他范围只报告。测量、采样和失败条件见[性能政策](gate-policy.md#性能报告与快速预算)。

### 项目输入与成功证明

只有自动 changed 使用完整输入精确匹配的项目证明，并在最终成功且输入无漂移时发布。quick/selected 不进入全域证明流程，不删除既有 receipt；完整事务见[输入证明政策](gate-policy.md#项目输入与成功证明)。

### 调度与命令执行

并行和资源上限是硬约束，独立检查仍分别结算；命令从仓库根执行并保留 transcript。配额、超时与失败语义见[调度与命令政策](gate-policy.md#调度与命令执行)。

### 运行产物与恢复

每次运行在 `.log/vibe-check/invocations/` 创建独立结果目录。失败时先按 CLI 提示从项目根重跑对应命令并查看 transcript；输入未闭合或采集失败时检查诊断并修复输入身份或声明。产物路径、计划与实际结果的区别及诊断字段见 [Gate 运行结果与诊断](gate-runtime.md)。

### 原生材料范围与质量政策

原生检查以项目选择范围和 blocking 政策结算，安全与覆盖缺口不得静默通过；精确范围、上限和规则见[原生材料质量政策](gate-policy.md#原生材料范围与质量政策)。

### 生成前置与发布快照

`script:check:skill-updaters` 是统一生成 provider。selected 合并所选消费者声明的 skill，用同源适配器检查完整可达源码、updater、manifest/lock 和受管产物；未选 skill 的无关漂移不加入前置。直接选择全域生成能力及 changed/full/release 仍做联合检查。分发消费者以原生 `dependsOn` 等待真实通过，不能用 receipt 冒充前置。

独立生成校验及 `--skill` 参数见[同步与只读检查](tooling-distribution.md#同步与只读检查)；领域 `check:*` / `sync:*` 继续供定位与同步。typecheck/lint 检查当前程序质量，生成一致性由生成前置另证；quick 保持自身基线。取舍见[显式本地验证范围](decisions/261027-prefer-explicit-local-gate-scopes.md)。

普通检查的工作树输入与 release 制品输入分别核对：普通命令从项目根运行并依自身契约读取材料，原生材料检查在适用范围内从磁盘选择；release prepare 捕获一次 Git `pending` 快照，默认 Git 实现将其映射到 index。因此 release 通过不证明未暂存 skill 改动已进入制品。

release DAG 固定为环境前置通过后：

1. `release:skill-prepare` 解析基线 revision，一次捕获 pending snapshot、hash、版本和 version issues。捕获或解析失败为 unavailable；存在版本问题仍完成 prepare。
2. `release:skill-version` 依赖 prepare 与全部 66 项普通 Check，只有它们可信 passed 才授权；版本问题使 authorization failed。
3. `pack:skills` 依赖 authorization，从已授权的同一内存 snapshot 恰好打包一次，不重读 index。

同一快照限于本次 Run；公开 machine data 只保存 baseline、问题计数等摘要。`hash:skills` 仍为独立 CLI，pre-commit 仍独立按 `HEAD` 校验待提交版本。

### Gate 实现入口

Gate 项目入口位于 `scripts/vibe-check.ts` 与 `scripts/lib/vibe-gate/`，环境入口为 `scripts/environment.js`；按任务从 [Check 接入](gate-check-authoring.md)和实际源码追踪具体 owner。Vibe 公共 API 以安装版本的随包文档和类型为准。

## 兼容入口

### 工具 CLI 与 Git fixture 测试边界

详见[测试边界](test-maintenance.md#工具-cli-与-git-fixture-测试边界)。

### 测试证据账本

详见[测试证据账本](test-maintenance.md#测试证据账本)。
