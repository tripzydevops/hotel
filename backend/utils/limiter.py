from slowapi import Limiter
from slowapi.util import get_remote_address

# Global limiter instance to be shared across routes and main app
# Uses remote address as the key for tracking limits
limiter = Limiter(key_func=get_remote_address)
