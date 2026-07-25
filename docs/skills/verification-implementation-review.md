# Verification Implementation Review

`verification-implementation-review` 审查测试与工程校验实现，并维护可检索的验证 case。它只在新增、修改、删除或评审 test/check 实现，或者查询和整理现有 case 时启用；普通业务代码修改、仅运行既有检查、只修复被检查对象和业务运行时输入校验不会触发。

`test` 通过安排输入、状态或交互并断言结果产生证据。`check` 对代码、schema、生成物、依赖或工作区应用规则，主要产物是可复核的通过、失败或诊断结论。

## 核心模型

目录的登记单元是项目拥有的独立验证入口，不是每个函数、断言、规则或子步骤：

```text
一个保留的独立验证入口 <-> 一个 case
```

独立入口是项目稳定选择或调用的验证目标，能够产生可归属于自身的最终判定。项目直接配置的提交、CI 或发布 gate，以及项目直接采用的聚合命令或 CI job，都属于独立入口。

| 对象 | Case 处理 |
| --- | --- |
| 项目保留的独立入口 | 必须恰好登记一个 case |
| 只组成父入口判定的内部环节 | 归入父 case，不单独登记 |
| 不保留或交给人工流程、监控、发布治理的事项 | 不登记验证 case |

技术上能够 import、直接调用或被 runner 临时筛选，不自动成为独立入口。子步骤只有同时被项目作为稳定验证目标使用时，才从父 case 拆出自己的 case。

## 审查内容

确定入口归属后，skill 继续判断：

1. 验证对应什么稳定契约。
2. 失败是否能指出具体契约失效。
3. test 是否断言可观察结果，check 是否判断可复核工程状态。
4. 输入、环境、fixture、规则和结果是否可靠。
5. 证据是否复述实现、只证明 mock 或自证循环。
6. 新增证明价值是否足以承担执行、维护和故障定位成本。

## Case 与索引

每个 case 使用 `Verification: test|check`、`Entry:`、`Contract:` 和 `Proves:`：

```markdown
### Case SCHEMA-GENERATED-CURRENT-001: Generated schema stays current
Verification: check

Entry:
- `scripts/check-generated.ts`
- `bun run check:generated`

Contract:
- Committed schema artifacts match their maintained source.

Proves:
- Regeneration produces no artifact drift.
```

示例中的文件和命令是同一个 check 入口的两种定位方式。一个 case 的全部 `Entry:` 必须指向同一逻辑入口，不能收纳内部辅助实现或其他独立入口。

Markdown 目录是权威源，派生索引只负责低上下文查询：

1. `list --query <text>` 搜索 case ID、标题、全部 Contract、全部 Proves 和 Entry。
2. `list --verification test|check` 按实现类型筛选。
3. `show <case-id>` 从 Markdown 展开一个 case。
4. `sync-index --write` 重建索引，`check` 严格校验配置、目录和索引新鲜度。

`list` 和 `show` 在持久化索引不可用时从当前合法目录建立只读内存投影，不要求查询任务先写文件。索引不发现入口、不执行 Entry，也不能判断入口身份、父子归属或证明质量。

旧 `test-evidence-review`、入口采集器、`@test-evidence` marker 和 automated/review/exempt 目录由 skill 内的迁移引用承接。

实际行为入口位于 [`skills/verification-implementation-review/`](../../skills/verification-implementation-review/)。
