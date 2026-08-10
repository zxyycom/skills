# Test Evidence Review

`test-evidence-review` 只审查测试实现及其证据目录，不再承接 lint、schema、
生成物一致性、安全扫描等工程校验。

## 核心模型

```text
一个保留的最小原生测试入口 <-> 一个 case
```

这里的入口不是任意可运行目标，而是测试框架能够稳定选择、单独报告通过或失败，
并拥有一项完整测试意图的最小命名节点。通常是 `test`、`it`、测试方法或参数化后
的单个框架 case。它不绑定 `node:test` 或其他特定实现；优先沿用项目已有的常见
框架和最简单的精确选择方式，不为账本统一框架。

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

Markdown 目录是权威源。根目录的 `test-evidence-topics.json` 定义受控 topic，
每个 case 单独位于 `<topic>/<slug>.md`；topic 只是稳定测试责任、维护和查询边界，
不改变“一个最小原生测试入口对应一个 case”的身份。派生索引统一聚合全部 case，
按 ID、标题、Contract、Proves、Entry 和精确 topic 查询，并保存根目录相对源路径
以支持定点展开。它不发现测试、不自动收集或注册 case，也不使用源码 marker、角色
或状态字段。

账本路径固定为 `docs/test-evidence`，派生索引固定为其中的
`test-evidence-index.json`，case ID 采用统一协议。使用者只指定工作区根目录，
不需要也不能用项目级配置改变这些规则。

主要命令：

```text
node scripts/test-evidence-catalog.mjs topics --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --topic <topic> --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --query "<text>" --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs stage-index <case-id...> --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
```

## 怎样隔离共享索引的待提交变化

多个 Case 共用一个 `test-evidence-index.json`。同一工作区同时维护 A、B Case，
但当前提交只选择 A 时，先用 `sync-index --write` 从完整目录重建工作区索引，再运行
严格 `check`，最后执行：

```text
bun run test-evidence -- stage-index <A-case-id> --root <workspace-root>
```

该命令只把 A 对应的索引变化写入 `pending`；B 的索引变化仍只存在于工作区索引。
Case 重命名同时传入旧、新 ID。topic 表属于完整集合的 metadata，成员或描述变化不能
按 Case 拆分；同一索引已有待提交变化时命令也会拒绝覆盖。

`stage-index` 不读取或暂存 topic 表、Case Markdown、测试代码或产品代码。调用方
必须按实际提交范围另行暂存这些文件，并在提交前核对完整 `pending` 内容。成功只证明
所选索引条目已经暂存，不证明领域文件已经选择或目录当前有效。

实际行为入口位于 [`skills/test-evidence-review/`](../../skills/test-evidence-review/)。
