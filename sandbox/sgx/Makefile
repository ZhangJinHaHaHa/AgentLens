# Makefile for Agent Shenji SGX Quote Generator
#
# Build in SGX mode:
#   make SGX=1
#
# Clean:
#   make clean
#
# Requires: gramine, python3

# 该 Makefile 只把 quote 生成器模板物化并在 SGX 模式下签名；它不安装宿主依赖、不生成签名私钥，
# 也不判断产出的 MRENCLAVE 是否已被远端 verifier 信任。输入工具链和默认签名材料由受控构建机提供。
# 普通 all 仅生成可审阅 manifest，SGX=1 才产生 enclave manifest 与签名；任一工具失败都会阻断对应目标。
ARCH_LIBDIR ?= /lib/$(shell $(CC) -dumpmachine)

# Python3 entrypoint
# 解释器绝对路径会进入模板的可信文件集合，因此构建机 Python 变化将有意改变测量值并要求重新登记。
ENTRYPOINT ?= $(shell sh -c "command -v python3")

ifeq ($(DEBUG),1)
# DEBUG 仅提高 Gramine 日志详细度；模板中的 enclave debug 标志仍固定关闭，不能把日志开关当成调试 enclave 授权。
GRAMINE_LOG_LEVEL = debug
else
GRAMINE_LOG_LEVEL = error
endif

.PHONY: all
all: generate-quote.manifest
ifeq ($(SGX),1)
all: generate-quote.manifest.sgx generate-quote.sig
endif

# Generate the manifest from template
# 生成文件是可重复构建的派生产物，模板参数缺失或 gramine-manifest 不兼容时应失败而非沿用旧文件。
generate-quote.manifest: generate-quote.manifest.template
	gramine-manifest \
		-Dlog_level=$(GRAMINE_LOG_LEVEL) \
		-Dentrypoint=$(ENTRYPOINT) \
		-Darch_libdir=$(ARCH_LIBDIR) \
		$< $@

# Sign the manifest for SGX (produces .manifest.sgx and .sig)
generate-quote.manifest.sgx generate-quote.sig: generate-quote.manifest generate-quote.py
	gramine-sgx-sign \
		--manifest $< \
		--output $@

.PHONY: clean
# clean 只移除本目录可再生的 manifest/signature；不会触碰签名密钥、系统配置或已经发布的测量登记。
clean:
	$(RM) -f generate-quote.manifest generate-quote.manifest.sgx generate-quote.sig

.PHONY: distclean
distclean: clean
	$(RM) -rf *.token
