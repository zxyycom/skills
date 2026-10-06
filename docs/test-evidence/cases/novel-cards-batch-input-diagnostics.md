### Case NOVEL-CARDS-BATCH-INPUT-DIAGNOSTICS-037: 批量输入失败定位

Tests:
- `test:40425277b8ad296b46fce19a185ec3b02710a8c42eab3c3901b1c582b2a407ca`

Tags:
- `novel-cards`

Contract:
- 批量JSON文件在输入边界完成读取、UTF-8解码和结构校验；边界失败须定位实际input文件，不能发布卡片或索引。

Proves:
- 输入缺失、非法JSON、非法UTF-8与错误字段类型均退出1并输出error，诊断包含input路径；旧索引原字节和三张原卡保留，history与journal目录均未创建。
