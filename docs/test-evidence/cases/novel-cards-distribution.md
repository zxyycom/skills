### Case NOVEL-CARDS-DISTRIBUTION-012: 独立分发与import边界

Tests:
- `test:3ac91f5e6775728dc966f097edd8ae6a92c76d566dc3d9df4053dda1f1f54ef2`

Tags:
- `novel-cards`

Contract:
- 生成MJS不依赖工作区node_modules，import不执行CLI或写入。

Proves:
- 复制到独立临时项目后import仅输出调用方标记且无索引副作用；同步、show和check均由Node成功执行；真实argv错误退出2且仅stderr，领域错误退出1且stdout单个JSON与stderr诊断。
