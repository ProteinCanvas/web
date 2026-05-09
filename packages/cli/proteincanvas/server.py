import asyncio
import importlib.resources
import webbrowser
from pathlib import Path

from aiohttp import web
from watchfiles import awatch


WATCHED_EXTENSIONS = {".pdb", ".cif", ".csv", ".fasta"}

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}


def _static_dir() -> Path:
    with importlib.resources.path("proteincanvas", "_static") as p:
        return Path(p)


@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        return web.Response(headers=CORS_HEADERS)
    response = await handler(request)
    response.headers.update(CORS_HEADERS)
    return response


async def _watch_campaign(path: str) -> None:
    async for changes in awatch(path):
        new_files = [
            Path(str(change[1])).name
            for change in changes
            if Path(str(change[1])).suffix in WATCHED_EXTENSIONS
        ]
        if new_files:
            print(f"New files detected: {', '.join(new_files)}")


async def serve_campaign(path: str, port: int, host: str, open_browser: bool) -> None:
    static_dir = _static_dir()
    campaign_dir = Path(path)

    app = web.Application(middlewares=[cors_middleware])

    if static_dir.exists():
        app.router.add_static("/", static_dir, show_index=False, follow_symlinks=True)

    app.router.add_static("/campaign", campaign_dir, show_index=True, follow_symlinks=True)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()

    print(f"ProteinCanvas running at http://{host}:{port}")

    if open_browser:
        webbrowser.open(f"http://localhost:{port}")

    watch_task = asyncio.create_task(_watch_campaign(path))

    try:
        await asyncio.Event().wait()
    finally:
        watch_task.cancel()
        await runner.cleanup()
