### Case NATIVE-RECORD-MUTATION-CHECK-001: 双域来源检查与错误聚合

Tests:
- `test:598319a3c78139f391e1d8e39eb9a5ec6b21ce7e6c9d0e998886104d3ab04986`
- `test:64a7128e1db0ce1e1ea3ff99392c661d1b996b1530553e65c52b150971f4d658`
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`
- `test:aa8b51aa7b298b7f3ee8cf34bcacab13bd0e40dd32b4f91e483e9d9c585d020e`
- `test:ae42ded23d29f2af769d620f3edcda11d54a8d40e8f3ab7902350380ed51de59`
- `test:f305d1446702243fdb39186c40af0f8221d5bc2bdc605fc0da5ab58834fa4f48`

Tags:
- `record-rust`

Contract:
- 检查须重建适用来源并区分坏来源、缺失资源和部分覆盖。

Proves:
- 私有两域输入验证源投影、独立错误聚合和未引用资源。
- 调查 selected 回退发现核对索引缺失、无效或位置失效时的头部读取，及所选正文、重复所选身份、头编码和不安全成员错误。
