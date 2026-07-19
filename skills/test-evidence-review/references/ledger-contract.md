# 测试证据账本契约

本引用定义 `test-evidence-review` 使用的账本字段、源码角色、项目配置和 CLI 一致性约束。执行顺序、写入授权和初始化行为由 [SKILL.md](../SKILL.md) 承接。

## 目录

1. [职责](#职责)
2. [账本 case 模型](#账本-case-模型)
3. [账本格式](#账本格式)
4. [源码标记](#源码标记)
5. [项目配置](#项目配置)
6. [CLI](#cli)
7. [发现边界](#发现边界)

## 职责

账本保存稳定验证义务，包括自动化证明、人工审查风险和发现豁免。源码标记保存测试文件到 case 的角色归属，CLI 检查账本结构、标记角色和测试发现结果的一致性。

语义审查负责判断测试价值、重复证据、人工审查的必要性和豁免是否真实；测试框架继续负责执行测试；项目测试策略继续拥有测试层级、责任域和覆盖要求。

默认账本路径是 `docs/testing/cases.md`，默认配置路径是 `.test-evidence.json`。项目可以通过配置替换路径、ID 格式、语言、扫描范围和未登记策略。

## 账本 case 模型

每个 case 必须声明：

```text
Status: active | planned
Verification: automated | review | exempt
```

合法组合只有：

1. `active + automated`：已有可执行的机械证明。
2. `planned + automated`：证明目标明确，但测试尚未实现。
3. `active + review`：当前通过人工 CR 关注稳定风险。
4. `active + exempt`：当前测试发现结果已被审计为误报。

review 和 exempt 代表当前已经存在的义务，因此不使用 planned。验证方式变化时保留同一个稳定 case ID，并按新方式替换该 case 的字段和源码映射。

## 账本格式

账本的三级或更深标题全部作为 case 解析，标题第一个 token 必须是符合 `caseIdPattern` 的 case ID；普通章节只使用一级或二级标题。所有路径和 glob 使用工作区相对 POSIX 形式；`Scope:` 的每个列表项必须是单个反引号包裹的路径或 glob。

### 自动化 case

active automated case：

```markdown
### WB-CALC-ADD-001 Addition remains observable
Status: active
Verification: automated
Code: `src/calc.test.ts`

Proves:
- Public addition returns the sum of two accepted operands.
```

要求：

1. 必须有且只有一个有效的 `Code:`。
2. 必须有且只有一个非空 `Proves:`，内容使用列表或 Mermaid。
3. 不声明 `Scope:`、`Risk:`、`Reason:` 或 `Review:`。
4. 必须有且只有一个引用该 case 的 `@test-evidence main`。

planned automated case：

```markdown
### WB-CALC-FUTURE-001 Future behavior
Status: planned
Verification: automated

Proves:
- A future public behavior has an explicit proof target.
```

planned case 必须有非空 `Proves:`，不声明 `Code:`、`Scope:`、`Risk:`、`Reason:` 或 `Review:`，也不添加源码标记。

### 人工审查 case

```markdown
### RV-PROCESS-CLEANUP-001 Child process cleanup remains safe
Status: active
Verification: review

Scope:
- `src/process/**`

Risk:
- Abnormal termination may leave child processes or temporary files behind.

Reason:
- Reliable automation currently requires disproportionate operating-system fault injection.

Review:
- Confirm every failure path terminates the child process.
- Confirm temporary resources are released before returning the error.
```

要求：

1. `Scope:`、`Risk:`、`Reason:` 和 `Review:` 各有且只有一个非空列表。
2. `Scope:` 定位需要触发人工检查的代码、配置或文档范围。
3. `Risk:` 描述需要保护的稳定风险，`Reason:` 解释机械验证为何当前不成比例，`Review:` 给出可执行检查动作。
4. 不声明 `Code:` 或 `Proves:`，也不添加源码测试标记。

### 发现豁免 case

```markdown
### EX-PARSER-FIXTURE-001 Parser fixture is not project evidence
Status: active
Verification: exempt

Scope:
- `tests/fixtures/generated_project.py`

Reason:
- The detector recognizes test syntax inside a parser fixture that is read as data and never executed as a project test.
```

要求：

1. `Scope:` 和 `Reason:` 各有且只有一个非空列表。
2. 不声明 `Code:`、`Proves:`、`Risk:` 或 `Review:`。
3. 必须至少有一个引用该 case 的 `@test-evidence exempt`。
4. 原因只在账本保存；源码不复制自由文本原因。

## 源码标记

标记使用统一语法：

```text
@test-evidence <main|derived|exempt> <CASE-ID>
```

主要测试入口：

```text
// @test-evidence main WB-CALC-ADD-001
```

一个 active automated case 必须有且只有一个 main。标记所在相对路径必须与账本 `Code:` 一致。

衍生测试源码：

```text
# @test-evidence derived WB-CALC-ADD-001
```

derived 可以重复出现，但必须引用已有的 active automated case。它表示该测试文件虽然包含框架测试入口，验证意义仍归属于指定主 case；它不创建独立账本 case，也不接纳缺少证明价值的测试。

发现豁免：

```text
// @test-evidence exempt EX-PARSER-FIXTURE-001
```

exempt 必须引用 active exempt case。一个发现豁免可以对应多个测试文件，但每个位置都必须由标记指向同一账本原因。

统一约束：

1. 标记必须严格包含角色和一个合法 case ID，不携带额外 token。
2. main 和 derived 只能引用 active automated case；exempt 只能引用 active exempt case。
3. review 和 planned case 不得拥有源码标记。
4. 标记必须位于 CLI 实际发现为测试的源码文件中。
5. 同一测试文件可以关联多个自动化 case，但同一 case 不能在该文件中同时是 main 和 derived，同一角色与 case ID 的组合只声明一次。
6. 发现豁免按文件生效：一个文件有且只有一个 exempt 标记，并且不与 main 或 derived 混用；同一个 exempt case 可以映射多个文件。
7. CLI 识别常见的 `//`、`#`、`--`、`;`、块注释和 HTML 注释前缀。

当前发现器以文件为最小强制归属单元，不要求每个测试函数单独登记。单个测试函数是否重复、无效或应拆分 case，继续由语义准入判断。

## 项目配置

最小配置：

```json
{
  "schemaVersion": 1,
  "unregisteredTestFiles": "error"
}
```

完整字段示例：

```json
{
  "schemaVersion": 1,
  "catalogPath": "docs/testing/cases.md",
  "caseIdPattern": "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$",
  "languages": ["rust", "typescript", "python", "go"],
  "includeGlobs": ["src/**/*", "tests/**/*", "scripts/**/*"],
  "ignoreGlobs": ["**/build/**", "**/vendor/**"],
  "unregisteredTestFiles": "error"
}
```

支持的 `unregisteredTestFiles`：

1. `ignore`：只维护账本和源码标记，不检查未登记测试文件。
2. `warn`：报告未登记测试文件但保持成功退出，默认值。
3. `error`：把未登记测试文件作为失败，适合 CI。

`includeGlobs` 省略或为空时，CLI 按启用语言的扩展名扫描工作区。配置中的路径和 glob 必须保持工作区相对且不能包含 `..`。

`ignoreGlobs` 用于构建输出、依赖、vendor 和其他不进入项目审计范围的目录。项目拥有的测试发现误报使用 exempt case，不用 ignore 隐藏。

## CLI

从 skill 目录运行，或使用脚本绝对路径：

```text
node scripts/test-evidence.mjs check --root <workspace-root>
node scripts/test-evidence.mjs check --root <workspace-root> --config <relative-config-path>
node scripts/test-evidence.mjs check --root <workspace-root> --json
```

退出状态：

1. `0`：没有结构或一致性错误；仍可能有 warn 模式报告。
2. `1`：账本、验证方式、标记角色、路径或严格未登记检查失败。
3. `2`：命令参数错误。

CLI 汇总 active automated、planned automated、review、exempt、源码角色和未登记文件数量。它校验 `Scope:` 路径或 glob 的格式，但不判断其风险语义，也不执行测试、不判断 `Proves:` 的价值或替代 `Review:` 中的人工检查。

## 发现边界

当前发现器识别：

- Rust：`#[test]` 和常见 namespaced test attribute。
- TypeScript/JavaScript：`test`、`it`、`describe` 调用。
- Python：`test_*` 函数和 `Test*` 类。
- Go：`Test*`、`Benchmark*`、`Fuzz*` 函数。
- Java：常见 JUnit test annotation。
- C#：常见 xUnit、NUnit、MSTest attribute。

宏、别名、自定义测试框架和动态注册可能产生漏报或误报。先用 `warn` 建立基线；确认发现结果稳定后再切换为 `error`。发现误报需要保留审计价值时登记 exempt case，不为扫描通过而创建虚假自动化 case。
