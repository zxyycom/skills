#include <stdlib.h>
#include <unistd.h>
int main(void){size_t n=64UL*1024*1024;char *p=malloc(n);if(!p)return 1;for(size_t i=0;i<n;i+=4096)p[i]=1;return p[n-4096]!=1;}
