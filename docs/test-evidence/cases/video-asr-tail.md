### Case VIDEO-ASR-TAIL-001: ASR 末端容差保持原始证据

Tests:
- `test:228b0f52279f80a438d540a9b34e42d66f3bcf62e867fddd68c913f4d100cf42`
- `test:49ea1e034d1aaac49ab8d1b7bd1ff319aa7b85326ddc457170be94f141a6220f`
- `test:6f825a9ec2cd357d73707349b7211005e4e94dd786e50474cb1d404e52e7a01a`
- `test:804b831cc851b89b80e2063aa368ccc622dc282290859a9b39570da5cbfbb418`

Tags:
- `video-understanding`

Contract:
- 只有 ASR 唯一越界且按时间排序末尾的 cue，在 start 小于媒体时长、end 超出不超过 25 ms 时可归一；其他来源不借用此容差，原始输出与来源必须保留。

Proves:
- 允许的末端被归一并返回可审计 warnings；超界、多个重叠或非 ASR 输入被拒绝，历史成功结果与原始字节不受破坏。
