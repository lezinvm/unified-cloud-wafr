"""Check framework package.

Public entry point for the engine:
    from checks import get_provider
    provider = get_provider("gcp")   # or "aws" / "azure"

Each provider module (gcp_checks.py, aws_checks.py, azure_checks.py) registers
its checks against a shared Provider (see base.py). To add a new cloud, add a
`<name>_checks.py` module that creates a Provider(name, catalog_column=...) and
registers checks the same way.
"""
from .base import Provider, get_provider, PROVIDERS, rollup  # noqa: F401
