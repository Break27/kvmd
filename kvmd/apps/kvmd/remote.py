import asyncio

from time import time

from typing import AsyncGenerator
from typing import Tuple

from ... import aiotools


class RemoteHost:
    def __init__(
        self,
        name,
        address='',
        encoding='utf-8',
        **kwargs
    ) -> None:
        self.name = name
        self.address = address
        self.encoding = encoding
        self.actions = kwargs

        self.online = False
        self.last_seen = 0

    def get_state(self) -> dict:
        return {
            "name": self.name,
            "online": self.online,
            "last_seen": self.last_seen,
            "actions": self.parse_action(),
        }

    def parse_action(self, action=None) -> list[str] | str:
        if not action:
            return [
                key[3:].upper() for key, value in self.actions.items()
                if key.startswith('on_') and value
            ]
        command = self.actions.get("on_%s" % action.lower())
        if not command: raise NotImplementedError()
        return command

    async def ping(self) -> bool:
        process = await asyncio.create_subprocess_shell(
            f"ping -i 0.5 -c 2 -w 2 {self.address}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.wait()
        online = process.returncode == 0

        changed = self.online != online
        self.online = online

        if self.online:
            self.last_seen = time()
        return changed


class RemoteControl:
    def __init__(self, hosts: list[RemoteHost], timeout: int, ssh_key: str) -> None:
        self.__hosts = { host.name: host for host in hosts }
        self.__timeout = timeout
        self.__ssh_key = ssh_key

        self.__notifier = aiotools.AioNotifier()

    @staticmethod
    def from_dict(hosts: list[dict], **kwargs):
        roll = [RemoteHost(**host) for host in hosts]
        return RemoteControl(roll, **kwargs)

    async def get_state(self) -> list[dict]:
        return [
            host.get_state() for host in self.__hosts.values()
        ]

    async def perform(self, hostname, action) -> Tuple[int | None, str, str]:
        if hostname not in self.__hosts:
            raise KeyError(hostname)
        host = self.__hosts.get(hostname)
        command = host.parse_action(action)

        if command.startswith("ssh"):
            head, tail = command.split(' ', 1)
            slices = [head, "-oStrictHostKeyChecking=no", "-i", self.__ssh_key, tail]
            command = ' '.join(slices)

        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        await process.wait()
        stdout, stderr = await process.communicate()

        message = stdout.decode(host.encoding)
        error = stderr.decode(host.encoding)
        return (process.returncode, message, error)

    async def update(self) -> list[dict]:
        return [
            host.get_state() for host in self.__hosts.values()
            if await host.ping()
        ]

    async def poll_state(self) -> AsyncGenerator[list, None]:
        while True:
            state = await self.update()
            if state: yield state
            await self.__notifier.wait(self.__timeout)
