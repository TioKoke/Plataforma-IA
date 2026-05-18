"""
Servicio de integración con Microsoft Outlook via Graph API.
Maneja OAuth confidential client flow y operaciones de email/calendario.
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from typing import Optional

import httpx

from app.config import config, get_logger

logger = get_logger("outlook")

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
OUTLOOK_SCOPES = [
    "openid", "profile", "email", "offline_access",
    "Mail.Read", "Mail.Send", "Calendars.Read",
]


class OutlookService:
    """Microsoft Graph API integration via OAuth confidential client."""

    def get_authorization_url(self, state: str) -> str:
        """Build the Microsoft OAuth authorization URL."""
        params = {
            "client_id": config.AZURE_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": self._get_redirect_uri(),
            "response_mode": "query",
            "scope": " ".join(OUTLOOK_SCOPES),
            "state": state,
            "prompt": "consent",
        }
        base = f"https://login.microsoftonline.com/{config.AZURE_TENANT_ID}/oauth2/v2.0/authorize"
        return f"{base}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        """
        Exchange authorization code for tokens (confidential client).

        Returns:
            dict with access_token, refresh_token, expires_in, scope
        """
        data = {
            "client_id": config.AZURE_CLIENT_ID,
            "client_secret": config.AZURE_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self._get_redirect_uri(),
            "scope": " ".join(OUTLOOK_SCOPES),
        }
        token_url = f"https://login.microsoftonline.com/{config.AZURE_TENANT_ID}/oauth2/v2.0/token"

        async with httpx.AsyncClient() as client:
            resp = await client.post(token_url, data=data)
            resp.raise_for_status()
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        """
        Refresh an expired access token.

        Returns:
            dict with access_token, refresh_token, expires_in
        """
        data = {
            "client_id": config.AZURE_CLIENT_ID,
            "client_secret": config.AZURE_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": " ".join(OUTLOOK_SCOPES),
        }
        token_url = f"https://login.microsoftonline.com/{config.AZURE_TENANT_ID}/oauth2/v2.0/token"

        async with httpx.AsyncClient() as client:
            resp = await client.post(token_url, data=data)
            resp.raise_for_status()
            return resp.json()

    # ── Graph API operations ─────────────────────────────────────

    async def read_emails(
        self,
        access_token: str,
        folder: str = "inbox",
        top: int = 10,
        search: Optional[str] = None,
    ) -> list[dict]:
        """Read emails from a folder."""
        top = min(top, 50)
        params = {
            "$top": str(top),
            "$select": "id,subject,from,receivedDateTime,bodyPreview,isRead",
            "$orderby": "receivedDateTime desc",
        }
        if search:
            params["$search"] = f'"{search}"'

        url = f"{GRAPH_BASE}/me/mailFolders/{folder}/messages"
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "id": m["id"],
                "subject": m.get("subject", "(Sin asunto)"),
                "from": m.get("from", {}).get("emailAddress", {}).get("address", ""),
                "from_name": m.get("from", {}).get("emailAddress", {}).get("name", ""),
                "received": m.get("receivedDateTime", ""),
                "preview": m.get("bodyPreview", ""),
                "is_read": m.get("isRead", False),
            }
            for m in data.get("value", [])
        ]

    async def send_email(
        self,
        access_token: str,
        to: list[str],
        subject: str,
        body: str,
        cc: Optional[list[str]] = None,
    ) -> dict:
        """Send an email via Microsoft Graph."""
        message = {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            "toRecipients": [
                {"emailAddress": {"address": addr}} for addr in to
            ],
        }
        if cc:
            message["ccRecipients"] = [
                {"emailAddress": {"address": addr}} for addr in cc
            ]

        url = f"{GRAPH_BASE}/me/sendMail"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url, headers=headers, json={"message": message}
            )
            resp.raise_for_status()

        return {"success": True, "message": f"Email enviado a {', '.join(to)}"}

    async def get_calendar_events(
        self,
        access_token: str,
        start: str,
        end: str,
        top: int = 20,
    ) -> list[dict]:
        """Get calendar events in a date range (ISO 8601 datetime strings)."""
        top = min(top, 50)
        params = {
            "startDateTime": start,
            "endDateTime": end,
            "$top": str(top),
            "$select": "id,subject,start,end,location,organizer,isAllDay",
            "$orderby": "start/dateTime",
        }
        url = f"{GRAPH_BASE}/me/calendarView"
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "id": e["id"],
                "subject": e.get("subject", "(Sin título)"),
                "start": e.get("start", {}).get("dateTime", ""),
                "end": e.get("end", {}).get("dateTime", ""),
                "location": e.get("location", {}).get("displayName", ""),
                "organizer": e.get("organizer", {}).get("emailAddress", {}).get("name", ""),
                "is_all_day": e.get("isAllDay", False),
            }
            for e in data.get("value", [])
        ]

    async def get_user_profile(self, access_token: str) -> dict:
        """Validate token by fetching the user profile."""
        url = f"{GRAPH_BASE}/me"
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params={
                "$select": "displayName,mail,userPrincipalName"
            })
            resp.raise_for_status()
            return resp.json()

    # ── Helpers ───────────────────────────────────────────────────

    def _get_redirect_uri(self) -> str:
        """Return the OAuth redirect URI registered in Azure AD for Outlook callbacks."""
        return config.OUTLOOK_REDIRECT_URI


outlook_service = OutlookService()
