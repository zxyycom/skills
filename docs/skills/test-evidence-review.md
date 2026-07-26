# Test Evidence Review

`test-evidence-review` 只审查测试实现及其证据目录，不再承接 lint、schema、
生成物一致性、安全扫描等工程校验。

## 核心模型

```text
一个保留的最小原生测试入口 <-> 一个 case
```

这里的入口不是任意可运行目标，而是测试框架能够稳定选择、单独报告通过或失败，
并拥有一项完整测试意图的最小命名节点。通常是 `test`、`it`、测试方法或参数化后
的单个框架 case。

判断时先看最终结果归属：结果只组成父节点判定的是内部环节；自身有 runner 最终
结果但仍包含结果可分别归因的更小测试节点的是聚合容器；拥有自身最终结果且没有
更小原生测试节点的才是登记入口。

测试文件、suite、目录、package script、runner 命令和 CI job 即使可以单独运行，
只要仍聚合多个可区分的原生测试节点，就只是容器。fixture、helper、mock、断言和
步骤是内部环节。两者都不能据此登记成一个巨型 case。

一个自定义测试程序只有在确实只产生一个不可再归因、意图单一的最终判定时，才可
整体作为入口。一个入口混合多个可独立命名、独立失败的意图时，应先拆测试。

## 审查内容

确定入口后，skill 判断：

1. 测试对应什么稳定契约。
2. 失败能否指出具体契约失效。
3. 断言是否覆盖调用方可观察结果。
4. fixture、mock、时序、随机性和环境是否可靠。
5. 是否只复述实现、只证明 mock 或形成自证循环。
6. 新增证明价值是否值得维护与运行成本。

本次修改涉及的每个新增或保留测试入口都必须登记，删除入口时同步删除 case。工具
不扫描源码，因此不会声称自动证明全仓没有漏项；未触及历史测试只有在任务明确
要求补齐时才进入范围。

## Case 与索引

每个 case 只有 `Entry:`、`Contract:` 和 `Proves:`：

```markdown
### Case AUTH-ROLE-ACCESS-001: Guest access is rejected

Entry:
- `tests/access.test.ts > rejects guest mutation`

Contract:
- Resource mutation follows the caller role boundary.

Proves:
- A guest mutation is rejected.
- The resource remains unchanged.
```

Markdown 目录是权威源，派生索引只负责按 ID、标题、Contract、Proves 和 Entry
快速查询。它不发现测试、不自动收集或注册 case，也不使用源码 marker、角色或
状态字段。

主要命令：

```text
node scripts/test-evidence-catalog.mjs list --query "<text>" --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
```

实际行为入口位于 [`skills/test-evidence-review/`](../../skills/test-evidence-review/)。
