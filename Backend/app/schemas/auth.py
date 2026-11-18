from pydantic import EmailStr, Field, field_validator

from app.schemas.common import CamelModel


class RegisterIn(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return v


class LoginIn(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(CamelModel):
    id: int
    name: str
    email: str


class TokenOut(CamelModel):
    access_token: str
    user: UserOut
