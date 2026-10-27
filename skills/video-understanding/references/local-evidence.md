# 证据读取与管理

按当前任务进入对应操作：

- 继续理解或交接材料：从[继续已有证据](#继续已有证据)核对定位，再按窗口读取。
- 保存可复用解释：进入[保存采用与校正](#保存采用与校正)，保留原始材料与核实范围。
- 排查失败或不可用结果：先查[运行日志](#运行日志与诊断)，再按[恢复规则](#复用状态与失败恢复)判断影响范围。

新材料按[字幕](subtitle-tools.md)或[画面](frame-text.md)操作取得；启动与位置见[本地工具入口](local-tools.md)。

## 证据模型与证明范围

一个 `scopeId` 对应一代证据；其中原始材料 M 包含字幕、ASR 或 OCR 等来源，条目 T、帧 F 和帧 OCR O 提供可定位的观察。请求覆盖与实际处理覆盖不同，帧的请求时点与实际 PTS 也不同；读取某个窗口或离散帧不证明其间连续过程。新 scope 不继承旧 ID。

采用 S 表示任务选择的来源或基于原始证据撰写的文本，C 是对同一来源字幕的忠实修正，D 是人工核实的单帧描述；它们引用原始对象，不取代原始记录。authored 文本的覆盖由引用支持，不能当作连续字幕；机器 ASR/OCR、采用和校正均不自动证明真实性。结论应标明来源、实际核实范围、时点及未覆盖部分；状态、hash 和成功读取只支持各自的可用性或完整性判断。

## 继续已有证据

1. 首次调用先完成[共同准备](local-tools.md#调用前准备)。从保存或交接的实际响应复制完整绝对 `output` 赋给 `$evidence`，并保留预期 `scopeId` 与材料 ID。同一 shell 内可复用已赋值变量；每次新的 shell 工具调用重新提供所需赋值或使用已填入实际值的完整命令。路径和 ID 沿用已知原值，不由目录片段、截短哈希或当前工作目录重建。

   ```powershell
   node "$cli" read --output "$evidence" --view materials --limit 20
   ```

2. 首次复用先核对返回的 `scopeId`，按需[分页](#窗口与分页)定位所需材料 ID，再盘点来源、状态、覆盖与当前性。身份不符或找不到所需 ID 时，停止使用该定位并向交接方核对。materials 列出 M；纯画面目录用下方 raw 查询定位 F。
3. 恢复已有采用用 effective，并检查 adoption 与可用性；比较原始材料用各 M 的 raw，按本批问题设置窗口。普通回答可直接使用原始内容，selection-required 仅表示尚无持久采用。

   ```powershell
   node "$cli" read --output "$evidence" --view effective --start 10 --end 30 --limit 40
   node "$cli" read --output "$evidence" --view raw --material "$material" --start 10 --end 30 --limit 40
   node "$cli" read --output "$evidence" --view raw --start 10 --end 30 --limit 40
   ```

   选择所需查询即可。第三行返回窗口内 T/F/O，找到 F 后按[画面操作](frame-text.md#2-实际打开图片并记录观察)打开 PNG。

4. 不可用项按[当前性与完整性](#当前性与完整性)判断影响范围；缺素材时仍可用已知 output 查日志。保留有效材料，回到主流程完成任务或补齐缺口。需要复用解释时再保存校正。

### 材料交接

主代理从本次工具实际响应取得定位，向接收者交付：

1. **任务与范围**：本批问题、负责的时间窗、输入／输出预算，要求返回结论、同 scope 的证据引用、实际读取覆盖及未解决缺口。
2. **就绪状态**：材料的当前状态与可读范围。尚未就绪时说明最后确认状态，以及后续由谁通过何种方式提供就绪材料；接收者只处理已可读部分，不推测未来路径或把等待当作完成。
3. **就绪材料的精确定位与读取**：原样提供完整绝对 `output`、`scopeId`、所需材料 ID，以及已填入实际入口、路径、材料和时间窗的可直接执行命令；命令使用变量时附齐所需赋值。接收者按[继续已有证据](#继续已有证据)先盘点核对再读取；定位不可确认时返回缺口，由主代理补充。

## 证据作用域与 ID 引用

当前协议为 v5。`evidence.json` 保存素材、scope、时长、材料、帧与校正指针；`artifacts/<opId>/` 保存不可变的字幕副本、解析文本、ASR、OCR、媒体元数据、PNG 及校正。原素材保持不变，无自动 sidecar 写入；独占写入与原子发布保护快照。

scopeId 唯一标识一代证据。ID 在 scope 内按前缀追加且不复用：M 材料、T 字幕条目、F 帧、O 帧 OCR；S/C/D 为校正。排序不改变 ID，同址重建使用新 scope，旧 ID/revision 仅属于原 scope。

### 原始材料与状态

每个 M 记录 kind、requestKey、来源／参数、工具版本和模型 hash、请求／实际覆盖、状态、产物路径及 hash。未知语言与精度用 unknown，失败尝试不计成功覆盖。当前 ASR 的语言请求、结果与 `languageMode` 见[音轨与语言](subtitle-tools.md#音轨与语言)。

| 原始对象 | 语义与定位 |
| --- | --- |
| subtitle M / T | `origin` 为 external/embedded/asr/hard-ocr；T 保存原文与解析区间。ASR [末端归一](subtitle-tools.md#asr-末端时间归一)由 `warnings` 标明，原始输出保留在同 M 的 `files` 中 |
| F | requested 与 actual PTS、整数 pts/timeBase、streamIndex、尺寸与 PNG |
| frame-ocr M / O | 每个输入 F 对应 O，保存机器文字／空观察、输入图 hash、区域与变换；框与分数仅来自真实 API |

每次新尝试使用独立 M；complete/empty 分别为成功有内容／有效输出为空，failed/interrupted 为失败／中断。按 requestKey 复用最新有效成功材料，失败保留旧成功。自动发现重查候选，已有 M 只依赖当时来源；新增无关字幕或工具升级不自动使它过期，版本另记 provenance，重算用 fresh。prepare/ocr 返回 M 和 cueCount/observationCount，条目由 raw 分页读。

### ASR 历史材料

缺模型依据（`provenance.models=[]`）的旧 ASR `empty` 保持可读，但不自动复用，查询的 `languageMode` 为 `unknown`。其原始 `language` 可能只是当时的请求值，不能作为识别结果；原记录和产物保持不变。

历史 `language=unknown` 仍表示未知。确需新结果时按授权追加处理，保留旧材料，不改写原记录或产物。

## 查询参数与结果

### 材料与原始读取

`--view materials` 按 M ID 分页，返回身份、来源、状态、覆盖、当前性和条数；无对应 M 表示未运行。`--view raw --material M0001` 读取指定字幕或 frame-ocr；省略 material 时读全部来源的 T/F/O。material 仅用于 raw，不可用项返回定位与原因。

### 有效读取与采用状态

缺省 `--view effective`：source S 返回所选 M 的原文叠加有效 C；authored S 返回原始锚定的采用文本，不叠加 C。无 active S 且只有一份可用字幕时返回“未采用原文”；多份候选返回有界清单并提示选择。effective 同时保留 F/D，机器 O 仅在 raw 返回；S 失效为 unavailable，不自动改选。

adoption 区分 selected-source、authored、unavailable、unadopted-single-source、selection-required、no-subtitle；它表达采用状态，而非正确性评级。

### 窗口与分页

raw/effective 的 start/end 选择 `[start,end)` 重叠项，默认零到末尾；读到末尾时可省略 `--end`，不必抄写精确时长。时间值须为有限非负秒数，实际窗口满足 `0 ≤ start < end ≤ duration`。

显式 `--end` 的末端舍入按以下边界处理：

1. **接纳与返回**：仅 `read` 的显式 end 正超出时长不超过 0.005 秒时，收紧到精确 duration；该容差依据小数点后两位四舍五入的最大误差确定。返回 `window` 为实际窗口，text/JSON 的 `warnings` 均标明请求值、实际值及容差。
2. **拒绝与修正**：start 不归一，归一后仍须 end 大于 start。更大越界和空／反向窗口继续失败，诊断给出 start/end/duration 与修正方法。
3. **影响范围**：只调整本次查询，不改证据、材料覆盖、帧时间或校正；与 [ASR 末端登记归一](subtitle-tools.md#asr-末端时间归一)是独立边界。

同起点按 ID 稳定排序，offset/limit 在选窗后分页。limit 默认 80、范围 1–500。有 remaining 时，保持同一 output、view、material（含省略状态）、时间窗与 limit，只将 offset 改为 nextOffset 续页；跨 shell 调用按[继续已有证据](#继续已有证据)重新提供变量赋值。

C 按替换区间命中，任一分段命中即整组返回；抑制项按原 targets 区间定位。limit 计条目，完整组超出阅读预算时交接未读范围，保持组完整；区间外沿不证明空隙已覆盖。

### 精确对象与维护查询

`--id <M/T/F/O/S/C/D>` 返回自身内容，关联证据只给定位摘要，最多 80 项，relatedRemaining 表达未返回数量；正文另按 ID 取。M 自身不展开全部 T/O。id 与显式 view/start/end/offset/limit/material 互斥。S/C/D 可加 `--revision <正整数>` 读历史，省略则读最新；读取不改变生效状态。

materials 和 calibrations 按 ID 分页、无时间窗。calibrations 包含未选材料的 C、撤销和 unavailable 项，用于发现 ID/revision 及原因。

### 输出格式与状态

1. 日常阅读用 `--format text`：raw/effective 中可用的普通 T 按 `ID [start,end] "正文"` 紧凑显示，连续同来源条目共享材料、来源、时间含义、可用性及原因。正文采用 JSON 字符串转义，换行和控制字符保持在正文内。批次保留 scope、output、窗口、分页和警告；校正组、其他对象及不可用项显示完整详情。
2. 机器消费用 `--format json`，精读单项用 `--id`，均保留完整内容。两种格式使用同一查询结果，选择、分页和采用状态一致；定位先用上述有界查询，再取需要的详情。

availability 区分 raw、unadopted、effective、revoked、unavailable、missing。材料 detail 含 origin/status、requestedCoverage/processedCoverage、cueCount/observationCount、current，失败 processedCoverage 为空；校正 detail 保留 reason/verified，C 另给 segments 和 originalRanges。

read 只读取记录；真实性由材料和实际核实支持，查询状态与保存成功不是正确性证明。

## 保存采用与校正

解释需要复用或用户要求保存时，从本目录响应复制 scopeId 和原始 IDs，按下表选择用途。selection 表达任务采用，verified 记录实际核实范围。

### 两层校准与生效范围

校正只引用同 scope 的原始 M/T/F/O，不引用 S/C/D，保持原始与采用／校正两层。

| kind / ID | 内容与边界 |
| --- | --- |
| selection / S，source | 选一份 complete/empty 字幕 M，用途 transcript/subtitle/translation，保存理由与实际核实范围 |
| selection / S，authored | 非空采用文本以原始 T/F/O refs 锚定，用途 translation/narrative；覆盖来自所引证据，不当作连续语音／字幕时间 |
| correction / C | targets 为同一 M 内有序连续 T，support 可跨 M 引用原始 T/F/O；replacement.segments 支持 N→M 重分句、移时与空数组抑制 |
| description / D | 单个 F 的非空核实描述，support 可用原始 T/O；机器 O 不自动成为 D |

每个 scope 最多一个 active S，表示当前任务采用；切换用途、mode 或来源用同 S 的新 revision。撤销 S 保留 M/C/D，恢复无选择规则。C 忠实修正所属 M，不承担翻译；另写译文用 authored，已有译文字幕可直接 source selection。authored 不叠加 C，引用原始依据。

同 T 最多一个 active C，同 F 最多一个 active D。替换 segments 文字非空、位于素材时长内、start ≤ end 且按时间排序，允许真实交叠；空数组表示有意抑制，撤销恢复原文。操作者负责真实性、选择理由与覆盖，CLI 校验确定性约束。

### refine 输入、更新与撤销

`refine --file` 读取操作者提供的 JSON；scopeId、IDs 与 expectedRevision 从本目录实际响应复制。create/update 除变体字段外共同要求非空 `reason` 与 `verified: {refs: [...], note: "..."}`；verified.refs 是实际核实过的原始 T/F/O，可为空，但 note 仍如实说明未核实部分。可选 support 是辅助原始 T/F/O，省略归一为 []。这三个字段不构成自动真实性证明。

1. create 带 action、scopeId 和完整 kind 内容，分配稳定 S/C/D 与 revision。
2. update 带 action、scopeId、id、expectedRevision 与完整同 kind 内容，全量替换而非合并；revision 加一，可恢复已撤销 ID。省略允许的 support 即清除旧辅助引用。
3. revoke 只带 action、scopeId、id、expectedRevision；revision 加一，保留正文但退出生效。旧 expectedRevision、跨 scope、无效或冲突目标拒绝，失败不改变已发布 revision。
4. 引用不存在、重复、类型不符、不连续、不可用或已冲突的原始目标／佐证拒绝；目标与 support 必须本次当前有效。payload 损坏先以完整 update 修复，不能盲目覆盖或撤销。

### JSON 示例与调用

按实际 scope、ID、时点与核实内容准备获授权的绝对本地 JSON 路径 `$refinement`，执行 `node "$cli" refine --output "$evidence" --file "$refinement"`。source、correction、authored、单帧 description 和撤销的完整输入例子见[校正 JSON 示例](refine-examples.md)；字段和生效规则以上文为准。

#### 选用一份字幕

source selection 选用一份成功字幕；见[输入示例](refine-examples.md#选用一份字幕)。

#### 同材料局部忠实修正／重分句

correction 保留原始条目并表达修正；见[输入示例](refine-examples.md#同材料局部忠实修正重分句)。

#### 另写译文／综合文案

authored selection 以原始证据锚定另写文本；见[输入示例](refine-examples.md#另写译文综合文案)。

#### 实际看过的单帧描述

description 保存核实过的单帧观察；见[输入示例](refine-examples.md#实际看过的单帧描述)。

#### 更新与撤销

以实际 revision 更新或撤销校正；见[输入示例](refine-examples.md#更新与撤销)。

### 保存后回读

按 ID 回读正文与 revision，再核对所需 effective 窗口；需要历史时显式指定 revision：

```powershell
node "$cli" read --output "$evidence" --id S0001 --format json
node "$cli" read --output "$evidence" --id S0001 --revision 1 --format json
node "$cli" read --output "$evidence" --view effective --start 10 --end 14 --limit 20
```

## 运行日志与诊断

1. `node "$cli" logs --output "$evidence" --offset 0 --limit 10 --format json` 从最近已保存记录开始，按文件名中的 UTC 开始时间倒序，同时间按完整文件名降序。limit 默认 80、范围 1–500；nextOffset 非空时续页。offset 不是跨快照稳定 cursor，分页期间新增记录会改变位置。
2. `node "$cli" logs --output "$evidence" --id <运行ID> --format json` 读取该次阶段、结果与 diagnostic 路径，按需再读取筛选后的 diagnostic 正文。成功动作返回的 runId 可直接查询；id 与显式 offset/limit 互斥。

prepare/frames/ocr/refine 在 `runs/<UTC开始时间>-<运行ID>.json` 保存开始/结束时间、命令与安全参数、complete/reused/failed/interrupted 等结果、失败阶段及产物定位，`diagnostic-*.log` 承接筛选后的子进程诊断。运行记录不含素材正文、校正 text、模型 prompt 或敏感环境，也不参加原始产物完整性。logs 只核对可识别的 v5 根协议，不要求素材仍当前或原始产物摘要通过；manifest 无法识别仍可能阻断。纯 read/logs 无写副作用。

日志为 best-effort，主动作结果独立结算；前置、协议、锁或日志写失败可能只有 stderr。排查同时看本次退出／stderr、已发布状态和已保存运行，保存时间与 running 字样均不证明当前进程状态。恢复与清理另按下节处理。

## 复用、状态与失败恢复

新目录经独占锁复核后初始化；已有证据须通过协议与当前性核对。不可用或失败时保留原素材及证据，按[证据恢复](evidence-recovery.md)判断局部影响、根级阻断和授权后的恢复路径。

### 当前性与完整性

视频或根协议异常可能阻断正常读写；材料、帧或校正损坏可能局部影响。具体核对、可用性与恢复见[当前性与完整性](evidence-recovery.md#当前性与完整性)。

### 局部操作与恢复单位

成功、未运行、失败与中断分别处理；锁、并发和超时边界见[局部操作与恢复单位](evidence-recovery.md#局部操作与恢复单位)。

## 时间解释与素材提交

字幕与 ASR/OCR 时间见[字幕操作](subtitle-tools.md#3-检查材料并分批读取)，帧的编码像素及实际 PTS 见[画面操作](frame-text.md#2-实际打开图片并记录观察)。C 保留原 targets 和 replacement 区间，authored 覆盖来自原始 refs，均须按实际观察解释连续性。

素材与输出的数据流、进程及网络边界见[运行时说明](runtime.md#媒体数据流与隔离)。
