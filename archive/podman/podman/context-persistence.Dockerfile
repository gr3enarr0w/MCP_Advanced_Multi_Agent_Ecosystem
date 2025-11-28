FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/context-persistence

COPY src/mcp-servers/context-persistence/pyproject.toml ./pyproject.toml
COPY src/mcp-servers/context-persistence/src ./src

RUN pip install --upgrade pip setuptools wheel \
 && pip install -e .

WORKDIR /srv/context-persistence/src

CMD ["python3", "-m", "context_persistence.server"]
