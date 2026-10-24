### Case VIDEO-ASR-NATIVE-001: ASR 原生参数与返回协议由媒体边界验证

Tests:
- `test:2a969a3806b5ff4818ef1648a4764b4f12ea73a64e6fa19ff615163191af709b`

Tags:
- `video-understanding`

Contract:
- ASR 边界使用离线本地模型参数，显式语言与 initial prompt 只在有值时传入；返回的语言和 segments 必须有效。

Proves:
- 捕获的原生 argv 保留 helper、缓存、CPU 和离线选项；实际 audio.json 被解析校验，缺失语言、非法 timing 和文件缺失被明确拒绝且不改原始结果。
