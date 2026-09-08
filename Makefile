.PHONY: check verify social-preview check-social-preview install uninstall

check:
	cjs tests/check-source.js applet.js usage-format.js
	cjs tests/test-usage-format.js
	cjs tests/test-spark-disclosure.js
	cjs tests/test-action-centering.js
	cjs tests/test-popup-width.js
	cjs tests/test-panel-colors.js
	cjs tests/test-model-visibility.js
	cjs tests/test-notification-delivery.js
	cjs tests/test-installation-paths.js
	cjs tests/test-backend-paths.js
	cjs tests/test-chatgpt-launch.js
	cjs tests/test-settings-schema.js
	cjs tests/test-reset-lifecycle.js
	cjs tests/test-reset-confirmation.js
	python3 -m unittest discover -s tests -p 'test*.py'
	python3 -m json.tool metadata.json >/dev/null
	python3 -m json.tool settings-schema.json >/dev/null
	python3 tests/check-ui-inventory.py
	python3 tests/check-png.py icon.png icons/usage-white.png icons/terminal-bot.png
	python3 scripts/render-icons.py --check
	python3 tests/check-rights-inventory.py
	shellcheck install.sh uninstall.sh tests/ui/*.sh
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
