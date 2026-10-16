# Retro calculator (16-bit, black and green)

A standard-mode calculator in a Windows 3.x style layout with a green phosphor
palette, built after inspecting a Windows `calc.exe` with REA. Open
`index.html` directly in a browser; it has no build step or dependencies.

```bash
node --test experiments/retro-calculator/calculator.test.mjs
```

## What REA found in `calc.exe`

Target: `calc.exe`, 49,152 bytes, SHA-256
`621ba3934afc45c35a4ee16386f4da30119f39fa243e8dc8fef3491a76f829d8`. The binary
was only read, never executed.

| Step          | REA command                                         | Result                                                                                                                                                                 |
| ------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory     | `rea inspect-artifact calc.exe`                     | PE, one node, no child containers; next probes: managed metadata, then native.                                                                                         |
| Managed check | `rea inspect-managed-artifact calc.exe`             | x86-64 PE32+, no CLI directory: native, not .NET.                                                                                                                      |
| Native layout | `rea inspect-with-objdump calc.exe section_headers` | 7 sections; `.text` is only 0xcb0 bytes, `.rsrc` 0x4710 (icon and version info).                                                                                       |
| Code          | `rea inspect-with-objdump calc.exe disassemble`     | `WinMain` writes the `CalculatorStarted` ETW event, then calls `ShellExecuteW(NULL, NULL, L"ms-calculator:", NULL, NULL, SW_SHOWNORMAL)` at `0x140001af1` and returns. |

Observed facts (section and disassembly output retained as REA Evidence; the
import table and version strings were read with plain `objdump -p` and
`strings`, outside REA): the version resource
reads "Windows Calculator", `10.0.26100.8521`; imports are limited to
`SHELL32!ShellExecuteW`, CRT startup, and ETW (`EventRegister`,
`EventWriteTransfer`). There is no arithmetic, window class, or button layout
in this file.

Inference: this `calc.exe` is the Windows 11 launcher stub that hands off to
the packaged Calculator app through the `ms-calculator:` protocol, so the
calculator behavior itself is not recoverable from this binary. Native
providers (Ghidra, Hopper, IDA) were not configured in the analysis
environment; objdump was sufficient because the code is a single short path.

## Behavior implemented

The engine (`calculator.js`) follows the documented behavior of the Windows
Calculator standard mode rather than code taken from the binary:

- Immediate left-to-right evaluation (`2 + 3 × 4 = 20`).
- `=` repeats the last operation; an operator pressed twice replaces the first.
- `%` takes a percentage of the left operand for `+`/`−` and divides by 100
  for `×`/`÷`; `√`, `x²`, `1/x` and `+/−` apply to the current entry.
- `Back`, `CE`, `C`, memory (`MC`, `MR`, `MS`, `M+`, `M−`) and a history panel.
- Error messages block input until cleared; entries are limited to 16 digits
  and results are rounded to 15 significant digits.
- pt-BR number formatting (`1.234,5`).

Keyboard: digits, `,`/`.`, `+ - * /`, `Enter`/`=`, `Backspace`, `Delete` (CE),
`Esc` (C), `@` (√), `q` (x²), `r` (1/x), `F9` (+/−), `%`, `Ctrl+L/R/M/P/Q`
for memory, `Ctrl+C`/`Ctrl+V` and `Ctrl+H` for history.
