# 已有 ComfyUI 工作流接口

先按[图像接口总览](image-interfaces.md)确认当前协议与授权，实际调用及回看见[生成记录](generation-records.md)。

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
