name: Update Database

on:
  repository_dispatch:
    types: [update_database]

jobs:
  update-json:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: Update datastore.json
        env:
          # This captures the payload (uid/aid) from your website's dispatch
          PAYLOAD: ${{ toJson(github.event.client_payload) }}
        run: |
          # This script assumes you have created 'update_script.py' in your root
          # to parse the PAYLOAD environment variable and edit datastore.json
          python3 update_script.py "$PAYLOAD"

      - name: Commit and push changes
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git add medalDatabase/datastore.json
          git commit -m "Auto-update datastore with new asset ID"
          git push
