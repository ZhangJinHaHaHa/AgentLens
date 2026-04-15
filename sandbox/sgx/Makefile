# Makefile for Agent Shenji SGX Quote Generator
#
# Build in SGX mode:
#   make SGX=1
#
# Clean:
#   make clean
#
# Requires: gramine, python3

ARCH_LIBDIR ?= /lib/$(shell $(CC) -dumpmachine)

# Python3 entrypoint
ENTRYPOINT ?= $(shell sh -c "command -v python3")

ifeq ($(DEBUG),1)
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
clean:
	$(RM) -f generate-quote.manifest generate-quote.manifest.sgx generate-quote.sig

.PHONY: distclean
distclean: clean
	$(RM) -rf *.token
