"""Main CLI module for LAL (Learn Any Language)."""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

import click

from lal_cli import articles as articles_lib
from lal_cli import models as models_lib
from lal_cli import user as user_lib
from lal_cli.database import DB_PATH, init_db

# Project root directory (parent of cli directory)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
BACKEND_PORT = 18080
FRONTEND_PORT = 5173

# Store running server processes
_running_processes: List[subprocess.Popen] = []


@click.group()
@click.version_option(version="0.1.0")
def cli() -> None:
    """LAL CLI - Learn Any Language CLI Tool.

    A CLI tool for managing articles, word lists, exercises,
    and AI model configuration for language learning.
    """
    init_db()


# ============================================================================
# Models Commands
# ============================================================================


@click.group("models")
def models() -> None:
    """Manage AI models."""
    pass


@models.command("anthropic")
@click.option("--model-name", required=True, help="Model name (e.g., claude-3-5-sonnet)")
@click.option("--base-url", default=None, help="Base URL for API")
@click.option("--key", "api_key", required=True, help="API key")
def models_add_anthropic(
    model_name: str,
    base_url: Optional[str],
    api_key: str,
) -> None:
    """Add an Anthropic AI model configuration."""
    try:
        models_lib.add_anthropic(
            name="anthropic",
            model_name=model_name,
            base_url=base_url,
            api_key=api_key,
        )
        click.echo("Anthropic model added successfully.")
    except ValueError as e:
        click.echo(f"Error: {e}", err=True)


@models.command("openai")
@click.option("--model-name", required=True, help="Model name (e.g., gpt-4, gpt-4o)")
@click.option("--base-url", default=None, help="Base URL for API")
@click.option("--key", "api_key", required=True, help="API key")
def models_add_openai(
    model_name: str,
    base_url: Optional[str],
    api_key: str,
) -> None:
    """Add an OpenAI AI model configuration."""
    try:
        models_lib.add_openai(
            name="openai",
            model_name=model_name,
            base_url=base_url,
            api_key=api_key,
        )
        click.echo("OpenAI model added successfully.")
    except ValueError as e:
        click.echo(f"Error: {e}", err=True)


@models.command("list")
def models_list() -> None:
    """List all configured AI models."""
    rows = models_lib.list_models()

    if not rows:
        click.echo("No models configured. Use 'lal-cli models add' to add one.")
        return

    click.echo(f"{'Name':<20} {'Provider':<12} {'Model':<20} {'Base URL':<30}")
    click.echo("-" * 82)
    for row in rows:
        base_url = row["base_url"] or "N/A"
        click.echo(f"{row['name']:<20} {row['provider']:<12} {row['model_name']:<20} {base_url:<30}")


@models.command("delete")
@click.argument("name")
def models_delete(name: str) -> None:
    """Delete an AI model configuration."""
    if models_lib.delete_model(name):
        click.echo(f"Model '{name}' deleted successfully.")
    else:
        click.echo(f"Error: Model '{name}' not found.", err=True)


# ============================================================================
# User Commands
# ============================================================================


@click.group("user")
def user() -> None:
    """Manage user settings."""
    pass


@user.command("config")
@click.option("--name", required=True, help="User name")
@click.option("--native", "native_language", required=True, help="Native language")
@click.option("--target", "target_language", required=True, help="Target language to learn")
@click.option("--current-level", default="A1", help="Current CEFR level (A1-C2)")
def user_config(
    name: str,
    native_language: str,
    target_language: str,
    current_level: str,
) -> None:
    """Configure user settings."""
    try:
        user_lib.set_user_config(
            name=name,
            native=native_language,
            target=target_language,
            current_level=current_level,
        )
        click.echo("User settings configured successfully.")
    except ValueError as e:
        click.echo(f"Error: {e}", err=True)


@user.command("show")
def user_show() -> None:
    """Show current user settings."""
    row = user_lib.show_user_config()

    if not row:
        click.echo("No user configured. Use 'lal-cli user config' to set up your profile.")
        return

    click.echo("Current User Settings:")
    click.echo(f"  Name:             {row['name']}")
    click.echo(f"  Native Language:  {row['native_language']}")
    click.echo(f"  Target Language: {row['target_language']}")
    click.echo(f"  Current Level:   {row['current_level']}")


# ============================================================================
# Articles Commands
# ============================================================================


@click.group("articles")
def articles() -> None:
    """Manage articles."""
    pass


@articles.command("add")
@click.option("--title", required=True, help="Article title")
@click.option("--source", default=None, help="Source URL")
@click.option("--content", required=True, help="Article content")
@click.option("--level", default=None, help="CEFR level (A1-C2)")
@click.option("--notes", default=None, help="User notes")
def articles_add(
    title: str,
    source: Optional[str],
    content: str,
    level: Optional[str],
    notes: Optional[str],
) -> None:
    """Add a new article."""
    # Validation
    if not title or not title.strip():
        click.echo("Error: --title is required", err=True)
        return
    if not content or not content.strip():
        click.echo("Error: --content is required", err=True)
        return

    try:
        article_id = articles_lib.add_article(
            title=title,
            source=source,
            content=content,
            level=level,
            notes=notes,
        )
        click.echo(f"Article '{title}' added successfully.")
        click.echo(f"  ID: {article_id}")
    except Exception as e:
        click.echo(f"Error adding article: {e}", err=True)


@articles.command("list")
@click.option("--archived", is_flag=True, help="Show archived articles")
def articles_list(archived: bool) -> None:
    """List all articles."""
    rows = articles_lib.list_articles(archived=archived)

    if not rows:
        click.echo("No articles found.")
        return

    click.echo(f"{'ID':<38} {'Title':<30} {'Level':<6} {'Created At':<20}")
    click.echo("-" * 94)
    for row in rows:
        title = row["title"][:27] + "..." if len(row["title"]) > 30 else row["title"]
        click.echo(f"{row['id']:<38} {title:<30} {row['level'] or 'N/A':<6} {row['createdAt']:<20}")


@articles.command("delete")
@click.argument("article_id")
def articles_delete(article_id: str) -> None:
    """Delete an article by ID."""
    success, title = articles_lib.delete_article(article_id)
    if success:
        click.echo(f"Article '{title}' deleted successfully.")
    else:
        click.echo(f"Error: Article with ID '{article_id}' not found.", err=True)


# ============================================================================
# Server Management Commands
# ============================================================================


def _is_port_in_use(port: int) -> bool:
    """Check if a port is already in use."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("localhost", port))
            return False
        except OSError:
            return True


def _kill_process_on_port(port: int) -> bool:
    """Kill any process using the specified port. Returns True if a process was killed."""
    try:
        # Use lsof to find the process on the port
        result = subprocess.run(
            ["lsof", "-ti", f"localhost:{port}"],
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            pids = result.stdout.strip().split("\n")
            for pid in pids:
                try:
                    os.kill(int(pid), signal.SIGTERM)
                except (ProcessLookupError, PermissionError):
                    # Process may have already ended or we don't have permission
                    pass
            return True
        return False
    except subprocess.NotFoundError:
        # lsof not available, try alternative approach
        try:
            result = subprocess.run(
                ["ps", "aux"],
                capture_output=True,
                text=True,
            )
            for line in result.stdout.split("\n"):
                if f"localhost:{port}" in line or f":{port}" in line:
                    parts = line.split()
                    if len(parts) > 1:
                        try:
                            pid = int(parts[1])
                            os.kill(pid, signal.SIGTERM)
                            return True
                        except (ProcessLookupError, PermissionError, ValueError):
                            pass
        except subprocess.NotFoundError:
            pass
    return False


def _cleanup_processes() -> None:
    """Clean up any running server processes."""
    global _running_processes
    for proc in _running_processes:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                proc.kill()
            except ProcessLookupError:
                pass
    _running_processes.clear()


@click.command("init")
def init() -> None:
    """Initialize the LAL project.

    Creates the database directory and file, checks for frontend/backend
    directories, and creates a default .env file in the backend.
    """
    click.echo("Initializing LAL project...")

    # Create database directory and initialize database
    click.echo("\n[1/4] Setting up database...")
    db_dir = DB_PATH.parent
    db_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    click.echo(f"  Database directory: {db_dir}")
    click.echo(f"  Database file: {DB_PATH}")
    click.echo("  Database tables created successfully.")

    # Check backend directory
    click.echo("\n[2/4] Checking backend directory...")
    if BACKEND_DIR.exists():
        click.echo(f"  Backend found at: {BACKEND_DIR}")
    else:
        click.echo(f"  Backend directory not found at: {BACKEND_DIR}", err=True)

    # Check frontend directory
    click.echo("\n[3/4] Checking frontend directory...")
    if FRONTEND_DIR.exists():
        click.echo(f"  Frontend found at: {FRONTEND_DIR}")
    else:
        click.echo(f"  Frontend directory not found at: {FRONTEND_DIR}", err=True)

    # Create .env file in backend if it doesn't exist
    click.echo("\n[4/4] Setting up backend environment...")
    env_file = BACKEND_DIR / ".env"
    if env_file.exists():
        click.echo(f"  .env file already exists at: {env_file}")
    else:
        default_env_content = f"""# Database
DATABASE_URL="file:{DB_PATH}"

# Server
PORT={BACKEND_PORT}
"""
        try:
            env_file.write_text(default_env_content)
            click.echo(f"  Created .env file at: {env_file}")
        except Exception as e:
            click.echo(f"  Warning: Could not create .env file: {e}", err=True)

    click.echo("\nInitialization complete!")
    click.echo("\nNext steps:")
    click.echo("  1. Run 'lal-cli start' to start the servers")
    click.echo("  2. Configure your AI model with 'lal-cli models addanthropic --model-name <name> --key <key>'")
    click.echo("  3. Set up your profile with 'lal-cli user config --name <name> --native <lang> --target <lang>'")


@click.command("start")
def start() -> None:
    """Start both frontend and backend servers.

    Starts the backend server on port 18080 and frontend on port 5173.
    Servers run in the background and will continue until 'stop' is called
    or the process is interrupted.
    """
    global _running_processes

    # Check if servers are already running
    backend_running = _is_port_in_use(BACKEND_PORT)
    frontend_running = _is_port_in_use(FRONTEND_PORT)

    if backend_running:
        click.echo(f"Error: Backend server is already running on port {BACKEND_PORT}.", err=True)
        click.echo("Use 'lal-cli stop' to stop it first, or 'lal-cli restart' to restart.", err=True)
        return

    if frontend_running:
        click.echo(f"Error: Frontend server is already running on port {FRONTEND_PORT}.", err=True)
        click.echo("Use 'lal-cli stop' to stop it first, or 'lal-cli restart' to restart.", err=True)
        return

    # Check that backend and frontend directories exist
    if not BACKEND_DIR.exists():
        click.echo(f"Error: Backend directory not found at: {BACKEND_DIR}", err=True)
        click.echo("Run 'lal-cli init' first to initialize the project.", err=True)
        return

    if not FRONTEND_DIR.exists():
        click.echo(f"Error: Frontend directory not found at: {FRONTEND_DIR}", err=True)
        click.echo("Run 'lal-cli init' first to initialize the project.", err=True)
        return

    click.echo("Starting servers...")

    # Set up signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        click.echo("\nShutting down servers...")
        _cleanup_processes()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start backend server
    click.echo(f"\nStarting backend server on port {BACKEND_PORT}...")
    try:
        backend_env = os.environ.copy()
        backend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(BACKEND_DIR),
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )
        _running_processes.append(backend_proc)
        click.echo(f"  Backend starting (PID: {backend_proc.pid})...")
    except Exception as e:
        click.echo(f"  Error starting backend: {e}", err=True)
        _cleanup_processes()
        return

    # Wait a moment for backend to start
    time.sleep(2)

    # Start frontend server
    click.echo(f"Starting frontend server on port {FRONTEND_PORT}...")
    try:
        frontend_env = os.environ.copy()
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            env=frontend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )
        _running_processes.append(frontend_proc)
        click.echo(f"  Frontend starting (PID: {frontend_proc.pid})...")
    except Exception as e:
        click.echo(f"  Error starting frontend: {e}", err=True)
        _cleanup_processes()
        return

    # Wait for servers to be ready
    click.echo("\nWaiting for servers to be ready...")
    max_wait = 30
    for i in range(max_wait):
        time.sleep(1)
        if _is_port_in_use(BACKEND_PORT) and _is_port_in_use(FRONTEND_PORT):
            break
        if i % 5 == 0:
            click.echo(f"  Still starting... ({i+1}/{max_wait}s)")

    # Check if servers started successfully
    if not _is_port_in_use(BACKEND_PORT):
        click.echo("Warning: Backend server may not have started correctly.", err=True)
    if not _is_port_in_use(FRONTEND_PORT):
        click.echo("Warning: Frontend server may not have started correctly.", err=True)

    click.echo("\n" + "=" * 50)
    click.echo("Servers started successfully!")
    click.echo(f"  Backend:  http://localhost:{BACKEND_PORT}")
    click.echo(f"  Frontend: http://localhost:{FRONTEND_PORT}")
    click.echo("=" * 50)
    click.echo("\nPress Ctrl+C to stop the servers.")

    # Keep the process running
    try:
        while True:
            time.sleep(1)
            # Check if any process has died
            for proc in _running_processes:
                if proc.poll() is not None:
                    click.echo("\nError: A server process has exited unexpectedly.", err=True)
                    _cleanup_processes()
                    return
    except KeyboardInterrupt:
        pass
    finally:
        _cleanup_processes()


@click.command("stop")
def stop() -> None:
    """Stop all running LAL servers.

    Kills processes running on ports 18080 (backend) and 5173 (frontend).
    """
    click.echo("Stopping servers...")

    backend_stopped = _kill_process_on_port(BACKEND_PORT)
    frontend_stopped = _kill_process_on_port(FRONTEND_PORT)

    # Also clean up any processes we started
    _cleanup_processes()

    if not backend_stopped and not frontend_stopped:
        click.echo("No servers were running on the expected ports.")
        click.echo(f"  Backend:  port {BACKEND_PORT}")
        click.echo(f"  Frontend: port {FRONTEND_PORT}")
        return

    if backend_stopped:
        click.echo(f"  Backend server on port {BACKEND_PORT} stopped.")
    else:
        click.echo(f"  No backend server found on port {BACKEND_PORT}.")

    if frontend_stopped:
        click.echo(f"  Frontend server on port {FRONTEND_PORT} stopped.")
    else:
        click.echo(f"  No frontend server found on port {FRONTEND_PORT}.")

    click.echo("Servers stopped.")


@click.command("restart")
def restart() -> None:
    """Restart all LAL servers.

    Stops any running servers and then starts them again.
    """
    click.echo("Restarting servers...")

    # Try to stop any running servers first
    backend_was_running = _is_port_in_use(BACKEND_PORT)
    frontend_was_running = _is_port_in_use(FRONTEND_PORT)

    if backend_was_running or frontend_was_running:
        stop()
        time.sleep(1)

    # Start servers
    click.echo("\nStarting servers...")
    start()


# Register subcommands
cli.add_command(models)
cli.add_command(user)
cli.add_command(articles)
cli.add_command(init)
cli.add_command(start)
cli.add_command(stop)
cli.add_command(restart)


if __name__ == "__main__":
    cli()
