# The server of the app. Built with the compose contexts `frontend` (app.manifest.json — the frontend reads it too)
# and `docs` (Aktualizácie, Ako začať). The dependencies come first, so a change in the code does not reinstall them.
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
RUN python -c "import tomllib; print('\n'.join(tomllib.load(open('pyproject.toml', 'rb'))['project']['dependencies']))" > /tmp/requirements.txt \
    && pip install --no-cache-dir -r /tmp/requirements.txt
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY --from=frontend app.manifest.json /app/app.manifest.json
COPY --from=docs AKO_ZACAT.md /app/docs/AKO_ZACAT.md
COPY --from=docs specs/versions /app/docs/specs/versions
ENV APP_MANIFEST_PATH=/app/app.manifest.json APP_DOCS_DIR=/app/docs
USER 1000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
