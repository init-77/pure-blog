import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONTENT_DIRECTORY = ROOT / "content"
POSTS_DIRECTORY = ROOT / "posts"
ARTICLES_INDEX = CONTENT_DIRECTORY / "articles.json"
ARTICLE_TEMPLATE = ROOT / "article.html"
MANIFEST = POSTS_DIRECTORY / ".generated-pages.json"


def slugify(title):
    normalized = unicodedata.normalize("NFD", title)
    normalized = "".join(character for character in normalized if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def read_previous_pages():
    if not MANIFEST.exists():
        return set()

    pages = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if not isinstance(pages, list) or any(
        not isinstance(page, str) or not re.fullmatch(r"[a-z0-9-]+\.html", page)
        for page in pages
    ):
        raise ValueError("Manifest delle pagine generate non valido")
    return set(pages)


def main():
    article_files = json.loads(ARTICLES_INDEX.read_text(encoding="utf-8"))
    if not isinstance(article_files, list) or any(
        not isinstance(filename, str) or not re.fullmatch(r"[^/]+\.md", filename, re.IGNORECASE)
        for filename in article_files
    ):
        raise ValueError("Indice degli articoli non valido")

    pages = {}
    for filename in article_files:
        filename_slug = re.sub(r"^\d{8}\s*-\s*", "", Path(filename).stem)
        slug = slugify(filename_slug)
        if not slug:
            raise ValueError(f"Slug vuoto per {filename}")
        page = f"{slug}.html"
        if page in pages:
            raise ValueError(f"Slug duplicato: {slug}")
        pages[page] = filename

    previous_pages = read_previous_pages()
    template = ARTICLE_TEMPLATE.read_text(encoding="utf-8")
    POSTS_DIRECTORY.mkdir(exist_ok=True)

    for old_page in previous_pages - pages.keys():
        (POSTS_DIRECTORY / old_page).unlink(missing_ok=True)

    for page in pages:
        destination = POSTS_DIRECTORY / page
        if destination.exists() and page not in previous_pages:
            raise FileExistsError(f"La pagina esiste ma non è gestita dal generatore: {destination}")
        destination.write_text(template, encoding="utf-8")

    MANIFEST.write_text(json.dumps(sorted(pages), indent=2) + "\n", encoding="utf-8")
    print(f"Generate {len(pages)} pagine in {POSTS_DIRECTORY.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()