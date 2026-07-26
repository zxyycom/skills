# 从泛化验证目录迁移

仅当工作区仍使用 `verification-implementation-review`、泛化验证目录，
`Verification:` 字段，或更早的 marker 与采集配置时读取。新工具不自动迁移。

## 恢复测试专属边界

1. 使用 `test-evidence-review`。
2. 使用 `.test-evidence.json`、`docs/test-evidence/cases/` 中按稳定测试责任拆分的
   主题 Markdown，以及
   `docs/test-evidence/test-evidence-index.json`。
3. 使用 `scripts/test-evidence-catalog.mjs`。
4. 目录只保留原生测试入口；lint、schema、生成物、依赖、工作区状态等工程 check
   移交各自 owner，不转换成测试 case。
5. 从保留 case 中删除 `Verification:`。新的测试身份由目录本身表达。

## 重新确定 Case 粒度

不要把旧“独立验证入口”机械改名成测试入口。逐条按 runner 的原生报告节点重审：

1. 测试文件、suite、package script、runner 命令和 CI job 如果聚合多个原生测试
   节点，只是容器；把旧聚合 case 拆成每个最小原生测试入口一个 case。
2. fixture、helper、mock、断言、before/after hook 和测试步骤归入所属测试入口，
   不单独登记。
3. 一个自定义测试程序只有在确实产生一个不可再归因且意图单一的判定时，才保留为
   一个入口。
4. 用 `Entry:` 保存测试定义与精确选择定位；只写聚合文件或通用命令不足以证明粒度。
5. 保留仍成立的 Contract 和 Proves；一个 case 混合多个可独立命名、独立失败的
   意图时，先拆测试。

## 不恢复旧自动化

更早的 test-evidence 实现可能包含源码 marker、入口采集器、自动注册、main /
derived / exempt 角色或 planned / review 状态。迁移时删除这些配置与字段，不恢复
相应能力，也不以发现数量反向生成 case。

目录只保存显式 case，派生索引只负责查询。Agent 在本次测试改动范围内判断并登记
最小入口；工具不扫描全仓来证明覆盖率。

## 完成迁移

运行：

```text
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
```

再运行迁移后的目标测试，确认每个 Entry 能精确定位一个原生测试节点；删除旧目录、
旧索引、旧配置和旧临时清单后，确认没有调用方继续依赖。
