# MIPS Assembler
[![Netlify Status](https://api.netlify.com/api/v1/badges/9e028f70-0f4d-4b99-ac7f-3dedbd707983/deploy-status)](https://app.netlify.com/sites/mips-assembler/deploys)
[![Vitest](https://github.com/mclrc/mips-assembler/actions/workflows/vitest.yml/badge.svg)](https://github.com/mclrc/mips-assembler/actions/workflows/vitest.yml)
[![ESLint](https://github.com/mclrc/mips-assembler/actions/workflows/eslint.yml/badge.svg)](https://github.com/mclrc/mips-assembler/actions/workflows/eslint.yml)

This [MIPS assembler](https://mips-assembler.netlify.app/) enables you to assemble and inspect a subset of MIPS assembly directly in your browser.

It's not feature complete, but should include everything you're likely to encounter in a basic school or university course. It is also written to be
easily extensible, with tests to ensure you can't accidentally break anything, so don't hesitate to open a PR!

### Missing but easy-to-implement:
- Support for comments
- Displaying labels in the final table
- Adding more R/I instructions
- More comprehensive testing/test coverage
- Better error handling & feedback
- ASCII immediates
- Syntax highlighting (probably using [react-codemirror](https://www.npmjs.com/package/@uiw/react-codemirror))

### Slightly tougher to implemenent:
- Float instructions & format (for `add.s`, `sub.d`, etc.)
- Disassembler
- Info layers for individual instructions
- Data section

### Difficult to implement:
- Basic MIPS emulator/VM
