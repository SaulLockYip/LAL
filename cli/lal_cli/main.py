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
from lal_cli import settings as settings_lib
from lal_cli import user as user_lib
from lal_cli.database import DB_PATH, init_db

# Project root directory (parent of cli directory)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
BACKEND_PORT = 18080
FRONTEND_PORT = 5173
BACKEND_PID_FILE = Path(os.path.expanduser("~/.learn-any-language/server.pid"))

# Store running server processes
_running_processes: List[subprocess.Popen] = []


@click.group()
@click.version_option(version="0.1.0")
def cli() -> None:
    """LAL CLI - Learn Any Language CLI Tool.

    A CLI tool for managing articles and AI model configuration
    for language learning.
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
    click.echo(f"  Native Language:  {row['nativeLanguage']}")
    click.echo(f"  Target Language: {row['targetLanguage']}")
    click.echo(f"  Current Level:   {row['currentLevel']}")


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


@articles.command("get")
@click.argument("article_id")
def articles_get(article_id: str) -> None:
    """Get an article's content by ID."""
    success, title, content = articles_lib.get_article_content(article_id)
    if not success:
        click.echo(f"Error: Article with ID '{article_id}' not found.", err=True)
        return

    click.echo(f"Title: {title}")
    click.echo("-" * 50)
    click.echo(content)


# ============================================================================
# Settings Commands
# ============================================================================


@click.group("settings")
def settings() -> None:
    """Manage settings."""
    pass


@settings.command("show")
def settings_show() -> None:
    """Show current user settings."""
    settings_lib.show_user_settings()


@settings.command("voices")
def settings_voices() -> None:
    """Show available macOS TTS voices."""
    voices = settings_lib.get_voices()

    if not voices:
        click.echo("No voices found. Is the server running?")
        return

    click.echo(f"{'Name':<40} {'Language':<12} {'Display Name':<30}")
    click.echo("-" * 82)
    for voice in voices:
        click.echo(f"{voice.get('name', ''):<40} {voice.get('lang', ''):<12} {voice.get('displayName', ''):<30}")


@settings.command("tts-voices")
@click.option("--language", default=None, help="Filter by language (e.g., chinese, english)")
def settings_tts_voices(language: str | None) -> None:
    """Show available MiniMax TTS voices."""
    voices = settings_lib.get_tts_voices(language)

    if not voices:
        click.echo("No TTS voices found. Is the server running and TTS API configured?")
        return

    click.echo(f"{'Voice ID':<40} {'Voice Name':<30}")
    click.echo("-" * 70)
    for voice in voices:
        click.echo(f"{voice.get('voice_id', ''):<40} {voice.get('voice_name', ''):<30}")
        desc = voice.get("description", [])
        if desc:
            for d in desc:
                click.echo(f"  - {d}")


@settings.command("ai-test")
@click.option("--provider", required=True, help="AI provider (openai or anthropic)")
@click.option("--model-name", required=True, help="Model name (e.g., gpt-4, claude-3-5-sonnet)")
@click.option("--base-url", required=True, help="Base URL for API")
@click.option("--key", "api_key", required=True, help="API key")
def settings_ai_test(
    provider: str,
    model_name: str,
    base_url: str,
    api_key: str,
) -> None:
    """Test AI connection."""
    click.echo("Testing AI connection...")
    result = settings_lib.test_ai_connection(provider, model_name, api_key, base_url)

    if result is None:
        click.echo("Failed to test AI connection. Is the server running?", err=True)
        return

    if result.get("success"):
        click.echo(f"Success: {result.get('message', 'Connection successful!')}")
    else:
        click.echo(f"Failed: {result.get('message', 'Connection failed')}", err=True)


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
@click.option("--repo", default="https://github.com/SaulLockYip/LAL.git", help="Git repository to clone")
@click.option("--dir", "target_dir", default=None, help="Target directory (default: ~/LAL)")
@click.option("--skip-clone", is_flag=True, help="Skip git clone (use existing directory)")
def init(repo: str, target_dir: str | None, skip_clone: bool) -> None:
    """Initialize the LAL project.

    Clones the repository to ~/LAL (or specified directory), installs dependencies,
    builds the frontend, and sets up the database.
    """
    click.echo("Initializing LAL project...")

    # Determine target directory
    if target_dir:
        install_dir = Path(target_dir).expanduser().resolve()
    else:
        install_dir = Path.home() / "LAL"

    # Step 1: Clone repo if needed
    click.echo("\n[1/6] Setting up project directory...")
    if install_dir.exists() and any(install_dir.iterdir()) and not skip_clone:
        click.echo(f"  Directory already exists: {install_dir}")
        click.echo("  Use --skip-clone to use existing directory")
    elif not install_dir.exists():
        click.echo(f"  Cloning repository to: {install_dir}")
        try:
            subprocess.run(["git", "clone", repo, str(install_dir)], check=True, capture_output=True)
            click.echo("  Repository cloned successfully")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Error cloning repository: {e.stderr.decode() if e.stderr else str(e)}", err=True)
            return
        except FileNotFoundError:
            click.echo("  Error: git is not installed. Please install git first.", err=True)
            return
    else:
        click.echo(f"  Empty directory, skipping clone: {install_dir}")

    # Update PROJECT_ROOT, BACKEND_DIR, FRONTEND_DIR to use install_dir
    global PROJECT_ROOT, BACKEND_DIR, FRONTEND_DIR
    PROJECT_ROOT = install_dir
    BACKEND_DIR = install_dir / "backend"
    FRONTEND_DIR = install_dir / "frontend"

    # Step 2: Install backend dependencies
    click.echo("\n[2/6] Installing backend dependencies...")
    if BACKEND_DIR.exists():
        try:
            subprocess.run(["npm", "install"], cwd=str(BACKEND_DIR), check=True, capture_output=True)
            click.echo("  Backend dependencies installed")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Error installing backend dependencies: {e.stderr.decode() if e.stderr else str(e)}", err=True)
            return
        except FileNotFoundError:
            click.echo("  Error: npm is not installed. Please install Node.js first.", err=True)
            return
    else:
        click.echo("  Backend directory not found", err=True)
        return

    # Step 3: Install frontend dependencies
    click.echo("\n[3/6] Installing frontend dependencies...")
    if FRONTEND_DIR.exists():
        try:
            subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True, capture_output=True)
            click.echo("  Frontend dependencies installed")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Error installing frontend dependencies: {e.stderr.decode() if e.stderr else str(e)}", err=True)
            return
    else:
        click.echo("  Frontend directory not found", err=True)
        return

    # Step 4: Build frontend static files
    click.echo("\n[4/6] Building frontend...")
    if FRONTEND_DIR.exists():
        try:
            subprocess.run(["npm", "run", "build"], cwd=str(FRONTEND_DIR), check=True, capture_output=True)
            click.echo("  Frontend built successfully")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Error building frontend: {e.stderr.decode() if e.stderr else str(e)}", err=True)
            return
    else:
        click.echo("  Frontend directory not found", err=True)
        return

    # Step 5: Create database and .env
    click.echo("\n[5/6] Setting up database...")
    db_dir = DB_PATH.parent
    db_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    click.echo(f"  Database directory: {db_dir}")
    click.echo(f"  Database file: {DB_PATH}")
    click.echo("  Database tables created successfully.")

    # Step 6: Create .env file in backend if it doesn't exist
    click.echo("\n[6/6] Setting up backend environment...")
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

    click.echo("\n" + "="*50)
    click.echo("Initialization complete!")
    click.echo(f"  Project location: {install_dir}")
    click.echo(f"  Database: {DB_PATH}")
    click.echo("\nNext steps:")
    click.echo("  1. Run 'lal-cli start' to start the server")
    click.echo("  2. Configure your AI model with 'lal-cli models add-anthropic --model-name <name> --key <key>'")
    click.echo("  3. Set up your profile with 'lal-cli user config --name <name> --native <lang> --target <lang>'")
    click.echo(f"  4. Open http://localhost:{BACKEND_PORT} in your browser")


@click.command("start")
def start() -> None:
    """Start the LAL server.

    Starts the backend server which serves both the API and frontend static files.
    Server runs in the background and will continue until 'stop' is called
    or the process is interrupted.
    """
    global _running_processes

    # Check if server is already running
    if _is_port_in_use(BACKEND_PORT):
        click.echo(f"Error: Server is already running on port {BACKEND_PORT}.", err=True)
        click.echo("Use 'lal-cli stop' to stop it first, or 'lal-cli restart' to restart.", err=True)
        return

    # Check that backend directory exists
    if not BACKEND_DIR.exists():
        click.echo(f"Error: Backend directory not found at: {BACKEND_DIR}", err=True)
        click.echo("Run 'lal-cli init' first to initialize the project.", err=True)
        return

    # Check if frontend dist exists (from build step)
    dist_path = FRONTEND_DIR / "dist"
    if not dist_path.exists():
        click.echo(f"Warning: Frontend has not been built (dist folder not found).", err=True)
        click.echo(f"Run 'npm run build' in {FRONTEND_DIR} first, or run 'lal-cli init' to set up.", err=True)
        click.echo("Starting server anyway - API will work but frontend will not be available.", err=True)

    click.echo("Starting server...")

    # Set up signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        click.echo("\nShutting down server...")
        _cleanup_processes()
        if BACKEND_PID_FILE.exists():
            BACKEND_PID_FILE.unlink()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start backend server (serves both API and frontend static files)
    click.echo(f"\nStarting server on port {BACKEND_PORT}...")
    try:
        backend_env = os.environ.copy()
        backend_proc = subprocess.Popen(
            ["npm", "start"],
            cwd=str(BACKEND_DIR),
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )
        _running_processes.append(backend_proc)
        BACKEND_PID_FILE.parent.mkdir(parents=True, exist_ok=True)
        BACKEND_PID_FILE.write_text(str(backend_proc.pid))
        click.echo(f"  Server starting (PID: {backend_proc.pid})...")
    except Exception as e:
        click.echo(f"  Error starting server: {e}", err=True)
        _cleanup_processes()
        return

    # Wait for server to start
    time.sleep(3)

    click.echo("\n" + "="*50)
    click.echo(f"LAL server is running!")
    click.echo(f"  Frontend: http://localhost:{BACKEND_PORT}")
    click.echo(f"  API:      http://localhost:{BACKEND_PORT}/api")
    click.echo("\nPress Ctrl+C to stop the server.")

    # Keep running and stream logs
    while True:
        try:
            line = backend_proc.stdout.readline()
            if line:
                click.echo(line.decode(), nl=False)
            if backend_proc.poll() is not None:
                break
        except:
            break


@click.command("stop")
def stop() -> None:
    """Stop the running LAL server.

    Kills the process running on port 18080.
    """
    click.echo("Stopping server...")

    # Try to kill by PID first if PID file exists
    server_stopped = False
    if BACKEND_PID_FILE.exists():
        try:
            pid = int(BACKEND_PID_FILE.read_text().strip())
            os.kill(pid, signal.SIGTERM)
            server_stopped = True
            BACKEND_PID_FILE.unlink()
        except (ValueError, ProcessLookupError, PermissionError):
            BACKEND_PID_FILE.unlink()

    # Also try port-based kill as fallback
    if not server_stopped:
        backend_stopped = _kill_process_on_port(BACKEND_PORT)
    else:
        backend_stopped = True

    # Also clean up any processes we started
    _cleanup_processes()

    if not backend_stopped:
        click.echo(f"No server was running on port {BACKEND_PORT}.")
        return

    click.echo(f"  Server on port {BACKEND_PORT} stopped.")
    click.echo("Server stopped.")


@click.command("restart")
def restart() -> None:
    """Restart the LAL server.

    Stops any running server and then starts it again.
    """
    global _running_processes

    # Stop any running server
    if _is_port_in_use(BACKEND_PORT):
        click.echo("Stopping server...")
        _kill_process_on_port(BACKEND_PORT)
        _cleanup_processes()
        time.sleep(1)
    else:
        click.echo("No server was running.")

    # Check that backend directory exists
    if not BACKEND_DIR.exists():
        click.echo(f"Error: Backend directory not found at: {BACKEND_DIR}", err=True)
        return

    # Start server
    click.echo("Starting server...")
    try:
        backend_env = os.environ.copy()
        backend_proc = subprocess.Popen(
            ["npm", "start"],
            cwd=str(BACKEND_DIR),
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )
        _running_processes.append(backend_proc)
        click.echo(f"  Server starting (PID: {backend_proc.pid})...")
    except Exception as e:
        click.echo(f"  Error starting server: {e}", err=True)
        return

    time.sleep(3)

    click.echo(f"\nServer restarted on port {BACKEND_PORT}.")
    click.echo(f"  Frontend: http://localhost:{BACKEND_PORT}")
    click.echo(f"  API:      http://localhost:{BACKEND_PORT}/api")


@click.command("update")
def update() -> None:
    """Update LAL to the latest version.

    Pulls latest code from git, reinstalls dependencies, rebuilds frontend,
    and restarts the server.
    """
    # Stop server if running
    if _is_port_in_use(BACKEND_PORT):
        click.echo("Stopping server...")
        _kill_process_on_port(BACKEND_PORT)
        _cleanup_processes()
        time.sleep(1)
    else:
        click.echo("No server running, proceeding with update...")

    # Check that project directory exists
    if not PROJECT_ROOT.exists():
        click.echo(f"Error: Project directory not found at: {PROJECT_ROOT}", err=True)
        click.echo("Run 'lal-cli init' first to set up the project.", err=True)
        return

    click.echo("\nUpdating LAL...")

    # Step 1: Git pull
    click.echo("\n[1/4] Pulling latest code...")
    try:
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            click.echo(f"  Warning: git pull failed: {result.stderr}")
        else:
            click.echo(f"  {result.stdout.strip()}")
    except FileNotFoundError:
        click.echo("  Warning: git not found", err=True)

    # Step 2: npm install (backend)
    click.echo("\n[2/4] Updating backend dependencies...")
    if BACKEND_DIR.exists():
        try:
            subprocess.run(["npm", "install"], cwd=str(BACKEND_DIR), check=True, capture_output=True)
            click.echo("  Backend dependencies updated")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Warning: npm install failed: {e}", err=True)
    else:
        click.echo("  Backend directory not found", err=True)

    # Step 3: npm install + build (frontend)
    click.echo("\n[3/4] Updating frontend dependencies...")
    if FRONTEND_DIR.exists():
        try:
            subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True, capture_output=True)
            click.echo("  Frontend dependencies updated")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Warning: npm install failed: {e}", err=True)

        click.echo("\n[4/4] Rebuilding frontend...")
        try:
            subprocess.run(["npm", "run", "build"], cwd=str(FRONTEND_DIR), check=True, capture_output=True)
            click.echo("  Frontend rebuilt")
        except subprocess.CalledProcessError as e:
            click.echo(f"  Warning: npm build failed: {e}", err=True)
    else:
        click.echo("  Frontend directory not found", err=True)

    # Step 4: Restart server
    click.echo("\nStarting server...")
    try:
        backend_env = os.environ.copy()
        backend_proc = subprocess.Popen(
            ["npm", "start"],
            cwd=str(BACKEND_DIR),
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )
        _running_processes.append(backend_proc)
    except Exception as e:
        click.echo(f"  Error starting server: {e}", err=True)
        return

    time.sleep(3)

    click.echo("\n" + "="*50)
    click.echo("Update complete!")
    click.echo(f"  Frontend: http://localhost:{BACKEND_PORT}")
    click.echo(f"  API:      http://localhost:{BACKEND_PORT}/api")


# Register subcommands
cli.add_command(models)
cli.add_command(user)
cli.add_command(articles)
cli.add_command(settings)
cli.add_command(init)
cli.add_command(start)
cli.add_command(stop)
cli.add_command(restart)
cli.add_command(update)


if __name__ == "__main__":
    cli()
