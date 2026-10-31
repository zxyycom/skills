### Case VIDEO-PROCESS-LIFECYCLE-001: 进程失败超时取消与输出限额可区分

Tests:
- `test:2ad5c09bdd6e305725e4b517f1b742207439f68f0bd99cbc4b5eb04fb066457c`
- `test:aebe73443d30eac3c0b7d175d3c0b27540ac23abe3d2c7b0aa084e787624977a`
- `test:f98c1c4013d95ae0ee12ee81c734992d478ec4433e061c4bac2b6282ec53b231`

Tags:
- `video-understanding`

Contract:
- 本地子进程拥有明确退出、超时、取消及输出限额边界；需要终止时回收对应进程树并保留诊断。

Proves:
- 非零退出保留 stderr，超时与取消有不同失败种类，stdout 超限阻断而 stderr 超限保留安全说明，启动失败不伪装成协议成功。
