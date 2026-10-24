# Proposal

将记录工具的普通操作收敛到发布索引与明确影响范围，本目录保存本次 Change 的临时实施计划。

## Why

一万条存量基线显示普通发布、候选删除和身份更正仍读取大量无关正文，Git 历史及暂存也承担全量 payload 成本。用户确认：普通操作不替未同步的外部修改证明全集当前性；跨时间同名以现有日期 ID 区分，无需并发唯一性机制。

## Outcome

Decision Records 与 Investigation Report 的普通操作以合法发布索引和本次所选、实际受影响对象为读取边界，不隐式扫描未选正式正文或无关 Git blob；创建使用现有日期 ID 的完整 basename 并返回实际位置，候选转正保留身份。显式全量检查、同步与内容发现继续承担自己的非局部读取责任。

## Scope

### Intended Change

- 收敛创建、候选读取／发布、演进、生命周期、关系修改、删除、更名、stage 和相关历史门禁的来源范围。
- 收窄未选候选引用承诺：不自动检查或改写，过期引用由其发布发现；共同修改显式选择。
- 保持 `YYMMDD-<name>`，默认完整 ID 文件名；返回最终 ID 与实际 locator/sourcePath，转正不重分配 ID。名称可重复，仅名称 selector 歧义时明确提示；旧同名记录不强制迁移。

### Resulting Impacts

- 更新两域 CLI／SDK 契约、恢复说明、直接维护 owner、行为测试和 Case。
- 按实际消费关系调整 record-operations、index-runtime 与 Git 支持；保留局部安全读写、锁、fresh、CAS、防覆盖、实际写集验收与失败事实。
- 同步分发产物和独立 skill 版本，记录长期责任边界，补充一万条存量的定向验收证据。

## Success Criteria

1. 普通索引型操作不读取与所选／实际影响集合无关的正式正文；索引已足够回答的关系、状态和引用发现不再触发正文取证。
2. 未选正文手改／损坏不阻断无依赖局部操作；所选输入漂移明确失败，已存在集合索引不可用时不静默全集回退。首次空集合仍可建立。
3. 删除／更名仅处理索引可见正式引用与显式所选候选；不承诺修复未选草稿。资源处理限定明确 owner 与授权范围。
4. 历史与 stage 读取必要索引、所选 payload；未选 pending 路径、mode、OID 和 staged 删除保持，漂移检查与失败恢复有效。
5. 新建采用现有日期 ID 的完整 basename；同日同名零覆盖失败，跨日／legacy 同名可新建，返回 ID 与实际位置；publish 保留候选 ID，旧记录仍可读取。
6. 相关测试、分发检查、Case 覆盖与 `bun run check:changed` 通过；定向一万条样本记录工作量、耗时、CPU、RSS 和操作效果，不宣称未验证的阶段收益。
7. 阶段正确性审查无阻断；最终文档经 ai-ready 优化、源码经编码规范与最小实现优化；无不必要通用机制。

## Affected Owners

- `tools/decision-records/`、`tools/investigation-report/` 及对应 skill 行为文档和生成制品。
- `tools/record-operations/`、`tools/index-runtime/`、`tools/shared/src/version-control/` 的实际受影响边界。
- `docs/test-evidence/`、`docs/decisions/`；编码和交付规则仍由项目 owner 维护。
