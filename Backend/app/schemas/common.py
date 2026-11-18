from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Accepts and emits camelCase so the frontend types map 1:1."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
