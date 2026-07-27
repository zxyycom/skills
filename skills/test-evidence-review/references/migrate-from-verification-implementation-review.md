# 从泛化验证目录迁移

仅当工作区仍使用 `verification-implementation-review`、泛化验证目录、
`Verification:` 字段，或更早的 marker 与采集配置时读取。当前工具只接受 v3
测试证据根目录；迁移必须显式完成，不提供双读、自动搬移或隐式转换。

## 恢复测试专属边界

1. 使用 `test-evidence-review`，并按
   [测试证据目录契约](catalog-contract.md) 创建当前目录；本文只说明旧模型如何
   退出，不复制 topic、case 和索引的完整格式规则。
2. 让 `.test-evidence.json` 使用 `schemaVersion: 3`，`catalogPath` 指向
   `docs/test-evidence` 根目录，`indexPath` 指向根目录中的
   `docs/test-evidence/test-evidence-index.json`：

   ```json
   {
     "schemaVersion": 3,
     "catalogPath": "docs/test-evidence",
     "indexPath": "docs/test-evidence/test-evidence-index.json"
   }
   ```

3. 在 `docs/test-evidence/test-evidence-topics.json` 中使用 `schemaVersion: 1`
   显式定义排序且唯一的 topic ID 与稳定责任描述；不要从旧目录名、测试路径或
   case ID 自动猜测 topic。
4. 每个保留 case 独占 `<topic-id>/<semantic-slug>.md`，且只对应一个 runner 能
   稳定选择并单独报告的最小原生测试入口。case ID 继续作为跨 topic 稳定身份。
5. 目录只保留原生测试入口；lint、schema、生成物、依赖和工作区状态等工程 check
   移交各自 owner，不转换成测试 case。

## 重新确定 Case 粒度

不要把旧“独立验证入口”机械改名成测试入口。逐条按 runner 的原生报告节点重审：

1. 测试文件、suite、package script、runner 命令和 CI job 如果聚合多个原生测试
   节点，只是容器；把旧聚合 case 拆成每个最小原生测试入口一个 case 文件。
2. fixture、helper、mock、断言、before/after hook 和测试步骤归入所属测试入口，
   不单独登记。
3. 一个自定义测试程序只有在确实产生一个不可再归因且意图单一的判定时，才保留为
   一个入口。
4. 用 `Entry:` 保存测试定义与精确选择定位；只写聚合文件或通用命令不足以证明粒度。
5. 保留仍成立的 Contract 和 Proves，删除 `Verification:`、角色和状态字段；一个
   case 混合多个可独立命名、独立失败的意图时，先拆测试。

## 执行单轨迁移

1. 先盘点旧目录中仍应保留的测试 case、稳定 ID 和精确 Entry，再确定受控 topic 表
   与每个 case 的唯一归属。
2. 在旧权威源之外准备完整 v3 根目录，逐个写入单 case 文件；如果旧目录位于目标根
   目录内部，先移到根目录之外的可恢复位置，避免旧成员违反 v3 根目录白名单。
3. 切换 `.test-evidence.json` 后只读取 v3 根目录。不要保留运行时双读、兼容
   fallback，也不要让工具自动移动旧文件或根据源码生成 case。
4. v3 同步、检查和代表性查询通过后，删除旧泛化验证目录、索引、配置和临时清单；
   保留当前 `.test-evidence.json`，且不同时维护两份权威源。

更早的源码 marker、入口采集器、自动注册、main / derived / exempt 角色或
planned / review 状态都不属于当前模型。删除这些配置与字段，不以发现数量反向
生成 case。

## 完成迁移

依次运行：

```text
node scripts/test-evidence-catalog.mjs topics --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --topic <topic-id> --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
```

再运行迁移后的目标测试，并确认：

1. topic 表、case 总数和全部稳定 case ID 与迁移盘点一致。
2. 每个 `sourcePath` 都是根目录相对 `<topic-id>/<semantic-slug>.md`。
3. 每个 Entry 精确定位一个原生测试节点，`show` 展开对应单 case 原文。
4. 旧目录、配置、索引、marker 和采集入口已无调用方依赖。
