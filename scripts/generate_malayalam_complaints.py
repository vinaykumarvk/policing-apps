#!/usr/bin/env python3
"""Generate sample Malayalam police complaints as OCR-ready PDF/PNG documents.

Renders typed complaint letters (A4) through headless Chrome so Malayalam
script shaping (conjuncts, chillu) is correct. All names, phone numbers, and
vehicle numbers are fictitious; each page carries a SPECIMEN footer.

Usage: python3 scripts/generate_malayalam_complaints.py
Output: fixtures/complaints/malayalam/complaint-NN-<slug>.{html,pdf,png,txt}
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "complaints" / "malayalam"

COMPLAINTS = [
    {
        "slug": "drug-sale-near-school-ernakulam",
        "date": "02.07.2026",
        "to": ["സ്വീകർത്താവ്,", "സ്റ്റേഷൻ ഹൗസ് ഓഫീസർ,", "എറണാകുളം സെൻട്രൽ പോലീസ് സ്റ്റേഷൻ,", "എറണാകുളം ജില്ല."],
        "subject": "വിഷയം: സ്കൂൾ പരിസരത്ത് മയക്കുമരുന്ന് വിൽപ്പന നടക്കുന്നത് സംബന്ധിച്ച പരാതി.",
        "body": [
            "ഞാൻ എറണാകുളം ജില്ലയിലെ കലൂരിൽ താമസിക്കുന്ന രമേശ് കുമാർ ആണ്. കഴിഞ്ഞ രണ്ട് ആഴ്ചയായി ഞങ്ങളുടെ പ്രദേശത്തുള്ള ഗവൺമെന്റ് ഹയർ സെക്കൻഡറി സ്കൂളിന് സമീപം വൈകുന്നേരം അഞ്ച് മണിക്ക് ശേഷം രണ്ട് യുവാക്കൾ ബൈക്കിൽ എത്തി വിദ്യാർത്ഥികൾക്ക് മയക്കുമരുന്ന് വിൽക്കുന്നതായി ശ്രദ്ധയിൽപ്പെട്ടിട്ടുണ്ട്. കറുത്ത നിറത്തിലുള്ള ബൈക്കിലാണ് ഇവർ എത്തുന്നത്. വാഹനത്തിന്റെ നമ്പർ KL-07-AX-1234 ആണെന്ന് മനസ്സിലാക്കാൻ കഴിഞ്ഞു.",
            "സ്കൂൾ വിദ്യാർത്ഥികളുടെ ഭാവി അപകടത്തിലാക്കുന്ന ഈ പ്രവർത്തനത്തിൽ അടിയന്തരമായി അന്വേഷണം നടത്തി കുറ്റക്കാർക്കെതിരെ നിയമനടപടി സ്വീകരിക്കണമെന്ന് താഴ്മയായി അപേക്ഷിക്കുന്നു.",
        ],
        "from": ["വിശ്വസ്തതയോടെ,", "രമേശ് കുമാർ", "ടി.സി 14/523, കലൂർ, എറണാകുളം - 682017", "ഫോൺ: 94470 12345"],
    },
    {
        "slug": "whatsapp-threat-thiruvananthapuram",
        "date": "28.06.2026",
        "to": ["സ്വീകർത്താവ്,", "സ്റ്റേഷൻ ഹൗസ് ഓഫീസർ,", "സൈബർ ക്രൈം പോലീസ് സ്റ്റേഷൻ,", "തിരുവനന്തപുരം സിറ്റി."],
        "subject": "വിഷയം: വാട്ട്സ്ആപ്പ് വഴി തുടർച്ചയായി ഭീഷണി സന്ദേശങ്ങൾ ലഭിക്കുന്നത് സംബന്ധിച്ച്.",
        "body": [
            "ഞാൻ തിരുവനന്തപുരം പട്ടം സ്വദേശിനിയായ ലക്ഷ്മി നായർ ആണ്. കഴിഞ്ഞ ഒരാഴ്ചയായി അപരിചിതമായ നമ്പറിൽ നിന്ന് (98950 67890) എനിക്ക് വാട്ട്സ്ആപ്പിൽ തുടർച്ചയായി ഭീഷണി സന്ദേശങ്ങൾ ലഭിക്കുന്നു. പണം ആവശ്യപ്പെട്ടുകൊണ്ടും, നൽകിയില്ലെങ്കിൽ എന്റെ ഫോട്ടോകൾ സാമൂഹ്യ മാധ്യമങ്ങളിൽ പ്രചരിപ്പിക്കുമെന്നും ഭീഷണിപ്പെടുത്തുന്നു. സന്ദേശങ്ങളുടെ സ്ക്രീൻഷോട്ടുകൾ ഈ പരാതിയോടൊപ്പം സമർപ്പിക്കുന്നു.",
            "എന്റെ സുരക്ഷ കണക്കിലെടുത്ത് അടിയന്തരമായി അന്വേഷണം നടത്തി നടപടി സ്വീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.",
        ],
        "from": ["വിശ്വസ്തതയോടെ,", "ലക്ഷ്മി നായർ", "പട്ടം, തിരുവനന്തപുരം - 695004", "ഫോൺ: 94960 54321"],
    },
    {
        "slug": "suspicious-godown-kozhikode",
        "date": "30.06.2026",
        "to": ["സ്വീകർത്താവ്,", "ജില്ലാ പോലീസ് മേധാവി,", "കോഴിക്കോട് സിറ്റി."],
        "subject": "വിഷയം: ഉപയോഗശൂന്യമായ ഗോഡൗണിൽ രാത്രികാലങ്ങളിൽ നടക്കുന്ന സംശയാസ്പദമായ പ്രവർത്തനങ്ങൾ സംബന്ധിച്ച്.",
        "body": [
            "ഞാൻ കോഴിക്കോട് വെള്ളയിൽ പ്രദേശത്ത് താമസിക്കുന്ന അബ്ദുൽ റഹ്മാൻ ആണ്. ഞങ്ങളുടെ വീടിന് സമീപമുള്ള പഴയ ഗോഡൗണിൽ കഴിഞ്ഞ ഒരു മാസമായി അർദ്ധരാത്രിയിൽ ലോറികൾ വന്നു പോകുന്നതും അപരിചിതർ പെട്ടികൾ ഇറക്കുന്നതും കാണുന്നുണ്ട്. പകൽ സമയത്ത് ഗോഡൗൺ പൂട്ടിക്കിടക്കുകയാണ്. ഇത് മയക്കുമരുന്ന് സൂക്ഷിക്കുന്ന കേന്ദ്രമാകാമെന്ന് നാട്ടുകാർക്ക് ശക്തമായ സംശയമുണ്ട്.",
            "ഈ വിവരം അടിയന്തരമായി പരിശോധിച്ച് ആവശ്യമായ നടപടി സ്വീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.",
        ],
        "from": ["വിശ്വസ്തതയോടെ,", "അബ്ദുൽ റഹ്മാൻ", "വെള്ളയിൽ, കോഴിക്കോട് - 673032", "ഫോൺ: 90720 98765"],
    },
]

HTML_TEMPLATE = """<!doctype html>
<html lang="ml">
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 0; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    width: 210mm; min-height: 297mm; box-sizing: border-box;
    padding: 22mm 20mm 16mm;
    background: #fdfcf7;
    font-family: "Malayalam MN", "Malayalam Sangam MN", serif;
    font-size: 13.5pt; line-height: 1.9; color: #1a1a1a;
  }}
  .date {{ text-align: right; margin-bottom: 10mm; }}
  .to p, .from p {{ margin: 0; }}
  .subject {{ font-weight: 700; margin: 8mm 0; }}
  .salutation {{ margin: 0 0 5mm; }}
  .body p {{ margin: 0 0 5mm; text-align: justify; text-indent: 12mm; }}
  .from {{ margin-top: 12mm; }}
  .sign {{ margin-top: 10mm; }}
  .specimen {{
    margin-top: 12mm; padding-top: 3mm; border-top: 0.3mm solid #bbb;
    font-size: 8pt; color: #888; text-align: center;
    font-family: Helvetica, Arial, sans-serif;
  }}
</style>
</head>
<body>
  <p class="date">തീയതി: {date}</p>
  <div class="to">{to}</div>
  <p class="subject">{subject}</p>
  <p class="salutation">ബഹുമാനപ്പെട്ട സർ,</p>
  <div class="body">{body}</div>
  <div class="from">{sender}</div>
  <p class="sign">ഒപ്പ്: ______________</p>
  <p class="specimen">SPECIMEN — fictitious sample generated for OCR pipeline testing. Not a real complaint.</p>
</body>
</html>
"""


def render(complaint: dict, index: int) -> None:
    name = f"complaint-{index:02d}-{complaint['slug']}"
    html_path = OUT_DIR / f"{name}.html"
    pdf_path = OUT_DIR / f"{name}.pdf"
    png_path = OUT_DIR / f"{name}.png"
    txt_path = OUT_DIR / f"{name}.txt"

    html = HTML_TEMPLATE.format(
        date=complaint["date"],
        to="".join(f"<p>{line}</p>" for line in complaint["to"]),
        subject=complaint["subject"],
        body="".join(f"<p>{para}</p>" for para in complaint["body"]),
        sender="".join(f"<p>{line}</p>" for line in complaint["from"]),
    )
    html_path.write_text(html, encoding="utf-8")

    ground_truth = "\n".join(
        [f"തീയതി: {complaint['date']}", *complaint["to"], complaint["subject"],
         "ബഹുമാനപ്പെട്ട സർ,", *complaint["body"], *complaint["from"]]
    )
    txt_path.write_text(ground_truth + "\n", encoding="utf-8")

    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf_path}", str(html_path)],
        check=True, capture_output=True,
    )
    # PNG at ~150 DPI A4 (1240x1754) for image-ingestion testing
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         "--window-size=1240,1754", "--force-device-scale-factor=1.5",
         f"--screenshot={png_path}", str(html_path)],
        check=True, capture_output=True,
    )
    print(f"generated {name}.pdf / .png / .txt")


def main() -> None:
    if not Path(CHROME).exists():
        sys.exit("Google Chrome not found — required for Malayalam text shaping")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, complaint in enumerate(COMPLAINTS, start=1):
        render(complaint, index)


if __name__ == "__main__":
    main()
