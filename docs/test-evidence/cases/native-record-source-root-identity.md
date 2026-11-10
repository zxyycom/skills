### Case NATIVE-RECORD-SOURCE-ROOT-IDENTITY-001: 不同工作区不能只按集合目录合并

Tests:
- `test:7416237cf49a9e37673529d0c15e6203b689000bcfd020f06256e03dbf1b316f`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 来源去重身份包含工作区 root 与调查目录，不仅比较最终集合目录。

Proves:
- 两项配置指向同一物理报告目录但工作区 root 不同，真实 list 保留两个不同 root 的来源且两项都返回对应报告。
