### se devo rimuovere un articolo mi basta fare "git rm" e poi lancio lo script e lui rimuove il file statico?

Quasi: `git rm` da solo non basta, perché `articles.json` continuerebbe a elencare l’articolo e il generatore proverebbe a leggerlo, fallendo.

Fai così:

1. `git rm "content/nome-del-file.md"`
2. Rimuovi lo stesso nome da `articles.json`.
3. Lancia `python3 generate_article_pages.py`.

Il generatore toglierà la pagina statica corrispondente e aggiornerà il manifest.

## Attenzione: 
Modificare un articolo non necessariamente genera un nuovo html, anzi, la generazione va lanciata solo se si rimuovono o aggiungono articoli, perché il contenuto viene comunque preso dal markdown, non c'è una copia nel file dell'articolo statico (vedere il contenuto dell'html in posts per capirsi)