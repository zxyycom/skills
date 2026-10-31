---
title: "统一领域范围后的门禁质量复核"
id: "261031-gate-domain-scope-quality-audit"
formedAt: "2026-10-31T07:56:52Z"
question: "提交 e34493de 后，显式领域和完整门禁是否仍有可复现的误阻断、指标漏检或验收稳定性问题？"
tags:
  - "gate-quality"
  - "project-tooling"
  - "validation-boundaries"
relations: []
---

## 形成时背景

- 用户在提交 `e34493de3b295458045e989f2307b48e8d1dde85` 后询问是否仍有质量问题。本轮开始时工作区干净；请求是质量复核，不包含实现修复、提交或远端写入。
- 前轮已验证 quick 和 `gate-tests + repository-validation`，但没有执行完整 base。本轮补跑 full，并检查统一范围表中的领域归属和空代码范围，避免把局部成功外推为完整通过。
- 本轮运行时为 Node.js `v26.8.2`、Bun `1.4.4`，仓库使用锁定的 `@zxyycom/vibe-check@0.0.4`。调查范围包含所提交改动及直接相关的既有扫描政策与测试边界，不是全仓人工审查。

## 调查目的

- 判断正常领域选择是否会误阻断，所选领域的产品源码是否确实进入指标，以及完整模式是否覆盖维护的构建代码。
- 取得完整 base 的当次实际结论，区分确定配置问题、当次测试失败、尚未证实的原因和已经验证的保护边界。

## 调查范围与依据

- 当前规范来自 [Gate 执行](../gate-execution.md)、[原生材料政策](../gate-policy.md)、[领域声明契约](../gate-check-authoring.md#领域范围与检查订阅)及[生成源码归属](../tooling-distribution.md#源码与依赖边界)。实现核对 `scripts/lib/vibe-gate/impact-tools.ts`、`code-selection.ts`、`checks/native.ts` 及 CLI 成功结算。
- 主代理与两个只读审查代理分别检查扫描覆盖、领域归属和实际结算；使用当前 Definition、原生 Check 与 `collectProjectFiles`，私有 fixture 只替换非目标环境前置。没有替换作为观察目标的指标执行器或成功判定。
- 执行 `bun run check -- --scope full`：完整 base 的 66 项均实际执行，65 passed、1 failed，三个 release-only 项不适用，退出 1，总墙钟约 135.3 秒。失败项为 `test:test-evidence:public-boundary`；其他 base 项包括类型、lint、格式、结构、生成一致性、原生指标及记录检查均通过。
- full invocation 为 `.log/vibe-check/invocations/20261031T075157522Z-1ccd770a-568e-4305-9833-e8a1ef1401e5`。其标准运行产物按项目约定保留，本报告在下文保存必要观察，不把日志缓存的后续存在性作为结论前提。
- 失败后单独运行 `bun test ./tools/test-evidence/tests/public-boundary.test.ts`：6 pass、0 fail，约 3.56 秒。只有一次完整运行和一次单独重跑，不足以证明失败频率或完整 Gate 已恢复。
- 动态反例均在系统临时目录创建、完成后清理；没有向受审源码或测试注入违规。指标探针须使用正常 Node 启动方式；继承 `--input-type=module` 的 worker 会产生探针环境自身的 `analysis-failed`，排除该启动因素后再取得下述指标结论。

## 调查结果与边界

### 确认问题一：纯声明分发范围被判为可扫描代码域

- 位置：`scripts/lib/vibe-gate/impact-tools.ts` 的 `decision-distribution`、`investigation-distribution` 及 `gateCodeToolIds`／`isGateCodePattern`。
- 两个范围都包含 `tools/<domain>/api/**`，因此前缀分类器启用文件和函数指标，但实际 API 源为 `.d.mts`，skill 下文件又是排除在维护代码之外的分发副本。两域的维护 JavaScript/TypeScript 投影均为零文件。
- 在当前仓库材料上执行对应原生指标，两项均返回 `not-applicable / no-eligible-input`，aggregate failed。另在私有 fixture 经真实 CLI 结算确认：必跑指标空选集退出 1，健康选集退出 0，所选产品函数六参数违规退出 1；没有发现吞掉不适用或失败的行为。
- 判断为 P2：合法的两个分发范围不能独立完成局部验收。修复方向是在同一声明中正确区分可扫描维护代码与纯声明／分发材料，不以放宽意外不适用的阻断政策消除误报。

### 确认问题二：版本管理范围把自身源码留在额外依赖中

- 位置：`scripts/lib/vibe-gate/impact-tools.ts` 的 `version-control.files`。
- 当前 `files` 只有版本管理测试和 Git fixture；27 个 `tools/shared/src/version-control/` 源码文件只通过共同输入进入完整证明闭包，没有进入所选领域的指标范围。
- 私有 fixture 使用现有源码路径 `tools/shared/src/version-control/git-core.ts`，放置六参数产品函数，并保留健康的版本管理测试文件。selected 的原生函数指标 passed、零 finding；同 fixture 的 full failed，唯一 finding 为产品参数数 `6 > 5`。
- 判断为 P2：按版本管理领域运行测试仍可能漏掉该领域自身的产品代码指标违规。修复方向是将该源码目录归入 `version-control.files`；其他领域真正消费它时的共同输入仍保留，不应把所有传递依赖都扩入局部扫描。

### 确认问题三：默认 build 排除误伤长期构建适配源码

- 位置：`scripts/lib/vibe-gate/checks/native.ts` 的维护代码和自动化代码 selections；这项配置早于本次提交存在。
- 项目明确由 `scripts/build/` 维护生成适配器，其中现有 11 个长期 `.ts` 源文件。但上游默认排除含 `**/build/**`，原生 selection 保持默认排除，显式包含不能覆盖该防呆层。
- 对当前仓库的原生 file-metrics、function-metrics、duplicate-detection options 分别使用 `collectProjectFiles`，11 个源文件在三项选集中均为零命中。
- 单变量反例：私有 `scripts/build/probe.ts` 含八参数函数，另有健康的 `scripts/lib/healthy.ts` 时，full 原生函数指标 passed、零 finding；把相同八参数函数再放入 `scripts/lib/control.ts` 后，failed，唯一 finding 指向后者，自动化参数上限为七。构建目录内的违规始终没有被分析。
- 判断为 P2：即使完整指标通过，也没有证明这些维护源码的指标或重复规则。修复应在项目 selection owner 区分真实维护的 build 源码与需要排除的依赖、构建产物，不宜无区别撤销所有默认排除。

### 完整验收中的超时失败：已观察，尚未定位原因

- 失败源为 `tools/test-evidence/tests/public-boundary.test.ts`，节点 `distributed Node CLI returns schema-valid Case list, tags, show, and search JSON`。该节点顺序启动多个真实 Node CLI；本轮 full transcript 记录 `timed out after 5000ms`、`killed 1 dangling process`，后续节点另出现 `shown.code` 为 null 的断言，整个文件报告 4 pass、2 fail。
- 单独重跑同文件 6/6 通过，证明当次独立执行没有复现，不推翻第一次失败。负载、测试边界与超时清理是后续候选因素，尚无受控对照把根因归到某一项；不能将其写成已确认的并发 Bug，也不能据此声称完整 Gate 通过。
- 后续应在完整调度与独立运行间重复对照，观察真实子进程生命周期和每个原生节点的时间预算，再按测试行为 owner 选择修复；不直接靠放宽断言或盲目增加超时掩盖问题。

### 已验证的保护与交付边界

- DR／IR 的新增未归属源码、新测试 helper 以及新增未知工具 owner，会进入未闭合输入诊断，保守选择全部 58 项可复用项目检查，并拒绝发布 `inputs-unclosed` receipt；本轮未发现这些新增边界静默省略。
- 严格 aggregate 和 CLI 非零退出按契约工作；问题一应修领域分类，不应更改此保护。
- 本轮不修复上述问题，不修改测试或账本，不执行 CI、release 打包或远端写入。持久写入仅为本报告及其派生索引；审查辅助物已清理。建议优先修复前两个局部范围问题，同时补覆盖构建源码的选择反例，再独立定位超时稳定性。

### 用户授权后的修复与补证

以下内容是用户随后要求“重新调整优化一下”后的同轮补证，不回填为首次只读复核时已经成立的认识；形成时间和前面的失败观察保留。

- 领域表增加显式 `kind: code | declarations | material`。声明分发域保留类型、lint、格式三项质量命令，不再启动没有维护实现材料的指标；真正代码域的空输入仍严格失败。版本管理的自身源码已加入 `files`，没有删掉其他领域实际消费它时的共同输入。
- 全部原生维护材料和 Markdown 指纹来源共用 `project-files.ts` 的项目选择政策，仅对根 `scripts/build/` 维护源码豁免通用 build 排除，依赖、VCS、日志、缓存、产物、其他及再次嵌套的 build 目录继续隔离。selected 投影保留这一 selection 的开关与排除，完整模式也恢复相同源码覆盖；输入证明契约同步提升为 v9。
- 修复过程中独立审查发现否定 extglob 对 `scripts2`、`scripts-copy`、`building` 等前缀近邻的处理会漏掉排除，已修正并补入真实文件矩阵。独立使用六种目录名穷举到四层，1,555 个文件按路径段判据计算预期，收集结果完全一致，排除的 build 目录没有被读取。
- 另一次早期 quick 因新排除模式的前导 `!!` 触发上游全候选回退与剪枝保守路径，出现预算失败；更正为普通列表负模式后，实际 quick 六项全部通过，总墙钟约 6.49 秒、P90 约 5.52 秒。独立对当前仓库交替测量默认与项目政策的 Markdown／密钥收集，未读取保护目录；密钥选集只增加应覆盖的 11 个构建源码文件，没有全仓遍历退化证据。
- Test Evidence 分发测试按可独立归因的 CLI 契约由六个节点拆为十三个，每个节点使用私有 fixture；非目标索引准备走公开 sync API，真实 Node 的各命令、协议、退出状态和显式写授权断言仍保留。单节点连续 Node 启动最多从五次降至两次，没有放宽断言或默认超时。
- 私有探针确认 Bun `1.4.4` 的测试超时不会自动 abort `TestContext.signal`，旧 callback 可以恢复；这解释了先前测试超时后旧断言出现在后续节点的生命周期缺口。测试私有 Node scope 现在先禁止新启动、终止并等待所属子进程关闭，再清理 fixture，取消值与真实 CLI 退出结果分离。强制 100 毫秒超时的隔离探针仍把原节点报告为失败，而后续 usage 节点通过，没有旧业务断言污染；删除启动保护的变异被独立 marker 断言捕获。
- 新增或调整的 Gate 定向测试 17/17 通过，覆盖两类分发范围、联合隔离、版本管理六参数产品违规、构建源码八参数自动化违规、空代码输入和默认保护矩阵。七项无落盘变异均由相应原生节点的断言捕获。Test Evidence 稳定聚合入口 51/51 通过；六次并发 public-boundary 文件运行共 78 个节点通过，作为有界压力观察保留。
- 测试账本按最终最小原生节点同步，项目检查覆盖 1,802 个真实实体，引用及覆盖通过。类型、lint 和格式检查通过。两类分发范围的实际组合 Gate 13 项全部通过，其文件／函数指标按明确的声明类别禁用，而不是把空指标结果改成 passed。
- 最终执行 `bun run check -- --scope full`：66 个 base Check 全部 passed、零 failed、零 unavailable，三个 release-only 项按模式禁用，退出 0，总墙钟约 96.44 秒；此前失败的 Test Evidence public-boundary 在本次完整调度中通过。运行目录为 `.log/vibe-check/invocations/20261031T081307371Z-3b331eb9-f005-43a1-98af-e0cf6694ee4e`，不复用项目 receipt。
- 当前取舍由[领域质量类别](../decisions/261031-declare-gate-domain-quality-kinds.md)和[受控文件排除](../decisions/261031-preserve-native-file-guards-with-build-source-exception.md)承接，先前统一范围模型继续有效。本轮只进行本地实现、测试及记录维护，没有 Git 暂存、提交、推送或实际发布。
- 三个确定范围问题及测试的组织／清理缺口已有对应修复和当次证据。首次 full 下使旧组合节点超过五秒的具体负载来源仍未单独归因；本次完整调度通过及有界压力观察不构成所有环境下无超时的证明。未执行远端 CI、Windows 验收或 release 打包。
