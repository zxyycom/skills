# 测试证据账本契约

每次触发 `test-evidence-review` 后读取本引用。账本、源码标记和 CLI 是该 skill 的默认工作面，不需要再判断项目是否已经采用。账本尚不存在时，修改类任务按默认路径初始化并登记当前范围；只读任务输出拟登记映射，但不越过写入授权。

## 目录

1. [职责](#职责)
2. [账本格式](#账本格式)
3. [源码标记](#源码标记)
4. [项目配置](#项目配置)
5. [CLI](#cli)
6. [发现边界](#发现边界)
7. [初始化与接入](#初始化与接入)

## 职责

账本保存稳定证明目标，源码标记保存测试实现到 case 的归属，CLI 检查二者和测试文件发现结果的一致性。语义审查仍负责判断测试价值和重复证据；测试框架继续负责执行测试；项目测试策略继续拥有测试层级、责任域和覆盖要求。

默认账本路径是 `docs/testing/cases.md`，默认配置路径是 `.test-evidence.json`。项目可以通过配置替换路径、ID 格式、语言、扫描范围和未登记策略。

## 账本格式

每个 case 使用三级或更深标题，标题第一个 token 是 case ID：

```markdown
### WB-CALC-ADD-001 Addition remains observable
Status: implemented
Code: `src/calc.test.ts`

Proves:
- Public addition returns the sum of two accepted operands.
```

固定字段：

1. `Status:` 只能是 `implemented` 或 `planned`。
2. implemented case 必须有且只有一个 ``Code: `relative/path` ``。
3. planned case 不声明 `Code:`。
4. 每个 case 必须有且只有一个非空 `Proves:`，内容使用列表或 Mermaid。
5. `Code:` 保存主要验证入口，不枚举所有辅助测试。

## 源码标记

主要入口：

```text
// @case WB-CALC-ADD-001
```

一个 implemented case 必须有且只有一个主要 `@case`。标记所在相对路径必须与账本 `Code:` 一致。

辅助测试：

```text
# @supports WB-CALC-ADD-001
```

`@supports` 可以在多个文件重复出现，但必须指向 implemented case。它表示辅助证据，不创建新的稳定证明目标。

发现豁免：

```text
// @test-exempt generated compatibility fixture
```

`@test-exempt` 必须带具体原因。它只处理测试文件发现误差或不承接产品证明的特殊测试，不替代应有的 case。

CLI 识别常见的 `//`、`#`、`--`、`;`、块注释和 HTML 注释前缀。

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
  "ignoreGlobs": ["**/fixtures/generated/**"],
  "unregisteredTestFiles": "error"
}
```

支持的 `unregisteredTestFiles`：

1. `ignore`：只维护账本和源码标记，不检查未登记测试文件。
2. `warn`：报告未登记测试文件但保持成功退出，默认值。
3. `error`：把未登记测试文件作为失败，适合 CI。

`includeGlobs` 省略或为空时，CLI 按启用语言的扩展名扫描工作区。配置中的路径和 glob 必须保持工作区相对且不能包含 `..`。

## CLI

从 skill 目录运行，或使用脚本绝对路径：

```text
node scripts/test-evidence.mjs check --root <workspace-root>
node scripts/test-evidence.mjs check --root <workspace-root> --config <relative-config-path>
node scripts/test-evidence.mjs check --root <workspace-root> --json
```

退出状态：

1. `0`：没有结构或一致性错误；仍可能有 warn 模式报告。
2. `1`：账本、标记、路径或严格未登记检查失败。
3. `2`：命令参数错误。

## 发现边界

当前发现器以文件为最小强制归属单元，识别：

- Rust：`#[test]` 和常见 namespaced test attribute。
- TypeScript/JavaScript：`test`、`it`、`describe` 调用。
- Python：`test_*` 函数和 `Test*` 类。
- Go：`Test*`、`Benchmark*`、`Fuzz*` 函数。
- Java：常见 JUnit test annotation。
- C#：常见 xUnit、NUnit、MSTest attribute。

宏、别名、自定义测试框架和动态注册可能产生漏报或误报。先用 `warn` 建立基线；确认项目发现结果稳定后再切换为 `error`。不要为了让扫描通过而给无关文件添加虚假 case。

## 初始化与接入

1. 优先使用 `.test-evidence.json` 指定的路径和发现规则；配置不存在时使用默认账本路径和默认发现规则。
2. 账本不存在且任务允许修改时，创建账本并登记当前审查范围内的稳定证明目标。默认规则足够时不额外创建配置。
3. 账本不存在且任务保持只读时，不创建文件；在结论中给出拟 case、主要 `@case` 入口、`@supports` 归属和预期 CLI 状态。
4. 给主要入口添加 `@case`，给辅助测试添加 `@supports`。
5. 以 `warn` 运行 CLI，修正发现范围和真实漏登。本次新增或修改的测试不得留在未登记清单中。
6. 基线可信后将 `unregisteredTestFiles` 改为 `error` 并接入 CI。
