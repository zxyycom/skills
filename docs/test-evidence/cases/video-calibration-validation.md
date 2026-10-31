### Case VIDEO-CALIBRATION-VALIDATION-001: 校正分组和作用域验证先于发布

Tests:
- `test:1c2c558f1d9b0818273565fd9f05414085a938baa98569e3976f24aada99b535`
- `test:533cf4c09d5c2bab5c5618e401c63861098b92b9b51f4f350ea399a6bc606c6c`

Tags:
- `video-understanding`

Contract:
- N 到 M 校正、抑制和撤销不改 raw；targets 必须属于同一 scope、材料内连续组，并满足时间与活动重叠约束。

Proves:
- 有效改时返回完整替换组且 raw 字节不变；跨 scope、乱序/跨材料、非法时间与重叠在发布前失败。
