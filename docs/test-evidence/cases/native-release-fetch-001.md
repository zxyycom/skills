### Case NATIVE-RELEASE-FETCH-001: 原生下载限定已选仓库与资产身份

Tests:
- `test:c4cca8890e918a4f26f80e505c4c321327ce9003fb62792ecdb7105b0196a192`

Tags:
- `repository-tooling`

Contract:
- 原生下载只消费一次解析的 release 资产，限定 GitHub 仓库并在交付文件集合前校验 manifest 与 ZIP 身份。

Proves:
- 固定响应的合法 manifest、skill 包和运行时按预期顺序请求并返回所选角色文件。
- 指向其他来源或重复资产名在网络请求前拒绝；测试不访问真实网络或执行安装。
- 超过 manifest 下载上限的响应被中止并报错。
