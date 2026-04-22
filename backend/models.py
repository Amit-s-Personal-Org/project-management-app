from pydantic import BaseModel, model_validator


class AuthRequest(BaseModel):
    username: str
    password: str


class CreateBoardRequest(BaseModel):
    name: str


class ChatRequest(BaseModel):
    message: str
    board_id: int
    history: list[dict] = []


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def validate_card_references(self) -> "BoardData":
        known = set(self.cards.keys())
        for col in self.columns:
            missing = set(col.cardIds) - known
            if missing:
                raise ValueError(
                    f"Column '{col.title}' references unknown card IDs: {missing}"
                )
        return self


class BoardInfo(BaseModel):
    id: int
    name: str
    created_at: str


class AIResponse(BaseModel):
    message: str
    board_update: BoardData | None = None
