/* =========================================================================
   Calcula.AI — sw.js
   Service worker: guarda o site no aparelho para ele abrir sem internet.

   Como atualizar: troque o numero da VERSAO. O navegador vai baixar tudo
   de novo e apagar o pacote antigo. Sem isso, o celular continua abrindo
   a versao guardada mesmo depois de voce publicar mudancas.
   ========================================================================= */

const VERSAO = "calcula-ai-v2";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.svg",
  "./css/themes.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/calc.css",
  "./css/lists.css",
  "./css/operacao.css",
  "./css/utils.css",
  "./css/mobile.css",
  "./js/storage.js",
  "./js/theme.js",
  "./js/calculator.js",
  "./js/negocio.js",
  "./js/chart.js",
  "./js/ui/core.js",
  "./js/ui/printers.js",
  "./js/ui/rolos.js",
  "./js/ui/produtos.js",
  "./js/ui/vendas.js",
  "./js/ui/despesas.js",
  "./js/ui/painel.js",
  "./js/ui/material-rows.js",
  "./js/ui/calc.js",
  "./js/ui/result.js",
  "./js/ui/settings.js",
  "./js/main.js",
  "./icons/icone-192.png",
  "./icons/icone-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // A pagina em si vem da rede quando da, para voce receber as atualizacoes;
  // offline, cai na copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
          return r;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Arquivos (css, js, icones, e o Chart.js do CDN) saem da copia local,
  // que e instantanea, e sao atualizados em segundo plano.
  e.respondWith(
    caches.match(req).then((guardado) => {
      const rede = fetch(req)
        .then((r) => {
          if (r && (r.ok || r.type === "opaque")) {
            const copia = r.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return r;
        })
        .catch(() => guardado);
      return guardado || rede;
    })
  );
});
