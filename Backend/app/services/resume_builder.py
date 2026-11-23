from __future__ import annotations

from fpdf import FPDF

from app.schemas.resume_builder import ResumeData
from app.services import llm

SYSTEM = """\
You are a resume parser. Extract structured data from the raw resume text below.

Rules:
- Parse the text into the JSON schema provided.
- For personal info: extract name, email, phone, location, LinkedIn URL, and portfolio URL.
- For experience: extract each position with company, role, dates, and description.
  Set "current" to true if the position says "Present" or "Current" for end date.
- For projects: extract name, description, technologies used, and link if any.
- For education: extract institution, degree, field of study, dates, and GPA if mentioned.
- For certifications: extract name, issuer, and date.
- For skills: list all technical skills mentioned as short canonical names (e.g. "python", "react").
- For summary: extract or synthesize a professional summary from the resume.
- If a field is not found in the text, leave it as the default empty value.
- Use camelCase for all JSON keys.\
"""


def parse(text: str) -> ResumeData:
    """Parse raw resume text into structured ResumeData via LLM."""
    return llm.complete_json(ResumeData, SYSTEM, text)


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

_FONT = "Helvetica"
_PAGE_W = 210  # A4 mm
_MARGIN = 15
_CONTENT_W = _PAGE_W - 2 * _MARGIN


# The core Helvetica font is Latin-1 only, so typographic characters that the
# resume data or the templates contain (em dashes, bullets, smart quotes) must be
# transliterated before drawing. Without this fpdf2 raises and the export fails.
_TRANSLITERATE = str.maketrans({
    "\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"',
    "\u201d": '"', "\u2022": "-", "\u2026": "...", "\u00a0": " ", "\u2192": "->",
})


def _font_safe(text: str) -> str:
    """Replace characters the built-in PDF font cannot encode."""
    translated = text.translate(_TRANSLITERATE)
    return translated.encode("latin-1", "replace").decode("latin-1")


class _ResumePDF(FPDF):
    """Thin wrapper for resume-specific helpers."""

    # Every string passes through one of these two methods, so sanitising here
    # covers user data and template strings alike.
    @staticmethod
    def _clean(args, kwargs):
        args = list(args)
        if len(args) > 2 and isinstance(args[2], str):
            args[2] = _font_safe(args[2])
        if isinstance(kwargs.get("text"), str):
            kwargs["text"] = _font_safe(kwargs["text"])
        return args, kwargs

    def cell(self, *args, **kwargs):
        args, kwargs = self._clean(args, kwargs)
        return super().cell(*args, **kwargs)

    def multi_cell(self, *args, **kwargs):
        args, kwargs = self._clean(args, kwargs)
        return super().multi_cell(*args, **kwargs)

    def _section_title(self, title: str) -> None:
        self.set_font(_FONT, "B", 13)
        self.set_text_color(40, 40, 40)
        self.cell(0, 8, title.upper(), new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(80, 80, 80)
        self.line(self.l_margin, self.get_y(), _PAGE_W - self.r_margin, self.get_y())
        self.ln(3)

    def _body(self, text: str, size: int = 10) -> None:
        self.set_font(_FONT, "", size)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def _bold_line(self, text: str, size: int = 11) -> None:
        self.set_font(_FONT, "B", size)
        self.set_text_color(30, 30, 30)
        self.cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")

    def _light_line(self, text: str, size: int = 9) -> None:
        self.set_font(_FONT, "I", size)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")


def _date_range(start: str, end: str, current: bool = False) -> str:
    parts = []
    if start:
        parts.append(start)
    if current:
        parts.append("Present")
    elif end:
        parts.append(end)
    return " - ".join(parts) if parts else ""


def _build_professional(pdf: _ResumePDF, data: ResumeData) -> None:
    """Professional template: lines, borders, structured."""
    p = data.personal

    # Header
    pdf.set_font(_FONT, "B", 22)
    pdf.set_text_color(20, 20, 20)
    name = p.name or "Your Name"
    pdf.cell(0, 12, name, new_x="LMARGIN", new_y="NEXT", align="C")

    contact_parts = [v for v in [p.email, p.phone, p.location] if v]
    if contact_parts:
        pdf.set_font(_FONT, "", 9)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 5, "  |  ".join(contact_parts), new_x="LMARGIN", new_y="NEXT", align="C")

    links = [v for v in [p.linkedin, p.portfolio] if v]
    if links:
        pdf.set_font(_FONT, "", 9)
        pdf.cell(0, 5, "  |  ".join(links), new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_draw_color(40, 40, 40)
    pdf.set_line_width(0.5)
    pdf.line(pdf.l_margin, pdf.get_y() + 3, _PAGE_W - pdf.r_margin, pdf.get_y() + 3)
    pdf.ln(7)

    # Summary
    if data.summary:
        pdf._section_title("Professional Summary")
        pdf._body(data.summary)
        pdf.ln(2)

    # Skills
    if data.skills:
        pdf._section_title("Skills")
        pdf._body(", ".join(data.skills))
        pdf.ln(2)

    # Experience
    if data.experience:
        pdf._section_title("Experience")
        for exp in data.experience:
            pdf._bold_line(f"{exp.role}  —  {exp.company}")
            dr = _date_range(exp.start_date, exp.end_date, exp.current)
            if dr:
                pdf._light_line(dr)
            if exp.description:
                pdf.ln(1)
                for line in exp.description.split("\n"):
                    line = line.strip()
                    if line:
                        pdf._body(f"• {line}" if not line.startswith("•") else line, 10)
            pdf.ln(2)

    # Projects
    if data.projects:
        pdf._section_title("Projects")
        for proj in data.projects:
            pdf._bold_line(proj.name)
            if proj.technologies:
                pdf._light_line("Tech: " + ", ".join(proj.technologies))
            if proj.description:
                pdf.ln(1)
                pdf._body(proj.description)
            if proj.link:
                pdf._light_line(proj.link)
            pdf.ln(2)

    # Education
    if data.education:
        pdf._section_title("Education")
        for edu in data.education:
            degree_field = " in ".join([v for v in [edu.degree, edu.field] if v])
            pdf._bold_line(edu.institution)
            if degree_field:
                pdf._light_line(degree_field)
            dr = _date_range(edu.start_date, edu.end_date)
            if dr:
                pdf._light_line(dr)
            if edu.gpa:
                pdf._light_line(f"GPA: {edu.gpa}")
            pdf.ln(2)

    # Certifications
    if data.certifications:
        pdf._section_title("Certifications")
        for cert in data.certifications:
            parts = [cert.name]
            if cert.issuer:
                parts.append(f"— {cert.issuer}")
            if cert.date:
                parts.append(f"({cert.date})")
            pdf._body(" ".join(parts))


def _build_minimal(pdf: _ResumePDF, data: ResumeData) -> None:
    """Minimal template: clean, no borders or lines."""
    p = data.personal

    # Header — just name, large and clean
    pdf.set_font(_FONT, "B", 24)
    pdf.set_text_color(0, 0, 0)
    name = p.name or "Your Name"
    pdf.cell(0, 14, name, new_x="LMARGIN", new_y="NEXT")

    contact_parts = [v for v in [p.email, p.phone, p.location, p.linkedin, p.portfolio] if v]
    if contact_parts:
        pdf.set_font(_FONT, "", 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5, "  •  ".join(contact_parts), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # Summary
    if data.summary:
        pdf.set_font(_FONT, "B", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "SUMMARY", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        pdf._body(data.summary)
        pdf.ln(3)

    # Skills
    if data.skills:
        pdf.set_font(_FONT, "B", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "SKILLS", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        pdf._body(", ".join(data.skills))
        pdf.ln(3)

    # Experience
    if data.experience:
        pdf.set_font(_FONT, "B", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "EXPERIENCE", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        for exp in data.experience:
            pdf._bold_line(f"{exp.role}  —  {exp.company}", 10)
            dr = _date_range(exp.start_date, exp.end_date, exp.current)
            if dr:
                pdf._light_line(dr)
            if exp.description:
                pdf.ln(1)
                for line in exp.description.split("\n"):
                    line = line.strip()
                    if line:
                        pdf._body(f"• {line}" if not line.startswith("•") else line, 10)
            pdf.ln(2)

    # Projects
    if data.projects:
        pdf.set_font(_FONT, "B", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "PROJECTS", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        for proj in data.projects:
            pdf._bold_line(proj.name, 10)
            if proj.technologies:
                pdf._light_line("Tech: " + ", ".join(proj.technologies))
            if proj.description:
                pdf.ln(1)
                pdf._body(proj.description)
            if proj.link:
                pdf._light_line(proj.link)
            pdf.ln(2)

    # Education
    if data.education:
        pdf.set_font(_FONT, "B", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "EDUCATION", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        for edu in data.education:
            degree_field = " in ".join([v for v in [edu.degree, edu.field] if v])
            pdf._bold_line(edu.institution, 10)
            if degree_field:
                pdf._light_line(degree_field)
            dr = _date_range(edu.start_date, edu.end_date)
            if dr:
                pdf._light_line(dr)
            if edu.gpa:
                pdf._light_line(f"GPA: {edu.gpa}")
            pdf.ln(2)

    # Certifications
    if data.certifications:
        pdf.set_font(_FONT, "B", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "CERTIFICATIONS", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        for cert in data.certifications:
            parts = [cert.name]
            if cert.issuer:
                parts.append(f"— {cert.issuer}")
            if cert.date:
                parts.append(f"({cert.date})")
            pdf._body(" ".join(parts))


_BUILDERS = {
    "professional": _build_professional,
    "minimal": _build_minimal,
}


def export_pdf(data: ResumeData, template: str = "professional") -> bytes:
    """Generate a PDF resume from structured data. Returns raw PDF bytes."""
    builder = _BUILDERS.get(template, _build_professional)

    pdf = _ResumePDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=_MARGIN)
    pdf.set_margins(_MARGIN, _MARGIN, _MARGIN)
    pdf.add_page()

    builder(pdf, data)

    # fpdf2 >= 2.8 returns a bytearray, which Response cannot render.
    return bytes(pdf.output())
