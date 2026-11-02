"""
Calcula.AI — API de dados
=========================
Guarda as colecoes do app (rolos, produtos, registros, despesas e ajustes)
num SQLite, para o celular e o PC enxergarem os mesmos dados.

O desenho e proposital de simples: cada colecao e gravada inteira, com a
hora da ultima alteracao. Sao dezenas de registros, nao milhares, entao
nao compensa sincronizar item a item. Quem tiver a versao mais nova vence.
"""
import json
import pathlib
import sqlite3
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

BANCO = pathlib.Path("/opt/calcula-ai/dados/calcula.db")
COLECOES = {"rolos", "produtos", "registros", "despesas", "negocio",
            "impressoras", "ajustes"}

app = FastAPI(title="Calcula.AI", docs_url="/api/docs", openapi_url="/api/openapi.json")


def conexao() -> sqlite3.Connection:
    BANCO.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(BANCO, timeout=10)
    c.execute("""create table if not exists colecoes (
                   nome text primary key,
                   dados text not null,
                   atualizado_em integer not null)""")
    return c


class Envio(BaseModel):
    dados: Any
    atualizadoEm: int | None = None


@app.get("/api/saude")
def saude():
    """Serve para o site descobrir se o servidor esta no ar."""
    return {"ok": True, "hora": int(time.time() * 1000)}


@app.get("/api/estado")
def estado():
    """Tudo que o servidor tem, com a hora de cada colecao."""
    with conexao() as c:
        linhas = c.execute("select nome, dados, atualizado_em from colecoes").fetchall()
    return {nome: {"dados": json.loads(dados), "atualizadoEm": quando}
            for nome, dados, quando in linhas}


@app.put("/api/colecao/{nome}")
def gravar(nome: str, envio: Envio):
    """Grava uma colecao inteira. A hora vem do cliente, ou e a de agora."""
    if nome not in COLECOES:
        raise HTTPException(status_code=400, detail=f"colecao desconhecida: {nome}")
    quando = envio.atualizadoEm or int(time.time() * 1000)
    with conexao() as c:
        c.execute("""insert into colecoes (nome, dados, atualizado_em)
                     values (?, ?, ?)
                     on conflict(nome) do update set
                       dados = excluded.dados,
                       atualizado_em = excluded.atualizado_em""",
                  (nome, json.dumps(envio.dados, ensure_ascii=False), quando))
    return {"ok": True, "atualizadoEm": quando}
