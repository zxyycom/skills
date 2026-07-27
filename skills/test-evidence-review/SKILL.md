---
name: test-evidence-review
description: >-
  在新增、修改、删除或审查测试实现，或查询、整理其测试证据 case 时使用。
  以测试框架中最小可独立选择并报告结果的原生测试入口为登记单元，区分它与
  suite、文件、脚本、CI job、fixture、helper 和断言等容器或内部环节，评估
  测试证据质量并维护可检索 case。工程校验、普通业务代码、仅运行既有测试
  或只修复被测对象不使用。
metadata:
  version: "5"
---

# Test Evidence Review

## 目标与边界

本 skill 只审查测试实现及其证据目录。核心映射固定为：

```text
一个保留的最小原生测试入口 <-> 一个 case
```

以下任务使用本 skill：

1. 新增、修改、删除或审查测试实现。
2. 查询、整理或修复已经登记的测试 case。

以下任务不使用：

1. lint、类型检查、schema 检查、生成物一致性检查、安全扫描等工程校验。
2. 普通业务代码、运行时输入校验、构建逻辑或发布 gate 的实现。
3. 只运行既有测试，或只修复被测对象而不修改测试。

任务同时修改产品代码和测试时，只对测试部分应用本 skill。审查、查询和评估
请求保持只读；只有修改请求才更新测试、行为 owner、case 目录、配置或派生索引。

## 核心判断：最小原生测试入口

最小原生测试入口是测试框架能够稳定选择并单独报告通过或失败，且自身拥有一项
完整测试意图的最小命名节点。它通常是 `test`、`it`、测试方法或参数化后的单个
框架 case。

“独立”不等于“命令行上可以单独运行”。测试文件、suite、目录、package script、
runner 命令和 CI job 即使可选，也只要聚合多个可区分的原生测试节点，就属于容器，
不能登记成一个合并 case。

判断顺序固定为：

1. 结果只用于组成父节点的判定时，它是内部环节。
2. 节点拥有 runner 报告的最终结果，但仍包含结果可分别归因的更小原生测试节点时，
   它是聚合容器。
3. 节点拥有自身最终结果，且不存在结果可分别归因的更小原生测试节点时，它才是
   最小原生测试入口。

按以下规则判断：

| 对象 | Case 处理 |
| --- | --- |
| 最小原生测试入口 | 保留时恰好登记一个 case |
| suite、文件、目录、脚本、runner 或 CI job | 仅作定位或执行容器，不因可单独运行而登记 |
| setup、fixture、helper、mock、断言或测试步骤 | 属于测试入口的内部环节，不单独登记 |
| 一个自定义测试程序只产生一个不可再归因的最终判定 | 只有在确实不存在更小测试节点且测试意图单一时，才可作为一个入口 |
| 同一入口混合多个可独立命名、独立失败的测试意图 | 先拆测试入口；不得用一个巨型 case 掩盖边界 |

参数化测试以 runner 的实际报告粒度判断：每组参数能够稳定选择、稳定命名并独立
报告时分别登记；否则登记声明它们的单个原生测试入口。技术上能够 import、临时
筛选某个 helper 或单独执行某段代码，不会使它成为测试入口。

本次修改涉及的每个保留入口都必须登记。工具不会扫描源码来证明全仓完整性；
未触及的历史测试只有在任务明确要求补齐时才进入范围。

## 内容 owner 与读取路径

1. 本文件承接触发边界、入口粒度、证据评估、处置流程和完成标准。
2. [catalog-contract.md](references/catalog-contract.md) 承接 case 字段、目录、
   派生索引、配置、CLI 和机器接口。
3. `scripts/test-evidence-catalog.mjs` 只校验、同步和查询显式 case。它不扫描源码、
   不执行 `Entry:`、不发现或自动登记测试，也不判断测试粒度或证明价值。
4. [migrate-from-verification-implementation-review.md](references/migrate-from-verification-implementation-review.md)
   只在工作区仍使用泛化验证目录、`Verification:` 字段，或更早的 marker 与采集
   配置时读取。
5. [upgrade-from-single-file-catalog.md](references/upgrade-from-single-file-catalog.md)
   只在配置仍使用 `schemaVersion: 1`、`catalogPath` 仍指向单个 Markdown，或
   `schemaVersion: 2` 目录仍由根目录直属主题 Markdown 组成时读取。
6. 项目行为 owner 承接长期产品与接口契约；case 的 `Contract:` 只压缩当前测试
   所需背景，不取代行为 owner。

按任务读取：

1. **查询或整理 case**：先用 `topics` 读取受控主题表，再用 `list --topic <topic>`
   和 `list --query <text>` 搜索 ID、标题、Contract、Proves 和 Entry；范围不明确时
   先用有界 `list`，再用 `show` 展开目标 case。
2. **审查或修改测试**：读取项目测试约定、当前 diff、目标测试及被测契约，再搜索
   相关 case，并按 runner 的原生报告节点确定粒度。
3. **写入或结构修复**：完整读取目录契约。
4. **旧格式迁移**：遇到 `.verification-evidence.json`、`docs/verification/`、
   `Verification:`、`verification-catalog.mjs`、`@test-evidence` 或入口采集配置时
   读取迁移文档。
5. **旧目录升级**：遇到配置 `schemaVersion: 1`、文件型 `catalogPath`，或
   `schemaVersion: 2` 根目录直属主题 Markdown 时读取升级文档。

索引缺失、损坏或陈旧时，`list` 和 `show` 使用当前合法 Markdown 的只读内存
投影并报告 warning，不写回文件。目录不存在时，查询任务报告没有可查询目录；
修改任务只有在决定保留至少一个测试入口后才初始化目录。

## 证据评估

确定原生测试入口后，评估：

1. **契约背景**：能够指出产品规则、接口行为、schema、安全边界或错误语义。
2. **证明信号**：失败能够指向具体契约失效，而不只是内部实现变化。
3. **可观察性**：断言覆盖调用方可观察的返回值、状态、交互、错误或资源结果。
4. **可靠性**：输入、fixture、mock、时序、随机性和环境不会制造不稳定信号。
5. **证据独立性**：没有只复述实现、只证明 mock，或让被测实现生成自己的预期值。
6. **维护价值**：新增证明价值足以承担运行时间、维护和故障定位成本。

多个断言可以属于一个 case，但必须共同服务同一测试意图和最终判定。只要它们已经
形成可独立命名、可独立失败的测试意图，就应拆成不同原生测试入口和不同 case，
不能因位于同一文件、suite 或开发任务而合并。

## 工作流

1. **建立范围**：确认本次新增、修改、删除或审查的测试入口与预期契约。
2. **搜索目录**：按测试名、入口、契约、输入、错误和输出搜索已有 case。
3. **确定粒度**：以 runner 原生节点为基准，区分最小入口、聚合容器和内部环节。
4. **评估证据**：检查契约、信号、可观察性、可靠性、独立性和维护成本。
5. **实施处置**：
   - 保留的最小入口新建或更新唯一 case。
   - 删除测试入口时删除对应 case；只改变定位时更新原 case。
   - 容器与内部环节只在确有定位价值时写入其所属 case，不独立登记。
   - 混合多个独立测试意图的入口先拆分。
   - 没有新增证明价值的测试删除或不新增。
6. **同步索引**：case 正文变化后运行 `sync-index --write`；索引不手工编辑。
7. **验证结果**：运行目标测试，再运行目录 `check`；按项目要求补充更大范围检查。

## Case、索引与 CLI

每个 case 使用 `Entry:`、`Contract:` 和 `Proves:`；没有 `Verification:`、状态、
角色或 marker 字段。精确格式以目录契约为准。

Markdown 目录是权威源。根目录的受控主题表定义可用 topic；每个 case 单独位于
`<topic>/<slug>.md`，路径 topic 只提供维护、筛选和定位边界，不合并或改变 case
身份。派生索引提供按 case ID、标题、全部 Contract、全部 Proves、全部 Entry 和
精确 topic 的快速查询；`show` 根据目录相对 `sourcePath` 展开完整原文。索引统一
聚合全部 topic，但不收集、注册或生成 case。

从 skill 目录运行：

```text
node scripts/test-evidence-catalog.mjs topics --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --topic <topic> --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --query "<contract or entry>" --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
```

`list` 可组合单个 `--topic`、`--query`、`--limit` 和 `--offset`；需要机器输出时
增加 `--json`。

## 完成标准

### 只读任务

1. 先给总体判断；对需要动作的测试说明原生入口、所属容器、契约、证明信号和处置。
2. 没有越过只读授权；拟登记 case、未运行环境和结论边界已经说明。

### 修改任务

1. 本次范围内每个新增或保留的最小原生测试入口都恰好由一个 case 承接；已删除
   入口不再保留 case。
2. 没有把整个 skill、模块、测试文件、suite、脚本或 CI job 当成聚合 case。
3. 每个 case 的 `Entry:` 都定位同一原生测试入口；Contract 与 Proves 可独立理解。
4. case 位于受控主题表定义的 `<topic>/<slug>.md`，一个文件恰好承接一个 case；
   topic 只表达稳定测试责任，没有重新集中或改变 case 粒度。
5. fixture、helper、mock、断言和测试步骤没有被误登记为独立 case。
6. 工程校验没有进入测试证据目录，目录中也没有 `Verification:`、marker 或状态角色。
7. 派生索引已从合法目录同步；已运行目标测试和目录 `check`，或明确报告阻塞边界。

### 通用交付

报告实际改动、测试结果、目录校验、未执行环境和残余风险，并区分测试实现失败、
被测对象失败与目录结构失败。
