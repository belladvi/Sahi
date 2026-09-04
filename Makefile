# Thin wrappers over npm scripts (parity with the build-spec's `make` mental model).
.PHONY: install dev build test typecheck lint verify

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

typecheck:
	npm run typecheck

lint:
	npm run lint

# The full gate to run before pushing.
verify: typecheck lint test build
