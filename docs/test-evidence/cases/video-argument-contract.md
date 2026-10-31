### Case VIDEO-ARGUMENT-CONTRACT-001: 命令参数按适用域严格解析

Tests:
- `test:0aa540344f9b0289527f71892240718a2a86b99ec37709062867faba3d85cba2`

Tags:
- `video-understanding`

Contract:
- 命令只接受其适用选项，路径、预算、轨道索引与帧尺寸须满足各自输入约束。

Proves:
- 显式 track zero、各字幕来源与 selector/ROI 的合法组合和原宽尺寸保留语义；缺少 selector、来源冲突、不适用 ROI/选项、非绝对路径和非法时间/预算被明确拒绝。
