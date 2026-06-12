import base64
import hashlib
import hmac
import json
import os
import secrets
import shutil
import unicodedata
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Generator

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"

for directory in (UPLOADS_DIR, STATIC_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)

    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)

    return url


DEFAULT_DATABASE_URL = f"sqlite:///{(BASE_DIR / 'lableaf.db').as_posix()}"
DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))

engine_kwargs: dict[str, Any] = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete")
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    default_report_period = Column(String(16), default="7", nullable=False)
    email_notifications = Column(Boolean, default=False, nullable=False)
    save_uploaded_images = Column(Boolean, default=True, nullable=False)
    compact_dashboard = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    plan_id = Column(String(32), nullable=False)
    status = Column(String(32), default="active", nullable=False)
    payment_id = Column(String(64), nullable=False)
    payment_method = Column(String(80), nullable=False)
    tokens_total = Column(Integer, nullable=False)
    tokens_used = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=True)
    stored_filename = Column(String(255), nullable=True)
    image_url = Column(String(512), nullable=True)
    result_image_url = Column(String(512), nullable=True)
    classe = Column(String(160), nullable=True)
    confianca = Column(Float, nullable=True)
    recomendacao = Column(Text, nullable=True)
    status = Column(String(32), default="completed", nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="analyses")


class RegisterRequest(BaseModel):
    nome: str
    email: str
    senha: str


class LoginRequest(BaseModel):
    email: str
    senha: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    senha: str
    confirmar_senha: str


class ProfileUpdateRequest(BaseModel):
    nome: str
    email: str


class ChangePasswordRequest(BaseModel):
    senha_atual: str
    nova_senha: str
    confirmar_senha: str


class SettingsUpdateRequest(BaseModel):
    default_report_period: str
    email_notifications: bool
    save_uploaded_images: bool
    compact_dashboard: bool


class CheckoutRequest(BaseModel):
    plan_id: str
    card_name: str
    card_number: str
    card_expiry: str
    card_cvv: str


SECURITY = HTTPBearer(auto_error=False)
PBKDF2_ITERATIONS = 260_000
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
RESET_TOKEN_MINUTES = int(os.getenv("RESET_TOKEN_MINUTES", "30"))
RETURN_RESET_TOKEN = os.getenv("RETURN_RESET_TOKEN", "true").lower() == "true"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PLAN_CYCLE_DAYS = 30

PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "essencial": {
        "id": "essencial",
        "name": "Essencial",
        "tag": "Inicial",
        "price_cents": 4900,
        "price_label": "R$ 49",
        "billing_label": "/mes",
        "tokens": 30,
        "description": "Para validar analises pontuais e manter historico basico.",
        "features": [
            "30 analises por ciclo",
            "Download do resultado",
            "Historico simplificado",
            "Suporte por email",
        ],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "tag": "Profissional",
        "price_cents": 9900,
        "price_label": "R$ 99",
        "billing_label": "/mes",
        "tokens": 120,
        "description": "Para acompanhamento recorrente com mais volume e relatorios.",
        "features": [
            "120 analises por ciclo",
            "Relatorios completos",
            "Filtros por doenca e periodo",
            "Suporte prioritario",
        ],
    },
    "avancado": {
        "id": "avancado",
        "name": "Avancado",
        "tag": "Institucional",
        "price_cents": 19900,
        "price_label": "R$ 199",
        "billing_label": "/mes",
        "tokens": 500,
        "description": "Para equipes, turmas e laboratorios com alto volume.",
        "features": [
            "500 analises por ciclo",
            "Exportacao de relatorios",
            "Uso institucional",
            "Suporte dedicado",
        ],
    },
}

EMPTY_RECOMMENDATION_MESSAGES = {
    "nenhuma recomendacao retornada pela api",
    "sem recomendacao",
}
RECOMMENDATION_CATALOG: dict[str, str] = {
    "mosaic virus": (
        "Doenca viral sem tratamento curativo. Use sementes certificadas, monitore "
        "e reduza insetos vetores, elimine plantas voluntarias e remova plantas "
        "muito afetadas quando houver foco localizado."
    ),
    "mossaic virus": (
        "Doenca viral sem tratamento curativo. Use sementes certificadas, monitore "
        "e reduza insetos vetores, elimine plantas voluntarias e remova plantas "
        "muito afetadas quando houver foco localizado."
    ),
    "yellow mosaic": (
        "Doenca viral sem tratamento curativo. Reforce o controle de insetos vetores, "
        "elimine plantas voluntarias e hospedeiras proximas e priorize sementes e "
        "cultivares sadias nos proximos plantios."
    ),
    "bacterial blight": (
        "Evite manejar a lavoura com folhas molhadas, use sementes sadias, faca "
        "rotacao de culturas e monitore a evolucao das manchas. Em alta severidade, "
        "confirme o diagnostico antes de qualquer intervencao."
    ),
    "brown spot": (
        "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade "
        "no baixeiro. Fungicida registrado pode ser avaliado quando houver historico "
        "da area e condicoes favoraveis."
    ),
    "septoria": (
        "Maneje restos culturais, faca rotacao fora da soja e acompanhe a severidade "
        "no baixeiro. Fungicida registrado pode ser avaliado quando houver historico "
        "da area e condicoes favoraveis."
    ),
    "crestamento": (
        "Use sementes sadias, reduza a permanencia de palhada infectada e monitore "
        "folhas novas. Em areas com historico e clima favoravel, avalie fungicida "
        "registrado com orientacao tecnica."
    ),
    "ferrugen": (
        "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique "
        "alertas regionais, elimine plantas voluntarias e avalie fungicida registrado "
        "conforme recomendacao tecnica local."
    ),
    "ferrugem": (
        "Suspeita de ferrugem exige monitoramento rapido. Confirme em campo, verifique "
        "alertas regionais, elimine plantas voluntarias e avalie fungicida registrado "
        "conforme recomendacao tecnica local."
    ),
    "powdery mildew": (
        "Monitore a disseminacao nas folhas, prefira cultivares menos suscetiveis e "
        "evite estresse da lavoura. Fungicida registrado pode ser considerado se a "
        "doenca avancar em fase sensivel."
    ),
    "southern blight": (
        "Melhore a drenagem, reduza excesso de residuos infectados e faca rotacao com "
        "culturas nao hospedeiras. Em areas recorrentes, planeje manejo de solo e "
        "cultivares com acompanhamento tecnico."
    ),
    "sudden death syndrone": (
        "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos "
        "ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza "
        "compactacao e nematoides."
    ),
    "sudden death syndrome": (
        "Nao ha tratamento de resgate eficiente em plantas ja afetadas. Para proximos "
        "ciclos, use cultivares tolerantes, trate sementes, melhore drenagem e reduza "
        "compactacao e nematoides."
    ),
    "healthy": (
        "Nao ha indicio relevante de doenca nesta imagem. Mantenha o monitoramento "
        "da area, registre novas amostras e acompanhe mudancas de cor, manchas ou "
        "queda precoce das folhas."
    ),
    "saudavel": (
        "Nao ha indicio relevante de doenca nesta imagem. Mantenha o monitoramento "
        "da area, registre novas amostras e acompanhe mudancas de cor, manchas ou "
        "queda precoce das folhas."
    ),
}


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> bool:
    return "@" in email and "." in email.rsplit("@", 1)[-1]


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return "$".join(
        [
            "pbkdf2_sha256",
            str(PBKDF2_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(key).decode("ascii"),
        ]
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, key_b64 = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False

        salt = base64.b64decode(salt_b64)
        expected_key = base64.b64decode(key_b64)
        actual_key = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(actual_key, expected_key)
    except (ValueError, TypeError):
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def user_payload(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "nome": user.name,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def create_session_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(days=SESSION_DAYS),
        )
    )
    db.commit()
    return token


def get_user_settings(db: Session, user: User) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()

    if settings is None:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def settings_payload(settings: UserSettings) -> dict[str, Any]:
    return {
        "default_report_period": settings.default_report_period,
        "email_notifications": settings.email_notifications,
        "save_uploaded_images": settings.save_uploaded_images,
        "compact_dashboard": settings.compact_dashboard,
        "updated_at": settings.updated_at.isoformat() if settings.updated_at else None,
    }


def plan_payload(plan_id: str) -> dict[str, Any] | None:
    plan = PLAN_CATALOG.get(plan_id)

    if plan is None:
        return None

    return dict(plan)


def get_subscription(db: Session, user: User) -> Subscription | None:
    subscription = (
        db.query(Subscription).filter(Subscription.user_id == user.id).first()
    )

    if (
        subscription is not None
        and subscription.status == "active"
        and as_utc(subscription.expires_at) < utcnow()
    ):
        subscription.status = "expired"
        subscription.updated_at = utcnow()
        db.commit()
        db.refresh(subscription)

    return subscription


def subscription_tokens_remaining(subscription: Subscription) -> int:
    return max(0, subscription.tokens_total - subscription.tokens_used)


def normalize_class_key(value: str | None) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    without_accents = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )
    return " ".join(
        without_accents.lower().replace("_", " ").replace("-", " ").split()
    )


def is_empty_recommendation(value: str | None) -> bool:
    if not value or not value.strip():
        return True

    key = normalize_class_key(value).rstrip(".!?")
    return key in EMPTY_RECOMMENDATION_MESSAGES


def recommendation_for_class(class_name: str | None) -> str:
    return RECOMMENDATION_CATALOG.get(normalize_class_key(class_name), "")


def subscription_payload(subscription: Subscription | None) -> dict[str, Any] | None:
    if subscription is None:
        return None

    return {
        "id": subscription.id,
        "plan_id": subscription.plan_id,
        "plan": plan_payload(subscription.plan_id),
        "status": subscription.status,
        "active": subscription.status == "active"
        and as_utc(subscription.expires_at) >= utcnow(),
        "payment_id": subscription.payment_id,
        "payment_method": subscription.payment_method,
        "tokens_total": subscription.tokens_total,
        "tokens_used": subscription.tokens_used,
        "tokens_remaining": subscription_tokens_remaining(subscription),
        "started_at": subscription.started_at.isoformat()
        if subscription.started_at
        else None,
        "expires_at": subscription.expires_at.isoformat()
        if subscription.expires_at
        else None,
        "updated_at": subscription.updated_at.isoformat()
        if subscription.updated_at
        else None,
    }


def require_analysis_token(db: Session, user: User) -> Subscription:
    subscription = get_subscription(db, user)

    if subscription is None or subscription.status != "active":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Escolha um plano para liberar analises.",
        )

    if subscription_tokens_remaining(subscription) <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Os tokens do plano acabaram. Renove ou escolha outro plano.",
        )

    return subscription


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(SECURITY),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticacao obrigatoria.",
        )

    session = (
        db.query(AuthSession)
        .filter(AuthSession.token_hash == hash_token(credentials.credentials))
        .first()
    )

    if session is None or as_utc(session.expires_at) < utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao expirada. Entre novamente.",
        )

    return session.user


def serialize_analysis(record: Analysis) -> dict[str, Any]:
    recommendation = record.recomendacao

    if is_empty_recommendation(recommendation):
        recommendation = recommendation_for_class(record.classe) or recommendation

    return {
        "id": record.id,
        "classe": record.classe,
        "confianca": record.confianca,
        "recomendacao": recommendation,
        "status": record.status,
        "erro": record.error_message,
        "imagem": record.image_url,
        "imagem_resultado": record.result_image_url,
        "arquivo": record.original_filename,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


def is_healthy_class(classe: str | None) -> bool:
    value = (classe or "").strip().lower()
    return "saudavel" in value or "healthy" in value


def secure_upload_name(filename: str | None) -> tuple[str, str]:
    original_name = Path(filename or "imagem.jpg").name
    suffix = Path(original_name).suffix.lower()

    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        suffix = ".jpg"

    return original_name, f"{uuid.uuid4().hex}{suffix}"


def build_report(db: Session, user: User, period: str, disease: str) -> dict[str, Any]:
    query = db.query(Analysis).filter(
        Analysis.user_id == user.id,
        Analysis.status == "completed",
    )

    if period != "all":
        try:
            days = max(1, int(period))
        except ValueError:
            days = 7
        query = query.filter(Analysis.created_at >= utcnow() - timedelta(days=days))

    if disease and disease != "all":
        query = query.filter(Analysis.classe == disease)

    records = query.order_by(Analysis.created_at.desc()).all()
    total = len(records)
    healthy = sum(1 for record in records if is_healthy_class(record.classe))
    sick = total - healthy

    counter = Counter(record.classe or "Nao identificado" for record in records)
    most_common_name, most_common_count = (
        counter.most_common(1)[0] if counter else ("Nenhuma", 0)
    )

    distribution = [
        {
            "classe": classe,
            "quantidade": count,
            "percentual": round((count / total) * 100, 1) if total else 0,
        }
        for classe, count in counter.most_common()
    ]

    today = utcnow().date()
    dates = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    day_counts = Counter(
        record.created_at.date() for record in records if record.created_at is not None
    )
    period_series = [
        {
            "label": date.strftime("%d/%m"),
            "total": day_counts.get(date, 0),
        }
        for date in dates
    ]

    return {
        "total": total,
        "doentes": sick,
        "saudaveis": healthy,
        "percentual_doentes": round((sick / total) * 100, 1) if total else 0,
        "percentual_saudaveis": round((healthy / total) * 100, 1) if total else 0,
        "doenca_mais_comum": {
            "classe": most_common_name,
            "quantidade": most_common_count,
        },
        "distribuicao": distribution,
        "periodo": period_series,
        "historico": [serialize_analysis(record) for record in records[:10]],
        "doencas_disponiveis": sorted(counter.keys()),
    }


app = FastAPI(title="LabLeaf API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/imagens", StaticFiles(directory=BASE_DIR / "imagens"), name="imagens")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "database": "configured",
    }


@app.post("/api/auth/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    name = payload.nome.strip()
    email = normalize_email(payload.email)

    if not name:
        raise HTTPException(status_code=400, detail="Informe o nome.")

    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Informe um email valido.")

    if len(payload.senha) < 8:
        raise HTTPException(
            status_code=400, detail="A senha deve ter pelo menos 8 caracteres."
        )

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="Este email ja esta cadastrado.")

    user = User(name=name, email=email, password_hash=hash_password(payload.senha))
    db.add(user)
    db.commit()
    db.refresh(user)
    get_user_settings(db, user)

    token = create_session_token(db, user)

    return {"token": token, "user": user_payload(user)}


@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(payload.senha, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha invalidos.")

    token = create_session_token(db, user)
    return {"token": token, "user": user_payload(user)}


@app.post("/api/auth/logout")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(SECURITY),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if credentials is not None:
        db.query(AuthSession).filter(
            AuthSession.token_hash == hash_token(credentials.credentials)
        ).delete()
        db.commit()

    return {"message": "Sessao encerrada."}


@app.post("/api/auth/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    response: dict[str, Any] = {
        "message": "Se o email estiver cadastrado, enviaremos instrucoes para redefinir a senha."
    }

    if user is None:
        return response

    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(minutes=RESET_TOKEN_MINUTES),
        )
    )
    db.commit()

    if RETURN_RESET_TOKEN:
        response.update(
            {
                "reset_token": token,
                "reset_url": f"recuperar.html?token={token}",
                "expires_in_minutes": RESET_TOKEN_MINUTES,
            }
        )

    return response


@app.post("/api/auth/reset-password")
def reset_password(
    payload: ResetPasswordRequest, db: Session = Depends(get_db)
) -> dict[str, str]:
    if len(payload.senha) < 8:
        raise HTTPException(
            status_code=400, detail="A senha deve ter pelo menos 8 caracteres."
        )

    if payload.senha != payload.confirmar_senha:
        raise HTTPException(status_code=400, detail="As senhas nao coincidem.")

    reset_token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == hash_token(payload.token))
        .first()
    )

    if (
        reset_token is None
        or reset_token.used_at is not None
        or as_utc(reset_token.expires_at) < utcnow()
    ):
        raise HTTPException(status_code=400, detail="Link invalido ou expirado.")

    reset_token.user.password_hash = hash_password(payload.senha)
    reset_token.used_at = utcnow()
    db.query(AuthSession).filter(AuthSession.user_id == reset_token.user_id).delete()
    db.commit()

    return {"message": "Senha atualizada com sucesso."}


@app.get("/api/me")
def me(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": user_payload(user)}


@app.get("/api/plans")
def list_plans() -> dict[str, Any]:
    return {"items": [dict(plan) for plan in PLAN_CATALOG.values()]}


@app.get("/api/subscription")
def current_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return {"subscription": subscription_payload(get_subscription(db, user))}


@app.post("/api/subscription/checkout")
def checkout_subscription(
    payload: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    plan = PLAN_CATALOG.get(payload.plan_id)

    if plan is None:
        raise HTTPException(status_code=400, detail="Plano invalido.")

    card_digits = "".join(char for char in payload.card_number if char.isdigit())
    card_expiry = payload.card_expiry.strip()
    card_cvv = payload.card_cvv.strip()

    if not payload.card_name.strip():
        raise HTTPException(status_code=400, detail="Informe o nome do cartao.")

    if len(card_digits) < 12:
        raise HTTPException(status_code=400, detail="Numero do cartao invalido.")

    if len(card_cvv) < 3:
        raise HTTPException(status_code=400, detail="CVV invalido.")

    if "/" not in card_expiry:
        raise HTTPException(status_code=400, detail="Validade invalida.")

    now = utcnow()
    payment_id = f"fake_{uuid.uuid4().hex[:16]}"
    payment_method = f"Cartao final {card_digits[-4:]}"
    subscription = get_subscription(db, user)

    if subscription is None:
        subscription = Subscription(
            user_id=user.id,
            plan_id=plan["id"],
            payment_id=payment_id,
            payment_method=payment_method,
            tokens_total=plan["tokens"],
            tokens_used=0,
            started_at=now,
            expires_at=now + timedelta(days=PLAN_CYCLE_DAYS),
            updated_at=now,
            status="active",
        )
        db.add(subscription)
    else:
        subscription.plan_id = plan["id"]
        subscription.status = "active"
        subscription.payment_id = payment_id
        subscription.payment_method = payment_method
        subscription.tokens_total = plan["tokens"]
        subscription.tokens_used = 0
        subscription.started_at = now
        subscription.expires_at = now + timedelta(days=PLAN_CYCLE_DAYS)
        subscription.updated_at = now

    db.commit()
    db.refresh(subscription)

    return {
        "message": "Pagamento ficticio aprovado. Plano ativado com sucesso.",
        "subscription": subscription_payload(subscription),
    }


@app.put("/api/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    name = payload.nome.strip()
    email = normalize_email(payload.email)

    if not name:
        raise HTTPException(status_code=400, detail="Informe o nome.")

    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Informe um email valido.")

    existing_user = (
        db.query(User).filter(User.email == email, User.id != user.id).first()
    )
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="Este email ja esta em uso.")

    user.name = name
    user.email = email
    db.commit()
    db.refresh(user)

    return {"user": user_payload(user)}


@app.put("/api/profile/password")
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not verify_password(payload.senha_atual, user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")

    if len(payload.nova_senha) < 8:
        raise HTTPException(
            status_code=400, detail="A nova senha deve ter pelo menos 8 caracteres."
        )

    if payload.nova_senha != payload.confirmar_senha:
        raise HTTPException(status_code=400, detail="As senhas nao coincidem.")

    user.password_hash = hash_password(payload.nova_senha)
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()

    return {"message": "Senha alterada com sucesso. Entre novamente."}


@app.get("/api/settings")
def get_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return {"settings": settings_payload(get_user_settings(db, user))}


@app.put("/api/settings")
def update_settings(
    payload: SettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    allowed_periods = {"7", "30", "all"}
    if payload.default_report_period not in allowed_periods:
        raise HTTPException(status_code=400, detail="Periodo padrao invalido.")

    settings = get_user_settings(db, user)
    settings.default_report_period = payload.default_report_period
    settings.email_notifications = payload.email_notifications
    settings.save_uploaded_images = payload.save_uploaded_images
    settings.compact_dashboard = payload.compact_dashboard
    settings.updated_at = utcnow()
    db.commit()
    db.refresh(settings)

    return {"settings": settings_payload(settings)}


@app.post("/api/analyses")
async def create_analysis(
    classe: str = Form(...),
    confianca: float | None = Form(None),
    recomendacao: str | None = Form(None),
    imagem_resultado: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    class_name = classe.strip()
    if not class_name:
        raise HTTPException(status_code=400, detail="Informe a classe da analise.")

    subscription = require_analysis_token(db, user)
    original_name = "sem-arquivo"
    stored_name = ""
    image_url = ""
    settings = get_user_settings(db, user)
    initial_recommendation = recomendacao.strip() if recomendacao else ""

    if is_empty_recommendation(initial_recommendation):
        initial_recommendation = recommendation_for_class(class_name)

    if file is not None and file.filename:
        if file.content_type and not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Envie um arquivo de imagem.")

        original_name, stored_name = secure_upload_name(file.filename)

        if settings.save_uploaded_images:
            file_path = UPLOADS_DIR / stored_name

            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            image_url = f"/uploads/{stored_name}"
        else:
            stored_name = ""

    record = Analysis(
        user_id=user.id,
        original_filename=original_name,
        stored_filename=stored_name,
        image_url=image_url,
        result_image_url=imagem_resultado,
        classe=class_name,
        confianca=confianca,
        recomendacao=initial_recommendation or None,
        status="completed",
    )
    db.add(record)
    subscription.tokens_used += 1
    subscription.updated_at = utcnow()
    db.commit()
    db.refresh(record)
    db.refresh(subscription)

    response = serialize_analysis(record)
    response["analysis_id"] = record.id
    response["subscription"] = subscription_payload(subscription)
    return response


@app.get("/api/analyses")
def list_analyses(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    records = (
        db.query(Analysis)
        .filter(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .all()
    )
    return {"items": [serialize_analysis(record) for record in records]}


@app.get("/api/reports/summary")
def report_summary(
    period: str = "7",
    disease: str = "all",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return build_report(db, user, period, disease)


@app.get("/api/analyses/{analysis_id}")
def get_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    record = (
        db.query(Analysis)
        .filter(Analysis.id == analysis_id, Analysis.user_id == user.id)
        .first()
    )

    if record is None:
        raise HTTPException(status_code=404, detail="Analise nao encontrada.")

    return serialize_analysis(record)


PUBLIC_FILES = {
    "index.html",
    "login.html",
    "cadastro.html",
    "recuperar.html",
    "relatorio.html",
    "planos.html",
    "perfil.html",
    "configuracoes.html",
    "menu.html",
    "style.css",
    "login.css",
    "cadastro.css",
    "conta.css",
    "relatorio.css",
    "planos.css",
    "menu.css",
    "script.js",
    "auth.js",
    "config.js",
    "recuperar.js",
    "perfil.js",
    "configuracoes.js",
    "planos.js",
    "relatorio.js",
    "menu.js",
}


@app.get("/", include_in_schema=False)
def root() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/config.js", include_in_schema=False)
def runtime_config() -> PlainTextResponse:
    api_base = os.getenv("PUBLIC_API_BASE", "")
    ai_api_url = os.getenv("AI_API_URL", "https://lableafapi.onrender.com/predict")
    content = "\n".join(
        [
            f"window.LABLEAF_API_BASE = {json.dumps(api_base)};",
            f"window.LABLEAF_AI_API_URL = {json.dumps(ai_api_url)};",
            "",
        ]
    )
    return PlainTextResponse(content, media_type="application/javascript")


@app.get("/{filename}", include_in_schema=False)
def public_file(filename: str) -> FileResponse:
    if filename not in PUBLIC_FILES:
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    path = BASE_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    return FileResponse(path)
