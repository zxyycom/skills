# 证据读取与管理

按当前任务进入对应操作：

- 继续理解或交接材料：从[继续已有证据](#继续已有证据)核对定位，再按窗口读取。
- 保存可复用解释：进入[保存采用与校正](#保存采用与校正)，保留原始材料与核实范围。
- 排查失败或不可用结果：先查[运行日志](#运行日志与诊断)，再按[恢复规则](#复用状态与失败恢复)判断影响范围。

新材料按[字幕](subtitle-tools.md)或[画面](frame-text.md)操作取得；启动与位置见[本地工具入口](local-tools.md)。

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

下列示例中的 scope、ID、文字与时点须替换为本目录实际值和本次核实内容，保存为获授权的绝对本地 JSON 路径 `$refinement` 再执行 `node "$cli" refine --output "$evidence" --file "$refinement"`。

#### 选用一份字幕

source 的 material 是成功字幕 M，使用 material 而非 refs/text。

```json
{
  "scopeId": "<本目录 scopeId>",
  "action": "create",
  "kind": "selection",
  "mode": "source",
  "material": "M0002",
  "purpose": "transcript",
  "reason": "需要原音听写，字幕材料另保留供比较",
  "verified": {"refs": ["T0003"], "note": "只回听核对了此条，其余仍是机器转录"}
}
```

#### 同材料局部忠实修正／重分句

```json
{
  "scopeId": "<本目录 scopeId>",
  "action": "create",
  "kind": "correction",
  "targets": ["T0003", "T0004"],
  "support": ["F0001"],
  "replacement": {"segments": [
    {"start": 10, "end": 11.2, "text": "第一段已核实原话"},
    {"start": 11.2, "end": 12, "text": "第二段已核实原话"},
    {"start": 12, "end": 13.5, "text": "第三段已核实原话"}
  ]},
  "reason": "回听后修正分句与时间，保留原始两条",
  "verified": {"refs": ["T0003", "T0004", "F0001"], "note": "只核实本组原话和该离散画面"}
}
```

#### 另写译文／综合文案

```json
{
  "scopeId": "<本目录 scopeId>",
  "action": "create",
  "kind": "selection",
  "mode": "authored",
  "refs": ["T0003", "F0001", "O0001"],
  "purpose": "narrative",
  "text": "依据已核实片段与画面形成的采用文案",
  "reason": "该任务需要综合文案而非原音字幕",
  "verified": {"refs": ["F0001", "O0001"], "note": "实际核对该帧文字；原音未回听"}
}
```

#### 实际看过的单帧描述

support 仅可为 T/O，无字幕也可保存。

```json
{
  "scopeId": "<本目录 scopeId>",
  "action": "create",
  "kind": "description",
  "refs": ["F0001"],
  "support": ["O0001"],
  "text": "该帧招牌显示已看清的文字",
  "reason": "保存此离散画面的核实描述",
  "verified": {"refs": ["F0001", "O0001"], "note": "实际打开该 PNG 核对文字；帧间状态未知"}
}
```

#### 更新与撤销

已有 active S 时完整 update 同一 S：使用实际 id/expectedRevision，将 source 的 material 换为 authored 的 refs/text，kind 保持 selection。撤销仅提交以下字段；更新／撤销均使用本次读取的最新 revision：

```json
{
  "scopeId": "<本目录 scopeId>",
  "action": "revoke",
  "id": "S0001",
  "expectedRevision": 1
}
```

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

新目录或空叶目录经独占锁复核后初始化；已有证据通过 v5 协议与当前性核对后继续。不支持版本、未知非空目录或坏 manifest 明确报错并阻断自动读写，保持已有文件和目录内容不变。

恢复时保留原素材及有价值证据，由操作者按以下顺序选择：

1. 按[当前性与完整性](#当前性与完整性)区分局部影响与根级阻断，局部问题按下表处理。
2. 根级阻断后需要新证据时，显式指定新 output，保留原目录。
3. 确需同址重建时，另行授权备份并清空精确叶目录，再初始化新 scope；新 scope 不继承原 ID 或校正。CLI 不自动迁移、转换或清理。

### 当前性与完整性

根级核对视频规范路径、大小、mtime、manifest 结构、唯一 ID、引用与 scope；源视频变化、重复 ID、悬空引用或 scope 不一致阻断正常读写，logs 仍提供诊断。prepare 另核对本次请求。

被选外部字幕变化／消失、某 M 产物 hash 或 payload 与索引不符只使该 M 不可用；单帧损坏只影响该 F 及依赖它的 O／校正，其他材料仍可读和获取。自动发现重查候选，已有 M 只依赖实际所选来源，新增无关 sidecar 不使已有 M 失效。

C/D payload 或佐证失效局部回退仍有效原文／原帧并标 unavailable；目标不可用则只返回定位、原因与 null 正文。S 无效使采用 unavailable，raw 仍可读，不自动替换来源；撤销 S 后才恢复无选择规则。raw 是历史材料，不绕过本次当前性检查。

视频 stat 不防御刻意同大小、同 mtime 的内容替换；素材替换或元数据不可信时停止复用，按上述人工评估恢复。输出摘要证明完整性，不是真实性签名。

### 局部操作与恢复单位

| 状态或检查结果 | 含义与下一步 |
| --- | --- |
| M complete / empty | 成功有内容 / 成功但有效输出为空；核对后同请求复用。empty 不证明静音或无视觉信息 |
| 无对应 M | 该路线未运行；帧-only 是正常 scope，可按需补文字 |
| 局部 failed / interrupted | 操作失败或中断；合法、当前的 v5 根可显式新尝试，保留旧成功材料 |
| 根陈旧、损坏、未知或不支持 | 阻断自动读写并保留原目录，按上述恢复顺序处理 |

失败非零退出；失败状态发布成功时，文字或帧操作保存 failure 的 kind/stage/target/reason/action。后续发布或清理再失败仍保留主错误，并补充安全诊断；已发布状态可能未更新，须结合本次退出和诊断判断。新操作不覆写或复用失败 raw，也不清除旧成功文字/帧；局部失败不使整个作用域成为半成品。

写入取得独占锁，并发或遗留锁明确拒绝；正常结束只回收自身锁。遗留锁需先确认操作者/进程状态，再按精确目标恢复，不能自动抢占。索引原子发布，不发布 running 半索引：操作期间 read 读取旧已发布快照，首次尚无已知时长则 read 不可用。孤儿 artifacts 和失败诊断保留，不自动删除。

目录可能含私人信息，manifest 与原始结果共同保留；经筛选诊断、失败中间物和 `.process/` 是可再生成工作物，清理须确认授权精确目标。提取的临时 WAV 成功解析后删除。

`--timeout 0` 默认无固定死限，正秒数限制每个子进程；OCR 超时／取消必须回收工具进程树，是否已通过真实回收验收按运行时资格核对。失败批次不参与复用。

媒体子进程结构化响应有大小上限，超限按 protocol 失败停止；stderr 筛选后限量保存，超限只留说明。Whisper 原始结果直接保存为文件，不重复收集完整 stdout；此上限不是 ASR 文件或 read 文本的字数预算。

## 时间解释与素材提交

字幕与 ASR/OCR 时间见[字幕操作](subtitle-tools.md#3-检查材料并分批读取)，帧的编码像素及实际 PTS 见[画面操作](frame-text.md#2-实际打开图片并记录观察)。C 保留原 targets 和 replacement 区间，authored 覆盖来自原始 refs，均须按实际观察解释连续性。

素材与输出的数据流、进程及网络边界见[运行时说明](runtime.md#媒体数据流与隔离)。
