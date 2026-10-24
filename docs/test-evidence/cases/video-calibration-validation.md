### Case VIDEO-CALIBRATION-VALIDATION-001: 校正分组和作用域验证先于发布

Tests:
- `test:bf64fb7bfd299ed4c4feea89b6855f1718fd1970f04cd9ee2963bba444159992`
- `test:fa239408ff9aa3b588b8868f3acff36267ed1456389e04c3934f31cdef8eba29`

Tags:
- `video-understanding`

Contract:
- N 到 M 校正、抑制和撤销不改 raw；targets 必须属于同一 scope、材料内连续组，并满足时间与活动重叠约束。

Proves:
- 有效改时返回完整替换组且 raw 字节不变；跨 scope、乱序/跨材料、非法时间与重叠在发布前失败。
