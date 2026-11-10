### Case NATIVE-RECORD-SOURCE-ROOT-ALIASES-001: 同根别名去重后允许写入

Tests:
- `test:e42b8da583f71e102ab4de460095413a3a25440315a36ec67c420936c21e380d`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 来源身份使用系统可解析的工作区 root 与调查目录；跨配置层指向同一根的别名只保留一次，写入按去重后的源数判断。

Proves:
- 项目 first 和本地 ../first 经组合 key 引用后，真实 new 成功在 first 创建一个候选而不写 second；若按声明字符串计数将因多源而失败。
