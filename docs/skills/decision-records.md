# Decision Records

`decision-records` 提供一套可在不同项目中复用的决策记录方案，以及一个配套 CLI。它希望把长期记忆做成普通、公开、可版本化的项目材料，而不是隐藏在模型状态、数据库或工具缓存里。

## 核心承诺

当一个选择会影响后续工作时，把它写成显式 Markdown 决策，记录当时的问题、取舍、适用条件、影响和验证方式。未来的人或 agent 可以从索引找到当前有效判断，也可以沿状态关系回放它如何被修订、替代或判定无效。

这种记忆具有三个特征：

1. 可审核：内容、状态和关系都能直接阅读，并可通过代码审查或版本历史检查。
2. 可优化：新认识不会覆盖历史原因，而是通过 `amended`、`superseded` 和 `invalidated` 显式演进。
3. 简单直接：使用固定目录、Markdown 文件、文件名状态和相对链接，不维护另一份隐藏状态。

## 组成

当前只设计一个通用 skill 和一个配套 CLI：

1. [`skills/decision-records/SKILL.md`](../../skills/decision-records/SKILL.md) 负责判断和维护流程，包括何时记录、怎样写、怎样更新旧决策以及何时读取历史。
2. [`references/decision-record-rules.md`](../../skills/decision-records/references/decision-record-rules.md) 负责跨项目复用的固定格式契约。
3. `scripts/decision-records/` 承接 CLI 的 TypeScript 源码、测试和构建入口；生成后的 `skills/decision-records/scripts/decision-records.mjs` 提供 `check`、`list` 和 `sync-index`。
4. 各目标项目自己的 `docs/decisions/` 保存实际决策，是长期记忆的数据 owner。

CLI 不会评价决策是否正确、是否值得记录或是否真的来自用户确认；这些语义判断由 skill 和用户完成。默认列表和索引只显示 `active`，其他状态继续保留并可显式查询；`invalidated` 进入专用归档目录。

## 复用方式

不同项目采用同一套目录、状态和正文结构，只替换领域内容，并按需增加更严格的记录门槛。CLI 默认处理 `docs/decisions/`，也可以通过参数处理其他明确目录。

一套固定契约比兼容任意格式更容易长期维护：skill、决策文件和校验器共享同一语义，不需要为每个项目重新解释标题、状态或关系。

## 初始参考

项目保留了一套已落地决策目录的原始快照，位于 `skills/decision-records/references/archive/`。它只用于回放体系演进，不参与默认读取；当前方案和后续开发都以本仓库中的通用规则为依据。

## 后续微调

后续重点不是继续拆分 skills，而是通过真实决策样例调整三类边界：

1. 记录门槛是否足够清楚，能排除任务日志和未确认建议。
2. 固定结构是否在“容易写”和“足够回放”之间保持平衡。
3. CLI 是否只覆盖确定性约束，并给出足够直接的修复信息。
4. 归档移动是否需要在后续增加带预览和显式写入的独立命令。
