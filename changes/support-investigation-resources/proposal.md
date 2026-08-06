# Proposal

建立调查报告随附资源能力的临时实施计划，让报告可以引用高保真原始材料，并由现有主题索引派生引用关系与完整性信息。

## Why

当前 `investigation-report` 只把一层分类目录中的主题 Markdown 作为调查集合成员。接口参数、原始响应、日志、截图或较长规范如果全部写进正文，会淹没调查主线；如果只保留摘要或把文件随意放在调查目录中，又无法稳定定位、校验和发现内容变化。

调查报告需要把“正文解释结论”和“资源保存细节”分开：报告继续独立说明背景、目的、依据、结果与边界，必要的原始材料放入受控资源池；报告与资源的关系由 Markdown 声明，现有派生索引负责把关系和资源哈希投影成可重建的读取视图。

## Outcome

`investigation-report` 在调查根目录支持可选的统一 `_resources/` 资源池。每份报告可以通过固定元数据引用其中的平级或嵌套资源；主题 Markdown 是引用关系的事实源，`investigation-index.json` 仍以主题为主条目，并派生报告级资源关系、资源 SHA-256 摘要表和覆盖资源快照的 `sourceRevision`。

## Scope

纳入：

- 定义 `_resources/`、可移植资源 ID、报告级 Markdown 引用语法、共享引用和资源历史维护规则。
- 扩展调查 Markdown 解析、目录发现、路径安全、引用完整性和孤儿资源校验。
- 在现有主题 entry 中投影报告到资源的关系，在索引 metadata 中保存每个资源的 SHA-256，并让资源快照参与新鲜度判断。
- 提升调查索引 definition version，更新 JSON Schema、CLI、类型声明、行为文档、可分发生成产物和 skill 独立版本。
- 增加成功路径、资源变化和失败分支测试，并同步测试证据账本。

不纳入：

- 不改变 `<category-id>/<semantic-slug>.md` 的主题身份、报告追加模型或主题级主索引粒度。
- 不建立另一份手写关系源、独立资源 entry、资源全文检索或资源专用生命周期。
- 不处理远程下载、内容转换、版权管理、密钥保管或大文件后端。
- 不迁移当前主题正文，也不要求没有资源引用的主题创建 `_resources/` 或占位元数据。

## Success Criteria

- 报告可以选择性使用固定 Markdown 元数据引用一个或多个安全资源，且能够从单份报告原文恢复精确关系并直接打开资源。
- 默认全量检查拒绝缺失、越界、符号链接、非普通文件和孤儿资源，允许同一资源被多份报告或主题共享。
- 每个主题仍只生成一个索引 entry；entry 保存报告级资源关系，metadata 对每个被引用资源只保存一次 ID 与 SHA-256。
- 资源新增、删除、重命名或内容变化会改变完整源快照，使旧索引失效，并产生包含资源 ID 的诊断。
- 没有资源引用的既有主题 Markdown 继续合法；重新同步后生成新 definition version 的索引，不保留旧索引格式兼容分支。
- 报告正文仍概括影响结论的关键事实，并说明资源来源、观测条件和支撑作用，不能用附件替代四项固定核心。
- 相关契约、实现、生成产物、测试证据和主仓库检查全部通过，资源方向与当前事实核对后完成决策对齐。

## Affected Owners

- `skills/investigation-report/SKILL.md`：资源使用条件、正文责任、敏感信息与历史维护语义。
- `skills/investigation-report/references/investigation-report-contract.md` 与索引 Schema：目录、Markdown 元数据、索引投影、快照和 CLI 固定契约。
- `tools/investigation-report/`：解析、发现、校验、哈希、索引构建、查询前新鲜度检查和测试源码。
- `skills/investigation-report/scripts/`、`agents/` 与版本 metadata：自包含分发产物和发现入口。
- `docs/skills/investigation-report.md`：面向人类的能力说明。
- `docs/decisions/investigation-report/`：主题级索引基线与随附资源长期方向。
- `docs/test-evidence/`：新增或修改测试入口对应的证据 case 与派生索引。
