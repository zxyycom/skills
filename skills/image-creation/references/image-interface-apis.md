# 显式图像 API 接口

仅在用户明确授权 API／CLI 路径后使用；先按[图像接口总览](image-interfaces.md)确认当前协议与授权，实际调用及回看见[生成记录](generation-records.md)。

## 2. OpenAI Images API 与 Responses

仅在用户明确授权API／CLI路径后使用。以下是SDK请求／响应形态示意，尖括号代表需按当前支持替换的内容，不是可直接发送的值；不锁模型或参数。Images与Responses不要混用。[官方图像指南](https://developers.openai.com/api/docs/guides/image-generation)

| 入口 | 主要请求 | 拿图／续接 |
| --- | --- | --- |
| Images新生成：`client.images.generate` | `model=<图像模型>, prompt=<完整实际词>` | 图像响应的 `data[*].b64_json` 解码；检查实际返回类型 |
| Images编辑：`client.images.edit` | `model, prompt, image=<实际文件或文件列表>`；仅支持时加 `mask` | 同上；文件列表顺序对应参考职责 |
| Responses：`client.responses.create` | `model=<支持该工具的主模型>, input=<文字与必要图像上下文>, tools=[{type:"image_generation"}]` | 从 `output` 筛出 `image_generation_call`，取 `result` 图像数据；需要续接时用 `previous_response_id` |

最小链：核对合法请求 → 保存词／附图 → 发送 → 提取并保存真实图像 → 回看记录。可见 `revised_prompt` 与提交词分存；只有文本、错误或未完成状态不算出图。蒙版是引导，不是非目标像素锁；API控制不反推为原生字段。[返回与编辑说明](https://developers.openai.com/api/docs/guides/image-generation)

## 3. Gemini 图像接口

先确认当前SDK／HTTP协议。下列为官方页所示 Interactions 的最小形态，不与其他版本的 `generateContent` 混用。[官方图像指南](https://ai.google.dev/gemini-api/docs/image-generation)

```text
client.interactions.create(
  model=<当前支持的图像模型>,
  input=<完整实际词，或按协议排列的文字/图像输入>
)
→ 单图快捷取法 interaction.output_image.data：按返回mime类型解码保存
续接：同一入口增加 previous_interaction_id=<前轮interaction.id>
```

`output_image` 只取最后生成的图像块，仅适合已确认单图交付。系列／交错多图需按当前协议遍历 `steps`，从 `model_output` 的 `content` 提取实际图像块，逐项保存并关联文本／交付序号；不要把thought图或中间预览算作成品。[完整输出说明](https://ai.google.dev/gemini-api/docs/image-generation#interleaved-text-and-images)

最小链：记录输入 → 检查真实图像及状态 → 保存全部交付图 → 逐图回看记录。文本、被阻止、缺图或解码失败不算成图；不自动换模型。多轮保存实际上下文关系，不只记最后一句修改。
