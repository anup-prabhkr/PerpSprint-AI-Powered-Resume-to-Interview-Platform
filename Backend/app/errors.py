class AppError(Exception):
    """Error with an HTTP status and a message that is safe to show to users."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
