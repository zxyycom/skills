---
name: test-evidence-review
description: >-
  在新增、修改、删除或审查测试实现，或查询、整理其测试证据 case 时使用。
  先以测试框架能稳定独立选择并单独报告结果的最小原生测试入口界定 case，
  再审查契约、证明信号和可靠性，并维护一入口一 case 的可检索账本。
  工程校验、仅运行既有测试或只修改被测对象不使用。
metadata:
  version: "19"
---

# Test Evidence Review

## 使用判断

本 skill 处理测试实现及其测试证据账本。以下任务使用：

1. 新增、修改、删除或审查测试实现。
2. 查询、整理或修复已经登记的测试 case。

以下任务不使用：

1. lint、类型检查、schema 检查、生成物一致性检查、安全扫描等工程校验。
2. 普通业务代码、运行时输入校验、构建逻辑或发布 gate 的实现。
3. 只运行既有测试，或只修改被测对象而不修改测试。

任务同时修改产品代码和测试时，只对测试部分应用本 skill。查询、审查和评估请求
保持只读；只有用户授权修改时，才修改测试、行为 owner、case 目录或派生索引。

触发后的目标结果固定为：

```text
本次范围内一个保留的最小原生测试入口 <-> 一个 case
```

“保留”指入口经过本次审查或修改后仍存在于测试实现中。账本登记入口，不登记测试
文件、suite、脚本等聚合容器，也不登记 fixture、helper、断言等内部环节。

## 核心判断：什么是登记入口

最小原生测试入口是测试框架能够稳定独立选择、单独报告通过或失败，并且自身拥有
一项完整测试意图的最小命名节点。它通常是 `test`、`it`、测试方法或参数化后的
单个框架 case。

按以下顺序判断候选节点：

1. 候选节点的结果只用于组成父节点判定时，它是内部环节。
2. 候选节点拥有 runner 报告的结果，但仍包含结果可分别归因的更小原生测试节点时，
   它是聚合容器。
3. 候选节点拥有自身最终结果，且不存在结果可分别归因的更小原生测试节点时，它才是
   最小原生测试入口。

| 候选对象 | 处理 |
| --- | --- |
| 最小原生测试入口 | 保留时恰好登记一个 case |
| suite、文件、目录、package script、runner 或 CI job | 只作定位或执行容器 |
| setup、fixture、helper、mock、断言、hook 或测试步骤 | 归入所属入口，不单独登记 |
| 只产生一个不可再归因且意图单一的最终判定的自定义测试程序 | 可以作为一个入口 |
| 混合多个可独立命名、独立失败测试意图的入口 | 先拆测试入口，再分别登记 |

“独立”不等于命令行上可以单独运行。只要文件、suite、脚本或 CI job 仍聚合多个
可区分的原生测试节点，它就是容器。技术上能够 import、临时筛选某个 helper 或
单独执行一段代码，也不会使它成为测试入口。

参数化测试按 runner 的真实报告粒度判断：每组参数能够稳定选择、稳定命名并独立
报告时分别登记；否则登记声明这些参数的单个原生测试入口。

## 范围与内容 Owner

本次修改涉及的每个新增或保留入口都必须登记；删除入口时同步删除对应 case。工具
不会扫描源码来证明全仓完整性，因此未触及的历史测试只有在任务明确要求补齐时才
进入范围。

内容 owner 与读取条件如下：

1. 本文件承接触发边界、入口粒度、证据评估、执行流程和完成标准。
2. [catalog-contract.md](references/catalog-contract.md) 承接 case 字段、目录布局、
   固定路径、派生索引、CLI 和机器接口；写入或结构修复 case，以及需要分页、
   JSON 或诊断契约时完整读取。
3. 项目测试约定、目标测试、当前 diff 和被测契约决定具体测试行为；审查或修改测试
   时读取。
4. 项目行为 owner 承接长期产品与接口契约；case 的 `Contract:` 只压缩当前测试
   所需背景，不取代行为 owner。
5. [migrate-from-verification-implementation-review.md](references/migrate-from-verification-implementation-review.md)
   只在工作区仍存在泛化验证目录、`Verification:`、旧 marker 或采集配置时读取。
6. [upgrade-from-single-file-catalog.md](references/upgrade-from-single-file-catalog.md)
   只在旧账本仍是单个 Markdown，或根目录直属主题 Markdown 时读取。

`scripts/test-evidence-catalog.mjs` 只校验、同步和查询显式 case，或按调用方给出的
Case ID 暂存派生索引条目。它不扫描源码、不执行 `Entry:`、不发现或自动登记测试，
也不判断测试粒度或证明价值。

目录不存在时，只读任务报告没有可查询目录；修改任务只有在决定保留至少一个测试
入口后才初始化目录。

## 证据评估

确定最小原生测试入口后，逐项判断：

1. **契约背景**：测试能够指出产品规则、接口行为、schema、安全边界或错误语义。
2. **证明信号**：失败能够指向具体契约失效，而不只是内部实现变化。
3. **可观察性**：断言覆盖调用方可观察的返回值、状态、交互、错误或资源结果。
4. **可靠性**：输入、fixture、mock、时序、随机性和环境不会制造不稳定信号。
5. **证据独立性**：没有只复述实现、只证明 mock，或让被测实现生成自己的预期值。
6. **维护价值**：新增证明价值足以承担运行时间、维护和故障定位成本。

多个断言可以属于一个入口，但必须共同服务同一测试意图和最终判定。只要观察点已经
形成可独立命名、可独立失败的测试意图，就先拆成不同原生测试入口，再分别登记 case。

## 执行流程

### 查询、审查或评估

1. 确认只读范围、目标测试或目标 case。
2. 查询 case 时先运行 `topics` 获取受控 topic，再用 `list --topic <topic>` 或
   `list --query <text>` 缩小范围，最后用 `show <case-id>` 展开权威原文。
3. 审查测试时读取测试约定、目标测试和被测契约，并搜索相关 case。
4. 按 runner 原生报告节点区分最小入口、聚合容器和内部环节，再完成证据评估。
5. 先报告总体判断；对需要动作的入口说明所属容器、测试意图、契约、证明信号和
   建议处置。不得因只读任务修改测试、case 或索引。

索引缺失、损坏或陈旧时，`list` 和 `show` 使用当前合法 Markdown 的只读内存投影
并报告 warning，不写回文件。

### 修改测试或账本

1. **建立范围**：列出本次新增、修改、删除或保留的原生测试入口及预期契约。
2. **搜索已有 case**：按测试名、入口、契约、输入、错误和输出查找稳定 case ID。
3. **确定粒度**：以 runner 原生报告节点为准，排除聚合容器和内部环节。
4. **评估并修改**：检查六项证据标准；混合多个独立意图的入口先拆分，没有足够
   证明价值的候选测试不新增，已经确认不再保留的测试删除。
5. **维护 case**：
   - 新增或保留的最小入口新建或更新唯一 case。
   - 删除测试入口时删除对应 case；只改变定位时更新原 case。
   - 容器和内部环节只在有定位价值时写入所属 case，不独立登记。
6. **同步索引**：case 正文变化后运行 `sync-index --write`；索引不手工编辑。
7. **按需隔离索引暂存**：同一工作区有多项 Case 变化、当前提交只选择其中一部分时，
   在第 6 步同步完整工作区索引后先通过目录 `check`，再用
   `stage-index <case-id...>` 只暂存所选 Case 的索引条目；topic 表、Case Markdown、
   测试代码和产品代码仍由调用方按实际范围另行暂存。
8. **验证结果**：运行目标测试，再运行目录 `check`；按项目要求补充更大范围检查。

## Case 与查询模型

每个 case 只使用 `Entry:`、`Contract:` 和 `Proves:`。Markdown 目录是权威源；
根目录受控 topic 表定义稳定测试责任，每个 `<topic>/<slug>.md` 恰好保存一个
case。topic 只提供维护、筛选和定位边界，不合并或改变 case 身份。

`Entry:` 中的所有定位必须指向同一个最小原生测试入口。`Contract:` 提供理解测试
所需的最小稳定背景；`Proves:` 说明直接且可判断的可观察结果。目录不使用
`Verification:`、状态、角色或源码 marker。

派生索引统一聚合全部 topic，并提供按 case ID、标题、Contract、Proves、Entry
和精确 topic 的查询。索引可以删除重建，但不收集、注册或生成 case。精确格式、
固定路径、CLI 参数和机器结果以目录契约为准。

`stage-index` 只把已经存在于 current revision 或工作区索引中的所选 Case ID 交给
通用索引运行时。Case 重命名同时选择旧、新 ID；topic 表 metadata 变化不能按 Case
拆分。同一索引已有 `pending` 时命令拒绝覆盖。成功不表示 topic 表、Case Markdown、
测试代码或产品代码已经暂存，提交前仍需核对完整 `pending` 范围。

从 skill 目录执行常用事务：

```text
node scripts/test-evidence-catalog.mjs topics --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --topic <topic> --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --query "<contract or entry>" --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs stage-index <case-id...> --root <workspace-root>
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
```

## 完成标准

### 只读任务

1. 已给出总体判断，并对需要动作的测试说明原生入口、所属容器、契约、证明信号和
   处置建议。
2. 没有越过只读授权；拟修改内容、未运行环境和结论边界已经说明。

### 修改任务

1. 本次范围内每个新增或保留的最小原生测试入口都恰好由一个 case 承接；已删除
   入口不再保留 case。
2. 没有把模块、skill、测试文件、suite、脚本或 CI job 登记成聚合 case，也没有
   把 fixture、helper、mock、断言或测试步骤登记成独立 case。
3. 每个 `Entry:` 都定位同一原生测试入口，`Contract:` 与 `Proves:` 可独立理解。
4. 每个 case 位于受控 topic 的独立 Markdown；topic 没有重新集中或改变 case 粒度。
5. 工程校验没有进入测试证据目录，目录中没有旧字段、marker、角色或状态。
6. 派生索引已从合法目录同步；目标测试和目录 `check` 已运行，或阻塞边界已说明。
7. 使用选择性索引暂存时，所选 Case ID、索引结果与另行暂存的领域文件范围已经核对，
   未选择 Case 的工作区索引变化没有进入本次 `pending`。

### 交付

报告实际改动、目标测试结果、目录校验、未执行环境和残余风险，并区分测试实现失败、
被测对象失败与目录结构失败。
