### Case VIDEO-ASR-NATIVE-001: ASR 原生参数与返回协议由媒体边界验证

Tests:
- `test:ae797dcd7900b94e8a83e0422296ec98fda50556fce47e593f8eb6ceba2f8abc`

Tags:
- `video-understanding`

Contract:
- ASR 边界使用离线本地模型参数，显式语言与 initial prompt 只在有值时传入；返回的语言和 segments 必须有效。

Proves:
- 使用隔离的 Windows 环境路径并替换原生进程端点，捕获的 argv 保留 helper、缓存、CPU 和离线选项；实际 audio.json 被解析校验，缺失语言、非法 timing 和文件缺失被明确拒绝且不改原始结果。fixture 在结束时恢复宿主环境，不证明 Linux 媒体运行支持。
