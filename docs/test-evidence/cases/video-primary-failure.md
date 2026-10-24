### Case VIDEO-PRIMARY-FAILURE-001: 附属日志失败不覆盖主操作结论

Tests:
- `test:5ccc94a6692389565c2a6611c4c0471def40c4679c2f26a3e61fa4c02a1a7dd6`
- `test:70366ff4de065425ec030fe54218476ac7acbfb415e0c29c85457782a27db550`
- `test:b6de2723ce99e606ec3d1935a5ba5d2820c2b24c99f6c69d4943173d3c87b1b5`

Tags:
- `video-understanding`

Contract:
- 失败状态发布、运行日志与诊断属于附属记录；附属失败不能把主成功改成失败或替换主失败。

Proves:
- prepare/frames 状态发布失败仍保留原阶段与 target；日志无法发布或诊断已占用时返回主结论，并明确记录保证缺口。
