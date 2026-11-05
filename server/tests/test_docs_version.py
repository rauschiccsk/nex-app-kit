"""DEV-307 — an app on the template reports the version of its newest release notes when nobody deploys one.

04.11.2026 NEX Knowledge carried „0.2.1“ in five places of its code; the cockpit's first PROD renamed its notes to
1.0.0, the code stayed 0.2.1 and the app's guard turned the main branch red. The version is no number in the code any
more: the cockpit passes APP_VERSION on every deploy, and without it the app is its newest release notes.
"""

from __future__ import annotations

from pathlib import Path

from nex_app_kit.docs import newest_version


def _notes(docs: Path, *versions: str) -> Path:
    for version in versions:
        folder = docs / "specs" / "versions" / version
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "RELEASE_NOTES.md").write_text(f"## {version}\n", encoding="utf-8")
    return docs


def test_the_newest_notes_by_number_not_by_name(tmp_path):
    docs = _notes(tmp_path, "v0.9.0", "v0.10.0", "v0.2.1")

    assert newest_version(docs) == "0.10.0"


def test_a_folder_without_notes_or_without_a_version_does_not_count(tmp_path):
    docs = _notes(tmp_path, "v0.2.1")
    (docs / "specs" / "versions" / "v1.0.0").mkdir()
    (docs / "specs" / "versions" / "draft").mkdir()
    (docs / "specs" / "versions" / "release-dates.json").write_text("{}", encoding="utf-8")

    assert newest_version(docs) == "0.2.1"


def test_without_notes_there_is_no_version(tmp_path):
    assert newest_version(tmp_path) is None
    assert newest_version(None) is None
