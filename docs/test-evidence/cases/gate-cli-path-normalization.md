### Case GATE-CLI-PATH-NORMALIZATION-001: Gate 采集与执行共享实际规范化的 PATH

Tests:
- `test:e0a367f64f9ddcdae87162252879a29f53d721a9c5b1ab97ce6cd10a7985e1c4`

Tags:
- `repository-tooling`

Contract:
- 有效 CLI 调用在输入采集与执行前对实际 PATH 按平台分隔符精确去重，保留首次出现的搜索顺序及空项、相对项；缺失 PATH 不创建值，使输入证明与执行消费相同的搜索路径。

Proves:
- 独立列出的重复普通项、空项与相对项输入，在 prepareActivation 和 runProject 中均观察到首次顺序保留的同一预期 PATH；调用后的实际 PATH 也与该值一致。
- 初始缺失 PATH 时，采集、执行及调用结束均保持缺失。
