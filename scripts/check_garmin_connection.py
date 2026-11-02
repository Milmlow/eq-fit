"""Privacy-preserving smoke test for the official Garmin Connect Personal API.

Used by a manually triggered GitHub Actions workflow. Never prints the API key,
bearer token, profile, activities, or raw HTTP response bodies.
"""
from __future__ import annotations

import os
import sys


def main() -> int:
    key = os.environ.get("GARMIN_PERSONAL_API_KEY", "").strip()
    if not key:
        print(
            "MISSING SECRET: Create GARMIN_PERSONAL_API_KEY in "
            "Settings > Secrets and variables > Actions > Secrets. "
            "An Actions VARIABLE is not a secret.",
            file=sys.stderr,
        )
        return 2

    try:
        from garmin_personal_api import GarminPersonalApiClient, PersonalApiAuthenticator
        from garmin_personal_api.errors import HttpError

        # GitHub-hosted runners are ephemeral. Tokens are never persisted to
        # the repository, build output, action artifacts, or GitHub Pages.
        with PersonalApiAuthenticator(timeout=25) as auth:
            bearer = auth.obtain_token(key)
        with GarminPersonalApiClient(bearer.access_token, timeout=25) as client:
            # Read access only. Intentionally discard the response: even
            # activity counts and titles should not appear in public CI logs.
            client.search_activities(start=0, limit=1)
    except HttpError as exc:
        status = exc.status_code
        if status in (401, 403):
            print(
                f"Garmin rejected the request (HTTP {status}). "
                "Check that the current Personal API key is valid and "
                "authorised for activities.",
                file=sys.stderr,
            )
        else:
            print(
                f"Garmin request failed (HTTP {status}). "
                "No private Garmin response has been printed.",
                file=sys.stderr,
            )
        return 1
    except Exception:
        # The underlying exception can contain request URLs or server
        # response text. Never dump tracebacks in public CI logs.
        print(
            "Garmin check failed before a successful activity request. "
            "Verify the secret, Personal API access, and Garmin availability. "
            "No personal data has been printed.",
            file=sys.stderr,
        )
        return 1

    print(
        "SUCCESS: Garmin Personal API authentication and read-only "
        "activities access both work. No activities were saved or published."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
