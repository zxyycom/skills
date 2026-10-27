# Test Evidence Review

`test-evidence-review` 用于把保留的最小原生测试入口与可复核的测试证据 Case 一起维护。它不替代产品测试、构建校验或覆盖率工具；它保存测试为什么值得保留、共同证明什么以及如何定位已登记证据。

[Test Design](test-design.md) 提供测试设计与实现改进流程；本 skill 审查实际证据并维护 Case，不复制该设计流程。两者可独立选用，账本引用有效不等于测试已执行或证明充分。

实际使用从 [SKILL.md](../../skills/test-evidence-review/SKILL.md) 开始，按当前任务选择读取和维护路径。

## 何时使用

在新增、修改、删除或审查测试实现时使用，也可用于查询、修复或整理 Case。只运行既有测试、只修改被测对象、lint 或构建检查不触发本 skill。

证据定位到 runner 能稳定独立选择并单独报告的最小命名测试节点，区别于 suite、测试文件等容器和 fixture、断言等内部环节。Case 按测试意图组织；测试拆合时以意图是否连续决定证据如何维护。

## Case 账本

项目的 `docs/test-evidence/cases/` 中每个 Markdown 保存一个 Case，派生索引位于 `docs/test-evidence/test-evidence-index.json`。Case 解释测试对应的契约、可观察证明与实际测试定位；一个 Case 可以引用多个节点，同一节点也可支持多个 Case。身份与字段的精确定义见 [Case 账本契约](../../skills/test-evidence-review/references/catalog-contract.md#目录与-case)。

索引是可删除重建的查询快照：`list` 与 `tags` 只读取它，因此结果的 currentness 为 unchecked；`show` 核对一个权威 Case，`search` 读取当前 Case 正文。修改 Case 后应同步索引，而不是手工编辑 JSON。

## 项目快照与检查

通用核心不扫描或执行项目测试。项目可提供完整实体快照，并独立核对来源以检查 Case 引用；引用有效不等同于测试通过、源码新鲜或证明充分。项目若要求全部发现实体都有 Case，由项目自己的覆盖门禁实施；快照与引用接口见[实体快照契约](../../skills/test-evidence-review/references/catalog-contract.md#实体快照与引用检查)。

## 从哪里开始

| 任务 | 入口 |
| --- | --- |
| 查询或审查已有证据 | [查询或审查流程](../../skills/test-evidence-review/SKILL.md#查询或审查) |
| 修改测试或维护 Case | [修改测试或账本流程](../../skills/test-evidence-review/SKILL.md#修改测试或账本) |
| 调用 CLI 或程序接口 | [工具运行前置](../../skills/test-evidence-review/SKILL.md#工具运行前置)、[CLI 与 API 契约](../../skills/test-evidence-review/references/catalog-contract.md#cli-与-api)；本仓库使用[维护短命令](../tooling.md#仓库维护短命令) |

暂存命令只处理所选 Case 的派生索引，不暂存 Case Markdown、测试或产品代码；精确范围与首次索引定义升级要求见[索引操作边界](../../skills/test-evidence-review/references/catalog-contract.md#索引与查询)。

## 旧布局升级

已有 topic/`Entry:` 目录时使用[显式升级流程](../../skills/test-evidence-review/references/upgrade-from-legacy-topic-catalog.md)，先以真实项目快照预演映射；映射无法确定时停止，实际写入须有相应授权。普通查询与维护不兼容读取或自动迁移旧格式；支持布局、原数据保护与失败恢复继续由升级契约承接。
