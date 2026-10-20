### Case NOVEL-CARDS-DISTRIBUTION-012: 独立分发与import边界

Tests:
- `test:dbe0953f5b9bd904b279d85bc33377260d662ee0e55b364146e8c4a24ea5e024`

Tags:
- `novel-cards`

Contract:
- 分发 TS 使用完整闭包与声明的兼容依赖，import不执行CLI或写入。

Proves:
- 复制到独立临时项目后import仅输出调用方标记且无索引副作用；同步、show和check均由Node成功执行；真实argv错误退出2且仅stderr，领域错误退出1且stdout单个JSON与stderr诊断。
