# Temporary test for Agent 2 (delete this file after testing)
import json

from app.agents.screening_agent import gave_consent, opening_message, question_message, write_report

questions = [
    "How many years of Python experience do you have?",
    "Tell me about a REST API you built.",
]

print(opening_message("Ali", "Python Developer"))
print("Consent 'Yes sure':", gave_consent("Yes sure"))  # should be True
print("Consent 'no thanks':", gave_consent("no thanks"))  # should be False
print("Consent 'not sure':", gave_consent("not sure"))  # should be False
print(question_message(0, questions))

# A pretend finished call
transcript = [
    {"role": "agent", "text": opening_message("Ali", "Python Developer")},
    {"role": "candidate", "text": "Yes"},
    {"role": "agent", "text": question_message(0, questions)},
    {"role": "candidate", "text": "About 3 years, mostly Django and FastAPI."},
    {"role": "agent", "text": question_message(1, questions)},
    {"role": "candidate", "text": "I built an orders API in FastAPI with PostgreSQL and JWT login, used by 2,000 users."},
]

print(json.dumps(write_report("Python Developer", questions, transcript), indent=2))
