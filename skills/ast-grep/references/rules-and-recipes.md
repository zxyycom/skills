# ast-grep 规则与命令配方

本文只在简单 pattern 不足、需要 YAML rule、调试或持久规则测试时读取。具体 flags 和语言清单以当前安装版本的 `ast-grep <command> --help` 为准。

## 匹配模型

1. ast-grep 把 pattern 解析成 tree-sitter 语法树，再将它与目标代码的语法树比较；pattern 必须是目标语言可解析的代码。
2. 每次 rule match 只有一个 target node。关系规则描述 target 与周围节点的关系，组合规则仍然判断同一个 target node。
3. `language` 决定 pattern 的解析方式和默认扫描文件。扩展名不足以消除歧义时显式指定语言。
4. pattern 默认采用 `smart` strictness。只有空白、注释、标点、节点文字或种类的差异确实会改变目标时才调整 strictness。

## Metavariable

| 写法 | 含义 |
| --- | --- |
| `$VAR` | 捕获一个 named AST node；名称使用大写字母、数字或下划线 |
| `$$VAR` | 捕获一个 named 或 unnamed node，适合标点等高级场景 |
| `$$$ARGS` | 捕获零个或多个节点，例如参数、形参或 statements |
| `$_`、`$_VAR` | 非捕获匹配；同名多次出现时不要求内容相同 |

同一个捕获变量重复出现时要求结构一致。例如 `$A == $A` 匹配两侧相同的节点，不匹配 `a == b`。

在 POSIX shell 和 PowerShell 中，单引号通常可以防止 `$` 展开；其他 shell 的 quoting 规则可能不同。多行 rule 优先写入临时 YAML 文件，避免 shell 改写 metavariable。

## 从 pattern 到 rule

### Atomic rules

常用 atomic rule：

- `pattern`：按代码形状匹配。
- `kind`：按 tree-sitter node kind 匹配。
- `regex`：对整个 node text 应用 Rust regex。
- `nthChild`、`range`：按相邻位置或源码范围进一步筛选，只有目标确实依赖这些条件时使用。

普通字符串 pattern 解析不稳定时使用 object pattern，以完整 `context` 提供可解析代码，再用 `selector` 选出真正 target：

```yaml
rule:
  pattern:
    context: class Example { $FIELD }
    selector: field_definition
```

命令行可用 `--selector` 表达相同选择。不要用无关 context 意外收紧目标。

### Relational rules

四种关系都由根 rule 匹配 target，子 rule 匹配 surrounding node：

| 关系 | 含义 |
| --- | --- |
| `inside` | target 位于满足子 rule 的祖先中 |
| `has` | target 含有满足子 rule 的后代 |
| `precedes` | target 前方存在满足子 rule 的 sibling |
| `follows` | target 后方存在满足子 rule 的 sibling |

`stopBy` 决定遍历距离：

- 省略或 `neighbor`：只检查相邻一层。
- `end`：一直检查到该方向终点。
- rule object：到满足停止 rule 的节点为止，且停止节点本身也参与匹配。

只有需求是“任意深度”时才使用 `stopBy: end`；直接 child、parent 或 sibling 条件不应无条件扩大遍历。

`field` 可以限定 child 在语法树中的角色。例如 JavaScript pair 的 `key` 与 `value` 都可能含有相同文字，但语义位置不同。

```yaml
rule:
  kind: pair
  has:
    field: key
    regex: prototype
```

### Composite rules

- `all`：同一个 target 必须满足全部子 rule。
- `any`：同一个 target 满足任一子 rule。
- `not`：同一个 target 不满足子 rule。
- `matches`：复用本地或项目 utility rule。

`all` 和 `any` 组合的是规则，不是多个节点。若目标是“一个 node 同时含有 number child 和 string child”，应写两个 `has`：

```yaml
rule:
  all:
    - has:
        kind: number
    - has:
        kind: string
```

rule object 的字段顺序不构成执行顺序。匹配依赖先前捕获的 metavariable 时，使用显式 `all` 数组表达顺序。

## 最小规则骨架

独立搜索 rule 至少包含 `id`、`language` 和一个正向 `rule`：

```yaml
id: awaited-call-in-loop
language: TypeScript
rule:
  pattern: await $PROMISE
  inside:
    any:
      - kind: for_statement
      - kind: for_in_statement
      - kind: while_statement
    stopBy: end
```

`message`、`severity`、`note`、`fix`、`files` 和 `ignores` 属于 lint 或 rewrite 行为；只有对应项目需要时添加。

## 调试顺序

1. 用一个最小正例运行最简单 pattern。
2. 用 `ast-grep run --pattern '<pattern>' --lang <lang> --debug-query=pattern` 检查 matcher 如何解析。
3. 用 `--debug-query=ast` 或 `cst` 查看目标 node kinds；需要紧凑树形时使用 `sexp`。
4. pattern 本身无法独立解析时增加 `context` 和 `selector`。
5. 加入一个关系或组合条件并重跑正反例；不要一次叠加全部条件。
6. 无匹配时确认语言、路径、扩展名、ignore、globs 和关系方向；`--inspect summary` 或 `entity` 可解释文件或规则为什么被跳过。
7. 结果过宽时增加最能区分反例的结构条件，而不是依赖文件名或偶然文字。

## 输出配方

```text
# 人类查看
ast-grep run --pattern '<pattern>' --lang <lang> <path>

# agent 或脚本逐条处理
ast-grep run --pattern '<pattern>' --lang <lang> --json=stream <path>

# 只列出有匹配的文件
ast-grep run --pattern '<pattern>' --lang <lang> --files-with-matches <path>

# 单一复杂 rule，不需要 sgconfig.yml
ast-grep scan --rule <rule.yml> --json=stream <path>

# 解释项目扫描发现过程
ast-grep scan --inspect summary <path>
```

需要指定机器输出样式时使用 `--json=stream` 这类带等号的形式；当前版本支持的 style 和冲突选项以本机帮助为准。

## Rewrite 配方

简单 replacement：

```text
# 只预览 diff
ast-grep run --pattern 'oldApi($$$ARGS)' --rewrite 'newApi($$$ARGS)' --lang ts <path>

# 逐项确认并写入
ast-grep run --pattern 'oldApi($$$ARGS)' --rewrite 'newApi($$$ARGS)' --lang ts --interactive <path>

# 当前任务明确授权修改全部已验证 match 时写入
ast-grep run --pattern 'oldApi($$$ARGS)' --rewrite 'newApi($$$ARGS)' --lang ts --update-all <path>
```

复杂 rewrite 使用 rule 顶层 `fix`。fix 中只能可靠复用 rule 已捕获的 metavariable；未匹配变量可能产生空文本。多行 fix 保持模板中的相对缩进，应用后仍需 formatter 和目标语言检查。

## 持久规则测试

`sgconfig.yml` 注册 rule 和 test 目录：

```yaml
ruleDirs:
  - rules
testConfigs:
  - testDir: rule-tests
```

测试文件用相同 `id` 指向规则：

ast-grep test 从代码有效性命名用例：matcher 应报告的正例属于 `invalid`，matcher 不应报告的反例属于 `valid`。

```yaml
id: awaited-call-in-loop
valid:
  - await Promise.all(tasks)
invalid:
  - for (const task of tasks) { await task() }
```

运行路径：

```text
# 先检查 valid 不误报、invalid 不漏报
ast-grep test --skip-snapshot-tests

# 输出已稳定时检查 snapshots
ast-grep test

# 逐项接受 snapshot 更新
ast-grep test --interactive
```

`valid` 被报告属于 noisy match，`invalid` 未被报告属于 missing match；两类都需要修正规则或测试预期。

## 官方事实源

- CLI `run`：<https://ast-grep.github.io/reference/cli/run.html>
- Pattern syntax：<https://ast-grep.github.io/guide/pattern-syntax.html>
- Rule object：<https://ast-grep.github.io/reference/rule.html>
- Relational rules：<https://ast-grep.github.io/guide/rule-config/relational-rule.html>
- Rule tests：<https://ast-grep.github.io/guide/test-rule.html>
- Rewrite：<https://ast-grep.github.io/guide/rewrite-code.html>
- Project config：<https://ast-grep.github.io/reference/sgconfig.html>
- Languages：<https://ast-grep.github.io/reference/languages.html>
