# 字幕与听写操作

取得讲述文字或字幕，按任务范围读出所需信息。已有 SRT/VTT 可直接按 cue／行号阅读；需要统一视频定位或后续校正时再导入。首次本地调用先完成[共同准备](local-tools.md#调用前准备)。

## 1. 选择本次文字来源

| 所需材料 | 路线与边界 |
| --- | --- |
| 将已有 SRT/VTT 纳入证据 | `prepare --source external --subtitle <path>`；保留原文件、hash 和解析结果，时间仅承诺文件所给区间 |
| 视频内嵌文本轨 | `prepare --source embedded --subtitle-stream <index>`；先核对绝对 stream index、语言与同步 |
| 原音听写 | `prepare --source asr`；缺少合适字幕或需独立比较原音时获取，输出估计语音区间 |
| 烧录在画面的字幕 | `prepare --source hard-ocr --region x,y,w,h`；需连续屏幕字幕文本时获取，输出估计在屏区间；范围与资格见下文 |
| 位图字幕轨 | 用已授权的专用工具导出 SRT/VTT，再以 external 导入 |
| 只需便利取得一份文字 | `prepare --source auto`；外部 → 内嵌文本 → ASR，仅无候选或成功为空才继续，实际错误停止 |

已有文字和文本轨可省去重新识别，优先尝试；只有画面中几处文字时直接看[关键帧](frame-text.md)更合适。`auto` 的顺序是获取便利性而非质量排序；需要比较时可显式另取 ASR。平台自动／翻译字幕按[网站材料获取](online-sources.md)取得并保留类别与语言。

## 2. 获取或复用所选来源

按所选来源调用，路径和绝对轨号来自本次盘点；`$cli` 与运行位置已按共同入口确认。

```powershell
node "$cli" prepare --input "$video" --source external --subtitle "$subtitle"
node "$cli" prepare --input "$video" --source embedded --subtitle-stream 2
node "$cli" prepare --input "$video" --source asr --audio-stream 1
node "$cli" prepare --input "$video" --source hard-ocr --region 0,780,1920,300
node "$cli" prepare --input "$video" --source auto
```

1. source 缺省按 subtitle → external、subtitle-stream → embedded、其余 → auto 推定。subtitle 与 subtitle-stream 互斥；audio-stream、language、model、initial-prompt 只用于 auto/asr。未知、跨命令或冲突参数在写入前失败。
2. `prepare` 处理整个输入，ASR 默认转录完整所选音轨；start/end 只用于后续读取。预算要求截片时，用已授权工具保留来源、原视频偏移、边界上下文与覆盖；片段使用新 scope 和 ID。
3. 相同 requestKey 复用最新仍有效的 complete/empty；`--fresh` 追加重算结果并保留旧材料。版本／模型另记来源，升级本身不使旧结果失效。
4. 保存响应的 output、scopeId、material（M ID）和 cueCount；T 条目在下一步读。失败／中断按[失败分流](local-tools.md#失败分流)处理。

### 音轨与语言

1. ASR 必须有音轨；无音轨时报 `kind=input`、`stage=audio-extraction`，`processedCoverage=[]`，不等同于静音。音轨存在、识别完成且有效输出没有文字才是 `empty`；它仍不证明没有语音。
2. 语言未知时省略 `--language`，沿用底层自动检测；已核对所选音轨的语言时才显式传代码（例如 `--language en`）。标题、人物国籍、原版语言或字幕不能证明当前音轨语言。配音／多音轨选实际要处理的一轨，混语按相关片段回查；自动检测不等于逐段或全片验真。

新 ASR 材料分别保存请求与结果：

| 字段 | 含义 |
| --- | --- |
| `M.parameters.language` | 请求值；`unknown` 表示未强制，由底层自动检测 |
| `M.language` | 实际 `raw/audio.json` 的 `language`，不以请求值代填 |
| prepare 响应／材料 detail 的 `languageMode` | 结果已知时，显式指定为 `forced`，未强制为 `detected`；失败、中断或结果未知为 `unknown` |

底层 JSON 未保存检测概率，因此本工具不报告概率。继续旧证据时按[ASR 历史材料](local-evidence.md#asr-历史材料)解释语言字段与复用资格。

### ASR 末端时间归一

ASR 时间是估计值。登记时，满足以下全部条件才将尾端收紧到媒体时长：

1. 来源为 ASR，且只有一条 cue 越界。
2. 该 cue 是按起点、终点升序排列后的末条，起点严格小于媒体时长。
3. 越界量不超过 25 毫秒；数值有效性与区间顺序已通过输入校验。

25 毫秒取 Whisper 的 20 毫秒时间步长加时间映射至两位小数的最多 5 毫秒舍入量，是接纳策略而非识别误差保证。未满足条件的越界以协议错误拒绝，诊断给出首条越界 cue 的 ID、区间、媒体时长、越界量和越界条数。

归一只改变本次登记 T 的终点；原始 `raw/audio.*` 字节、文字、起点、ASR 来源、参数和模型依据保持不变。材料 `warnings` 记录 T ID、原终点、新终点、调整量与上限；`prepare` 返回这些警告，`read` 在本页包含所属 M 或其 T/O 时附带材料警告。原始文件与登记 payload 由同一 M 的路径和 hash 关联，可从材料 detail 回查。归一不等于原音核实。

归一直接消费本次识别结果。既有成功与失败材料保持原样，复用与追加恢复按[证据恢复](local-evidence.md#复用状态与失败恢复)执行。

### 硬字幕范围

使用 Windows x64 CPU 的 VideOCR 1.6.0 CLI、PaddleOCR；关闭繁转简，跳帧 0，禁用调试图保存，允许系统休眠。[当前支持状态](runtime.md#ocr-profile-与资格)仍为待资格验证。

先按[画面操作](frame-text.md)看清字幕位置，再选 ROI。region 为原编码像素中的整数 x,y,w,h：x/y 非负、w/h 为正、整区位于输入内；缩放 PNG 坐标须换回原编码尺寸。越界、非零旋转或非零时间起点拒绝。字幕位置变化、竖排、复杂背景与多区域需另验质量。

## 3. 检查材料并分批读取

`$evidence` 取实际 output，`$material` 取响应或清单的 M ID；时间窗和 limit 按本批问题设置。

```powershell
node "$cli" read --output "$evidence" --view materials --limit 20
node "$cli" read --output "$evidence" --view raw --material "$material" --start 10 --end 30 --limit 40
```

1. materials 给来源、状态、请求／实际覆盖及当前性；本次 M 也可用 `read --id "$material"` 查摘要。raw 按材料和 `[start,end)` 重叠窗口读正文；limit 计条目，有 remaining 时按 nextOffset 续读所选范围。
2. complete 表示该来源处理成功且有内容，empty 表示处理成功但有效输出为空；无对应 M 是未运行，failed/interrupted 是失败／中断。失败尝试不算成功覆盖。
3. 按需逐份读取多来源，再比较相关内容与时点。保留原文和定位，向主流程返回与问题有关的片段、提纲及缺口。
4. 文件／字幕轨时间、估计语音时间和估计在屏时间分别解释。视频须通过[媒体输入前置](local-tools.md#媒体输入前置)；外部字幕的版本、零起点和同步由操作者核对。小数与区间外沿不保证精度或连续覆盖。

## 4. 带着依据返回理解流程

带可读时点、scope/M/T、覆盖和疑点返回主流程，对照信息需求决定交付或补充。原音问题用授权播放器回听（本 CLI 无回听入口），画面字幕问题打开 PNG；分别说明机器识别、直接观察及尚未核实的部分。

当前回答可直接使用原始材料；需要复用采用解释时进入[保存采用与校正](local-evidence.md#保存采用与校正)，恢复既有采用时进入[继续已有证据](local-evidence.md#继续已有证据)。
