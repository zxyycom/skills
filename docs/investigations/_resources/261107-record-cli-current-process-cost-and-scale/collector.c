#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <fcntl.h>
int main(int argc, char **argv) {
 if (argc < 2) return 2;
 pid_t p=fork(); if (p<0) return 3;
 if(p==0){int fd=open("/dev/null",O_WRONLY);if(fd<0 || dup2(fd,1)<0 || dup2(fd,2)<0)_exit(126);close(fd);execvp(argv[1],argv+1);_exit(127);}
 int status;struct rusage ru;if(wait4(p,&status,0,&ru)<0)return 4;
 printf("{\"exit\":%d,\"signal\":%d,\"user_us\":%lld,\"system_us\":%lld,\"maxrss_kib\":%ld}\n",WIFEXITED(status)?WEXITSTATUS(status):-1,WIFSIGNALED(status)?WTERMSIG(status):0,(long long)ru.ru_utime.tv_sec*1000000+ru.ru_utime.tv_usec,(long long)ru.ru_stime.tv_sec*1000000+ru.ru_stime.tv_usec,ru.ru_maxrss);
 return WIFEXITED(status)?WEXITSTATUS(status):5;
}
