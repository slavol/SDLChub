from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from sqlalchemy import func

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database.session import SessionLocal
from backend.models.admin import SupportTicket, SupportTicketComment
from backend.models.user import User


DEMO_PREFIX = "[DEMO SUPPORT]"

REPORTERS = [
    ("maria.dumitrescu@sdlchub.demo", "Maria Dumitrescu"),
    ("radu.popescu@sdlchub.demo", "Radu Popescu"),
    ("elena.marin@sdlchub.demo", "Elena Marin"),
    ("bogdan.stan@sdlchub.demo", "Bogdan Stan"),
    ("ioana.pavel@sdlchub.demo", "Ioana Pavel"),
    ("victor.neagu@sdlchub.demo", "Victor Neagu"),
]

TICKETS = [
    {
        "title": "Board keeps old workflow columns after methodology switch",
        "priority": "CRITICAL",
        "status": "OPEN",
        "reporter": 0,
        "days_ago": 0,
        "description": (
            "I switched a project from Scrumban to Scrum, then Kanban, then back "
            "to Scrumban. The board kept refreshing and displayed stale columns."
        ),
        "comments": [
            ("user", "The project was GradeFlow. It happened after changing methodology three times quickly."),
            ("admin", "I am checking workflow config, visible columns and WIP limits for that project."),
            ("user", "The browser console also showed repeated task refresh calls."),
            ("admin", "I reproduced the stale workflow state and marked it as high priority."),
        ],
    },
    {
        "title": "Support page should show every comment on long tickets",
        "priority": "HIGH",
        "status": "IN_PROGRESS",
        "reporter": 1,
        "days_ago": 1,
        "description": "When a ticket has many replies, the admin view should not hide older comments.",
        "comments": [
            ("user", "I added five comments and only three were visible before scrolling."),
            ("admin", "The ticket detail panel is being converted to a scrollable conversation."),
            ("user", "Please keep delete controls available for each comment."),
            ("admin", "Comment deletion is now available in the conversation panel."),
            ("user", "Looks better, but please test with more demo data."),
        ],
    },
    {
        "title": "Archived project still allows editing in board routes",
        "priority": "CRITICAL",
        "status": "IN_PROGRESS",
        "reporter": 2,
        "days_ago": 2,
        "description": (
            "After archiving a project from Global Admin, Board and Backlog still "
            "allowed some controls to be used."
        ),
        "comments": [
            ("user", "Support should remain enabled, but all project work areas must be read-only."),
            ("admin", "I am validating the archive banner and disabled state on board, backlog, team and settings."),
        ],
    },
    {
        "title": "Email verification resend flow unclear after login",
        "priority": "HIGH",
        "status": "RESOLVED",
        "reporter": 3,
        "days_ago": 3,
        "description": "A new user who logs in before entering the verification code needs a direct resend page.",
        "comments": [
            ("user", "Login should redirect to verify email, not just fail."),
            ("admin", "Redirect and resend action were fixed in the auth flow."),
            ("user", "Confirmed, the email is delivered now."),
        ],
    },
    {
        "title": "Task detail properties overlap audit trail",
        "priority": "HIGH",
        "status": "OPEN",
        "reporter": 4,
        "days_ago": 4,
        "description": "On /dashboard/tasks/:id the properties panel floats over audit log after scrolling.",
        "comments": [
            ("user", "The right-side properties card covers audit entries on smaller screens."),
            ("admin", "The layout needs another responsive pass for the TaskId page."),
        ],
    },
    {
        "title": "Calendar meeting should warn when member is on leave",
        "priority": "MEDIUM",
        "status": "RESOLVED",
        "reporter": 5,
        "days_ago": 5,
        "description": "When creating a meeting, the calendar should detect vacations or unavailable blocks.",
        "comments": [
            ("user", "I added vacation for a developer and still created a meeting."),
            ("admin", "Availability conflicts are now shown before saving the meeting."),
        ],
    },
    {
        "title": "AI provider key setup needs clearer encrypted storage state",
        "priority": "MEDIUM",
        "status": "IN_PROGRESS",
        "reporter": 0,
        "days_ago": 6,
        "description": (
            "Project owners can add their own AI provider, but the UI should clearly "
            "show that the key is encrypted and not readable afterwards."
        ),
        "comments": [
            ("user", "I do not want the key visible after saving."),
            ("admin", "The API stores only encrypted material and returns metadata/state to the UI."),
        ],
    },
    {
        "title": "Dashboard risk cards feel detached from the main content",
        "priority": "MEDIUM",
        "status": "CLOSED",
        "reporter": 1,
        "days_ago": 8,
        "description": "Right-side risk lists should feel integrated with the page instead of pasted beside it.",
        "comments": [
            ("user", "The old right rail looked like a separate app."),
            ("admin", "Risk cards were moved into the dashboard card flow."),
            ("user", "Confirmed, this looks cleaner now."),
        ],
    },
    {
        "title": "Global Admin sidebar active section does not update while scrolling",
        "priority": "HIGH",
        "status": "OPEN",
        "reporter": 2,
        "days_ago": 0,
        "description": "The admin navigation stays highlighted on Command Center even when scrolling lower.",
        "comments": [
            ("user", "Identity, Project Registry and Support Desk do not become active live."),
            ("admin", "The sidebar needs to track the internal admin scroll container, not only the URL hash."),
        ],
    },
    {
        "title": "Reports PDF export should include Kanban lead time",
        "priority": "LOW",
        "status": "RESOLVED",
        "reporter": 3,
        "days_ago": 9,
        "description": "The report export should include flow metrics for Kanban projects.",
        "comments": [
            ("user", "Velocity alone is not enough for Kanban."),
            ("admin", "Lead time and flow metrics were added to reports and PDF export."),
        ],
    },
    {
        "title": "DevOps pull requests page needs manual confirmation actions",
        "priority": "MEDIUM",
        "status": "CLOSED",
        "reporter": 4,
        "days_ago": 10,
        "description": "Admins and tech leads need a page to confirm imported GitHub pull requests.",
        "comments": [
            ("user", "Webhook sync is nice, but I also want a manual review page."),
            ("admin", "Pull request review page and confirmation flow were implemented."),
        ],
    },
    {
        "title": "Account security should show active sessions",
        "priority": "LOW",
        "status": "RESOLVED",
        "reporter": 5,
        "days_ago": 11,
        "description": "Users should see active sessions and a security log in account settings.",
        "comments": [
            ("user", "I want to revoke sessions from the profile page."),
            ("admin", "Session list, revoke action and security log are now available."),
        ],
    },
]


def get_or_create_user(db, email: str, full_name: str) -> User:
    user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
    if user:
        if not user.full_name:
            user.full_name = full_name
        return user

    user = User(
        email=email,
        full_name=full_name,
        hashed_password="demo-seed-not-for-login",
        is_active=True,
        is_global_admin=False,
    )
    db.add(user)
    db.flush()
    return user


def first_admin(db) -> User | None:
    return (
        db.query(User)
        .filter(User.is_global_admin.is_(True))
        .order_by(User.id.asc())
        .first()
    )


def seed_support_tickets() -> None:
    db = SessionLocal()
    try:
        reporters = [get_or_create_user(db, email, name) for email, name in REPORTERS]
        admin = first_admin(db)
        now = datetime.now(timezone.utc)
        created = 0

        for index, item in enumerate(TICKETS):
            full_title = f"{DEMO_PREFIX} {item['title']}"
            ticket = db.query(SupportTicket).filter(SupportTicket.title == full_title).first()
            if ticket:
                continue

            created_at = now - timedelta(days=item["days_ago"], hours=index)
            reporter = reporters[item["reporter"] % len(reporters)]
            ticket = SupportTicket(
                reporter_id=reporter.id,
                reporter_email=reporter.email,
                title=full_title,
                description=item["description"],
                priority=item["priority"],
                status=item["status"],
                created_at=created_at,
                updated_at=created_at + timedelta(hours=len(item["comments"]) or 1),
            )
            db.add(ticket)
            db.flush()

            for comment_index, (author_type, body) in enumerate(item["comments"]):
                is_admin = author_type == "admin"
                author = admin if is_admin and admin else reporter
                db.add(
                    SupportTicketComment(
                        ticket_id=ticket.id,
                        author_id=author.id if author else None,
                        body=body,
                        is_admin_note=is_admin,
                        created_at=created_at + timedelta(minutes=20 * (comment_index + 1)),
                    )
                )

            created += 1

        db.commit()
        print(f"Seed complete. Created {created} demo support tickets.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_support_tickets()
