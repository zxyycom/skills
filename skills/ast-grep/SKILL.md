---
name: ast-grep
description: >-
  使用 ast-grep CLI 按 AST 结构概览、搜索、检查或受控重写代码。用户明确
  要求 ast-grep，或任务需要按语法形状、上下文关系和组合条件跨文件定位、
  审查或迁移代码时使用。普通文本搜索、自然语言语义搜索、符号引用或调用图
  查询、类型感知重命名，以及无需结构匹配的局部编辑不使用。
metadata:
  version: "1"
---

# ast-grep

## 目标

把用户描述的代码结构转换为可复现的 ast-grep 查询或规则，先用正反例证明匹配语义，再在最小必要范围内完成结构概览、搜索、规则扫描或代码重写，并留下足以复核结果的命令、范围和验证证据。

ast-grep 是基于 tree-sitter 语法树的确定性工具，不是自然语言语义搜索器。它擅长回答“什么代码具有这种语法结构”，不负责推断业务概念、类型解析、符号引用或运行时调用关系。

## 适用边界

使用本 skill：

1. 用户明确要求使用 `ast-grep` 或 `sg`。
2. 目标由代码形状表达，例如特定调用、声明、参数结构、父子或前后文关系。
3. 需要把同一结构查询扩展为可测试的 YAML 规则、项目扫描或 lint。
4. 需要对已经验证的结构匹配执行批量、可预览的语法级迁移。
5. 需要用 CLI 快速列出文件或目录的 symbols、imports、exports 或 members，且当前版本提供 `outline`。

以下情况使用其他能力：

1. 固定文本、正则、文件名或日志搜索优先使用 `rg`。
2. 按含义查找“认证逻辑”等概念时使用语义搜索或先恢复业务词汇。
3. 查找定义、引用、实现、调用路径或影响面时使用 LSP、代码图或项目已有的符号工具。
4. 跨作用域重命名、类型驱动迁移或需要模块解析时使用编译器、语言服务或专用 codemod。
5. 只需修改已知位置的少量代码时直接使用当前环境的编辑工具。

ast-grep 可以为上述流程提供候选位置，但不能把语法匹配结果冒充语义证明。

## 前置与授权

1. 先运行 `ast-grep --version`；只有环境不存在该命令时才检查 `sg --version`，并确认 `sg` 实际指向 ast-grep，避免命令重名。
2. 以本机 `ast-grep <command> --help` 为版本事实源。某个子命令或选项不存在时，使用当前版本支持的路径或报告前置缺失，不凭记忆安装或升级。
3. CLI 未安装时，说明缺失和所需能力；全局安装、升级、创建项目脚手架、启动 LSP 或修改 shell completion 需要当前任务明确授权。
4. `outline`、不带写入 flag 的 `run`、`scan` 和普通 `test` 是只读动作；即使提供 `--rewrite` 或 rule `fix`，没有 `--interactive` 或 `--update-all` 时也只预览。创建持久规则、修改 `sgconfig.yml`、更新 snapshots 或重写源码沿用当前任务的写入授权。
5. 默认尊重 ignore 文件并限制到最小路径。只有目标明确包含隐藏或已忽略文件时才使用 `--no-ignore`，并说明扩大后的范围。

## 命令选择

| 目标 | 入口 | 选择条件 |
| --- | --- | --- |
| 查看代码轮廓 | `ast-grep outline` | 需要 symbols、imports、exports、signatures 或 members；不要求引用和调用关系 |
| 一次性结构搜索 | `ast-grep run` | 一个 `pattern`、`kind` 或 selector 足以表达目标 |
| 一次性复杂搜索 | `ast-grep scan --rule <file>` | 需要 `inside`、`has`、`precedes`、`follows`、`all`、`any`、`not` 等规则 |
| 项目规则扫描 | `ast-grep scan` | 仓库已有 `sgconfig.yml`，需要发现并运行注册规则 |
| 规则回归验证 | `ast-grep test` | 持久规则已有或需要新增 `invalid`（应报告）、`valid`（不应报告）与 snapshot 证据 |
| 创建持久规则工程 | `ast-grep new` | 用户明确要求建立或扩展 ast-grep 项目，并接受交互式写入 |

`lsp` 和 `completions` 是环境集成入口，不属于普通结构搜索的默认流程。

## 主流程

### 1. 固定目标语义和范围

1. 从用户要求和目标仓库恢复语言、候选路径、应匹配代码、相近但不应匹配代码，以及只读或改写出口。
2. 能从现有代码取得代表样例时先读取样例；只有语言、目标节点或排除条件仍会改变规则时才询问用户。
3. 区分语法条件与语义假设。例如“调用名为 `open`”可由结构匹配证明，“这是文件系统调用”还需要类型或符号证据。

### 2. 构造并验证最小 matcher

1. 简单目标从 `run --pattern` 开始，并显式提供 `--lang`。pattern 必须是该语言可解析的代码。
2. 一个 `$VAR` 匹配一个节点，`$$$ARGS` 匹配零个或多个节点；在当前 shell 中保护 `$` 不被变量展开。多行 YAML 或 quoting 不稳定时使用临时 rule 文件，不把复杂规则塞进一条内联 shell 命令。
3. pattern 无法表达上下文、否定或组合条件时，改用 YAML rule；需要详细语法时读取 [规则与命令配方](references/rules-and-recipes.md)。
4. 为 matcher 准备至少一个应被报告的正例和一个最接近但不应被报告的反例。先在受控样例上运行，再扫描真实范围；只验证正例不足以证明排除条件。
5. 无匹配或结果异常时，先缩小规则并用 `--debug-query=pattern`、`ast`、`cst` 或 `sexp` 检查解析结果，再调整 `kind`、pattern context、selector 或关系方向。不要直接把规则放宽到“有结果”为止。

简单搜索示例：

```text
ast-grep run --pattern 'console.log($$$ARGS)' --lang ts --json=stream src
```

复杂规则示例：

```yaml
id: console-in-method
language: TypeScript
rule:
  pattern: console.log($$$ARGS)
  inside:
    kind: method_definition
    stopBy: end
```

```text
ast-grep scan --rule console-in-method.yml --json=stream src
```

### 3. 在真实代码上执行

1. 从最小文件或目录开始；需要时用 `--globs` 收窄扩展名和排除生成目录，不以仓库根目录作为无条件默认范围。
2. 少量结果可使用人类可读输出；需要计数、去重、下游处理或结果较多时使用 `--json=stream`。只需要文件清单时使用 `--files-with-matches`。
3. 检查代表性 match 的完整语境，确认 target node、捕获变量和排除条件仍符合目标，再扩大范围或形成结论。
4. `ast-grep run` 的退出码 `1` 表示没有匹配，不自动等于 CLI 故障。`scan` 还会受 rule severity 影响；结合标准输出、错误输出和实际命令解释状态。
5. 汇报使用的 matcher 或 rule、语言、路径与 glob、匹配数量或代表位置，以及结构搜索不能证明的剩余语义。

### 4. 代码重写

仅在当前任务授权修改代码时进入本分支：

1. 先用同一 matcher 做纯搜索，确认所有候选都属于目标范围。
2. 在正例和反例上验证 replacement 或 rule `fix`；确认捕获变量、缩进、标点和空匹配不会产生损坏代码。
3. 先只提供 `--rewrite` 或 rule `fix` 预览 diff，不带 `--interactive` 或 `--update-all`。
4. 逐项接受时使用 `--interactive`。只有当前任务授权修改全部匹配、范围已核对且预览一致时才使用 `--update-all`。
5. 应用后检查 diff，运行目标语言的 formatter、类型检查或测试，并重新运行原 matcher，确认旧结构的剩余数量符合预期。

ast-grep 的 rewrite 是语法级文本替换。匹配正确不保证迁移具有类型或业务语义正确性；需要这类保证时补充相应工具和测试。

### 5. 持久规则和项目扫描

1. 先查找并读取现有 `sgconfig.yml`、rule 目录、test 目录和相邻命名约定；已有项目不重新运行 `ast-grep new`。
2. 新规则先用独立 `scan --rule` 验证，再按项目约定接入 rule 目录。
3. 为每个规则维护 `invalid` 和 `valid` 用例：matcher 正例写入 `invalid`，matcher 反例写入 `valid`。开发早期可用 `ast-grep test --skip-snapshot-tests` 检查匹配，输出稳定后再检查或更新 snapshots。
4. `--update-all` 更新 snapshots 也属于写入动作；只在预期输出已经核对时使用。
5. 项目扫描的 severity、suppression、CI 失败策略由项目配置承接，本 skill 不擅自改变。

## 轮廓查看

当前 CLI 支持 `outline` 时，可用它在读取完整文件前获得轻量结构：

```text
ast-grep outline src --items exports --view signatures --json=stream
```

目录输入和文件输入的默认 `items`、`view` 可能不同；需要稳定机器输出时显式指定。`outline` 只抽取结构，不解析引用或调用图；当前版本没有该子命令时使用项目已有的 outline、LSP 或代码图能力。

## 按需参考

编写复杂 rule、选择 metavariable、关系和组合规则、调试 pattern 或维护 rule test 时读取 [规则与命令配方](references/rules-and-recipes.md)。普通 `run --pattern` 或 `outline` 不加载该文件。

完整、版本相关的语言和参数列表留在本机 `--help` 与 ast-grep 官方文档，本 skill 不复制一份会过期的穷举参考。

## 完成标准

1. ast-grep 相对文本搜索、语义搜索、LSP 和代码图的选择理由成立。
2. matcher 已由正例和最接近反例验证，真实扫描范围、语言和 ignore 行为明确。
3. 结果包含可复核的命令或 rule、范围和代表证据，没有把语法匹配夸大为语义证明。
4. 发生重写时，先预览后应用，最终 diff 和项目级 formatter、检查或测试已经验证。
5. CLI、子命令或外部语义能力缺失时已采用明确降级或报告前置，不自行安装、升级或扩大写入范围。
