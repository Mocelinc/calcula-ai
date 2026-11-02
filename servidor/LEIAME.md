# Servidor de casa

O que faz o celular e o PC enxergarem os mesmos dados. Sem isto, o app
continua funcionando — só que cada aparelho guarda os seus.

```
navegador  ──►  Caddy (container, porta 8081)  ──┬──►  arquivos do site
                                                 └──►  /api  →  FastAPI (porta 8001)  →  SQLite
```

O Caddy serve o site e repassa `/api` para a API, então os dois moram no
mesmo endereço e o navegador não precisa lidar com origem cruzada.

## Arquivos

| Arquivo | Onde vive no servidor |
| --- | --- |
| `api/main.py` | roda de dentro do clone, em `/opt/calcula-ai/site/servidor/api` |
| `Caddyfile` | montado no container do site |
| `calcula-api.service` | copiado para `/etc/systemd/system/` |

O banco fica em `/opt/calcula-ai/dados/calcula.db`, fora do clone, e entra
no backup diário junto com a configuração do Cosmos.

## Instalação (uma vez)

```sh
sudo python3 -m venv /opt/calcula-ai/api/venv
sudo /opt/calcula-ai/api/venv/bin/pip install fastapi uvicorn
sudo cp /opt/calcula-ai/site/servidor/calcula-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now calcula-api

sudo docker rm -f calcula-ai
sudo docker run -d --name calcula-ai --restart unless-stopped -p 8081:80 \
  -v /opt/calcula-ai/site:/usr/share/caddy:ro \
  -v /opt/calcula-ai/site/servidor/Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:alpine
```

## Atualizar

`/opt/calcula-ai/atualizar.sh` puxa o repositório e reinicia a API. O site
é servido direto do clone, então ele atualiza sozinho.

## Como a sincronização pensa

Cada coleção (rolos, produtos, registros, despesas, ajustes) viaja inteira,
com a hora da última alteração. Quem tiver a hora mais nova vence. São
dezenas de registros, não milhares — sincronizar item a item seria mais
código para um problema que não existe nesta escala.

O limite honesto disso: se você editar a **mesma** coleção nos dois
aparelhos enquanto um deles está sem rede, a que subir depois sobrescreve
a outra. Coleções diferentes ao mesmo tempo não se atrapalham.
