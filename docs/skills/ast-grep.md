# ast-grep

`ast-grep` skill 让 agent 使用 ast-grep CLI 按语法树结构查看、搜索、检查和迁移代码。它适合“找出某类调用”“定位某个结构内部的语句”“检查缺少某种子结构的声明”这类无法可靠地只靠文本表达的问题。

ast-grep 本身不是 AI，也不是自然语言语义搜索器。它使用 tree-sitter 将代码和查询 pattern 解析为语法树，再做确定性结构匹配。AI 的作用是把人的意图翻译成 matcher、构造正反例、检查结果并决定是否可以安全扩大范围。上游另有实验性 [ast-grep MCP](https://github.com/ast-grep/ast-grep-mcp) 和官方 [agent-skill](https://github.com/ast-grep/agent-skill)；本 skill 直接基于 CLI 工作，不依赖 MCP 或特定 agent 插件。

## 主要流程

1. 区分结构搜索与文本、语义、符号或调用图查询，固定语言、目标路径和排除条件。
2. 在 `outline`、`run`、`scan` 和 `test` 之间选择最小入口。
3. 用至少一个正例和最接近的反例证明 matcher，而不是在真实仓库里边试边放宽到出现结果。
4. 在最小路径执行，检查代表 match，再按需要扩大范围或交付规则。
5. 需要 rewrite 时先纯搜索、再预览 diff；只有当前任务已授权且全部 match 已核对时才写入，之后补 formatter、类型检查或测试。

`skills/ast-grep/references/rules-and-recipes.md` 按需承接 metavariable、atomic、relational、composite rule、调试、rewrite 和持久 rule test。穷举 flags、语言和版本差异仍以本机 `ast-grep <command> --help` 与[官方文档](https://ast-grep.github.io/)为事实源。

## 与相邻工具的边界

- `rg` 负责固定文本、正则和文件搜索，通常更直接。
- LSP 或代码图负责 definition、references、call graph 和 impact analysis。
- 语义搜索负责按业务含义或自然语言概念找代码。
- 编译器、语言服务或专用 codemod 负责类型感知重命名与跨模块语义迁移。
- ast-grep 负责可由语法树形状、上下文关系和组合条件证明的候选与 rewrite。

它可以与这些工具串联，但不能把 AST match 单独解释成业务或类型语义证据。

## 分发内容与前置

实际 skill 位于 `skills/ast-grep/`，作为独立分发单元。运行环境需要预先安装 ast-grep CLI；skill 不自动安装、升级、创建项目脚手架或启动 LSP。`outline` 等版本相关入口会先通过本机帮助确认，缺失时降级到当前项目已有的结构工具。
