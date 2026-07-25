# 决策记录维护恢复

本手册只在 CLI 无法使用、索引缺失或损坏、写入中断，或严格 `check` 失败且普通诊断不足时读取。决策语义和维护不变量仍以 [decision-record-rules.md](decision-record-rules.md) 为准。

## 恢复原则

1. 优先保留 `decision-domains.json` 和全部决策 Markdown；它们是权威来源。
2. `decision-index.json` 是可重建查询投影。索引内容不能反向覆盖领域定义或 Markdown。
3. 无法从现有材料确定的领域边界、决策语义、生命周期、时间或关系需要用户判断，不使用目录名、文件时间或默认值猜测。
4. 工具不可用时停止索引和状态维护，先恢复当前分发单元。

## 判断故障

1. 按 `--root` 和可选的 `--decisions-dir` 解析决策根目录，确认领域目录表、Markdown 和索引是否可读。
2. 决策根目录整体不存在且项目从未记录决策时，集合只是尚未初始化。
3. 领域目录表或 Markdown 无效时，先修复权威来源；索引重建不能替代缺失判断。
4. 权威来源有效而索引缺失、无法解析或陈旧时，直接按“重建索引”处理。
5. 状态命令疑似中断或报告恢复失败时，比较当前权威来源、索引和可用的最后可信版本，判断写入是否形成完整一致的新状态。
6. CLI 无法启动或分发文件不完整时，按“恢复工具”处理。

## 重建索引

从 skill 目录运行：

```text
node scripts/decision-records.mjs sync-index --write --root <resolution-root>
node scripts/decision-records.mjs check --root <resolution-root>
```

显式使用自定义决策目录时，两条命令传入相同的 `--decisions-dir`。同步从当前领域定义和全部已建立 Markdown 生成完整索引；来源无效时命令失败并保留原索引。

重建后按需运行 `list --status all --alignment all`、`show` 或 `trace`，确认预期成员、内容和关系能够恢复。

## 恢复中断写入

1. 权威来源已经形成完整一致的新状态时，以这些来源为准重建索引。
2. 只写入了部分文件，或目标含义无法确定时，从可信副本恢复命令前的完整组合，不根据部分索引补齐。
3. 恢复后运行严格 `check`，再核对受影响记录的完整内容和必要关系。
4. 不为消除错误删除无法解释的记录、关系或建立时间。

## 恢复工具

1. Node 不可用但存在兼容运行时时，可以用该运行时执行同一 `scripts/decision-records.mjs`，例如 `bun scripts/decision-records.mjs check ...`。
2. 当前 skill 分发文件损坏时，优先使用相邻 `scripts/update-skill.mjs` 检查并恢复完整 skill；不要单独复制 CLI、声明或 Schema。
3. 当前工具仍无法恢复且任务要求改变决策集合时，保留全部来源文件，报告阻断和已经确认的故障边界。

## 完成检查

1. 领域目录表和全部决策 Markdown 保持完整，未从索引或默认值制造新事实。
2. 索引能够由当前来源重建，严格 `check` 成功。
3. 受影响记录的生命周期、内容、领域和关系与恢复目标一致。
4. 仍无法确定的语义或状态已明确交给用户判断。
