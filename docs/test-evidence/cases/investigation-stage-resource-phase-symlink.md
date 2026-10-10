### Case INVESTIGATION-STAGE-RESOURCE-PHASE-SYMLINK-001: 写前复核拒绝同字节符号链接替换

Tests:
- `test:05987d4d3339b2c816b188d64845520d3156b63f0533582cc61f0a2f8cba22eb`
- `test:2b45f8f7ea874540bbedac861cf26ee59bb76f243a4a58dd050d2a5bdd306636`
- `test:468db851262592904c4511d59bff084abda176a4436e173ea7ecf4b766fea48f`
- `test:4cb65b52c68a80189b4a3bfcbfd718d3dc4a943c53d9585c1b025717ea76470a`

Tags:
- `investigation-report`

Contract:
- 所选完整资源树的路径安全必须在准备和写前分别验证，字节相同不能替代表示与路径检查。

Proves:
- 准备读取后 root、owner、中间目录和文件被同字节外部目标符号链接替换时 all/domain 返回 source-drift，不经替换路径再次取得资源字节且 index 不变。
