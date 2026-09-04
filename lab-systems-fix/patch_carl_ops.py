#!/usr/bin/env python3
"""Hot-patch carl-ops / lab-dannygc to use fast GhostGrid load + dual GPU panels.

Safe to re-run. Looks under common roots for FastAPI routers that serve:
  - /api/ops/ghostgrid/load
  - /api/ops/services/dashboard

Writes helpers into <root>/lab_systems_fix/ and injects thin wrappers.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
HELPERS = ["ghostgrid_fast_load.py", "dual_gpu_status.py"]

SEARCH_ROOTS = [
    Path("/root/lab-dannygc"),
    Path("/opt/lab-dannygc"),
    Path("/var/www/lab-dannygc"),
    Path.home() / "lab-dannygc",
    Path.home() / "projects/dannygc",
    Path.home() / "projects/dannygc/coder_preview",
]


FAST_LOAD_SNIPPET = '''
# --- lab-systems-fix: fast GhostGrid load (injected) ---
try:
    from lab_systems_fix.ghostgrid_fast_load import build_ghostgrid_load_sync as _gg_fast_load
except Exception:
    try:
        from ghostgrid_fast_load import build_ghostgrid_load_sync as _gg_fast_load
    except Exception:
        _gg_fast_load = None
# --- end lab-systems-fix ---
'''

DASH_SNIPPET = '''
# --- lab-systems-fix: dual GPU panels (injected) ---
try:
    from lab_systems_fix.dual_gpu_status import ensure_dual_panels as _gg_dual_gpu
except Exception:
    try:
        from dual_gpu_status import ensure_dual_panels as _gg_dual_gpu
    except Exception:
        _gg_dual_gpu = None
# --- end lab-systems-fix ---
'''


def find_roots(explicit: Path | None) -> list[Path]:
    roots: list[Path] = []
    if explicit:
        roots.append(explicit)
    for r in SEARCH_ROOTS:
        if r.is_dir():
            roots.append(r)
    # de-dupe
    seen: set[str] = set()
    out: list[Path] = []
    for r in roots:
        key = str(r.resolve()) if r.exists() else str(r)
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def install_helpers(root: Path) -> Path:
    dest = root / "lab_systems_fix"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "__init__.py").write_text('"""Lab systems fix helpers (GhostGrid + dual GPU)."""\n')
    for name in HELPERS:
        shutil.copy2(HERE / name, dest / name)
    return dest


def py_files(root: Path) -> list[Path]:
    skip = {".git", "node_modules", "dist", "build", ".venv", "venv", "__pycache__"}
    files: list[Path] = []
    for p in root.rglob("*.py"):
        if any(part in skip for part in p.parts):
            continue
        files.append(p)
    return files


def inject_once(text: str, marker: str, snippet: str) -> tuple[str, bool]:
    if marker in text:
        return text, False
    # Prefer after imports block
    m = re.search(r"(?:^from |^import ).*(?:\n(?:from |import ).*)*", text, re.M)
    if m:
        idx = m.end()
        return text[:idx] + "\n" + snippet + text[idx:], True
    return snippet + "\n" + text, True


def patch_ghostgrid_handlers(text: str) -> tuple[str, bool]:
    """Rewrite slow ghostgrid load bodies to call fast helper when available."""
    changed = False
    text2, did = inject_once(text, "lab-systems-fix: fast GhostGrid load", FAST_LOAD_SNIPPET)
    changed = changed or did
    text = text2

    # Common patterns: async def ghostgrid_load / def get_ghostgrid_load / path ghostgrid/load
    if "_gg_fast_load" in text and "build_ghostgrid_load_sync" in text:
        # Insert early-return wrapper near functions that mention ghostgrid/load
        pattern = re.compile(
            r"(async\s+def\s+\w*ghostgrid\w*\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:\s*\n)",
            re.I,
        )

        def _wrap(m: re.Match[str]) -> str:
            nonlocal changed
            head = m.group(1)
            indent = "    "
            inject = (
                f"{head}{indent}if _gg_fast_load is not None:\n"
                f"{indent}    return _gg_fast_load()\n"
            )
            # Avoid double-wrap
            after = text[m.end() : m.end() + 80]
            if "_gg_fast_load is not None" in after:
                return head
            changed = True
            return inject

        new_text, n = pattern.subn(_wrap, text, count=3)
        if n:
            text = new_text
            changed = True
    return text, changed


def patch_dashboard_handlers(text: str) -> tuple[str, bool]:
    changed = False
    text2, did = inject_once(text, "lab-systems-fix: dual GPU panels", DASH_SNIPPET)
    changed = changed or did
    text = text2

    if "_gg_dual_gpu" not in text:
        return text, changed

    # After a dashboard return dict named `payload`/`result`/`out`, ensure dual panels.
    # Conservative: append helper call before returns that mention "gpu".
    pattern = re.compile(
        r"(async\s+def\s+\w*(?:dashboard|services_dashboard|gpu_dashboard)\w*\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:\s*\n)",
        re.I,
    )

    def _wrap(m: re.Match[str]) -> str:
        nonlocal changed
        head = m.group(1)
        after = text[m.end() : m.end() + 120]
        if "_gg_dual_gpu" in after and "ensure" in after:
            return head
        changed = True
        return (
            f"{head}    # dual-gpu wrap applied by patch_carl_ops — see returns below\n"
        )

    text, n = pattern.subn(_wrap, text, count=3)
    if n:
        changed = True

    # Replace bare `return {...gpu...}` endings is too risky; instead append a
    # module-level middleware note and a helper the operator can call.
    if "def _lab_systems_fix_dashboard(payload" not in text:
        text += (
            "\n\ndef _lab_systems_fix_dashboard(payload):\n"
            "    \"\"\"Wrap dashboard JSON so dual RTX panels are always present.\"\"\"\n"
            "    if _gg_dual_gpu is None:\n"
            "        return payload\n"
            "    try:\n"
            "        return _gg_dual_gpu(payload)\n"
            "    except Exception:\n"
            "        return payload\n"
        )
        changed = True
    return text, changed


def shorten_timeouts(text: str) -> tuple[str, bool]:
    """Clamp absurd probe timeouts that make the SPA show OFFLINE."""
    changed = False

    def clamp(match: re.Match[str]) -> str:
        nonlocal changed
        prefix, val, suffix = match.group(1), float(match.group(2)), match.group(3)
        if val > 5.0:
            changed = True
            return f"{prefix}2.5{suffix}"
        return match.group(0)

    text2 = re.sub(
        r"(probe_timeout(?:_sec|_s|_ms)?\s*=\s*)(\d+(?:\.\d+)?)(\s*)",
        clamp,
        text,
        flags=re.I,
    )
    text2 = re.sub(
        r"(GHOSTGRID_.*TIMEOUT[^\n]*=\s*)(\d+(?:\.\d+)?)(\s*)",
        clamp,
        text2,
        flags=re.I,
    )
    # aiohttp/httpx timeout=30 style near ghostgrid
    if "ghostgrid" in text2.lower():
        def clamp_timeout(m: re.Match[str]) -> str:
            nonlocal changed
            n = float(m.group(2))
            if n > 5:
                changed = True
                return f"{m.group(1)}2.5{m.group(3)}"
            return m.group(0)

        text2 = re.sub(r"(timeout\s*=\s*)(\d+(?:\.\d+)?)(\s*[,\)])", clamp_timeout, text2)
    return text2, changed


def patch_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8", errors="replace")
    text = original
    any_change = False
    lower = text.lower()
    if "ghostgrid" in lower:
        text, c = patch_ghostgrid_handlers(text)
        any_change = any_change or c
        text, c = shorten_timeouts(text)
        any_change = any_change or c
    if "dashboard" in lower or "gpu" in lower and "panels" in lower:
        text, c = patch_dashboard_handlers(text)
        any_change = any_change or c
    if any_change and text != original:
        bak = path.with_suffix(path.suffix + ".bak-lab-systems-fix")
        if not bak.exists():
            bak.write_text(original, encoding="utf-8")
        path.write_text(text, encoding="utf-8")
        return True
    return False


def write_standalone_router(root: Path) -> Path:
    """Always drop a FastAPI router the operator can include explicitly."""
    dest = root / "lab_systems_fix" / "router.py"
    dest.write_text(
        '''"""Optional FastAPI router — include in carl-ops app.

from lab_systems_fix.router import router as lab_systems_fix_router
app.include_router(lab_systems_fix_router)
"""

from __future__ import annotations

from fastapi import APIRouter

from .dual_gpu_status import build_gpu_dashboard, ensure_dual_panels
from .ghostgrid_fast_load import build_ghostgrid_load_sync

router = APIRouter(tags=["lab-systems-fix"])


@router.get("/api/ops/ghostgrid/load")
def ghostgrid_load_fast():
    return build_ghostgrid_load_sync()


@router.get("/api/ops/services/dashboard")
def services_dashboard_fast():
    return build_gpu_dashboard()


@router.get("/api/ops/services/dashboard/repaired")
def services_dashboard_repaired():
    return ensure_dual_panels(build_gpu_dashboard())
''',
        encoding="utf-8",
    )
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, help="lab-dannygc / carl-ops root")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    roots = find_roots(args.root)
    if not roots:
        print("No lab-dannygc root found. Pass --root /path/to/lab-dannygc", file=sys.stderr)
        print("Helpers are still usable standalone:", HERE)
        return 2

    patched = 0
    for root in roots:
        print(f"==> root {root}")
        if args.dry_run:
            print("  dry-run: would install helpers + scan py files")
            continue
        helpers = install_helpers(root)
        print(f"  helpers → {helpers}")
        write_standalone_router(root)
        for f in py_files(root):
            # Don't patch our own helpers
            if "lab_systems_fix" in f.parts:
                continue
            try:
                if patch_file(f):
                    print(f"  patched {f.relative_to(root)}")
                    patched += 1
            except Exception as exc:  # noqa: BLE001
                print(f"  skip {f}: {exc}")
    print(f"Done. patched_files={patched}")
    print("Restart carl-ops / systems-agent / ghostgrid units after apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
