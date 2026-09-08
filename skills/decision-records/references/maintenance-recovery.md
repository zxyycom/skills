# 决策记录状态与维护恢复

本手册帮助操作者在首次候选集合、工具或索引异常、写入中断时，恢复可解释且可验证的决策集合。身份、生命周期与维护条件以[决策记录规则](decision-record-rules.md)为准。

## 先保留来源并判断范围

1. 保留当前 Markdown、索引和 Git 中可恢复的最后可信基线。Markdown 拥有决策事实，索引只用于定位和对账。
2. 按 `--root` 与可选 `--decisions-dir` 确认同一决策根，检查根目录、`archive/` 和索引的可读性。
3. 从诊断的 code、对象、原因和下一步定位；有 scope/outcome 时，只对声明范围判断是否已写入或恢复。
4. 根据可信来源自行恢复可确定的内容。关键事实或取舍无法确定且会改变恢复结果时，保留相关内容并询问；不从派生索引补造来源事实。

## 状态分流

| 当前事实 | 下一步 |
| --- | --- |
| 根目录整体不存在，且项目从未记录决策 | 视为尚未初始化；按当前任务决定是否起草。 |
| 只有合法 candidates，没有 active、archived 或正式索引 | 用 `candidates`、`show-candidate` 和严格 `check` 验收结构。继续完成正文与审核；经授权首次 activate 才建立索引，此时不运行 sync-index。 |
| ID、tags、状态与位置或 Markdown 结构无效 | 按可信来源和领域契约，在授权范围内修复权威 Markdown；关键判断无法确定时保留并询问。 |
| 已建立来源的 alignment 缺失、为 null 或非法 | 停止集合维护，按[已建立 alignment 无效](#已建立-alignment-无效)恢复；不能用生命周期操作或默认值补造状态。 |
| 已建立来源合法，索引缺失、损坏或陈旧 | 完整核对来源后，按下节重建索引。 |
| 写入中断或恢复结果不完整 | 按“中断写入”对账，暂停后续 mutation。 |
| CLI 无法启动或分发文件不完整 | 先按“工具恢复”修复执行入口。 |

## 已建立 alignment 无效

已建立记录的缺失、`null` 或非法 alignment 阻断检查、同步和其他集合维护。按以下顺序处理，范围只限受影响记录的该字段：

1. 保留当前 Markdown、索引以及 Git 中可恢复的最后可信基线；确认受影响 Decision ID、其原位 Markdown 和非法字段值。
2. 从可信 Git 历史或能够直接证明该记录既有状态的历史材料确定每个正确值。派生索引、目录位置和缺失值都不是证据；无法确定时保留来源并请求判断。
3. 取得明确授权，使其覆盖这些 ID 的原位 `alignment` 字段修复及影响；该授权不等同于建立、重新激活、归档或改变关系的授权。
4. 仅在原位 Markdown 修复已获证实的字段，保留 status、createdAt、关系和正文；不执行 activate、archive 或其他生命周期命令，也不默认写入 `unaligned`。
5. 再按下节全量重建索引并运行严格 `check`。验证失败时停止，不以旧索引、selected 同步或补值绕过来源错误。

## 索引恢复

默认 content 搜索可在完整验证来源后，用一次内存投影只读降级。该结果只证明本次读取；恢复常规索引查询仍需显式同步。metadata 搜索只读持久索引，不能走此降级路径。截断提示出现时，收紧筛选或继续读取已知 ID，不把缺失输出当作不存在记录。

来源完整、满足当前 definition 且已取得维护授权后，从 skill 目录执行不带选择器的全量重建：

```text
node scripts/decision-records.mjs sync-index --write --root <resolution-root>
node scripts/decision-records.mjs check --root <resolution-root>
```

自定义目录时，两条命令使用相同 `--decisions-dir`。definition 过期但来源合法时，完整同步建立新投影；不使用 `--select`，也不把旧索引作为正常 reader 或来源。已建立来源的 alignment 无效时，同步和检查均失败并保持零写入，不能只修索引。完成后按需用 `list --status all --alignment all`、`show` 或 `trace` 核对预期身份、位置、内容、非空 alignment 与关系。

## 中断写入

根据[规则定义的 outcome](decision-record-rules.md#验证与异常交付)选择动作：

| 诊断结果 | 操作者动作 |
| --- | --- |
| `no-change` | 修正前置条件，重新观察后显式发起命令。 |
| `rolled-back` | 复核旧范围已完整恢复，再决定是否重新操作。 |
| `partial-or-unknown` | 停止重试和补写，比较 Markdown、索引与可信版本；无法唯一确认完整状态时交给用户。 |
| `committed-cleanup-pending` | 先核对已完成的 Markdown、索引及诊断列出的残留，再决定后续维护。 |

对账目标是完整一致的旧状态或新状态。若权威 Markdown 已形成完整新状态，以它重建索引；若只完成部分写入，且可信副本能确定操作前完整组合，则在恢复授权范围内恢复 Markdown 与索引。保留无法解释的记录、关系与建立时间，不根据部分索引补造事实。

所有重试都由操作者在处理原因并重新观察后显式发起。权限不足时只取得当前进程所需授权，不使用 `sudo`；锁忙时等待或确认活动进程，确认没有活动进程后才人工检查残留锁，agent 和工具不自动删除锁。

## 工具恢复

- Node 不可用但有兼容运行时时，可用该运行时执行同一 CLI，例如 `bun scripts/decision-records.mjs check ...`。
- 分发文件损坏时，优先通过相邻 `scripts/update-skill.mjs` 检查并按更新授权恢复完整 skill，使 CLI、声明和 Schema 保持同一分发单元。
- 入口仍不可用时，保留全部来源，停止索引和状态维护，交付已确认的故障与阻塞范围。

## 恢复验收

已建立集合运行严格 `check`，再核对受影响 ID、位置、tags、生命周期、正文、非空 alignment 与关系。首次候选集合只证明 scaffold 结构，且继续保持 `alignment: null`、`createdAt: null` 与正式索引外；正文准备、语义审核和建立仍分别判断。

交付说明恢复目标、实际完成的范围、验证结果及剩余未知；不能完整证明旧/新状态时，明确需要用户判断的部分。
