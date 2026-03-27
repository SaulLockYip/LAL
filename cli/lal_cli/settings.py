"""Settings commands for LAL CLI."""
import click
import requests

# Backend server URL
BACKEND_PORT = 18080
BASE_URL = f"http://localhost:{BACKEND_PORT}/api"


def get_settings_user() -> dict | None:
    """Get user settings from the backend.

    Returns:
        User settings dict or None if failed
    """
    try:
        response = requests.get(f"{BASE_URL}/settings/user", timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("data")
        return None
    except requests.exceptions.RequestException as e:
        click.echo(f"Error fetching user settings: {e}")
        return None


def get_voices() -> list:
    """Get available macOS TTS voices from the backend.

    Returns:
        List of voice dictionaries
    """
    try:
        response = requests.get(f"{BASE_URL}/settings/voices", timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("data", [])
        return []
    except requests.exceptions.RequestException as e:
        click.echo(f"Error fetching voices: {e}")
        return []


def get_tts_voices(language: str | None = None) -> list:
    """Get available MiniMax TTS voices from the backend.

    Args:
        language: Optional language filter

    Returns:
        List of TTS voice dictionaries
    """
    try:
        params = {}
        if language:
            params["language"] = language
        response = requests.get(f"{BASE_URL}/settings/tts-voices", params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("data", [])
        return []
    except requests.exceptions.RequestException as e:
        click.echo(f"Error fetching TTS voices: {e}")
        return []


def test_ai_connection(provider: str, model_name: str, api_key: str, base_url: str) -> dict | None:
    """Test AI connection via the backend.

    Args:
        provider: AI provider (openai or anthropic)
        model_name: Model name
        api_key: API key
        base_url: Base URL for the API

    Returns:
        Result dict with success boolean and message
    """
    try:
        response = requests.post(
            f"{BASE_URL}/settings/ai/test",
            json={
                "provider": provider,
                "modelName": model_name,
                "apiKey": api_key,
                "baseUrl": base_url,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("data")
        return None
    except requests.exceptions.RequestException as e:
        click.echo(f"Error testing AI connection: {e}")
        return None


def show_user_settings() -> None:
    """Display user settings from local database and TTS settings from API."""
    # Import here to avoid circular imports
    from lal_cli import user as user_lib

    # Get user info from local database
    user_row = user_lib.show_user_config()

    # Get TTS settings from API
    settings = get_settings_user()

    click.echo("User Settings:")
    if user_row:
        click.echo(f"  Name:              {user_row['name']}")
        click.echo(f"  Native Language:   {user_row['nativeLanguage']}")
        click.echo(f"  Target Language:   {user_row['targetLanguage']}")
        click.echo(f"  Current Level:     {user_row['currentLevel']}")
    else:
        click.echo("  No user configured. Use 'lal-cli user config' to set up your profile.")

    click.echo()
    click.echo("TTS Settings:")
    if settings:
        click.echo(f"  TTS Voice ID:      {settings.get('ttsVoiceId', 'N/A')}")
        click.echo(f"  TTS Speed:         {settings.get('ttsSpeed', 'N/A')}")
        click.echo(f"  TTS Volume:        {settings.get('ttsVol', 'N/A')}")
        click.echo(f"  TTS Pitch:         {settings.get('ttsPitch', 'N/A')}")
        click.echo(f"  TTS Emotion:       {settings.get('ttsEmotion', 'N/A')}")
        click.echo(f"  TTS Sample Rate:   {settings.get('ttsAudioSampleRate', 'N/A')}")
        click.echo(f"  TTS Bitrate:       {settings.get('ttsBitrate', 'N/A')}")
        click.echo(f"  TTS Channel:       {settings.get('ttsChannel', 'N/A')}")
        click.echo(f"  TTS Sound Effects: {settings.get('ttsSoundEffects', 'N/A')}")
        click.echo(f"  TTS API Key:       {'[set]' if settings.get('ttsApiKey') else '[not set]'}")
    else:
        click.echo("  Failed to fetch TTS settings. Is the server running?")