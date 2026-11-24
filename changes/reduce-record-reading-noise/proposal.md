# Proposal

精简决策、调查报告与资源记录中反复出现的占位和派生字段，让读者先看到实际内容。

## Why

独立报告也要列出空关系，逻辑文档入口也要声明没有文件；索引为每条记录重写可还原的名称和路径。查询仅取一条记录时，整库标签统计又会淹没命中项。这三处干扰分别来自源模板、索引格式和列表展示。

## Outcome

作者只填写适用于记录的字段；读者先看到索引条目，仍能按原有身份、路径、关系或附件定位记录。普通列表保留统计概况，完整统计可显式获取。

## Scope

### Intended Change

调整三域的源 YAML 和派生索引；仅对决策、调查的普通 `list` 限制标签明细。字段规则和命令边界见[设计](design.md)。

### Resulting Impacts

源格式兼容、索引版本与全量重建、公开 CLI 输出分别验收。同步受影响的领域说明、机器 Schema、分发输入和仓库索引。

## Success Criteria

1. 旧 YAML 原样可读；精简写法得到相同记录事实，非法状态仍能被识别。
2. 新工具从来源重建精简索引，完整检查通过，再同步无变化；查询、来源校验和按 ID 暂存仍使用正确路径。
3. 普通列表默认显示前 10 种标签及剩余种数；同一查询的 `list --json` 保持完整统计和既有机器协议。

## Affected Owners

- 源格式和日常操作：[决策](../../skills/decision-records/SKILL.md)、[调查](../../skills/investigation-report/SKILL.md)、[资源](../../skills/resource-records/SKILL.md)。
- 索引结构：[记录 Schema 维护源](../../tools/record-contracts/README.md)；解析、重建、查询和暂存：[原生 CLI](../../tools/record-cli/README.md)。
- 分发同步：[项目维护命令](../../docs/tooling-commands.md)；测试入口与 Case：[测试证据维护](../../docs/test-maintenance.md)。
