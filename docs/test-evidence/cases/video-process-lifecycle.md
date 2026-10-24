### Case VIDEO-PROCESS-LIFECYCLE-001: 进程失败超时取消与输出限额可区分

Tests:
- `test:276bbb35a545d50e4abac52606d0dfa2def79ef60cd398ee82e85b4c72155a1e`
- `test:5e3aca36e637fd0f5b93db22e6e575ec4e59348745702df67ab0e0cbe6c6baf8`
- `test:f59829da3c9c3772ce1c1c80a54b2e74c306896bc5925e4812300555185606aa`

Tags:
- `video-understanding`

Contract:
- 本地子进程拥有明确退出、超时、取消及输出限额边界；需要终止时回收对应进程树并保留诊断。

Proves:
- 非零退出保留 stderr，超时与取消有不同失败种类，stdout 超限阻断而 stderr 超限保留安全说明，启动失败不伪装成协议成功。
