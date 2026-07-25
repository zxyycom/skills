# Verification Implementation Review

测试和工程校验都在回答“这个实现或工程状态是否正确”，但它们产生证据的方式不同。测试安排输入、状态或交互并断言结果；check 通过脚本、规则、配置或工具入口判断代码、schema、生成物、依赖或工作区是否满足约束。两者都可能重复、脆弱、与实现细节耦合，或者只制造一个看似严格但无法定位真实退化的信号。

`verification-implementation-review` 审查的是这些验证实现本身。它只在新增、修改、删除或评审测试与工程校验实现时启用，也可以用于查询和整理已经登记的验证 case。普通业务代码修改、仅运行既有检查、只修复被检查对象，以及业务运行时输入校验不会触发。

## 核心工作

流程先恢复验证实现需要证明的稳定契约，再检查失败信号、可观察性、确定性、独立性、重复和维护成本。结论可以是不保留、复用、合并或扩展既有实现，也可以建立新的 `test` 或 `check` case。只能由人工流程、监控或发布治理承接的风险会交给对应 owner，不伪装成目录中的验证实现。

保留的 case 只使用四个核心部分：

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

`Entry` 可以定位文件、规则、task 或项目拥有的命令入口；`Contract` 说明需要长期保持的规则背景；`Proves` 保存可独立判断的证明点。目录只登记已经存在且决定保留的实现，不保存 planned、人工 review 或发现豁免。

## 显式目录与派生索引

新方向不扫描源码、不要求 marker、不统计未登记测试函数，也不自动注册 case。Agent 在完成语义评估后显式维护 Markdown 目录，派生索引负责低上下文查询：

1. `list --query <text>` 按 case ID、标题、首条契约摘要或 Entry 搜索。
2. `list --verification test|check` 按实现类型筛选。
3. `show <case-id>` 只展开一个 case 的原始 Markdown。
4. `sync-index --write` 从合法目录重建索引，`check` 校验配置、目录与索引新鲜度。

索引不执行 Entry，不拥有 case 内容，也不能证明测试或 check 本身可靠。项目测试框架和工程命令继续负责运行；本 skill 负责判断验证实现值不值得存在、实际证明什么，以及如何被后续维护者快速找回。

旧 `test-evidence-review`、入口采集器、`@test-evidence` marker 和 automated/review/exempt 目录可以按新 skill 内的迁移引用一次性收敛。

实际 skill 位于 [`skills/verification-implementation-review/`](../../skills/verification-implementation-review/)。
