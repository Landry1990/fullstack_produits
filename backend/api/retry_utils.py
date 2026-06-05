import time
import logging
import functools

logger = logging.getLogger(__name__)


def retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=10.0,
                       exceptions=(Exception,), on_retry=None):
    """
    Décorateur de retry avec backoff exponentiel + jitter.

    Args:
        max_retries: nombre de tentatives max (hors appel initial)
        base_delay: délai de base en secondes
        max_delay: plafond du délai en secondes
        exceptions: tuple d'exceptions à capturer
        on_retry: callback(optionnel) appelé à chaque retry -> on_retry(attempt, exception)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    last_exception = exc
                    if attempt >= max_retries:
                        break
                    # Backoff exponentiel avec jitter de 0-20%
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    jitter = delay * 0.2
                    import random
                    sleep_time = delay + random.uniform(-jitter, jitter)
                    sleep_time = max(0.1, sleep_time)
                    logger.warning(
                        f"[{func.__name__}] tentative {attempt + 1}/{max_retries + 1} échouée: {exc}. "
                        f"Retry dans {sleep_time:.1f}s"
                    )
                    if on_retry:
                        on_retry(attempt + 1, exc)
                    time.sleep(sleep_time)
            if last_exception is not None:
                raise last_exception
            raise RuntimeError("retry_with_backoff: unexpected state")
        return wrapper
    return decorator
