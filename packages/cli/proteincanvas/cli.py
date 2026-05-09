import asyncio
import click
from proteincanvas import __version__
from proteincanvas.server import serve_campaign


@click.group()
@click.version_option(version=__version__, prog_name="proteincanvas")
def main() -> None:
    pass


@main.command()
@click.argument("path", default=".", type=click.Path(exists=True, file_okay=False, resolve_path=True))
@click.option("--port", default=3847, show_default=True, help="Port to listen on.")
@click.option("--host", default="127.0.0.1", show_default=True, help="Host to bind to.")
@click.option("--no-open", is_flag=True, default=False, help="Do not open the browser automatically.")
def serve(path: str, port: int, host: str, no_open: bool) -> None:
    try:
        asyncio.run(serve_campaign(path, port, host, not no_open))
    except KeyboardInterrupt:
        pass
