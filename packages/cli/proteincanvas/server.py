import asyncio
import importlib.resources
import webbrowser
from pathlib import Path

from aiohttp import web
from watchfiles import Change, awatch


WATCHED_EXTENSIONS = {".pdb", ".cif", ".csv", ".fasta"}

RESPONSE_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
}


def _static_dir() -> Path:
    return Path(str(importlib.resources.files("proteincanvas").joinpath("_static")))


@web.middleware
async def headers_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        return web.Response(headers=RESPONSE_HEADERS)
    response = await handler(request)
    response.headers.update(RESPONSE_HEADERS)
    return response


async def _watch_campaign(path: str) -> None:
    async for changes in awatch(path):
        added = [
            Path(p).name
            for change_type, p in changes
            if change_type == Change.added and Path(p).suffix in WATCHED_EXTENSIONS
        ]
        if added:
            print(f"New files: {', '.join(added)}")


async def serve_campaign(path: str, port: int, host: str, open_browser: bool) -> None:
    static_dir = _static_dir()
    campaign_dir = Path(path)

    app = web.Application(middlewares=[headers_middleware])

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
