"""DEV-313 — the code the scaffold writes into every app on the template is in English: its comments, docstrings and
test names carry no Slovak sentence. A screen text or a person's words may stand in a quotation on one line
(„Moje konto“); the documentation (docs/, *.md) and the texts the app shows people stay Slovak.

The cockpit holds a version's code to the same rule (the code a customer gets is English) and stops the build on a
Slovak comment. 05.11.2026 the NEX Manager 1.5.4 build stopped so on the scaffold's own guard files, copied into the app
as the brief asked — the Slovak came from here, not from the agent. So the scaffold is held to it before any app gets
it: every template is filled as the cockpit fills it (render.render, for every sign-in) and every file of the filled app
is read by its kind; a file of a kind this guard cannot read fails here too."""

from __future__ import annotations

import ast
import io
import re
import sys
import tokenize
from collections.abc import Iterator
from pathlib import Path

import pytest

SCAFFOLD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCAFFOLD))

import render  # noqa: E402

#: A name with Slovak letters: a value the renderer writes into a comment must stand quoted there.
VALUES = {
    "app_name": "NEX Skúška",
    "app_initials": "NS",
    "slug": "nex-skuska",
    "auth": "password",
    "ai": True,
    "backend_port": 18000,
    "frontend_port": 18001,
    "db_port": 18002,
    "kit_frontend": "github:rauschiccsk/nex-app-kit#v0.11.1",
    "kit_server": "nex-app-kit @ https://github.com/rauschiccsk/nex-app-kit/archive/refs/tags/v0.11.1.tar.gz#subdirectory=server",
}

#: Letters only Slovak (of the languages met in code) writes — the mechanical sign of a Slovak sentence.
SLOVAK_LETTERS = re.compile(r"[áäčďéíľĺňóôŕšťúýž]", re.IGNORECASE)
#: A quotation on one line — „…“ (or „…” / „…") as Slovak writes it, "…" or `…`. Its words are a screen's or a person's
#: and are kept as they are; a quotation over two lines is a Slovak sentence like any other.
QUOTED = re.compile(r"„[^„“”\n]*[“”]|„[^„“”\"\n]*\"|\"[^\"\n]*\"|`[^`\n]*`")
#: it("…"), test("…"), describe("…") and their .each/.only/.skip — the name of a test in a script.
TEST_TITLE = re.compile(
    r"\b(?:it|test|describe)(?:\.(?:each|only|skip)(?:\([^)]*\))?)?\(\s*([\"'`])((?:\\.|(?!\1).)*)\1"
)

PYTHON = {".py"}
SCRIPT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
BLOCK_COMMENTS = {".css"}
MARKUP = {".html", ".svg"}
#: .template-block — the env/ block of the sign-in, which the renderer writes as .env.example.template-block.
HASH = {
    ".toml",
    ".ini",
    ".yml",
    ".yaml",
    ".conf",
    ".env",
    ".sh",
    ".mako",
    ".gitignore",
    ".dockerignore",
    ".template-block",
}
#: Kinds with no comment to read: data, documentation (Slovak by the rule), an empty placeholder.
NO_COMMENTS = {".json", ".webmanifest", ".md", ".gitkeep"}


def templates() -> list[Path]:
    """Every template of the scaffold — a folder with the env/ blocks the renderer fills (render.render)."""
    return sorted(d for d in SCAFFOLD.iterdir() if d.is_dir() and (d / "env").is_dir())


def cases() -> list[tuple[Path, str]]:
    """Every template with every sign-in the renderer knows (render.AUTH_ENV)."""
    return [(template, auth) for template in templates() for auth in sorted(render.AUTH_ENV)]


def filled(template: Path, auth: str, target: Path) -> Path:
    """The app the cockpit writes from *template* for one sign-in."""
    render.render(template.name, {**VALUES, "auth": auth}, target)
    return target


def files(root: Path) -> list[Path]:
    return sorted(
        p
        for p in root.rglob("*")
        if p.is_file() and not {"__pycache__", "node_modules"} & set(p.relative_to(root).parts)
    )


def kind(path: Path) -> str | None:
    """How the comments of *path* are read — None for a kind this guard does not know."""
    name = path.name
    suffix = path.suffix or name  # .gitignore, .dockerignore, .gitkeep have their name for a suffix
    if name.startswith("Dockerfile"):
        return "hash"
    for label, suffixes in (
        ("python", PYTHON),
        ("script", SCRIPT),
        ("block", BLOCK_COMMENTS),
        ("markup", MARKUP),
        ("hash", HASH),
        ("none", NO_COMMENTS),
    ):
        if suffix in suffixes:
            return label
    return None


def is_test(relative: Path) -> bool:
    text = relative.as_posix()
    return bool(re.search(r"(^|/)(tests?|__tests__)/|\.test\.|(^|/)test_", text))


def _python(source: str, test: bool) -> Iterator[tuple[int, str]]:
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type == tokenize.COMMENT:
            yield tok.start[0], tok.string
    for node in ast.walk(ast.parse(source)):
        if test and isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.name.startswith(("test", "Test")):
                yield node.lineno, node.name
        body = getattr(node, "body", None)
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and body:
            first = body[0]
            value = first.value if isinstance(first, ast.Expr) else None
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                for offset, line in enumerate(value.value.split("\n")):
                    yield first.lineno + offset, line
        if test and isinstance(node, ast.Assert) and node.msg is not None:
            for sub in ast.walk(node.msg):
                if isinstance(sub, ast.Constant) and isinstance(sub.value, str):
                    yield sub.lineno, sub.value


def _script(source: str, test: bool) -> Iterator[tuple[int, str]]:
    """// and /* */ comments outside string literals; in a test also the test names."""
    line, i, n, quote = 1, 0, len(source), None
    while i < n:
        c = source[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            line += c == "\n"
            quote = None if c == quote else quote
            i += 1
            continue
        if c in "\"'`":
            quote = c
        elif source.startswith("//", i):
            end = source.find("\n", i)
            end = n if end < 0 else end
            yield line, source[i:end]
            i = end
            continue
        elif source.startswith("/*", i):
            end = source.find("*/", i + 2)
            end = n if end < 0 else end + 2
            yield from _lines(line, source[i:end])
            line += source.count("\n", i, end)
            i = end
            continue
        line += c == "\n"
        i += 1
    if test:
        for number, text in enumerate(source.splitlines(), 1):
            for m in TEST_TITLE.finditer(text):
                yield number, m.group(2)


def _lines(first: int, text: str) -> Iterator[tuple[int, str]]:
    for offset, line in enumerate(text.split("\n")):
        yield first + offset, line


def _blocks(source: str, opening: str, closing: str) -> Iterator[tuple[int, str]]:
    for m in re.finditer(re.escape(opening) + r".*?" + re.escape(closing), source, re.DOTALL):
        yield from _lines(source.count("\n", 0, m.start()) + 1, m.group(0))


def _hash(source: str) -> Iterator[tuple[int, str]]:
    """# to the end of the line, from the first # outside quotes."""
    for number, text in enumerate(source.splitlines(), 1):
        quote = None
        for i, ch in enumerate(text):
            if quote:
                quote = None if ch == quote else quote
            elif ch in "\"'":
                quote = ch
            elif ch == "#":
                yield number, text[i:]
                break


def comments(path: Path, source: str, test: bool) -> Iterator[tuple[int, str]]:
    """(line, text) of every comment, docstring line and — in a test — test name and assertion message of a file."""
    label = kind(path)
    if label == "python":
        yield from _python(source, test)
    elif label == "script":
        yield from _script(source, test)
    elif label == "block":
        yield from _blocks(source, "/*", "*/")
    elif label == "markup":
        yield from _blocks(source, "<!--", "-->")
    elif label == "hash":
        yield from _hash(source)


def slovak(text: str) -> bool:
    return bool(SLOVAK_LETTERS.search(QUOTED.sub("", text)))


def slovak_lines(root: Path) -> list[str]:
    found = []
    for path in files(root):
        relative = path.relative_to(root)
        source = path.read_text(encoding="utf-8")
        lines = {number: text for number, text in comments(path, source, is_test(relative)) if slovak(text)}
        found += [f"{relative}:{number}: {lines[number].strip()[:120]}" for number in sorted(lines)]
    return found


def test_every_template_is_read_with_every_sign_in():
    assert "nsv-standard" in [t.name for t in templates()]
    for template in templates():
        assert {auth for t, auth in cases() if t == template} == set(render.AUTH_ENV)


@pytest.mark.parametrize(("template", "auth"), cases(), ids=lambda case: getattr(case, "name", case))
def test_every_file_of_the_app_is_of_a_kind_the_guard_reads(template, auth, tmp_path):
    app = filled(template, auth, tmp_path)
    unknown = [str(p.relative_to(app)) for p in files(app) if kind(p) is None]
    assert unknown == [], "the guard does not know how comments are written in these files — add their kind above"


@pytest.mark.parametrize(("template", "auth"), cases(), ids=lambda case: getattr(case, "name", case))
def test_the_code_an_app_gets_has_no_slovak_comment(template, auth, tmp_path):
    app = filled(template, auth, tmp_path)
    read = {kind(p) for p in files(app)}
    assert {"python", "script", "hash", "markup"} <= read  # the guard read the code, not an empty folder
    assert (app / ".env.example.template-block").is_file()  # … and what the renderer wrote, not the bare template
    assert slovak_lines(app) == []


def test_a_file_of_an_unknown_kind_is_not_taken_for_one_without_comments():
    assert [kind(Path(p)) for p in ("deploy.rb", "logo.png", "Makefile")] == [None, None, None]


def test_tests_are_told_from_the_app_code():
    tests = ["frontend/src/test/App.test.tsx", "frontend/src/test/sharedCopies.ts", "backend/tests/test_frame.py"]
    code = ["frontend/src/App.tsx", "frontend/src/main.tsx", "backend/app/kit.py"]
    assert [is_test(Path(p)) for p in tests + code] == [True, True, True, False, False, False]


@pytest.mark.parametrize(
    ("name", "source", "test", "line"),
    [
        ("a.py", "x = 1  # Prehľad aplikácie\n", False, 1),
        ("a.py", '"""Server aplikácie."""\n', False, 1),
        ("a.py", 'def f():\n    """Vráti\n    sumu."""\n', False, 2),
        ("test_a.py", "def test_vrati_sumu_é():\n    pass\n", True, 1),
        ("test_a.py", 'def test_a():\n    assert 1, "zlá suma"\n', True, 2),
        ("a.ts", "const a = 1; // Prehľad\n", False, 1),
        ("a.ts", "/**\n * Náhľad\n */\nconst a = 1;\n", False, 2),
        ("a.test.ts", 'it("ukáže prehľad", () => {});\n', True, 1),
        ("a.css", "/* Farby aplikácie — tmavé */\n", False, 1),
        ("index.html", "<!-- Aby sa dala nainštalovať\n ako program -->\n", False, 1),
        ("nginx.conf", "    # Úvodná stránka sa neukladá\n", False, 1),
        ("Dockerfile", "# Obraz servera aplikácie\nFROM python\n", False, 1),
        ("a.ts", "// The Director: „… aby nič\n// také už nebolo.“\n", False, 1),
        ("test_a.py", 'def test_a():\n    assert 1, "„… aby nič\\ntaké už nebolo.“"\n', True, 2),
    ],
)
def test_the_guard_finds_a_slovak_comment_of_every_kind(name, source, test, line):
    path = Path(name)
    assert [n for n, text in comments(path, source, test) if slovak(text)][:1] == [line]


@pytest.mark.parametrize(
    ("name", "source", "test"),
    [
        ("a.py", 'title = "Prehľad"  # the page „Prehľad“\n', False),
        ("a.ts", 'const title = "Prehľad"; // `Moje konto` and "Nastavenia"\n', False),
        ("a.ts", 'const url = "http://x//y"; const t = "Úvod";\n', False),
        ("a.test.ts", 'it("shows the page „Prehľad“", () => expect("Prehľad").toBe("Prehľad"));\n', True),
        ("index.html", '<p title="Prehľad">Prehľad aplikácie</p>\n', False),
        ("a.env", 'NAME="Moja aplikácia"  # the name „Moja aplikácia“\n', False),
        ("a.env", 'TITLE="#1 Úvod"\n', False),
    ],
)
def test_the_guard_leaves_texts_for_people_and_quotations_alone(name, source, test):
    assert [text for _, text in comments(Path(name), source, test) if slovak(text)] == []
