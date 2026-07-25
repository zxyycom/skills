# 从 Test Evidence Review 迁移

仅当工作区仍存在旧 skill、配置、CLI、marker 或 case 字段时读取。新运行时不读取或自动迁移旧格式。

## 身份与文件

1. 使用 `verification-implementation-review` 替代 `test-evidence-review`。
2. 使用 `.verification-evidence.json`、`docs/verification/cases.md` 和 `docs/verification/verification-evidence-index.json`。
3. 使用 `scripts/verification-catalog.mjs` 替代 `test-evidence-ledger.mjs` 和 `test-entry-regex.mjs`。

## Case 收敛

逐条审查旧目录：

1. 已存在且值得保留的 automated 测试改为 `Verification: test`。
2. 实质是脚本、规则、配置、编译、lint、schema 或产物一致性检查的实现改为 `Verification: check`。
3. 用 `Entry:` 列表保存真实实现位置和项目拥有的规范调用入口；移除 `Status:`、`Code:`、`Scope:`、review 状态及源码角色。
4. 保留仍成立的 `Contract:` 和 `Proves:`，并重新检查证明信号、可靠性、重复与维护成本。
5. planned、review 和 exempt 不进入新目录。计划留在任务或变更 owner；人工风险交给对应流程 owner；发现误报通过调整发现器或工具配置处理。

## 移除采集与 marker

1. 删除 `.test-entry-regex.json` 和不再被其他 owner 使用的入口清单。
2. 删除 `@test-evidence main|derived|exempt <CASE-ID>` marker。
3. 不以 marker 数量或自动发现结果反向创建新 case；只有完成语义处置并保留的验证实现才显式登记。

## 完成迁移

运行：

```text
node scripts/verification-catalog.mjs sync-index --write --root <workspace-root>
node scripts/verification-catalog.mjs check --root <workspace-root>
```

再运行每个迁移 case 的项目验证入口，确认 Entry 仍能定位实现，test/check 分类与实际机制一致，且删除旧索引、旧配置和旧临时清单后没有调用方继续依赖。
