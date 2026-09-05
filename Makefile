.PHONY: check verify social-preview check-social-preview install uninstall

check:
	cjs tests/check-source.js applet.js usage-format.js
	cjs tests/test-usage-format.js
	cjs tests/test-spark-disclosure.js
	cjs tests/test-action-centering.js
	cjs tests/test-settings-schema.js
	python3 -m unittest tests/test_chatgpt_usage.py
	python3 -m json.tool metadata.json >/dev/null
	python3 -m json.tool settings-schema.json >/dev/null
	python3 tests/check-png.py icon.png icons/chatgpt-white.png icons/codex.png
	shellcheck install.sh uninstall.sh
	$(MAKE) check-social-preview

verify:
	git diff --check
	$(MAKE) check

social-preview:
	python3 .github/social-preview-src/render-all.py

check-social-preview:
	python3 .github/social-preview-src/render-all.py --check

install:
	./install.sh

uninstall:
	./uninstall.sh
