"""
Servicio de integración con Jira Cloud via OAuth 2.0 (3LO) con PKCE.
"""
import hashlib
import base64
import secrets
from typing import Optional

import httpx

from app.config import config, get_logger

logger = get_logger("jira")

JIRA_SCOPES = [
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    "offline_access",
]


class JiraService:
    """Atlassian Jira Cloud OAuth 2.0 + REST API v3."""

    AUTH_URL = "https://auth.atlassian.com/authorize"
    TOKEN_URL = "https://auth.atlassian.com/oauth/token"
    RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"

    @staticmethod
    def generate_pkce() -> tuple[str, str]:
        """Generate PKCE code_verifier and code_challenge."""
        code_verifier = secrets.token_urlsafe(64)[:128]
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
        return code_verifier, code_challenge

    def get_authorization_url(self, state: str, code_challenge: str) -> str:
        """Build the Atlassian OAuth authorization URL with PKCE."""
        from urllib.parse import urlencode

        params = {
            "audience": "api.atlassian.com",
            "client_id": config.JIRA_CLIENT_ID,
            "scope": " ".join(JIRA_SCOPES),
            "redirect_uri": config.JIRA_REDIRECT_URI,
            "state": state,
            "response_type": "code",
            "prompt": "consent",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str) -> dict:
        """
        Exchange authorization code for tokens.

        Returns:
            dict with access_token, refresh_token, expires_in, scope
        """
        data = {
            "grant_type": "authorization_code",
            "client_id": config.JIRA_CLIENT_ID,
            "client_secret": config.JIRA_CLIENT_SECRET,
            "code": code,
            "redirect_uri": config.JIRA_REDIRECT_URI,
            "code_verifier": code_verifier,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.TOKEN_URL, json=data)
            resp.raise_for_status()
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        """Refresh an expired Jira access token."""
        data = {
            "grant_type": "refresh_token",
            "client_id": config.JIRA_CLIENT_ID,
            "client_secret": config.JIRA_CLIENT_SECRET,
            "refresh_token": refresh_token,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.TOKEN_URL, json=data)
            resp.raise_for_status()
            return resp.json()

    async def get_accessible_resources(self, access_token: str) -> list[dict]:
        """Get Jira sites accessible with this token (returns cloud_id)."""
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            resp = await client.get(self.RESOURCES_URL, headers=headers)
            resp.raise_for_status()
            return resp.json()

    # ── Jira REST API v3 operations ──────────────────────────────

    def _api_base(self, cloud_id: str) -> str:
        return f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3"

    async def get_issues(
        self,
        access_token: str,
        cloud_id: str,
        jql: str = "assignee = currentUser() ORDER BY updated DESC",
        max_results: int = 20,
    ) -> list[dict]:
        """Search Jira issues with JQL."""
        max_results = min(max_results, 50)
        url = f"{self._api_base(cloud_id)}/search/jql"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }
        params = {
            "jql": jql,
            "maxResults": str(max_results),
            "fields": "summary,status,assignee,priority,updated,issuetype,project",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "key": issue["key"],
                "summary": issue["fields"].get("summary", ""),
                "status": issue["fields"].get("status", {}).get("name", ""),
                "priority": issue["fields"].get("priority", {}).get("name", ""),
                "type": issue["fields"].get("issuetype", {}).get("name", ""),
                "project": issue["fields"].get("project", {}).get("key", ""),
                "assignee": (issue["fields"].get("assignee") or {}).get("displayName", "Sin asignar"),
                "updated": issue["fields"].get("updated", ""),
            }
            for issue in data.get("issues", [])
        ]

    async def create_issue(
        self,
        access_token: str,
        cloud_id: str,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str = "Task",
    ) -> dict:
        """Create a new Jira issue."""
        url = f"{self._api_base(cloud_id)}/issue"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description}],
                        }
                    ],
                },
                "issuetype": {"name": issue_type},
            }
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        return {
            "key": data["key"],
            "id": data["id"],
            "url": f"https://your-org.atlassian.net/browse/{data['key']}",
        }

    async def add_comment(
        self,
        access_token: str,
        cloud_id: str,
        issue_key: str,
        body: str,
    ) -> dict:
        """Add a comment to a Jira issue."""
        url = f"{self._api_base(cloud_id)}/issue/{issue_key}/comment"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": body}],
                    }
                ],
            }
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        return {"id": data["id"], "issue_key": issue_key}


jira_service = JiraService()
