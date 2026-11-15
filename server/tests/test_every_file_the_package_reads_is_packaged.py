"""DEV-394 — every file of the package that is not Python goes into the installed package.

15.11.2026 the catalogs of the server's sentences (``locales/*.json``) were missing from the installed package: the
package's own tests run from the source tree (an editable install), and only an app on the template, which installs the
package from its archive, stopped at the first import (``FileNotFoundError: …/nex_app_kit/locales/sk.json``). A rule,
not a list: every non-Python file under the package must be named by the package data of ``pyproject.toml``."""

from __future__ import annotations

import fnmatch
import tomllib
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]
PACKAGE = SERVER / "src" / "nex_app_kit"


def test_every_data_file_is_named_by_the_package_data():
    patterns = tomllib.loads((SERVER / "pyproject.toml").read_text(encoding="utf-8"))["tool"]["setuptools"][
        "package-data"
    ]["nex_app_kit"]
    data = [
        p.relative_to(PACKAGE).as_posix()
        for p in PACKAGE.rglob("*")
        if p.is_file()
        and "__pycache__" not in p.parts
        and p.suffix not in (".py", ".pyc")
        and ".egg-info" not in str(p)
    ]

    assert data, "no data file found — the rule would pass on nothing"
    assert [f for f in data if not any(fnmatch.fnmatch(f, pattern) for pattern in patterns)] == []
