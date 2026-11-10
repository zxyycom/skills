### Case IR-RESOURCE-METADATA-LIMITS-001: 资源大小提示与数量上限保留已知覆盖

Tests:
- `test:c7672d576fd374b661c55859165d14d4d84cccf24d5a25dabcfdef3c4748cd18`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 文件与报告大小、引用数超过各自阈值时提示；文件上限造成未检查资源时，数量与已知体积分开表达。

Proves:
- 4／5 字节文件在阈值 4 下仅提示后者，总量 9 超过阈值 8 且引用数 2 超过阈值 1；maxFiles=1 时保留资源数 2、已知体积 4、metadataComplete=false 和一个 skippedFile。
