.PHONY: check verify install uninstall

check:
	cjs tests/check-source.js applet.js usage-format.js
	cjs tests/test-usage-format.js
	python3 -m unittest tests/test_chatgpt_usage.py
	python3 -m json.tool metadata.json >/dev/null
	python3 -m json.tool settings-schema.json >/dev/null
	python3 tests/check-png.py icon.png icons/chatgpt-white.png
	shellcheck install.sh uninstall.sh

verify:
	git diff --check
	$(MAKE) check

install:
	./install.sh

uninstall:
	./uninstall.sh
