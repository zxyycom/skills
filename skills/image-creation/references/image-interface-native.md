# Codex 原生图像接口

先按[图像接口总览](image-interfaces.md)确认运行时契约与授权，实际调用及回看见[生成记录](generation-records.md)。

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
