### se devo rimuovere un articolo mi basta fare "git rm" e poi lancio lo script e lui rimuove il file statico?

Quasi: `git rm` da solo non basta, perché `articles.json` continuerebbe a elencare l’articolo e il generatore proverebbe a leggerlo, fallendo.

Fai così:

1. `git rm "content/nome-del-file.md"`
2. Rimuovi lo stesso nome da `articles.json`.
3. Lancia `python3 generate_article_pages.py`.

Il generatore toglierà la pagina statica corrispondente e aggiornerà il manifest.