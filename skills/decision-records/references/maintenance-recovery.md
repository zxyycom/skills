# 决策记录状态与维护恢复

本手册承接首次候选审核状态，以及 CLI 无法使用、索引缺失或损坏、写入中断，或严格 `check` 失败且普通诊断不足时的维护恢复。决策语义和维护不变量以 [决策记录规则](decision-record-rules.md) 为准。

## 恢复原则

1. 优先保留全部决策 Markdown；它们是身份、tags、生命周期、内容和关系的权威来源。
2. `decision-index.json` 是可重建查询投影。索引不能反向覆盖 Markdown 或补造新事实。
3. 无法从现有材料确定的决策语义、分类、生命周期、时间或关系必须交给用户判断；不从目录名、文件时间、索引或默认值猜测。
4. 工具不可用时停止索引和状态维护，先恢复当前 skill 分发单元。
5. CLI 的 stderr 诊断只说明本次命令：先按 `code`、对象、原因和下一步定位；只有出现
   `scope` 与 `outcome` 时才按声明 mutation 范围判断恢复。它不产生可供以后查询的日志或
   receipt。

## 判断状态与故障

1. 按 `--root` 和可选 `--decisions-dir` 解析决策根目录，确认根目录 Markdown、`archive/` 与索引是否可读。
2. 根目录整体不存在且项目从未记录决策时，集合只是尚未初始化。
3. ID、tags、状态—位置或 Markdown 结构无效时，先修复权威 Markdown；索引重建不能替代缺失判断。
4. **首次候选集合**同时满足：集合中有一个或多个合法 `candidate`，没有 `active` 或 `archived` 的已建立记录，且不存在正式索引。使用 `candidates` 与 `show-candidate` 区分 scaffold/body readiness，并可运行严格 `check` 验收结构；不运行 `sync-index`。候选正文、语义审核和建立授权彼此独立，只有经授权首次 `activate` 建立索引后才形成正式集合。
5. 权威来源有效而索引缺失、无法解析或陈旧时，按“重建索引”处理。
6. 状态或关系命令疑似中断、或事务恢复失败时，比较权威 Markdown、索引和可用的最后可信版本，确认是否形成完整一致的旧状态或新状态。
7. CLI 无法启动或分发文件不完整时，按“恢复工具”处理。

## 重建索引

从 skill 目录运行：

```text
node scripts/decision-records.mjs sync-index --root <resolution-root>
node scripts/decision-records.mjs check --root <resolution-root>
```

显式使用自定义决策目录时，两条命令传入相同的 `--decisions-dir`。同步从全部合法已建立 Markdown 重建统一索引；来源无效时命令失败并保留原索引。

重建后按需运行 `list --status all --alignment all`、`show <decision-id>` 或 `trace <decision-id>`，确认预期 ID、位置、内容和关系可恢复。

## 恢复中断写入

1. `no-change` 只表示声明范围没有改变；先修正前置条件后重新执行显式命令。
2. `rolled-back` 表示失败后的完整旧范围已恢复；复核诊断后从当前事实重新发起操作。
3. `partial-or-unknown` 时不得重试、删锁或补写；先比较权威 Markdown、索引和可用的最后
   可信版本，无法唯一确定完整旧/新状态时交给用户。
4. `committed-cleanup-pending` 时，领域提交点已经越过；核对已完成的 Markdown 与索引及
   明确报告的残留 cleanup，再决定是否进行新的 mutation。
5. 权威 Markdown 已形成完整一致的新状态时，以它们为准重建索引。
6. 只写入部分文件、位置与 status 不一致，或目标含义无法确定时，从可信副本恢复命令前的完整 Markdown 和索引组合；不根据部分索引补齐。
7. 恢复后运行严格 `check`，再核对受影响记录的 ID、sourcePath、tags、生命周期、内容和必要关系。
8. 不为消除错误删除无法解释的记录、关系或建立时间。权限不足时授权当前进程而非使用
   `sudo`；lock busy 时等待或确认活动进程，绝不由工具或 agent 自动删除锁。

## 恢复工具

1. Node 不可用但存在兼容运行时时，可以用该运行时执行同一 `scripts/decision-records.mjs`，例如 `bun scripts/decision-records.mjs check ...`。
2. 当前 skill 分发文件损坏时，优先使用相邻 `scripts/update-skill.mjs` 检查并恢复完整 skill；不要单独复制 CLI、声明或 Schema。
3. 当前工具仍无法恢复且任务要求改变决策集合时，保留全部来源文件，报告阻断和已确认的故障边界。

## 完成检查

1. 全部 Markdown 保持完整，未从索引或默认值制造新事实。
2. 已建立集合的索引能够由当前来源重建，严格 `check` 成功；首次候选集合的 scaffold 可由 `check` 验收，但 body readiness、语义审核和建立仍按各自边界判断。后续若经授权首次 `activate` 建立索引，再按常规契约运行严格 `check`。
3. 受影响记录的 ID、位置、tags、生命周期、内容和关系与恢复目标一致。
4. 仍无法确定的语义或状态已明确交给用户判断。
