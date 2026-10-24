# 常见图像接口使用与注意事项

本文件负责把已经准备好的提示和实际图像送到选定入口，再取得可查看结果。先读当前运行时 tool schema、执行 skill 与所选服务官方文档；下列是接口形态与操作链，不是永久参数表。模型、尺寸、质量、seed、图数和蒙版等只按该入口当前支持设置；API支持不代表Codex原生工具也支持。

默认使用当前获授权的原生生图能力；显式选择API／CLI才走相应路径。失败不能自动扩大费用、改模型或另找凭据。已有工具适用时不额外编写客户端；本文件不要求安装SDK、登录、启动服务或部署ComfyUI。凭据只从授权的仓库外配置注入，不写入prompt、记录或日志。

## 1. Codex 原生图像工具

### 先辨认本次暴露的形式

工具可能以直接命名空间、经工具发现或经代码封装提供，不要求每个Codex部署都有 `functions`。下面对应一种明确暴露的形态；名称／字段变化时改用实际契约，不照抄：

```text
image_gen__imagegen({
  prompt,
  referenced_image_paths?,
  num_last_images_to_include?,
  transparent_background?
})
```

在这一形态下：

- 全新生图按契约省略两个引用字段；需要编辑／使用图像输入时，先查看实际目标和参考。
- 所有目标均有本地路径时使用 `referenced_image_paths`；本地图未看过先用 `view_image` 查看。字段内的图序必须对应提示中的图序。
- 至少一张目标没有路径时，使用能覆盖所有目标的最小 `num_last_images_to_include`，上限为5；它与路径字段互斥。不能覆盖全部所需图时，请用户重新附图，不悄悄漏图或声称已附。
- 透明背景请求显式设 `transparent_background: true`；编辑时保留既有透明，除非用户要求改变。实际alpha仍须检查，不凭棋盘格观感认定。
- 原生路径不需要用户提供 `OPENAI_API_KEY`；不虚构它未暴露的模型、质量、mask、输出路径或seed参数。

### 请求、等待、取图

先按[记录规则](generation-records.md)保留本次目的、完整实际词和输入；再调用。若当前确实通过 `functions.exec` 提供代码模式，遵循其长任务约定，例如：

```javascript
// @exec: {"yield_time_ms": 120000}
const result = await tools.image_gen__imagegen({
  prompt: "本次完整实际提示词",
  transparent_background: false
});
generatedImage(result);
```

这只是封装示意，实际提示词需替换且记录。只有返回 `Script running with cell ID ...` 才用 `functions.wait` 等待相应cell，并按当前契约给足等待时间；不要因等待较长重复提交付费生成。完成后用契约规定的 `generatedImage(result)`／原生展示方式交图，不把整个结果或base64打印出来。

从返回取得真实资源／路径，不保证某个盘符、OS临时目录或固定输出位置，也不虚构未提供的路径参数。需要项目文件时，核对返回原件是否存在，再按授权复制／保存为新版本并核对引用；若只有会话图而无可用文件，明确交付限制。接口成功后继续回看、保存检查结果并决定候选状态，不止于转发图片。

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

## 4. ComfyUI 已有工作流

只进入用户已授权实例；可用 `/object_info` 核对节点、`/upload/image` 上传。保存实际API格式工作流与有效提示节点，不只存GUI图或正向词；检查最终图像／文本接线。[官方服务路由](https://docs.comfy.org/development/comfyui-server/comms_routes)

```text
POST /prompt：{prompt: <API工作流节点映射>}
→ prompt_id（或 error / node_errors），不是完成图
GET /history/<prompt_id>：定位该任务 outputs 中的图像元数据
GET /view：按实际返回的 filename/subfolder/type 等元数据取图
```

可经 `/ws` 跟踪执行，再取图、回看与记录。节点验证、排队、执行失败和取图失败分别处理；不为取图清队列、重启或安装节点。[请求与输出路径](https://docs.comfy.org/development/comfyui-server/comms_routes)

输出定位示例为 `history[prompt_id].outputs[node_id].images[*]`；按其中的图像元数据取文件，不将WebSocket中间预览当最终图。此处使用官方的history取图模式，其他输出节点需按其实际返回适配。[官方API示例](https://docs.comfy.org/development/comfyui-server/api-examples)

## 共同收尾

无论哪种入口，都把“请求已提交／入队、生成已完成、图像已取得、文件已保存、已回看、已获用户认可”分开。实际词与可见改写词、请求图与阅读参考、返回原件与派生缩略图分别记录；详见生成记录owner，不在各接口下再造不同日志规范。
