from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeConnectionManager:
    def __init__(self) -> None:
        self._connections_by_user: dict[int, set[WebSocket]] = defaultdict(set)
        self._connections_by_project: dict[int, set[WebSocket]] = defaultdict(set)
        self._projects_by_socket: dict[WebSocket, set[int]] = {}
        self._user_by_socket: dict[WebSocket, int] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = asyncio.Lock()

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, websocket: WebSocket, *, user_id: int, project_ids: set[int]) -> None:
        await websocket.accept()

        async with self._lock:
            self._connections_by_user[user_id].add(websocket)
            self._user_by_socket[websocket] = user_id
            self._projects_by_socket[websocket] = set(project_ids)

            for project_id in project_ids:
                self._connections_by_project[project_id].add(websocket)

        await self.broadcast_presence(project_ids)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            user_id = self._user_by_socket.pop(websocket, None)
            project_ids = self._projects_by_socket.pop(websocket, set())

            if user_id is not None:
                user_connections = self._connections_by_user.get(user_id)
                if user_connections is not None:
                    user_connections.discard(websocket)
                    if not user_connections:
                        self._connections_by_user.pop(user_id, None)

            for project_id in project_ids:
                project_connections = self._connections_by_project.get(project_id)
                if project_connections is not None:
                    project_connections.discard(websocket)
                    if not project_connections:
                        self._connections_by_project.pop(project_id, None)

        await self.broadcast_presence(project_ids)

    async def broadcast_presence(self, project_ids: set[int]) -> None:
        if not project_ids:
            return

        async with self._lock:
            events: list[tuple[list[WebSocket], dict[str, Any]]] = []

            for project_id in project_ids:
                connections = list(self._connections_by_project.get(project_id, set()))
                online_user_ids = sorted(
                    {
                        user_id
                        for socket in connections
                        if (user_id := self._user_by_socket.get(socket)) is not None
                    }
                )
                events.append(
                    (
                        connections,
                        {
                            "type": "presence.changed",
                            "project_id": project_id,
                            "payload": {"online_user_ids": online_user_ids},
                        },
                    )
                )

        for connections, payload in events:
            for websocket in connections:
                await self._send(websocket, payload)

    async def _send(self, websocket: WebSocket, payload: dict[str, Any]) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            await self.disconnect(websocket)

    async def send_to_user(self, user_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections_by_user.get(user_id, set()))

        for websocket in connections:
            await self._send(websocket, payload)

    async def send_to_project(self, project_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections_by_project.get(project_id, set()))

        for websocket in connections:
            await self._send(websocket, payload)

    def queue_user_event(self, user_id: int | None, payload: dict[str, Any]) -> None:
        if user_id is None or self._loop is None:
            return

        asyncio.run_coroutine_threadsafe(self.send_to_user(int(user_id), payload), self._loop)

    def queue_project_event(self, project_id: int | None, payload: dict[str, Any]) -> None:
        if project_id is None or self._loop is None:
            return

        asyncio.run_coroutine_threadsafe(self.send_to_project(int(project_id), payload), self._loop)


realtime_manager = RealtimeConnectionManager()


def broadcast_user_event(user_id: int | None, event_type: str, payload: dict[str, Any] | None = None) -> None:
    realtime_manager.queue_user_event(
        user_id,
        {
            "type": event_type,
            "payload": payload or {},
        },
    )


def broadcast_project_event(project_id: int | None, event_type: str, payload: dict[str, Any] | None = None) -> None:
    realtime_manager.queue_project_event(
        project_id,
        {
            "type": event_type,
            "project_id": project_id,
            "payload": payload or {},
        },
    )
