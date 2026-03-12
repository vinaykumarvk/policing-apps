/**
 * Generate a sample Monthly Report Ingestion PDF for DOPAMS Module 2 demo.
 *
 * Usage:
 *   npx tsx apps/dopams-api/scripts/generate-sample-monthly-report.ts [output-path]
 *
 * Default output: apps/dopams-api/scripts/sample-monthly-report.pdf
 */

import { createPdfGenerator } from "@puda/api-integrations";
import { writeFileSync } from "fs";
import { resolve } from "path";

const outputPath = process.argv[2] || resolve(__dirname, "sample-monthly-report.pdf");

async function main() {
  const pdfGen = createPdfGenerator();
  const now = new Date();
  const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthLabel = prevMonth.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const buffer = await pdfGen.generate({
    header: {
      title: "Monthly Narcotics Intelligence Report",
      subtitle: `Reporting Period: ${prevMonthLabel}`,
      department: "DOPAMS — Drug Offenders Profile Analysis & Monitoring System",
      generatedBy: "Intelligence Bureau, State Anti-Narcotics Task Force",
      generatedAt: now.toISOString().slice(0, 10),
      referenceNumber: `DOP-MR-${reportMonth}-001`,
    },
    sections: [
      /* ── 1. Executive Summary ── */
      {
        type: "text",
        title: "1. Executive Summary",
        content:
          `This report presents a consolidated view of narcotics intelligence activities for ${prevMonthLabel}. ` +
          "During the reporting period, the Anti-Narcotics Task Force conducted 47 operations across 12 districts, " +
          "resulting in 23 arrests and the seizure of contraband valued at approximately INR 4.7 crore. " +
          "Cross-referencing with e-Courts data revealed 8 cases where bail was granted to repeat offenders, " +
          "necessitating enhanced surveillance. The lead-to-case conversion rate improved to 62% from 54% in the prior period. " +
          "Three new inter-state drug trafficking networks were identified through CDR analysis and financial trail mapping.",
      },

      /* ── 2. Key Performance Indicators ── */
      {
        type: "table",
        title: "2. Key Performance Indicators (KPIs)",
        headers: ["KPI", "Target", "Actual", "Achievement %", "Trend"],
        rows: [
          ["Active Subjects Under Monitoring", "—", "312", "—", "▲ +14"],
          ["New Subjects Profiled", "40", "47", "117.5%", "▲"],
          ["Lead Closure Rate", "80%", "62%", "77.5%", "▲ +8pp"],
          ["Avg. Case Resolution (days)", "30", "26", "115.4%", "▲"],
          ["Alert Response Time (hours)", "4.0", "3.2", "125.0%", "▲"],
          ["Memo Generation Rate", "—", "89", "—", "▲ +12"],
          ["Seizure Value (INR Crore)", "3.0", "4.7", "156.7%", "▲"],
          ["FIR Conversion Rate", "70%", "68%", "97.1%", "▼ -2pp"],
          ["Conviction Rate (e-Courts)", "60%", "52%", "86.7%", "▼ -4pp"],
          ["Inter-State Intel Shared", "10", "14", "140.0%", "▲"],
        ],
      },

      /* ── 3. District-wise Seizure Summary ── */
      {
        type: "table",
        title: "3. District-wise Seizure Summary",
        headers: ["District", "Operations", "Arrests", "Drug Type", "Qty (kg)", "Value (INR Lakh)"],
        rows: [
          ["Amritsar", "8", "5", "Heroin", "2.4", "120.0"],
          ["Ludhiana", "6", "3", "Opium, Poppy Husk", "45.0", "67.5"],
          ["Jalandhar", "5", "3", "Heroin, Tablets", "1.8", "95.0"],
          ["Ferozepur", "7", "4", "Heroin", "3.1", "155.0"],
          ["Fazilka", "4", "2", "Heroin", "1.2", "60.0"],
          ["Tarn Taran", "6", "2", "Poppy Husk", "38.0", "19.0"],
          ["Pathankot", "3", "1", "Charas", "5.5", "8.2"],
          ["Bathinda", "2", "1", "Tablets (Tramadol)", "8000 tabs", "4.0"],
          ["Moga", "3", "1", "Opium", "2.1", "10.5"],
          ["Sangrur", "2", "1", "Heroin, Charas", "0.8", "40.0"],
          ["Patiala", "1", "0", "—", "—", "—"],
          ["Kapurthala", "0", "0", "—", "—", "—"],
        ],
      },

      /* ── 4. E-Courts Integration Status ── */
      {
        type: "text",
        title: "4. E-Courts Integration — Data Ingestion Status",
        content:
          "During the reporting period, the DOPAMS e-Courts connector ingested case data from 6 district court portals. " +
          "A total of 142 NDPS case records were synchronized, with 97% match confidence against existing subject profiles. " +
          "8 cases flagged AMBIGUOUS (confidence < 60%) were routed for manual review. " +
          "3 new bail orders for high-risk subjects triggered automatic alert generation.\n\n" +
          "The following e-Courts portal URLs are configured for periodic data ingestion. " +
          "These URLs serve as the source for court case status, hearing schedules, bail orders, and conviction records.",
      },

      /* ── 5. E-Court URLs for Ingestion ── */
      {
        type: "table",
        title: "5. Configured E-Court Ingestion Sources",
        headers: ["Court / Portal", "URL", "Last Sync", "Status", "Records"],
        rows: [
          [
            "eCourts Services (National)",
            "https://services.ecourts.gov.in/ecourtindia_v6/",
            now.toISOString().slice(0, 10),
            "ACTIVE",
            "142",
          ],
          [
            "District Court Amritsar",
            "https://districts.ecourts.gov.in/amritsar",
            now.toISOString().slice(0, 10),
            "ACTIVE",
            "38",
          ],
          [
            "District Court Ludhiana",
            "https://districts.ecourts.gov.in/ludhiana",
            now.toISOString().slice(0, 10),
            "ACTIVE",
            "27",
          ],
          [
            "District Court Jalandhar",
            "https://districts.ecourts.gov.in/jalandhar",
            now.toISOString().slice(0, 10),
            "ACTIVE",
            "22",
          ],
          [
            "District Court Ferozepur",
            "https://districts.ecourts.gov.in/ferozepur",
            now.toISOString().slice(0, 10),
            "ACTIVE",
            "19",
          ],
          [
            "HC Punjab & Haryana",
            "https://highcourtchd.gov.in/",
            now.toISOString().slice(0, 10),
            "ACTIVE",
            "36",
          ],
          [
            "District Court Bathinda",
            "https://districts.ecourts.gov.in/bathinda",
            "—",
            "PENDING SETUP",
            "0",
          ],
          [
            "District Court Patiala",
            "https://districts.ecourts.gov.in/patiala",
            "—",
            "PENDING SETUP",
            "0",
          ],
        ],
      },

      /* ── 6. Ingestion Configuration Fields ── */
      {
        type: "keyValue",
        title: "6. Ingestion Configuration",
        entries: [
          { label: "Ingestion Mode", value: "Scheduled (every 6 hours) + On-demand manual trigger" },
          { label: "Data Types Ingested", value: "Case status, hearing schedules, bail orders, conviction records, FIR linkages" },
          { label: "Match Strategy", value: "Name + FIR number + Section of Law (confidence-scored)" },
          { label: "Ambiguity Threshold", value: "Confidence < 60% → routed to manual review queue" },
          { label: "Deduplication", value: "SHA-256 checksum on (case_number + court_code + hearing_date)" },
          { label: "Dead Letter Queue", value: "Failed ingestion records retained for 30 days with retry capability" },
          { label: "API Authentication", value: "Bearer token (per-court credentials stored in Secret Manager)" },
        ],
      },

      /* ── 7. Court Case Monitoring Summary ── */
      {
        type: "table",
        title: "7. Court Case Monitoring — NDPS Cases",
        headers: ["Case No.", "Court", "Subject", "NDPS Section", "Status", "Next Hearing"],
        rows: [
          ["NDPS-2026-0412", "Amritsar Sessions", "Gurpreet Singh", "21(c), 29", "Trial", "2026-04-15"],
          ["NDPS-2026-0398", "Ludhiana District", "Harjinder Kaur", "20, 25", "Bail Granted", "2026-04-22"],
          ["NDPS-2025-1187", "Ferozepur Sessions", "Ranjit Kumar", "21(b), 27A", "Arguments", "2026-03-28"],
          ["NDPS-2026-0445", "Jalandhar Sessions", "Amrit Pal", "22(c), 29", "Charge Framed", "2026-04-10"],
          ["NDPS-2025-0891", "HC Chandigarh", "Bikram Jit", "21(c), 27A", "Appeal Pending", "2026-05-02"],
          ["NDPS-2026-0467", "Tarn Taran District", "Sukhdev Singh", "15, 18", "Investigation", "2026-04-08"],
          ["NDPS-2025-1245", "Fazilka District", "Balwinder Singh", "21(c), 29", "Convicted", "—"],
          ["NDPS-2026-0389", "Amritsar Sessions", "Jaspreet Kaur", "22, 25A", "Bail Hearing", "2026-03-25"],
        ],
      },

      /* ── 8. Alerts Generated from E-Courts Data ── */
      {
        type: "table",
        title: "8. Alerts Generated from E-Courts Ingestion",
        headers: ["Alert ID", "Trigger", "Subject", "Severity", "Action Taken"],
        rows: [
          ["ALT-EC-001", "Bail granted to repeat offender", "Harjinder Kaur", "HIGH", "Surveillance activated"],
          ["ALT-EC-002", "Bail granted — flight risk flagged", "Ranjit Kumar", "CRITICAL", "Movement tracking initiated"],
          ["ALT-EC-003", "Case dismissed — re-evaluation needed", "Paramjit Gill", "MEDIUM", "Profile review scheduled"],
          ["ALT-EC-004", "Conviction — PD Act evaluation", "Balwinder Singh", "HIGH", "PD Act proceedings initiated"],
          ["ALT-EC-005", "Hearing postponed 3+ times", "Bikram Jit", "LOW", "Noted in case file"],
          ["ALT-EC-006", "Same advocate for co-accused", "Amrit Pal, Sukhdev", "MEDIUM", "Network link flagged"],
          ["ALT-EC-007", "Bail surety from known associate", "Jaspreet Kaur", "HIGH", "Associate profiled"],
          ["ALT-EC-008", "New NDPS case — existing subject", "Gurpreet Singh", "HIGH", "Case linked to profile"],
        ],
      },

      /* ── 9. Recommendations ── */
      {
        type: "text",
        title: "9. Recommendations",
        content:
          "1. Extend e-Courts integration to cover Bathinda and Patiala district courts (PENDING SETUP).\n" +
          "2. Automate PD Act fitness evaluation when conviction data is ingested from e-Courts.\n" +
          "3. Enhance bail-grant alert logic to cross-reference surety details with known associate database.\n" +
          "4. Establish data sharing MOU with NCB for inter-state case correlation.\n" +
          "5. Deploy NLP-based case order summarization for faster review of lengthy court orders.\n" +
          "6. Configure weekly scheduled reports for leadership with auto-publish workflow.",
      },

      /* ── 10. Annexure ── */
      {
        type: "text",
        title: "10. Annexure — Adding New E-Court Sources",
        content:
          "To configure a new e-Court URL for data ingestion in DOPAMS:\n\n" +
          "Step 1: Navigate to Admin Hub → Platform Connectors → E-Courts tab\n" +
          "Step 2: Click 'Add Connector' and enter the court portal URL\n" +
          "Step 3: Select data types to ingest (Case Status, Bail Orders, Hearing Schedule, Convictions)\n" +
          "Step 4: Configure polling interval (recommended: 6 hours for active courts)\n" +
          "Step 5: Set authentication credentials (if required by the portal)\n" +
          "Step 6: Run 'Test Connection' to validate connectivity\n" +
          "Step 7: Enable the connector — data will appear in the Ingestion Jobs queue\n\n" +
          "Alternatively, use the API endpoint:\n" +
          "  POST /api/v1/ingestion/connectors\n" +
          '  Body: { "connectorType": "ECOURTS", "name": "District Court XYZ",\n' +
          '          "config": { "baseUrl": "https://districts.ecourts.gov.in/xyz",\n' +
          '                      "dataTypes": ["case_status", "bail_orders", "hearings"],\n' +
          '                      "pollingIntervalSeconds": 21600 } }',
      },
    ],
    footer: {
      text: "Generated by DOPAMS — Drug Offenders Profile Analysis & Monitoring System",
      confidentiality: "CONFIDENTIAL — For authorized law enforcement personnel only. Unauthorized distribution prohibited.",
      pageNumbers: true,
    },
    watermark: "SAMPLE",
  });

  writeFileSync(outputPath, buffer);
  console.log(`Sample monthly report PDF generated: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("Failed to generate PDF:", err);
  process.exit(1);
});
