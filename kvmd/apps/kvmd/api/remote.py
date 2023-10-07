import sys
import traceback

from aiohttp.web import Request
from aiohttp.web import Response

from ....htserver import UnavailableError
from ....htserver import exposed_http
from ....htserver import make_json_response

from ....logging import get_logger

from ..remote import RemoteControl


# =====
class RemoteApi:
    def __init__(self, remote: RemoteControl) -> None:
        self.__remote = remote

    # =====

    @exposed_http("POST", "/remote")
    async def __state_handler(self, _: Request) -> Response:
        return make_json_response({
            "hosts": await self.__remote.get_state(),
        })

    @exposed_http("POST", "/remote/control")
    async def __remote_control_handler(self, request: Request) -> Response:
        data = await request.json()
        try:
            code, message, error = await self.__remote.perform(
                data["target"], data["action"]
            )
        except Exception:
            logger = get_logger(0)
            tb = traceback.format_exception(*sys.exc_info())

            logger.exception(repr(tb))
            raise UnavailableError()

        return make_json_response({
            "code": code,
            "message": message,
            "error": error,
        })
