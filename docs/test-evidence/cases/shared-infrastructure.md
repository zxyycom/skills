# 仓库检查与共享基础设施

### Case CHECK-PLAN-SCRIPTS-001: 完整检查计划保持稳定脚本顺序
Entry:
- `scripts/check.test.ts > check plan exposes every package script in execution order`
- `bun test --test-name-pattern="^check plan exposes every package script in execution order$" ./scripts/check.test.ts`
Contract:
- 完整检查计划必须显式列出全部 package script，并保持约定的执行顺序。
Proves:
- 实际前置任务名称和命令与仓库声明的稳定顺序完全一致。

### Case CHECK-OPTIONS-MODES-001: 完整检查选项具有严格解析契约
Entry:
- `scripts/check.test.ts > check options resolve concurrency and modes with strict validation`
- `bun test --test-name-pattern="^check options resolve concurrency and modes with strict validation$" ./scripts/check.test.ts`
Contract:
- 并发度和检查模式只接受受支持的默认值与显式取值。
Proves:
- 合法选项被正确解析，非法并发度和模式会在执行前被拒绝。

### Case CHECK-STATUS-OUTPUT-001: 检查状态决定输出与失败语义
Entry:
- `scripts/check.test.ts > check statuses and output preserve warning and failure semantics`
- `bun test --test-name-pattern="^check statuses and output preserve warning and failure semantics$" ./scripts/check.test.ts`
Contract:
- 成功、警告和阻断失败必须保留各自的状态、摘要和输出语义。
Proves:
- 可恢复警告不会被误判为阻断失败，真正失败仍产生失败结果。

### Case CHECK-STRICT-SCHEDULING-001: 严格模式在阻断失败后停止派发
Entry:
- `scripts/check.test.ts > strict scheduling stops new work and waits for running tasks`
- `bun test --test-name-pattern="^strict scheduling stops new work and waits for running tasks$" ./scripts/check.test.ts`
Contract:
- 严格模式遇到阻断失败后不得启动新任务，但必须等待已运行任务收尾。
Proves:
- 阻断失败后的待执行任务未被派发，已经启动的任务仍被完整回收。

### Case CHECK-WARNING-SCHEDULING-001: 警告模式允许后续检查继续
Entry:
- `scripts/check.test.ts > warning scheduling continues after recoverable failures`
- `bun test --test-name-pattern="^warning scheduling continues after recoverable failures$" ./scripts/check.test.ts`
Contract:
- 可恢复失败在警告模式下不得中断其余检查任务。
Proves:
- 警告结果被保留，同时后续任务仍完成执行。

### Case CHECK-WORKFLOW-PACKAGING-001: 打包只在无阻断失败时运行
Entry:
- `scripts/check.test.ts > workflow packages after warnings and skips after blocking failures`
- `bun test --test-name-pattern="^workflow packages after warnings and skips after blocking failures$" ./scripts/check.test.ts`
Contract:
- 完整工作流可在警告后打包，但任何阻断失败都必须跳过打包。
Proves:
- 警告路径调用打包，阻断失败路径不调用打包。

### Case CHECK-CLI-CONCURRENCY-001: CLI 在无效并发度下不启动检查
Entry:
- `scripts/check.test.ts > CLI reports invalid concurrency without starting checks`
- `bun test --test-name-pattern="^CLI reports invalid concurrency without starting checks$" ./scripts/check.test.ts`
Contract:
- CLI 必须在任务启动前验证并发度参数。
Proves:
- 无效并发度产生参数错误，且没有检查任务被执行。

### Case CHECK-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项
Entry:
- `scripts/check.test.ts > CLI reports unknown options without starting checks`
- `bun test --test-name-pattern="^CLI reports unknown options without starting checks$" ./scripts/check.test.ts`
Contract:
- 未声明的 CLI 选项不得被静默忽略。
Proves:
- 未知选项产生参数错误，且没有检查任务被执行。

### Case GENERATED-FILE-SOURCE-MAP-001: Source map 路径保持可移植
Entry:
- `scripts/lib/generated-file.test.ts > source map normalization keeps workspace sources portable`
- `bun test --test-name-pattern="^source map normalization keeps workspace sources portable$" ./scripts/lib/generated-file.test.ts`
Contract:
- 生成 source map 中的 workspace 源路径必须规范化为可移植相对路径。
Proves:
- 绝对路径和平台分隔符不会泄漏到规范化 source map。

### Case GENERATED-FILE-DECLARATION-001: 声明文件生成结果稳定
Entry:
- `scripts/lib/generated-file.test.ts > generated declarations normalize line endings and preserve the banner`
- `bun test --test-name-pattern="^generated declarations normalize line endings and preserve the banner$" ./scripts/lib/generated-file.test.ts`
Contract:
- 生成声明必须规范化换行，同时保留维护来源 banner。
Proves:
- 不同输入换行产生一致声明内容，且 banner 未被移除。

### Case GENERATED-FILE-DRIFT-001: 生成文件检查识别真实漂移
Entry:
- `scripts/lib/generated-file.test.ts > generated file checks ignore line-ending differences and detect drift`
- `bun test --test-name-pattern="^generated file checks ignore line-ending differences and detect drift$" ./scripts/lib/generated-file.test.ts`
Contract:
- 生成文件检查应忽略纯换行差异并报告实质内容漂移。
Proves:
- 等价换行通过检查，内容变化返回漂移诊断。

### Case SKILL-PACKAGE-HASH-001: Skill hash 使用待提交内容与独立版本
Entry:
- `scripts/lib/skill-package-hash.test.ts > package hashes use pending Git content and enforce independent skill versions`
- `bun test --test-name-pattern="^package hashes use pending Git content and enforce independent skill versions$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- Skill 包 hash 必须基于待提交 Git 内容，并按 skill 独立版本判断变更。
Proves:
- 工作区噪声不改变待提交 hash，打包内容变化要求对应 skill 提升版本。

### Case VERSION-CONTROL-STATES-001: 版本控制适配器区分仓库状态
Entry:
- `tools/shared/tests/version-control.test.ts > version control reads revision, pending, workspace, and failure states`
- `bun test --test-name-pattern="^version control reads revision, pending, workspace, and failure states$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 版本控制适配器必须分别读取 revision、pending、workspace 与命令失败状态。
Proves:
- 各状态返回正确内容，底层失败不会被伪装成空结果。
