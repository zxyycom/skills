# Change Plan

### Case CHANGE-PLAN-ARCHIVE-GATES-001: 归档拒绝未通过内容门禁的计划
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects plans that fail content gates`
- `bun test --test-name-pattern="^archive rejects plans that fail content gates$" ./tools/change-plan/tests/run.ts`
Contract:
- Change plan 只有在 proposal、design 和 tasks 满足归档门禁后才能归档。
Proves:
- 未完成或无效计划保持在活动目录并返回阻断诊断。

### Case CHANGE-PLAN-ARCHIVE-SOURCE-001: 归档拒绝不安全源路径
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects unsafe source paths`
- `bun test --test-name-pattern="^archive rejects unsafe source paths$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档源必须是受管理活动目录中的安全 change 路径。
Proves:
- 越界、别名或不受支持的源路径不会触发文件移动。

### Case CHANGE-PLAN-ARCHIVE-TARGET-001: 归档拒绝无效目标目录
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects invalid target directories`
- `bun test --test-name-pattern="^archive rejects invalid target directories$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档目标必须满足生命周期目录与目标命名约束。
Proves:
- 冲突或非法目标目录在写入前被拒绝。

### Case CHANGE-PLAN-ARCHIVE-MOVE-001: 完整计划被原子归档
Entry:
- `tools/change-plan/tests/archive.test.ts > archive moves complete plans and preserves their content`
- `bun test --test-name-pattern="^archive moves complete plans and preserves their content$" ./tools/change-plan/tests/run.ts`
Contract:
- 完整计划归档后必须从活动目录移动到归档目录并保持内容。
Proves:
- 源目录消失、目标目录存在，三个计划制品内容保持不变。

### Case CHANGE-PLAN-CATALOG-LIFECYCLE-001: 目录按生命周期列出计划
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog lists active, archived, and all change plans`
- `bun test --test-name-pattern="^catalog lists active, archived, and all change plans$" ./tools/change-plan/tests/run.ts`
Contract:
- Change catalog 必须支持 active、archived 与 all 生命周期筛选。
Proves:
- 每种筛选只返回对应生命周期且排序稳定的计划。

### Case CHANGE-PLAN-CATALOG-INVALID-001: 无效计划仍可被发现
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog keeps invalid change entries discoverable`
- `bun test --test-name-pattern="^catalog keeps invalid change entries discoverable$" ./tools/change-plan/tests/run.ts`
Contract:
- 结构或内容无效的 change 不得从目录查询中静默消失。
Proves:
- 无效条目仍返回身份和诊断，便于定位修复。

### Case CHANGE-PLAN-CATALOG-ROOTS-001: 生命周期根目录错误可诊断
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog reports inaccessible and malformed lifecycle roots`
- `bun test --test-name-pattern="^catalog reports inaccessible and malformed lifecycle roots$" ./tools/change-plan/tests/run.ts`
Contract:
- 不可访问或形态错误的生命周期根目录必须产生明确诊断。
Proves:
- 根目录读取失败不会被解释为空 catalog。

### Case CHANGE-PLAN-CATALOG-SHOW-001: Show 保留生命周期与分发 API 一致性
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog shows lifecycle status with bundled API parity`
- `bun test --test-name-pattern="^catalog shows lifecycle status with bundled API parity$" ./tools/change-plan/tests/run.ts`
Contract:
- Show 结果必须包含计划生命周期，并与 bundled API 输出一致。
Proves:
- 源实现和分发实现对同一 change 返回相同状态与制品。

### Case CHANGE-PLAN-CATALOG-SYMLINK-001: Catalog 不发现符号链接 change
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog does not discover symbolic-link change directories`
- `bun test --test-name-pattern="^catalog does not discover symbolic-link change directories$" ./tools/change-plan/tests/run.ts`
Contract:
- Change catalog 只发现受管理根目录中的真实目录。
Proves:
- 指向其他位置的符号链接目录不会被登记为 change。

### Case CHANGE-PLAN-CHECK-COMPLETE-001: 完整计划通过检查且 API 一致
Entry:
- `tools/change-plan/tests/check.test.ts > check accepts a complete plan with bundled API parity`
- `bun test --test-name-pattern="^check accepts a complete plan with bundled API parity$" ./tools/change-plan/tests/run.ts`
Contract:
- 制品完整且内容有效的计划应通过源 API 与 bundled API 检查。
Proves:
- 两种入口都返回成功且无诊断。

### Case CHANGE-PLAN-CHECK-PATH-001: 检查报告 change 目录路径问题
Entry:
- `tools/change-plan/tests/check.test.ts > check reports change directory path diagnostics`
- `bun test --test-name-pattern="^check reports change directory path diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 目录名称与位置必须满足路径契约。
Proves:
- 非法目录身份产生可定位的路径诊断。

### Case CHANGE-PLAN-CHECK-ARTIFACTS-001: 检查报告 proposal 与 tasks 问题
Entry:
- `tools/change-plan/tests/check.test.ts > check reports proposal and task artifact diagnostics`
- `bun test --test-name-pattern="^check reports proposal and task artifact diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Proposal 和 tasks 的必需结构与完成状态必须被逐项检查。
Proves:
- 缺失或无效制品产生对应文件和规则诊断。

### Case CHANGE-PLAN-CLI-CHECK-001: Check CLI 保持文本与 JSON 退出契约
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check preserves text and JSON exit contracts`
- `bun test --test-name-pattern="^CLI check preserves text and JSON exit contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- Check CLI 的文本和 JSON 模式必须表达相同结果与退出码。
Proves:
- 成功和失败计划在两种输出模式下具有一致状态。

### Case CHANGE-PLAN-CLI-LIST-001: List CLI 筛选生命周期并拒绝非法选项
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI list filters lifecycle status and rejects invalid options`
- `bun test --test-name-pattern="^CLI list filters lifecycle status and rejects invalid options$" ./tools/change-plan/tests/run.ts`
Contract:
- List CLI 只接受受支持的生命周期筛选和参数组合。
Proves:
- 合法筛选返回对应计划，非法选项产生参数错误。

### Case CHANGE-PLAN-CLI-SHOW-001: Show CLI 返回制品与无效计划诊断
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI show returns artifacts and invalid-plan diagnostics`
- `bun test --test-name-pattern="^CLI show returns artifacts and invalid-plan diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Show CLI 必须同时呈现计划制品和当前有效性诊断。
Proves:
- 已知有效与无效计划都可查询，且无效状态不会被隐藏。

### Case CHANGE-PLAN-CLI-ARCHIVE-001: Archive CLI 执行门禁与移动
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI archive enforces gates and moves complete plans`
- `bun test --test-name-pattern="^CLI archive enforces gates and moves complete plans$" ./tools/change-plan/tests/run.ts`
Contract:
- Archive CLI 必须复用归档门禁并只移动完整计划。
Proves:
- 无效计划被拒绝，完整计划被移动到归档生命周期。

### Case CHANGE-PLAN-CLI-ARGS-001: CLI 帮助与参数错误稳定
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI help and argument errors use stable exit contracts`
- `bun test --test-name-pattern="^CLI help and argument errors use stable exit contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- 帮助请求和参数错误必须使用稳定输出与退出码。
Proves:
- Help 成功返回，缺失或冲突参数以参数错误退出。

### Case CHANGE-PLAN-GENERATED-ARTIFACTS-001: 生成制品公开 API 与来源信息
Entry:
- `tools/change-plan/tests/generated-artifacts.test.ts > generated artifacts expose the public API and portable source metadata`
- `bun test --test-name-pattern="^generated artifacts expose the public API and portable source metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- Change Plan 分发制品必须公开约定 API，并携带可移植维护来源。
Proves:
- 生成脚本、声明与 source map 包含所需导出和仓库相对元数据。
