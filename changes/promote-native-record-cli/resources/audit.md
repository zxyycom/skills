# 切换方案审计依据

本文件记录 2026-11-08 在 revision `dc874213f494ba5411330afe135c0542df5184a8` 核对的源码事实、只读探针和方案使用复核。它支持 Readiness，不证明尚未实现的原生安装器、正式发布或平台验收。

B 阶段按现行承诺与实际节点对照，见 [B 阶段验收对照](b-acceptance.md)；尚缺项目以该对照和任务门禁为准。

## 范围与事实

| 已核对对象 | 事实及实施影响 |
| --- | --- |
| [根命令](../../../package.json)、两域 skill 与生成器 | 正式业务入口仍是 TS；DR 源版本 109、IR 98。准备期要保留可用入口，C 才同步启用新说明 |
| [DR Schema](../../../tools/decision-records/src/index/decision-index-json-schema.ts)、[IR Schema](../../../tools/investigation-report/src/index/investigation-index-json-schema.ts) | Schema 构造依赖旧领域定义；退出 SDK 前需移交数据源，不能先删旧工具 |
| [通用索引 Schema](../../../tools/index-runtime/src/schemas.ts)、[源码边界](../../../docs/tooling-distribution.md#源码与依赖边界) | Index Runtime 仍有其他消费者；新纯数据格式源需明确跨域 owner，并同步现有结构源规范 |
| [基础 manifest](../../../tools/skill-package/src/release-manifest.ts) | schemaVersion 1 的每个 skill 只投影 version，额外 native 字段被忽略；可在独立模块消费扩展，避免改变所有通用 updater 闭包 |
| [updater 编排](../../../tools/skill-updater/src/index.ts)、[下载](../../../tools/skill-updater/src/release.ts) | 先比版本，再加载固定资产名，下载/校验完成后才计划和安装；版本相等会直接成功，原生路径需独立 readiness 判断 |
| [安装实现](../../../tools/skill-updater/src/installation.ts) | 写文件不设置原生 executable bit；只覆盖、不退役旧文件。现有普通恢复能力不等于原生激活/清理协议 |
| [打包](../../../scripts/lib/skill-package/skill-package-release.ts) | 打包入口先递归清空传入输出目录；正式 caller 当前传根 dist。接入原生制品前必须隔离输出，保护已有证据/构建 |
| [发布编排](../../../scripts/lib/publishing/publish-skills.ts)、[资产收集](../../../scripts/lib/publishing/publish-skills-assets.ts) | 当前收集 dist 根 ZIP，rolling 先包后 manifest 再删旧资产；需要显式本轮资产清单和两个旧名 ZIP 的退出顺序 |
| [原生维护](../../../tools/record-cli/README.md)、[候选交付](../../../tools/record-cli/delivery/README.md)、[CI](../../../.github/workflows/record-cli-candidate.yml) | 目前仅候选，Linux 与 Windows 的既有验证范围不同，正式 skill/updater 未接线；B 阶段必须补真实两平台交付证据 |

这是接线和设计审计，不是完整消费者闭包或格式等价性审计。实际 import/导出、fixture、Gate、Case 和共享依赖清单由 1.1/1.7 完成，不能以本表直接批准删除；Schema 与 Rust 之间的全部语义差异也仍须按 1.1 核对。

## 只读探针

两项均在独立 Bun 进程直接调用当前源码，无网络请求、安装写入或永久测试文件。

### 基础解析器保留兼容

向 `validateSkillReleaseManifest` 传入：

```json
{
  "schemaVersion": 1,
  "skills": {
    "decision-records": { "version": 110, "native": { "role": "decision-records" } },
    "novel-cards": { "version": 1 }
  }
}
```

实际返回 `success: true`，output 的两项仅剩 version。结论：旧解析器接受扩展但丢弃它；原生消费者须从原始 JSON 独立验证，不能复用基础投影读取扩展。此探针没有验证新扩展 Schema。

### 缺旧名资产时早失败

对两个角色分别调用 `loadRemoteSkillFiles`，config 仍用各自 `<skill>.zip`，release 仅列 `record-native-installer.zip`；remotePackage 提供合法正整数版本。将 `globalThis.fetch` 替换为计数后抛错的 stub，捕获缺资产错误并核对计数。

两个角色均返回 `does not contain <skill>.zip`，`fetchCalls=0`。结合编排中 load 位于 plan/install 之前，可得现有代码在此路径不会进入安装。该结论限于当前实现与不同版本更新路径，不覆盖同版本短路、旧远端所有历史版本或新的引导实现；正式发布必须提升版本并撤掉两个旧名资产。

## 已收敛的方案选择

- 用户确认首批 Linux x64 + Windows x64，先准备再验收再切换，不保留旧领域 TS SDK。
- 采用纯数据 Schema owner、分离源码包/二进制、包内源码摘要、原生 manifest 扩展、资产改名和显式引导；取舍及停止条件以 [design](../design.md) 和[交付契约](delivery-contract.md)为准。
- 新方案实现、两平台实际安装和真实发布仍是未完成任务。发布/用户目录安装授权在对应执行阶段核对，不把计划提交当作该授权。

## 代表性使用复核

| 接手问题 | 从实际文档恢复的执行结果 |
| --- | --- |
| 现在从哪里做起？ | tasks 1.1，先交接 Schema 并核对格式/消费者；不直接切命令 |
| 二进制放哪里，如何影响 skill 版本？ | 独立 release ZIP；描述符进入 skill 包/hash，绑定原生源码，具体资产另由 manifest 绑定 |
| 旧 updater 会不会先覆盖新说明？ | 原生 release 撤掉旧名资产，旧 updater 在安装前失败；显式引导器验证后再激活新说明 |
| 已激活但旧 SDK 清理失败怎么办？ | 报告清理待完成并保留恢复位置；同版本 readiness 不误报成功，再执行验证并续清理 |
| 什么阻止正式切换？ | 1.5 要求 2.1–2.3 当前证据全部通过；C 改动后补受影响验收，远端发布另需授权 |
| 原生唯一后端是否排斥 Node？ | 只退出领域 SDK/TS 业务 CLI；Node 安装基础设施和无业务逻辑调度器保留 |

正文承接目标与关键取舍，交付细节和依据分开按需读取；任务 ID 持有进度，资源不复制 checkbox。审计门禁只声明已完成的范围，后续格式盘点、安装故障和正式验收均保持未勾选。

## 文档交付验证

- `bun run change-plan plan changes/promote-native-record-cli --json` 成功，stage 为 Plan，基线为上述审计 revision。
- `bun run check` 的 quick 六项公共基线通过：环境、secret、JSON、JSON Schema、Markdown 链接和 lint，性能预算通过。它不证明 Rust、安装器或完整发布门禁通过。
- proposal 成功标准 1–5 分别由 1.1–1.6 的阶段约束、2.2、2.3、1.7/2.4、1.2/2.4–2.5 承接。任务与资源的使用复核未发现阻止从 1.1 开始的设计缺口。

## 1.1 实施中格式差异

已将原随包 Schema 字节复制到 `tools/record-contracts/schemas/`，生成器和过渡期导出共用该源；两项生成漂移检查通过，不表示完整格式语义已验收。DR 的既有 Schema 在 relation 上允许可选 `name`，而[领域关系规则](../../../skills/decision-records/references/decision-record-rules.md#演进关系)只定义 `type`、`target` 与可选 `summary`，旧 TS 严格 state parser 与 Rust Relation 均拒绝额外 `name`。这是 Schema 既有宽松性，不据此扩大业务格式或在本次迁移中收窄分发 Schema；跨语言固定有效/无效样例和其余格式差异仍须继续核对，1.1 尚未完成。

已从 `dc874213f494ba5411330afe135c0542df5184a8` Git tree 记录两域包内各文件的长度、SHA-256 与 Git 可执行位；仅是源码包基线，并未证明远端历史 release 相同。候选引导器已接入该固定清单；仍须完成全平台与发布验收。

对照 `zxyycom/skills` release ID `346715779` 的 `skills-latest`：固定资产 ID `712372943`（DR ZIP，SHA-256 `3d6bc338496d309419690e0687e25c00727b56078077b049c3a020fb65613958`）和 `712372970`（IR ZIP，SHA-256 `6870930cb866325f6f3278aa96700986d52eec87fd02e9f0bbb6abb4de3b5207`）经下载并验证资产 hash；逐成员与上述 Git 清单比较，DR 274、IR 280 均无缺失、多余或长度/SHA-256 差异。ZIP 文件并未安装；Git 可执行位来自源码而非 ZIP 权限证明。rolling tag 可变，后续不以 tag 名冒充此固定资产身份。

孤立 UTF-16 代理项是另一个尚未裁决的真实差异：旧 TS 索引 state parser 接受 `title` 为 `\ud800abc`，且旧 Markdown parser 对 UTF-8 源中 YAML 转义 `title: "\uD800abc"` 返回非空结果、无诊断；原生候选明确拒绝该类输入。用户已确认以合法 Unicode 文本为支持边界，异常旧数据明确报错，不静默替换或丢字；不保留旧解析器接受孤立代理项的宽松行为。该取舍本身不证明其他格式差异已完成核对或 1.1、2.1 已通过。

## A 阶段局部基础设施

现已从单次 Git pending 捕获 skill、Rust 与候选生成闭包，并写入 `dist/skill-release/` 独占目录；私有 fixture 验证快照固定、源码摘要及 dist sentinel。原生 manifest、归属预检、激活与恢复、候选 updater 和私有源码包已有局部实现，但生成/发布完整链路和目标平台验收仍未闭合，1.2–1.4 继续未完成。

私有本机构建 `dist/skill-release/candidate-bEwnSX` 从同次 pending 源码捕获生成 `0.1.0` 两角色 Linux ZIP，源码 SHA-256 为 `112f7072446ad34f5418e21a353e371daf0cf28794c4dd9a231dcd2fed16de38`；Cargo 1.98.1 locked/offline 构建并实际核验两程序 `--version`。执行宿主是 WSL2、glibc 2.43，而非所需 Ubuntu 22.04 / glibc 2.35；二进制仍是私有候选，不证明 Linux 基线、Windows、安装或发布。首次尝试发现原候选 digest 的深度优先目录遍历与规范完整路径排序不同，导致 frozen manifest 拒绝构建；已修正排序并用 `foo.rs` 与 `foo/bar` 的独立固定摘要测试覆盖，复用原 staging 源码成功完成构建。

将上述两个已核验 ZIP 安全解包到本轮创建的临时隔离目录后调用旧包预检：DR 274、IR 280 文件均无冲突；分别修改各自 `SKILL.md` 后均只报告该路径，两个无关 sentinel 字节保持。临时目录已清理；这是旧文件归属预检的本机证据，不是原生安装、激活、回退或 Windows 证据。

复用该次冻结构建的两个原生 ZIP，在本轮私有临时目录分别回算长度与 SHA-256、确认 ZIP 中恰有对应角色程序、设置执行位并运行 `--version` 与 `--help`；两者通过，sentinel 保持，临时目录已清理。这仍不是新 skill 安装或 Ubuntu 22.04 / Windows 验收。

`RECORD_CLI_BIN_DIR` 指向上述冻结构建后运行 `bun run smoke:record-rust` 通过：私有 Git fixture 覆盖两 CLI help/version、决策候选创建/查询与缺失 JSON、调查资源归属重命名、决策 stage 保留未选 pending。fixture 由入口清理；该 smoke 不覆盖 2.1 全部业务、不证明其他平台或安装。

对两个真实旧 ZIP 的隔离副本，以仅含 `SKILL.md`、`native-runtime.json` 与角色二进制路径的**假设**新受管集合运行只读交接计划：DR 报新增 2、替换 1、退役 273；IR 报新增 2、替换 1、退役 279。该探针只验证清单和分类，假设集合不是最终候选包，也没有执行覆盖、删除或声明支持更新完成。

独立构造的 DR v4/definition 11 索引样例在私有目录分别经 AJV、旧 TS state parser、冻结 Rust 二进制 `list --json` 验证：正常样例三者接受；仅给关系加入额外 `name` 后，既有 Schema 仍接受、两种运行时均拒绝（Rust 退出 1，`invalid-index`）。这支持上述 Schema 宽松差异的裁决，不扩展为所有字段的等价证明。

新增的私有原生归档和 bundle 验证原语在解压前核对 ZIP 目录/本地头、文件类型、路径及大小上限，并在返回文件集合前核对 release 资产摘要、角色、版本和 descriptor；synthetic 样本覆盖拒绝路径。当前 fflate 生成的两份真实旧包（274/280 成员）和两份私有原生 ZIP（各一成员）均可读取。ZIP 子集有意拒绝 ZIP64、注释和 data descriptor；该原语探针本身不证明后续候选包与安装链，不能把原语通过当成 1.3 完成。

复用两个实际构建 ZIP 与对应纯数据 Schema，内存构造仅用于测试的 skill identity/descriptor/占位 updater，分别通过 `prepareNativeBundle` 绑定 manifest 长度、摘要、role、target 和源码，得到各 5 个预备文件。该组合的说明和 updater 均为合成样例，绝非可安装候选包，也没有执行安装。

在原生 bundle 改为同时验证两个角色共用源码、运行时版本与 bootstrap 身份后，已用同一组合重新运行该内存探针，两角色均通过；未生成或安装正式包。

原生 updater 新增的 6 个局部最小测试节点也以 Node 原生 `--test` 运行，6 通过；该运行使用仓库依赖，不证明独立引导包的 frozen 安装或完整更新生命周期。

旧版事务原语进一步以两份真实旧包的隔离副本运行：新文件集合仅为合成 `SKILL.md`、占位 descriptor/updater、Schema、旧依赖清单及对应实际 0.1.0 二进制；明确确认后完成激活、经清单退役并再次核对完成状态，两个 sentinel 保留。回调运行真实二进制的 version/help，合成 updater 以本次 Bun 进程可执行文件运行，不证明 Node 独立 updater、最终候选包、Windows 或完整 2.2。隔离目录本轮已清理。

仓库候选运行时现已提供 `prepare:record-native`、其 `--check` 与显式角色调度器；本机重新 prepare 后检查和两个 `--version` 通过。只读检查会识别源码或程序漂移，入口不会自动构建；两项真实平台能力仍以当前宿主为限。`record-rust` Gate 接入其独立 Node 测试；Windows 2022 候选 workflow 已配置锁定依赖预取、私有准备、角色调度、隔离 fixture 测试及仅列明文件的 artifact，但尚未执行本次 revision 的远端 CI，不把配置当通过证据。正式生产 CLI 和现有发布映射保持原状。

同法对独立 IR v4/definition 11 样例比较 AJV、旧 TS state parser 与冻结 Rust `list --json`：正常样例三者接受；重复 tag 三者拒绝；资源 ID `report/../secret` 由 Schema 的词法模式接受，但两种运行时拒绝，符合 Schema 对路径段附加校验交由 CLI 的注释。Rust 失败退出 1 并给出 `invalid-index`。这些均为局部样例，不能冒充两域完整格式或业务验收。


## 当前私有生成与本机安装证据

从当前暂存的同次 pending 捕获生成了 `dist/skill-release/candidate-afjyCj/` 私有源码包和独立 bootstrap；冻结 Rust 摘要 `b67627ecc8d55b41a4eed26baa511b8da37c9d1a07a8b22917e8a169b59073bc` 与 f93c439f 的 Ubuntu 22.04 私有 A 资产一致，故复用两角色 0.1.0 Linux ZIP，未重新编译。初次缺少生成器静态输入时失败的 `candidate-U8HcoW` 保留，补齐 pending 闭包后独占新目录重试；未将失败目录作为结果。

已在上述 stage 的隔离目标，以固定资产下载并核验的 DR 109、IR 98 ZIP 实际测试旧版交接和同版本重执行；真实程序 `--version`/help、最终目标 updater help、两域各 42 个受管成员及自有 sentinel 均通过，未修改真实用户目录。复用安装后程序通过私有 Git 业务 smoke，覆盖代表性记录创建、查询、资源和暂存。额外运行两份真实生成 bootstrap：模拟 release 请求时，新目标 `--check` 不写入、显式 `--yes` 新装、同版本检查与重执行及 sentinel 均通过；可复验脚本和输出保留在该 stage 的 `real-linux-private-smoke/`。

这些结果仅限本机 WSL/glibc 2.43 使用前述 Ubuntu 22.04 制品；Node 依赖沿仓库已准备的 `node_modules` 解析，release 响应为内存替身，Windows manifest 项为合成占位，因此不证明干净依赖安装、真实远端 release 或 Windows 安装。f6ad4284 的 Windows 2022 CI 已通过 runtime/隔离测试、真实 prepare、两个程序版本与私有 Git smoke，但旧候选 verify-real 因跨盘路径误判失败；修复后仍须以新 revision 重跑完整 Windows 及平台一致性检查。正式入口和发布映射未切换，A/B 任务不因此勾选。

在不重编译的另一私有探针中，对 A 冻结 Rust 的 Cargo 版本作与 f93 CI 一致的 0.1.1 successor 转换，得到摘要 `000341830f70e26171f94adffceea2d8d708c954bf429f0ba8f3e6cd07733605`，与已核验的 Ubuntu 22.04 B 资产相同；两域旧 skill 版本也仅在测试输入中加一，以产生 B 候选包 `candidate-WnjTO3`。从已安装 A 的两域真实包内 updater 在模拟 release 下执行 A→B，更新前检查、显式升级、更新后检查、0.1.1 版本、sentinel 及无遗留旧恢复目录均通过。此转换不是正式 pending skill 包，Windows 资产仍为占位，也不证明真实 release 或其他平台；脚本与日志保留于 `candidate-afjyCj/real-linux-private-smoke/`。

将仓库现有 `docs/decisions` 与 `docs/investigations` 复制到同一 stage 的隔离 fixture 后，以真实 A 二进制 JSON list 与旧 TS CLI 列表逐项比较完整身份和顺序：DR 均 156 条、IR 均 101 条，顺序完全一致，Rust 两域均退出 0 且无 warning。最初仅匹配带日期前缀的身份造成的探针假差异，改用全部列表首字段后消失；此结果不扩展为其他字段、写入或完整格式等价。

`879689ab` 的候选 CI 已在 Ubuntu 22.04 和 Windows 2022 完成 A/B 私有构建与跨平台来源比较；两平台 ZIP 已逐个按 CI 记录的长度和摘要核对。这是该 revision 的私有构建与 smoke，不自动证明之后变更的 Node 交付或正式安装。复用时另核对当前 Rust 冻结清单和编译 recipe 字节，Node delivery 单独记录。

从之后的同次 pending 生成私有候选 `candidate-xI85lo`，裁剪 lock 至四个直接依赖及一个可达传递依赖。在仓库外独占目录正常联网执行 pnpm 11.7 frozen install，默认供应链策略通过，隔离 store 内容均复用；没有禁用策略，也不宣称离线安装。两角色 bootstrap 在模拟 release 下使用上述 CI 的真实 Linux A 资产分别安装到没有依赖的干净目标，目标原生程序立即运行 version/help；之后在各目标显式安装冻结依赖，不使用验证 hook 的独立 updater help 与 check 均通过。依赖链接只指向独占验收目录。该 Linux 私有测试的 Windows 资产仍是占位、release 是替身；不证明真实 release、Windows 安装或 B 阶段整体通过。

相同候选还对已核验的真实 DR109、IR98 ZIP 作仓库外隔离首升：bootstrap 检查及显式激活、原生 version/help、目标显式依赖安装和无 hook updater help/check 均通过；两份自有 sentinel 保持，旧 SDK 文件退役。DR 旧 SDK 的空目录层级仍存在，不将文件退役等同目录清除。此项仍使用模拟 release 和 Windows 占位资产。

仅调整捕获和 updater 的相邻函数职责后，重新捕获 pending 生成 `candidate-O64E7U` 并复用隔离依赖缓存；干净新装和真实旧 ZIP 隔离首升的上述两角色检查均再次通过。记录脚本和日志保存在该 stage 的 `real-clean-install-evidence/`；这不改变前述平台和 release 边界。

补齐组合器 pending 输入后，`candidate-MyCDkj` 由冻结 delivery 组合 `879689ab` 双平台 A 实际资产，生成 28 项私有发布资产和来源记录。Rust 源码摘要、两平台清单与报告一致，六个编译 recipe 文件与构建 revision 的原始字节匹配；历史 build delivery 与当前 Node delivery 分别记录。该 stage 的 pending 尚未等于 commit、运行时为私有 0.1.0，不能发布或作为正式验收。隔离依赖验证根及其 store 副本已清理；相关脚本与日志保留在对应候选 stage。
