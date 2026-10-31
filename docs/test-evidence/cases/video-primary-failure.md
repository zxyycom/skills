### Case VIDEO-PRIMARY-FAILURE-001: 附属日志失败不覆盖主操作结论

Tests:
- `test:56b1f8eef6cc96fa766a9bcd9e084dbec4d3a7ce71088677c09993e0e38ac25d`
- `test:c4c25fc702e43dd730ce1c416e16ee62e353d4688f1db8910df5f994faf77583`
- `test:db23139ede807ce917d14fab16539c3c6bf9c388163b992dc75df887fd846927`

Tags:
- `video-understanding`

Contract:
- 失败状态发布、运行日志与诊断属于附属记录；附属失败不能把主成功改成失败或替换主失败。

Proves:
- prepare/frames 状态发布失败仍保留原阶段与 target；日志无法发布或诊断已占用时返回主结论，并明确记录保证缺口。
