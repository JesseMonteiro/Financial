#!/usr/bin/env python3
"""Patch XcodeGen output: link XCSwiftPackageProductDependency → XCLocalSwiftPackageReference.

XcodeGen 2.46 omits `package = <id>;` for local SPM products, which makes Xcode report
"Missing package product '…'". Idempotent.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PBXPROJ = ROOT / "FinanceHub.xcodeproj" / "project.pbxproj"


def main() -> int:
    if not PBXPROJ.is_file():
        print(f"error: missing {PBXPROJ}", file=sys.stderr)
        return 1

    text = PBXPROJ.read_text(encoding="utf-8")

    local_refs = re.findall(
        r"^\s+([A-F0-9]{24}) /\* XCLocalSwiftPackageReference .*? \*/ = \{\s*$",
        text,
        flags=re.MULTILINE,
    )
    if not local_refs:
        print("warning: no XCLocalSwiftPackageReference found; nothing to patch")
        return 0

    # Single local package at ios/ root — use the first (only) reference.
    package_id = local_refs[0]

    section_match = re.search(
        r"(/\* Begin XCSwiftPackageProductDependency section \*/\n)"
        r"(.*?)"
        r"(/\* End XCSwiftPackageProductDependency section \*/)",
        text,
        flags=re.DOTALL,
    )
    if not section_match:
        print("warning: no XCSwiftPackageProductDependency section; nothing to patch")
        return 0

    prefix, body, suffix = section_match.group(1), section_match.group(2), section_match.group(3)

    def patch_block(block: str) -> str:
        if "package =" in block:
            return block
        # Insert package line after isa.
        return re.sub(
            r"(isa = XCSwiftPackageProductDependency;\n)",
            rf"\1\t\t\tpackage = {package_id} /* XCLocalSwiftPackageReference */;\n",
            block,
            count=1,
        )

    blocks = re.split(r"(?=\t\t[A-F0-9]{24} /\* )", body)
    patched_body = "".join(patch_block(b) if "XCSwiftPackageProductDependency" in b else b for b in blocks)
    new_text = text[: section_match.start()] + prefix + patched_body + suffix + text[section_match.end() :]

    if new_text == text:
        print("local package backlinks already present")
        return 0

    PBXPROJ.write_text(new_text, encoding="utf-8")
    print(f"patched local package backlinks → {package_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

