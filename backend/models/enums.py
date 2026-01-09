import enum

class GlobalRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN" # Tu (Platform Owner)
    USER = "USER" # Utilizator normal

class Methodology(str, enum.Enum):
    SCRUM = "SCRUM"
    KANBAN = "KANBAN"
    SCRUMBAN = "SCRUMBAN"

class InvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"