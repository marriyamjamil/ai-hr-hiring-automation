"""
Agent 0: Job Description Generator.

HR gives the key details of a role and the AI writes a professional job
description, a scoring rubric (used later by the resume scorer) and screening
questions (used later by the calling agent). HR must review and approve the result.
"""

import json

from openai import OpenAI

from app.config import settings

# Used if the AI returns a rubric that doesn't add up to 100
DEFAULT_RUBRIC = {
    "required_skills": 40,
    "relevant_experience": 25,
    "projects": 20,
    "education_certifications": 10,
    "other_job_related": 5,
}

SYSTEM_PROMPT = """You are an experienced HR content writer. You write professional, specific
and inclusive job descriptions that real companies publish.

SPELLING RULES
- HR may type quickly and make spelling mistakes. Never copy a mistake.
- Correct spelling, grammar and capitalisation in everything HR wrote, including the job title,
  skills and responsibilities. Use the official spelling of technologies (for example "pyton" -> "Python",
  "javascrpt" -> "JavaScript", "postgre sql" -> "PostgreSQL").
- Never change the meaning: fix the words, keep the facts.

FACT RULES
- Use only the facts HR provides. Never invent salary, benefits, company facts, tools, perks or requirements.
- Keep every skill HR listed (only correct its spelling). Do not add or remove skills.
- If key responsibilities are missing, write realistic duties that fit the job title, the skills and the
  experience level.
- If an optional field is empty, leave its section out completely. Never write "not specified".

FAIRNESS RULES
- Use neutral, inclusive language. Never mention or hint at age, gender, religion, ethnicity,
  marital status, nationality, disability, "young", "energetic", "native speaker" or similar.
- Do not ask for a photo, date of birth or any personal details.

JOB DESCRIPTION FORMAT (markdown, in this order)
1. "# <Job title>"
2. One line with: company · location (work arrangement) · employment type · department (if given) · reports to (if given)
3. "## About us": a short, polished version of HR's company description (leave it out if none was given).
4. "## About the role": 2-3 sentences on the purpose of the role and its impact.
5. "## Key responsibilities": 6-8 specific bullet points that start with action verbs.
   Expand HR's responsibilities into clear, concrete duties for this exact role.
6. "## Required qualifications": the required skills, the experience, and education if given.
7. "## Preferred qualifications": only if preferred skills are given.
8. "## What we offer": only if a salary range or benefits are given. List exactly what HR gave.
9. "## How to apply": use HR's instructions and deadline if given; otherwise say
   "Submit your CV through our application portal."
10. A final italic equal opportunity line: we welcome applicants of all backgrounds and
    will provide reasonable accommodations during the hiring process on request.
Match the requested tone (Professional, Friendly or Startup) while staying clear and respectful.
Write dates in a readable form, for example "30 November 2026".
Avoid generic filler duties such as "stay updated with the latest technologies".

SCREENING QUESTIONS
- Write 6-8 open-ended questions that reveal real ability. No yes/no questions.
- Never start a question with "Do you have", "Have you" or "Are you", and never use "If yes".
- Cover each required skill at least once, ideally with "Tell us about a time..." or
  "Describe how you..." style questions.
- Include one question about notice period or availability, and one about the work arrangement.
- Job-related only. Never ask about personal or protected matters.

SCORING RUBRIC
- Use exactly these five criteria: required_skills, relevant_experience, projects,
  education_certifications, other_job_related. Whole numbers that add up to 100.
- Adjust the weights to the role (for example, more weight on experience for senior roles,
  more on projects and education for junior roles or internships).

Return ONLY valid JSON in exactly this format:
{
  "jd_text": "<the full job description in markdown>",
  "rubric": {"required_skills": <int>, "relevant_experience": <int>, "projects": <int>, "education_certifications": <int>, "other_job_related": <int>},
  "screening_questions": ["<question>", "..."],
  "title": "<the job title with correct spelling>",
  "required_skills": ["<each required skill HR gave, correctly spelled>"],
  "preferred_skills": ["<each preferred skill HR gave, correctly spelled>"]
}"""


def _valid_rubric(rubric: dict) -> bool:
    """Check the rubric has the five criteria, whole numbers, and a total of 100."""
    if set(rubric) != set(DEFAULT_RUBRIC):
        return False
    try:
        return sum(int(value) for value in rubric.values()) == 100
    except (TypeError, ValueError):
        return False


def generate_jd(job_info: dict) -> dict:
    """Ask Azure OpenAI to write the JD, rubric and screening questions."""
    client = OpenAI(
        base_url=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
    )

    # Send only the fields HR actually filled in
    filled_in = {key: value for key, value in job_info.items() if value not in (None, "", [])}

    response = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        temperature=0.4,  # a little creativity for nice writing, but still consistent
        response_format={"type": "json_object"},  # forces the reply to be valid JSON
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Job details from HR:\n" + json.dumps(filled_in, indent=2)},
        ],
    )

    result = json.loads(response.choices[0].message.content)

    rubric = result.get("rubric", {})
    if _valid_rubric(rubric):
        rubric = {name: int(value) for name, value in rubric.items()}
    else:
        rubric = DEFAULT_RUBRIC

    return {
        "jd_text": result.get("jd_text", ""),
        "rubric": rubric,
        "screening_questions": result.get("screening_questions", []),
        # Corrected spelling from the AI; if it sent nothing, keep what HR typed
        "title": result.get("title") or job_info["title"],
        "required_skills": result.get("required_skills") or job_info.get("required_skills", []),
        "preferred_skills": result.get("preferred_skills") or job_info.get("preferred_skills", []),
    }