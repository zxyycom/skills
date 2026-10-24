# 取帧、看图与画面文字

用关键帧理解画面、步骤、图表和文字。先看少量相关画面，再围绕缺口加密取帧、提高清晰度或转录文字。首次调用先完成[共同准备](local-tools.md#调用前准备)；已有有效 PNG 则直接查看。

## 1. 选择时点并取得一批画面

1. 局部任务先取操作前后、结果与疑点；全片任务按阶段取代表帧，包含无对白片段。先用能辨认布局和状态的尺寸定位，再为关键细节提高清晰度。
2. 发送前核对本批图片数量和最终宽高，复用已看过的画面。图片输入限制与计量按当前模型、提供方和工具核对；文件大小不代表模型成本。

```powershell
node "$cli" frames --input "$video" --times 12,12.3 --width 960
```

`--times` 每次 1–8 个秒数，均小于时长；`--width` 默认 960、范围 0–3840，0 保留原宽。示例时点按实际素材替换。frames 可直接初始化证据；同 requested 秒数与 width 复用原 ID，只采集缺失组合。actual 相同但 requested 不同仍是不同帧。

## 2. 实际打开图片并记录观察

1. 从响应取 output、scopeId 及 mappings 中的 F ID、path、尺寸和 actual，用图片查看工具打开 PNG。视觉判断以实际看到的内容为据；缺少查看能力时交接该缺口。
2. 图像是首个 video stream 的编码像素，未应用播放器旋转或像素宽高比变换。requested 是请求秒数，actual 是首个不早于它的已解码帧真实 PTS，另存整数 pts、timeBase、streamIndex；引用 actual。
3. 记录看清的状态、文字、图表与疑点。需要确认中间步骤或持续过程时加密对应时点；细字先补清晰图。少量可直接读出的文字沿用视觉结果。

已有证据中的帧可先定位再开图；`$frame` 是实际 F ID：

```powershell
node "$cli" read --output "$evidence" --id "$frame" --format json
```

尚无帧 ID 时，用 `read --view raw --start ... --end ... --limit ...` 在时间窗定位 F，按 nextOffset 续页；该视图同时可能返回文字 T/O。

## 3. 需要识字辅助时才运行 OCR

需要批量转录、检索或辅助核对时，对同 scope 内 1–8 个有效 F 做 OCR。使用独立槽中的 RapidOCR 3.10.0 Python API、ONNX Runtime CPU；[当前支持状态](runtime.md#ocr-profile-与资格)仍为待资格验证。OCR 读取已有 PNG。

```powershell
node "$cli" ocr --output "$evidence" --frames "$frame"
node "$cli" ocr --output "$evidence" --frames "$frame" --region 100,200,600,160
```

选择整帧或区域形式，多个 F 用逗号分隔。region 使用各 PNG 的整数像素坐标 x,y,w,h：x/y 非负、w/h 为正、整区位于每张图内，越界拒绝；缩放帧按实际 PNG 尺寸计算。有效相同请求复用，`--fresh` 追加新材料与观察；接受 input/output 定位、app-root、timeout 和 format。

### 检查并读取识别结果

保存 output、scopeId、material 与 observationCount；`$material` 取帧 OCR 的 M ID。

```powershell
node "$cli" read --output "$evidence" --view raw --material "$material" --limit 20
```

1. 每个 F 对应一个 O，保存文字／空观察、图 hash、尺寸、区域及映射到原 PNG 的变换；boxes/texts/scores 只来自真实 API。分数含义按引擎解释。
2. O 是 F 的 actual PTS 处的离散观察，没有 start/end；持续时间需要进一步观察。empty 要求工具成功且有效输出为空；缺模型、损坏图或进程／协议错误走[失败分流](local-tools.md#失败分流)，影响限于对应材料。
3. 有 remaining 时按 nextOffset 续页；limit 计条目。精读一项用实际 O ID 调用 `read --id`，原图按 F 定位。
4. 对照 PNG 核实决定答案的数字、单位、专名、否定和顺序，说明实际查看区域。仍看不清的内容保留 unknown。

## 4. 返回观察与缺口

按信息需求返回观察与缺口，附 actual 可读时点、scope/F 及必要的 M/O，区分看图、识别和推断。需要复用帧描述或综合文案时进入[保存采用与校正](local-evidence.md#保存采用与校正)；effective 保留 F/D，机器 O 在 raw 中查询。

需要整个视频的烧录字幕及在屏区间时，使用[硬字幕操作](subtitle-tools.md#硬字幕范围)。
