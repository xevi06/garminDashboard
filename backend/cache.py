from cachetools import TTLCache

_cache: TTLCache = TTLCache(maxsize=256, ttl=300)


def cache_get(key: str):
    return _cache.get(key)


def cache_set(key: str, value, ttl: int = 300):
    _cache[key] = value
