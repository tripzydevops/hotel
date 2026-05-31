#!/usr/bin/env python3
"""
OpenAPI Specification Generator

Generates the openapi.json file from the FastAPI application.
Used for:
  - SOC 2 audit evidence (API inventory)
  - DAST security scanning (Snyk, OWASP ZAP)
  - Hotel chain procurement questionnaires
  - HTNG/OpenTravel alignment documentation

Usage:
    python scripts/generate_openapi.py
    python scripts/generate_openapi.py --output docs/openapi.json
"""

import json
import os
import sys
import argparse

# Ensure the project root is in the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)


def generate_openapi_spec(output_path: str = "openapi.json") -> None:
    """Extract and save the OpenAPI schema from the FastAPI application."""
    # Load environment before importing the app
    from backend.utils.db import load_env_standard
    load_env_standard()

    from backend.main import app

    schema = app.openapi()

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    route_count = sum(
        len(methods)
        for methods in schema.get("paths", {}).values()
    )
    print(f"✅ OpenAPI spec generated: {output_path}")
    print(f"   Version: {schema.get('info', {}).get('version', 'unknown')}")
    print(f"   Paths: {len(schema.get('paths', {}))}")
    print(f"   Operations: {route_count}")
    print(f"   Schemas: {len(schema.get('components', {}).get('schemas', {}))}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate OpenAPI spec from FastAPI app")
    parser.add_argument(
        "--output", "-o",
        default="openapi.json",
        help="Output file path (default: openapi.json)"
    )
    args = parser.parse_args()
    generate_openapi_spec(args.output)
