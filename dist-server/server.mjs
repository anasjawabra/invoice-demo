// server/standalone.js
import http from "node:http";
import fs4 from "node:fs";
import path4 from "node:path";
import { fileURLToPath } from "node:url";

// src/data/clock.js
var ISO = /^\d{4}-\d{2}-\d{2}$/;
function riyadhToday(now = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function override() {
  try {
    if (typeof globalThis !== "undefined" && ISO.test(globalThis.__DEMO_TODAY__ || "")) return globalThis.__DEMO_TODAY__;
    if (typeof window !== "undefined" && window.location) {
      const q3 = new URLSearchParams(window.location.search).get("demoToday");
      if (q3 && ISO.test(q3)) {
        window.sessionStorage.setItem("ib_demo_today", q3);
        return q3;
      }
      if (q3 === "reset") window.sessionStorage.removeItem("ib_demo_today");
      const s = window.sessionStorage.getItem("ib_demo_today");
      if (s && ISO.test(s) && q3 !== "reset") return s;
    }
  } catch {
  }
  return null;
}
var DEMO_TODAY = override() || riyadhToday();
var IS_TIME_TRAVEL = DEMO_TODAY !== riyadhToday();

// src/data/amanahHierarchy.js
var HIERARCHY = [
  { order: 1, ref: "MREF-000-000", amanahKey: null, kind: "ministry_hq", nameAr: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A \u0648\u0644\u0625\u0633\u0643\u0627\u0646", sourceNameAr: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A \u0648\u0644\u0625\u0633\u0643\u0627\u0646", parentSourceAr: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A \u0648\u0627\u0644\u0625\u0633\u0643\u0627\u0646", flags: ["ministry_hq", "spelling_variant"] },
  { order: 2, ref: "MREF-004-000", amanahKey: "Makkah Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629", flags: ["amanah_self", "parent_alias"] },
  { order: 3, ref: "MREF-004-001", amanahKey: "Makkah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062C\u0645\u0648\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062C\u0645\u0648\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629", flags: ["parent_alias"] },
  { order: 4, ref: "MREF-004-002", amanahKey: "Makkah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0633\u0641\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0633\u0641\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629", flags: ["parent_alias"] },
  { order: 5, ref: "MREF-004-003", amanahKey: "Makkah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062F\u0631\u0643\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062F\u0631\u0643\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629", flags: ["parent_alias"] },
  { order: 6, ref: "MREF-005-000", amanahKey: "Al Madinah Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["amanah_self", "parent_alias"] },
  { order: 7, ref: "MREF-005-001", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u064A\u0646\u0628\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u064A\u0646\u0628\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 8, ref: "MREF-005-002", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u062F\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u062F\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 9, ref: "MREF-005-003", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u064A\u0628\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u064A\u0628\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 10, ref: "MREF-005-004", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062D\u0646\u0627\u0643\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062D\u0646\u0627\u0643\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 11, ref: "MREF-005-005", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0647\u062F", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0647\u062F", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 12, ref: "MREF-005-006", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u064A\u0646\u0628\u0639 \u0627\u0644\u0646\u062E\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u064A\u0646\u0628\u0639 \u0627\u0644\u0646\u062E\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 13, ref: "MREF-005-007", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062F\u0649 \u0627\u0644\u0641\u0631\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062F\u0649 \u0627\u0644\u0641\u0631\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 14, ref: "MREF-005-008", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u064A\u0635", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u064A\u0635", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 15, ref: "MREF-005-009", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0633\u0648", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0633\u0648", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 16, ref: "MREF-005-010", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0646\u062E\u064A\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0646\u062E\u064A\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 17, ref: "MREF-005-011", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0633\u064A\u062C\u064A\u062F \u0648\u0627\u0644\u0642\u0627\u062D\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0633\u064A\u062C\u064A\u062F \u0648\u0627\u0644\u0642\u0627\u062D\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 18, ref: "MREF-005-012", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0634\u0627\u0634", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0634\u0627\u0634", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 19, ref: "MREF-005-013", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062B\u0631\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062B\u0631\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 20, ref: "MREF-005-014", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0648\u064A\u0631\u0642\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0648\u064A\u0631\u0642\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 21, ref: "MREF-005-015", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u0644\u0635\u0644\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u0644\u0635\u0644\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 22, ref: "MREF-005-016", amanahKey: "Al Madinah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0644\u064A\u0644\u0629 \u062C\u0647\u064A\u0646\u0629 \u0648\u0627\u0644\u0645\u0631\u0628\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0644\u064A\u0644\u0629 \u062C\u0647\u064A\u0646\u0629 \u0648\u0627\u0644\u0645\u0631\u0628\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", flags: ["parent_alias"] },
  { order: 23, ref: "MREF-001-000", amanahKey: "Riyadh Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: ["amanah_self"] },
  { order: 24, ref: "MREF-001-001", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062E\u0631\u062C", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062E\u0631\u062C", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 25, ref: "MREF-001-002", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0648\u0627\u062F\u0645\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0648\u0627\u062F\u0645\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 26, ref: "MREF-001-003", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0641\u064A\u0641", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0641\u064A\u0641", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 27, ref: "MREF-001-004", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u062C\u0645\u0639\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u062C\u0645\u0639\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 28, ref: "MREF-001-005", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0632\u0644\u0641\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0632\u0644\u0641\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 29, ref: "MREF-001-006", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0648\u0627\u062F\u064A \u0627\u0644\u062F\u0648\u0627\u0633\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0648\u0627\u062F\u064A \u0627\u0644\u062F\u0648\u0627\u0633\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 30, ref: "MREF-001-007", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0634\u0642\u0631\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0634\u0642\u0631\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 31, ref: "MREF-001-008", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0648\u064A\u0639\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0648\u064A\u0639\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 32, ref: "MREF-001-009", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0631\u0639\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0631\u0639\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 33, ref: "MREF-001-010", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0627\u0641\u0644\u0627\u062C", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0627\u0641\u0644\u0627\u062C", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 34, ref: "MREF-001-011", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0648\u0637\u0629 \u0628\u0646\u064A \u062A\u0645\u064A\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0648\u0637\u0629 \u0628\u0646\u064A \u062A\u0645\u064A\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 35, ref: "MREF-001-012", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062D\u0648\u0637\u0629 \u0633\u062F\u064A\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062D\u0648\u0637\u0629 \u0633\u062F\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 36, ref: "MREF-001-013", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062F\u0644\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062F\u0644\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 37, ref: "MREF-001-014", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0633\u0644\u064A\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0633\u0644\u064A\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 38, ref: "MREF-001-015", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0631\u064A\u0645\u0644\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0631\u064A\u0645\u0644\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 39, ref: "MREF-001-016", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0636\u0631\u0645\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0636\u0631\u0645\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 40, ref: "MREF-001-017", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0631\u0627\u062A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0631\u0627\u062A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 41, ref: "MREF-001-018", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0632\u0627\u062D\u0645\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0632\u0627\u062D\u0645\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 42, ref: "MREF-001-019", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u063A\u0627\u0637", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u063A\u0627\u0637", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 43, ref: "MREF-001-020", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062A\u0645\u064A\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062A\u0645\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 44, ref: "MREF-001-021", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062B\u0627\u062F\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062B\u0627\u062F\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 45, ref: "MREF-001-022", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062C\u0644\u0627\u062C\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062C\u0644\u0627\u062C\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 46, ref: "MREF-001-023", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062D\u0631\u064A\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062D\u0631\u064A\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 47, ref: "MREF-001-024", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0648\u0636\u0629 \u0633\u062F\u064A\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0648\u0636\u0629 \u0633\u062F\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 48, ref: "MREF-001-025", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u064A\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u064A\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 49, ref: "MREF-001-026", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0644\u0648\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0644\u0648\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 50, ref: "MREF-001-027", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0648\u064A\u0636\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0648\u064A\u0636\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 51, ref: "MREF-001-028", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u064A\u064A\u0646\u0629 \u0648\u0627\u0644\u062C\u0628\u064A\u0644\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u064A\u064A\u0646\u0629 \u0648\u0627\u0644\u062C\u0628\u064A\u0644\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 52, ref: "MREF-001-029", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0647\u064A\u0627\u062B\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0647\u064A\u0627\u062B\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 53, ref: "MREF-001-030", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u062C\u0627\u062F\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u062C\u0627\u062F\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 54, ref: "MREF-001-031", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0627\u062C\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0627\u062C\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 55, ref: "MREF-001-032", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0645\u0627\u062D", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0645\u0627\u062D", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 56, ref: "MREF-001-033", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0646\u0641\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0646\u0641\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 57, ref: "MREF-001-034", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0635\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0635\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 58, ref: "MREF-001-035", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0647\u062F\u0627\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0647\u062F\u0627\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 59, ref: "MREF-001-036", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u0631\u0637\u0627\u0648\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u0631\u0637\u0627\u0648\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 60, ref: "MREF-001-037", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062C\u0645\u0634", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062C\u0645\u0634", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 61, ref: "MREF-001-038", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062D\u0644\u0628\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062D\u0644\u0628\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 62, ref: "MREF-001-039", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0634\u064A\u0642\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0634\u064A\u0642\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 63, ref: "MREF-001-040", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u062D\u0645\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u062D\u0645\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 64, ref: "MREF-001-041", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0631\u0648\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0631\u0648\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 65, ref: "MREF-001-042", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0635\u0627\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0635\u0627\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 66, ref: "MREF-001-043", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u062F\u0627\u0626\u0639 \u0627\u0644\u0639\u0636\u064A\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u062F\u0627\u0626\u0639 \u0627\u0644\u0639\u0636\u064A\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 67, ref: "MREF-001-044", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062C\u0644\u0647 \u0648\u062A\u0628\u0631\u0627\u0643", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062C\u0644\u0647 \u0648\u062A\u0628\u0631\u0627\u0643", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 68, ref: "MREF-001-045", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u062F\u064A\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u062F\u064A\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 69, ref: "MREF-001-046", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 70, ref: "MREF-001-047", amanahKey: "Riyadh Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u064A\u0627\u0646\u064A\u0629 \u0648\u0627\u0644\u0628\u0631\u0643", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u064A\u0627\u0646\u064A\u0629 \u0648\u0627\u0644\u0628\u0631\u0643", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", flags: [] },
  { order: 71, ref: "MREF-002-000", amanahKey: "Jeddah Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: ["amanah_self"] },
  { order: 72, ref: "MREF-002-001", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0627\u0628\u063A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0627\u0628\u063A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 73, ref: "MREF-002-002", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0646\u0641\u0630\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0646\u0641\u0630\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 74, ref: "MREF-002-003", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0644\u064A\u062B", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0644\u064A\u062B", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 75, ref: "MREF-002-004", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u0644\u064A\u0635", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u0644\u064A\u0635", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 76, ref: "MREF-002-005", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0648\u0632 (\u0627\u0644\u0642\u0646\u0641\u0630\u0629)", sourceNameAr: "(\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0648\u0632(\u0627\u0644\u0642\u0646\u0641\u0630\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: ["name_format"] },
  { order: 77, ref: "MREF-002-006", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0643\u0627\u0645\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0643\u0627\u0645\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 78, ref: "MREF-002-007", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0636\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0636\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 79, ref: "MREF-002-008", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0631\u0636\u064A\u0629 \u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0631\u0636\u064A\u0629 \u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 80, ref: "MREF-002-009", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062D\u062C\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062D\u062C\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 81, ref: "MREF-002-010", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0638\u064A\u0644\u0641", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0638\u064A\u0644\u0641", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 82, ref: "MREF-002-011", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0644\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0644\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 83, ref: "MREF-002-012", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0648\u0627\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0648\u0627\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 84, ref: "MREF-002-013", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0631\u0636\u064A\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0631\u0636\u064A\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 85, ref: "MREF-002-014", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u063A\u0645\u064A\u0642\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u063A\u0645\u064A\u0642\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 86, ref: "MREF-002-015", amanahKey: "Jeddah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0628\u062A \u0627\u0644\u062C\u0627\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0628\u062A \u0627\u0644\u062C\u0627\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", flags: [] },
  { order: 87, ref: "MREF-003-000", amanahKey: "Eastern Province Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: ["amanah_self"] },
  { order: 88, ref: "MREF-003-001", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0637\u064A\u0641", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0637\u064A\u0641", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 89, ref: "MREF-003-002", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062E\u0641\u062C\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062E\u0641\u062C\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 90, ref: "MREF-003-003", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062C\u0628\u064A\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062C\u0628\u064A\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 91, ref: "MREF-003-004", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0642\u064A\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0642\u064A\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 92, ref: "MREF-003-005", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0646\u0639\u064A\u0631\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0646\u0639\u064A\u0631\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 93, ref: "MREF-003-006", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0627\u0633 \u062A\u0646\u0648\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0627\u0633 \u062A\u0646\u0648\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 94, ref: "MREF-003-007", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0641\u064A\u0639\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0641\u064A\u0639\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 95, ref: "MREF-003-008", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0642\u0631\u064A\u0629 \u0627\u0644\u0639\u0644\u064A\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0642\u0631\u064A\u0629 \u0627\u0644\u0639\u0644\u064A\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 96, ref: "MREF-003-009", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0644\u064A\u062C\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0644\u064A\u062C\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 97, ref: "MREF-003-010", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u0631\u0627\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u0631\u0627\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 98, ref: "MREF-003-011", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0644\u0647\u0627\u0628\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0644\u0647\u0627\u0628\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 99, ref: "MREF-009-001", amanahKey: "Al-Ahsa Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0631\u064A\u0639\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0631\u064A\u0639\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", flags: [] },
  { order: 100, ref: "MREF-003-012", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062C\u0648\u0641 \u0628\u0646\u064A \u0647\u0627\u062C\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062C\u0648\u0641 \u0628\u0646\u064A \u0647\u0627\u062C\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 101, ref: "MREF-003-013", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0644\u064A\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0644\u064A\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 102, ref: "MREF-003-014", amanahKey: "Eastern Province Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u064A\u0646 \u062F\u0627\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u064A\u0646 \u062F\u0627\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", flags: [] },
  { order: 103, ref: "MREF-006-000", amanahKey: "Asir Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: ["amanah_self"] },
  { order: 104, ref: "MREF-006-001", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u0645\u064A\u0633 \u0645\u0634\u064A\u0637", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u0645\u064A\u0633 \u0645\u0634\u064A\u0637", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 105, ref: "MREF-006-002", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u064A\u0634\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u064A\u0634\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 106, ref: "MREF-006-003", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0638\u0647\u0631\u0627\u0646 \u0627\u0644\u062C\u0646\u0648\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0638\u0647\u0631\u0627\u0646 \u0627\u0644\u062C\u0646\u0648\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 107, ref: "MREF-006-004", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0646\u0645\u0627\u0635", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0646\u0645\u0627\u0635", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 108, ref: "MREF-006-005", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u062D\u0627\u064A\u0644 \u0639\u0633\u064A\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u062D\u0627\u064A\u0644 \u0639\u0633\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 109, ref: "MREF-006-006", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u062D\u062F \u0631\u0641\u064A\u062F\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u062D\u062F \u0631\u0641\u064A\u062F\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 110, ref: "MREF-006-007", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062A\u062B\u0644\u064A\u062B", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062A\u062B\u0644\u064A\u062B", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 111, ref: "MREF-006-008", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062A\u0646\u0648\u0645\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062A\u0646\u0648\u0645\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 112, ref: "MREF-006-009", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0633\u0631\u0627\u0629 \u0639\u0628\u064A\u062F\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0633\u0631\u0627\u0629 \u0639\u0628\u064A\u062F\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 113, ref: "MREF-006-010", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0644\u0642\u0631\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0644\u0642\u0631\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 114, ref: "MREF-006-011", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u062C\u0627\u0644 \u0627\u0644\u0645\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u062C\u0627\u0644 \u0627\u0644\u0645\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 115, ref: "MREF-006-012", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u062C\u0627\u0631\u062F\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u062C\u0627\u0631\u062F\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 116, ref: "MREF-006-013", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0631\u062C\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0631\u062C\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 117, ref: "MREF-006-014", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0628\u0648\u0639\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0628\u0648\u0639\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 118, ref: "MREF-006-015", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0644\u0644\u0633\u0645\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0644\u0644\u0633\u0645\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 119, ref: "MREF-006-016", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0637\u0631\u064A\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0637\u0631\u064A\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 120, ref: "MREF-006-017", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0634\u0627\u0626\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0634\u0627\u0626\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 121, ref: "MREF-006-018", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0627\u0631\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0627\u0631\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 122, ref: "MREF-006-019", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u062D\u0631 \u0623\u0628\u0648 \u0633\u0643\u064A\u0646\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u062D\u0631 \u0623\u0628\u0648 \u0633\u0643\u064A\u0646\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 123, ref: "MREF-006-020", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062F\u064A \u0628\u0646 \u0647\u0634\u0628\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062F\u064A \u0628\u0646 \u0647\u0634\u0628\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 124, ref: "MREF-006-021", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0631\u0643", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0631\u0643", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 125, ref: "MREF-006-022", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0627\u0632\u0645\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0627\u0632\u0645\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 126, ref: "MREF-006-023", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0635\u0628\u062D \u0628\u0644\u0644\u062D\u0645\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0635\u0628\u062D \u0628\u0644\u0644\u062D\u0645\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 127, ref: "MREF-006-024", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0641\u0631\u0634\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0641\u0631\u0634\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 128, ref: "MREF-006-025", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0646\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0646\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 129, ref: "MREF-006-026", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u0628\u064A\u062E\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u0628\u064A\u062E\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 130, ref: "MREF-006-027", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062B\u0646\u064A\u0629 \u0648\u062A\u0628\u0627\u0644\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062B\u0646\u064A\u0629 \u0648\u062A\u0628\u0627\u0644\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 131, ref: "MREF-006-028", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0646\u0642\u064A\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0646\u0642\u064A\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 132, ref: "MREF-006-029", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0635\u0645\u062E", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0635\u0645\u062E", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 133, ref: "MREF-006-030", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u0639\u0645\u0631\u0648", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u0639\u0645\u0631\u0648", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 134, ref: "MREF-006-031", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0627\u062D\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0627\u062D\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 135, ref: "MREF-006-032", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0648\u0627\u062F\u064A\u064A\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0648\u0627\u062F\u064A\u064A\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 136, ref: "MREF-006-033", amanahKey: "Asir Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u0645\u0648\u0627\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u0645\u0648\u0627\u0647", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", flags: [] },
  { order: 137, ref: "MREF-008-000", amanahKey: "Al-Qassim Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: ["amanah_self"] },
  { order: 138, ref: "MREF-008-001", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0646\u064A\u0632\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0646\u064A\u0632\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 139, ref: "MREF-008-002", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0631\u0633", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0631\u0633", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 140, ref: "MREF-008-003", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0628\u0643\u064A\u0631\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0628\u0643\u064A\u0631\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 141, ref: "MREF-008-004", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0630\u0646\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0630\u0646\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 142, ref: "MREF-008-005", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0627\u0633\u064A\u0627\u062D", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0627\u0633\u064A\u0627\u062D", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 143, ref: "MREF-008-006", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0628\u062F\u0627\u0626\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0628\u062F\u0627\u0626\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 144, ref: "MREF-008-007", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u064A\u0627\u0636 \u0627\u0644\u062E\u0628\u0631\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u064A\u0627\u0636 \u0627\u0644\u062E\u0628\u0631\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 145, ref: "MREF-008-008", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062E\u0628\u0631\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062E\u0628\u0631\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 146, ref: "MREF-008-009", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u064A\u0648\u0646 \u0627\u0644\u062C\u0648\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u064A\u0648\u0646 \u0627\u0644\u062C\u0648\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 147, ref: "MREF-008-010", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0636\u0631\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0636\u0631\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 148, ref: "MREF-008-011", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0635\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0635\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 149, ref: "MREF-008-012", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062F\u062E\u0646\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062F\u062E\u0646\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 150, ref: "MREF-008-013", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0642\u0644\u0629 \u0627\u0644\u0635\u0642\u0648\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0639\u0642\u0644\u0629 \u0627\u0644\u0635\u0642\u0648\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 151, ref: "MREF-008-014", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0646\u0628\u0647\u0627\u0646\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0646\u0628\u0647\u0627\u0646\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 152, ref: "MREF-008-015", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0634\u0645\u0627\u0633\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0634\u0645\u0627\u0633\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 153, ref: "MREF-008-016", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0628\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0628\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 154, ref: "MREF-008-017", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0648\u0627\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0648\u0627\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 155, ref: "MREF-008-018", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0623\u0628\u0627\u0646\u0627\u062A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0623\u0628\u0627\u0646\u0627\u062A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 156, ref: "MREF-008-019", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0641\u0648\u0627\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0641\u0648\u0627\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 157, ref: "MREF-008-020", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0645\u0627\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0645\u0627\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 158, ref: "MREF-008-021", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0634\u0631\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0634\u0631\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 159, ref: "MREF-008-022", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0641\u0648\u064A\u0644\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0641\u0648\u064A\u0644\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 160, ref: "MREF-008-023", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0635\u064A\u0628\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0635\u064A\u0628\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 161, ref: "MREF-008-024", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0635\u0631 \u0628\u0646 \u0639\u0642\u064A\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0635\u0631 \u0628\u0646 \u0639\u0642\u064A\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 162, ref: "MREF-008-025", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062F\u0644\u064A\u0645\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062F\u0644\u064A\u0645\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 163, ref: "MREF-008-026", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0638\u0627\u0647\u0631\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0638\u0627\u0647\u0631\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 164, ref: "MREF-008-027", amanahKey: "Al-Qassim Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0637\u064A\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0637\u064A\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", flags: [] },
  { order: 165, ref: "MREF-010-000", amanahKey: "Jazan Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: ["amanah_self"] },
  { order: 166, ref: "MREF-010-001", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0635\u0628\u064A\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0635\u0628\u064A\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 167, ref: "MREF-010-002", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0641\u064A\u0641\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0641\u064A\u0641\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 168, ref: "MREF-010-003", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0628\u0649 \u0639\u0631\u064A\u0634", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0628\u0649 \u0639\u0631\u064A\u0634", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 169, ref: "MREF-010-004", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0637\u0629 \u0628\u064A\u0634", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0637\u0629 \u0628\u064A\u0634", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 170, ref: "MREF-010-005", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0635\u0627\u0645\u0637\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0635\u0627\u0645\u0637\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 171, ref: "MREF-010-006", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u062D\u062F \u0627\u0644\u0645\u0633\u0627\u0631\u062D\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u062D\u062F \u0627\u0644\u0645\u0633\u0627\u0631\u062D\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 172, ref: "MREF-010-007", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0637\u0648\u0627\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0637\u0648\u0627\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 173, ref: "MREF-010-008", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0641\u0631\u0633\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0641\u0631\u0633\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 174, ref: "MREF-010-009", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062F\u0649 \u062C\u0627\u0632\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062F\u0649 \u062C\u0627\u0632\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 175, ref: "MREF-010-010", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0648\u0633\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0648\u0633\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 176, ref: "MREF-010-011", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0636\u0645\u062F", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0636\u0645\u062F", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 177, ref: "MREF-010-012", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0639\u0627\u0631\u0636\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0639\u0627\u0631\u0636\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 178, ref: "MREF-010-013", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0631\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0631\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 179, ref: "MREF-010-014", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0631\u062B", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0631\u062B", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 180, ref: "MREF-010-015", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0627\u0626\u0631 \u0628\u0646\u064A \u0645\u0627\u0644\u0643", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062F\u0627\u0626\u0631 \u0628\u0646\u064A \u0645\u0627\u0644\u0643", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 181, ref: "MREF-010-016", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0642\u064A\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0642\u064A\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 182, ref: "MREF-010-017", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0639\u064A\u062F\u0627\u0628\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0639\u064A\u062F\u0627\u0628\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 183, ref: "MREF-010-018", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0647\u0631\u0648\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0647\u0631\u0648\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 184, ref: "MREF-010-019", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0647\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0647\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 185, ref: "MREF-010-020", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0631\u064A\u062B", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0631\u064A\u062B", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 186, ref: "MREF-010-021", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0636\u0627\u064A\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0636\u0627\u064A\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 187, ref: "MREF-010-022", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0627\u0644\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0627\u0644\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 188, ref: "MREF-010-023", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0642\u0648", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0642\u0648", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 189, ref: "MREF-010-024", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0648\u0632 \u0627\u0644\u062C\u0639\u0627\u0641\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0648\u0632 \u0627\u0644\u062C\u0639\u0627\u0641\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 190, ref: "MREF-010-025", amanahKey: "Jazan Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0641\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0641\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", flags: [] },
  { order: 191, ref: "MREF-017-000", amanahKey: "Al Jawf Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: ["amanah_self"] },
  { order: 192, ref: "MREF-017-001", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0631\u064A\u0627\u062A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0631\u064A\u0627\u062A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 193, ref: "MREF-017-002", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062F\u0648\u0645\u0629 \u0627\u0644\u062C\u0646\u062F\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062F\u0648\u0645\u0629 \u0627\u0644\u062C\u0646\u062F\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 194, ref: "MREF-017-003", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0637\u0628\u0631\u062C\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0637\u0628\u0631\u062C\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 195, ref: "MREF-017-004", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0635\u0648\u064A\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0635\u0648\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 196, ref: "MREF-017-005", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u064A\u0633\u0627\u0648\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u064A\u0633\u0627\u0648\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 197, ref: "MREF-017-006", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0628\u0648\u0639\u062C\u0631\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0628\u0648\u0639\u062C\u0631\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 198, ref: "MREF-017-007", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0646\u0627\u0635\u0641\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0646\u0627\u0635\u0641\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 199, ref: "MREF-017-008", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0632\u0644\u0648\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0632\u0644\u0648\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 200, ref: "MREF-017-009", amanahKey: "Al Jawf Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u062F\u064A\u062B\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u062F\u064A\u062B\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", flags: [] },
  { order: 201, ref: "MREF-011-000", amanahKey: "Tabuk Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: ["amanah_self"] },
  { order: 202, ref: "MREF-011-001", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062A\u064A\u0645\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062A\u064A\u0645\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 203, ref: "MREF-011-002", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0645\u0644\u062C", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0645\u0644\u062C", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 204, ref: "MREF-011-003", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0636\u0628\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0636\u0628\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 205, ref: "MREF-011-004", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0648\u062C\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0648\u062C\u0647", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 206, ref: "MREF-011-005", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0642\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0642\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 207, ref: "MREF-011-006", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u062F\u0639", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u062F\u0639", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 208, ref: "MREF-011-007", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u064A\u0631 \u0628\u0646 \u0647\u0631\u0645\u0627\u0633", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u064A\u0631 \u0628\u0646 \u0647\u0631\u0645\u0627\u0633", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 209, ref: "MREF-011-008", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0644\u064A\u0628\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0644\u064A\u0628\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 210, ref: "MREF-011-009", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0634\u0648\u0627\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0634\u0648\u0627\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 211, ref: "MREF-011-010", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0646\u062C\u0648\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0646\u062C\u0648\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 212, ref: "MREF-011-011", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0628\u062D\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0628\u062D\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 213, ref: "MREF-011-012", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u062F\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u062F\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 214, ref: "MREF-011-013", amanahKey: "Tabuk Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0628\u0648 \u0631\u0627\u0643\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0628\u0648 \u0631\u0627\u0643\u0647", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", flags: [] },
  { order: 215, ref: "MREF-012-000", amanahKey: "Ha'il Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: ["amanah_self"] },
  { order: 216, ref: "MREF-012-001", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0642\u0639\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0642\u0639\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 217, ref: "MREF-012-002", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062A\u0631\u0628\u0629 \u0628\u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062A\u0631\u0628\u0629 \u0628\u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 218, ref: "MREF-012-003", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u062C\u0628\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u062C\u0628\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 219, ref: "MREF-012-004", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0627\u0626\u0637", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0627\u0626\u0637", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 220, ref: "MREF-012-005", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062E\u0637\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062E\u0637\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 221, ref: "MREF-012-006", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0648\u0636\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0648\u0636\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 222, ref: "MREF-012-007", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0644\u064A\u0645\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0644\u064A\u0645\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 223, ref: "MREF-012-008", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0645\u0644\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0645\u0644\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 224, ref: "MREF-012-009", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0643\u0647\u0641\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0643\u0647\u0641\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 225, ref: "MREF-012-010", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0648\u0642\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0648\u0642\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 226, ref: "MREF-012-011", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0645\u064A\u0631\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0645\u064A\u0631\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 227, ref: "MREF-012-012", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0634\u0646\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0634\u0646\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 228, ref: "MREF-012-013", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u063A\u0632\u0627\u0644\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u063A\u0632\u0627\u0644\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 229, ref: "MREF-012-014", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0644\u064A\u0641\u0629 \u0627\u0644\u0633\u0641\u0644\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0644\u064A\u0641\u0629 \u0627\u0644\u0633\u0641\u0644\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 230, ref: "MREF-012-015", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0641\u064A\u062F", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0641\u064A\u062F", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 231, ref: "MREF-012-016", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u062C\u0641\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u062C\u0641\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 232, ref: "MREF-012-017", amanahKey: "Ha'il Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0646\u0628\u0648\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0646\u0628\u0648\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", flags: [] },
  { order: 233, ref: "MREF-013-000", amanahKey: "Northern Borders Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: ["amanah_self"] },
  { order: 234, ref: "MREF-013-001", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0641\u062D\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0641\u062D\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 235, ref: "MREF-013-002", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0637\u0631\u064A\u0641", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0637\u0631\u064A\u0641", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 236, ref: "MREF-013-003", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0648\u064A\u0642\u064A\u0644\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0648\u064A\u0642\u064A\u0644\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 237, ref: "MREF-013-004", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0634\u0639\u0628\u0629 \u0646\u0635\u0627\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0634\u0639\u0628\u0629 \u0646\u0635\u0627\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 238, ref: "MREF-013-005", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0644\u064A\u0646\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0644\u064A\u0646\u0647", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 239, ref: "MREF-013-006", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0637\u0644\u0639\u0629 \u0627\u0644\u062A\u0645\u064A\u0627\u0637", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0637\u0644\u0639\u0629 \u0627\u0644\u062A\u0645\u064A\u0627\u0637", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 240, ref: "MREF-013-007", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0631\u064A\u0629 \u0628\u0646 \u0634\u0631\u064A\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u0631\u064A\u0629 \u0628\u0646 \u0634\u0631\u064A\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 241, ref: "MREF-013-008", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0648\u0636\u0629 \u0647\u0628\u0627\u0633", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0648\u0636\u0629 \u0647\u0628\u0627\u0633", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 242, ref: "MREF-013-009", amanahKey: "Northern Borders Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0645 \u062E\u0646\u0635\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0623\u0645 \u062E\u0646\u0635\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", flags: [] },
  { order: 243, ref: "MREF-016-000", amanahKey: "Al Bahah Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: ["amanah_self"] },
  { order: 244, ref: "MREF-016-001", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0644\u062C\u0631\u0634\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u0644\u062C\u0631\u0634\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 245, ref: "MREF-016-002", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0642\u0644\u0648\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0642\u0644\u0648\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 246, ref: "MREF-016-003", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0646\u062F\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0646\u062F\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 247, ref: "MREF-016-004", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u062E\u0648\u0627\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u062E\u0648\u0627\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 248, ref: "MREF-016-005", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0639\u0642\u064A\u0642", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0639\u0642\u064A\u0642", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 249, ref: "MREF-016-006", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0631\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0642\u0631\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 250, ref: "MREF-016-007", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u0643\u0628\u064A\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u0643\u0628\u064A\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 251, ref: "MREF-016-008", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u062C\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u062C\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 252, ref: "MREF-016-009", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u063A\u0627\u0645\u062F \u0627\u0644\u0632\u0646\u0627\u062F", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u063A\u0627\u0645\u062F \u0627\u0644\u0632\u0646\u0627\u062F", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 253, ref: "MREF-016-010", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u062D\u0633\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u062D\u0633\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 254, ref: "MREF-016-011", amanahKey: "Al Bahah Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0639\u0634\u0648\u0642\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u0639\u0634\u0648\u0642\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", flags: [] },
  { order: 255, ref: "MREF-014-000", amanahKey: "Najran Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: ["amanah_self"] },
  { order: 256, ref: "MREF-014-001", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0634\u0631\u0648\u0631\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0634\u0631\u0648\u0631\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 257, ref: "MREF-014-002", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u064A\u062F\u0645\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u064A\u062F\u0645\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 258, ref: "MREF-014-003", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0628\u0648\u0646\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0628\u0648\u0646\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 259, ref: "MREF-014-004", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0644\u0637\u0627\u0646\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0644\u0637\u0627\u0646\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 260, ref: "MREF-014-005", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u062F\u0631 \u0627\u0644\u062C\u0646\u0648\u0628", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0628\u062F\u0631 \u0627\u0644\u062C\u0646\u0648\u0628", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 261, ref: "MREF-014-006", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062B\u0627\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062B\u0627\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 262, ref: "MREF-014-007", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u0628\u0627\u0634", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062E\u0628\u0627\u0634", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 263, ref: "MREF-014-008", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0648\u062F\u064A\u0639\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0648\u062F\u064A\u0639\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 264, ref: "MREF-014-009", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0635\u064A\u0646\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062D\u0635\u064A\u0646\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 265, ref: "MREF-014-010", amanahKey: "Najran Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0626\u0631 \u0639\u0633\u0643\u0631", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0626\u0631 \u0639\u0633\u0643\u0631", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", flags: [] },
  { order: 266, ref: "MREF-007-000", amanahKey: "Taif Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: ["amanah_self"] },
  { order: 267, ref: "MREF-007-001", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062A\u0631\u0628\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062A\u0631\u0628\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 268, ref: "MREF-007-002", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062E\u0631\u0645\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062E\u0631\u0645\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 269, ref: "MREF-007-003", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0646\u064A\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0631\u0646\u064A\u0629", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 270, ref: "MREF-007-004", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0648\u064A\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u0648\u064A\u0647", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 271, ref: "MREF-007-005", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u064A\u0633\u0627\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0645\u064A\u0633\u0627\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 272, ref: "MREF-007-006", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u0633\u0639\u062F", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0628\u0646\u064A \u0633\u0639\u062F", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 273, ref: "MREF-007-007", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u062D\u0627\u0646\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u062D\u0627\u0646\u064A", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 274, ref: "MREF-007-008", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u064A\u0627", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0642\u064A\u0627", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 275, ref: "MREF-007-009", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0631\u064A\u0639 \u0628\u0646\u064A \u0645\u0627\u0644\u0643", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u0631\u064A\u0639 \u0628\u0646\u064A \u0645\u0627\u0644\u0643", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 276, ref: "MREF-007-010", amanahKey: "Taif Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0638\u0644\u0645", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0638\u0644\u0645", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", flags: [] },
  { order: 277, ref: "MREF-009-000", amanahKey: "Al-Ahsa Amanah", kind: "amanah_self", nameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", sourceNameAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", flags: ["amanah_self"] },
  { order: 278, ref: "MREF-009-002", amanahKey: "Al-Ahsa Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u064A\u0628\u0631\u064A\u0646", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u064A\u0628\u0631\u064A\u0646", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", flags: [] },
  { order: 279, ref: "MREF-009-003", amanahKey: "Al-Ahsa Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0644\u0648\u0649", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0633\u0644\u0648\u0649", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", flags: [] },
  { order: 280, ref: "MREF-009-004", amanahKey: "Al-Ahsa Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0637\u062D\u0627\u0621", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0628\u0637\u062D\u0627\u0621", parentSourceAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", flags: [] },
  { order: 281, ref: "MREF-015-000", amanahKey: "Hafr Al-Batin Amanah", kind: "amanah_self", nameAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", sourceNameAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", parentSourceAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", flags: ["amanah_self", "spelling_variant"] },
  { order: 282, ref: "MREF-015-001", amanahKey: "Hafr Al-Batin Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u064A\u0635\u0648\u0645\u0629", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0642\u064A\u0635\u0648\u0645\u0629", parentSourceAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", flags: ["spelling_variant"] },
  { order: 283, ref: "MREF-015-002", amanahKey: "Hafr Al-Batin Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u062F\u0627\u0648\u064A", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0635\u062F\u0627\u0648\u064A", parentSourceAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", flags: ["spelling_variant"] },
  { order: 284, ref: "MREF-015-003", amanahKey: "Hafr Al-Batin Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0630\u064A\u0628\u064A\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0630\u064A\u0628\u064A\u0647", parentSourceAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", flags: ["spelling_variant"] },
  { order: 285, ref: "MREF-015-004", amanahKey: "Hafr Al-Batin Amanah", kind: "municipality", nameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0639\u064A\u0631\u0647", sourceNameAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0633\u0639\u064A\u0631\u0647", parentSourceAr: "\u0627\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", flags: ["spelling_variant"] }
];
var MUNICIPALITY_NOT_SPECIFIED = { ar: "\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631", en: "Municipality not specified in source" };
var BY_AMANAH = /* @__PURE__ */ new Map();
var SELF = /* @__PURE__ */ new Map();
var BY_REF = /* @__PURE__ */ new Map();
for (const e of HIERARCHY) {
  if (e.kind === "municipality") {
    const m = { refId: e.ref, key: `${e.amanahKey}|${e.ref}`, amanahKey: e.amanahKey, order: e.order, ar: e.nameAr, en: e.nameAr, sourceNameAr: e.sourceNameAr, flags: e.flags, kind: "municipality" };
    (BY_AMANAH.get(e.amanahKey) || BY_AMANAH.set(e.amanahKey, []).get(e.amanahKey)).push(m);
    BY_REF.set(e.ref, m);
  } else if (e.kind === "amanah_self" && e.amanahKey) SELF.set(e.amanahKey, e);
}
var MAX_MUNICIPALITIES = Math.max(0, ...[...BY_AMANAH.values()].map((v) => v.length));
var municipalitiesOf = (amanahKey) => (BY_AMANAH.get(amanahKey) || []).slice();
var municipalityCountOf = (amanahKey) => (BY_AMANAH.get(amanahKey) || []).length;
var municipalityByRef = (refId) => BY_REF.get(refId) || null;
var municipalityByKey = (key) => {
  const s = String(key ?? "");
  const i = s.lastIndexOf("|");
  const m = i < 0 ? null : BY_REF.get(s.slice(i + 1));
  return m && m.key === s ? m : null;
};
var amanahSelfOf = (amanahKey) => SELF.get(amanahKey) || null;
function findMunicipality(amanahKey, name, norm2 = (x) => String(x ?? "").trim()) {
  const k = norm2(name);
  if (!k) return null;
  return municipalitiesOf(amanahKey).find((m) => norm2(m.ar) === k || norm2(m.sourceNameAr) === k) || null;
}

// src/data/catalog.js
var ENTITIES = [
  { en: "Riyadh Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636" },
  { en: "Jeddah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629" },
  { en: "Eastern Province Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629" },
  { en: "Makkah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629" },
  { en: "Al Madinah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629" },
  { en: "Asir Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631" },
  { en: "Taif Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641" },
  { en: "Al-Qassim Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645" },
  { en: "Al-Ahsa Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621" },
  { en: "Jazan Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646" },
  { en: "Tabuk Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643" },
  { en: "Ha'il Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644" },
  { en: "Northern Borders Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629" },
  { en: "Najran Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646" },
  { en: "Hafr Al-Batin Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646" },
  { en: "Al Bahah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629" },
  { en: "Al Jawf Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641" },
  { en: "Housing Sector", ar: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646" }
];
var N_AMANAH = 17;
var ENT_HOUSING = 17;
var ENTITY_INDEX = Object.fromEntries(ENTITIES.map((e, i) => [e.en, i]));
var AMANAH_CATALOG = ENTITIES.slice(0, N_AMANAH);
var SOURCES = [
  { key: "investment", platform: "Foras" },
  { key: "fines", platform: "Mumathil" },
  { key: "municipal_fees", platform: "Baladi" },
  { key: "licenses", platform: "Amanah Internal Reports" },
  { key: "accommodation", platform: "Baladi" },
  { key: "tobacco", platform: "Baladi" },
  { key: "white_lands", platform: "Baladi" },
  { key: "housing_sales", platform: "Baladi" }
];
var SOURCE_INDEX = Object.fromEntries(SOURCES.map((s, i) => [s.key, i]));
var ITEMS = [
  { key: "land_lease", source: "investment", ar: "\u0625\u064A\u062C\u0627\u0631 \u0623\u0631\u0627\u0636\u064A", en: "Land lease" },
  { key: "ad_sites", source: "investment", ar: "\u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0645\u0648\u0627\u0642\u0639 \u0625\u0639\u0644\u0627\u0646\u064A\u0629", en: "Advertising sites" },
  { key: "commercial_units", source: "investment", ar: "\u0625\u064A\u062C\u0627\u0631 \u0645\u062D\u0644\u0627\u062A \u062A\u062C\u0627\u0631\u064A\u0629", en: "Commercial units rent" },
  { key: "building_violations", source: "fines", ar: "\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0627\u0644\u0628\u0646\u0627\u0621", en: "Building violations" },
  { key: "signage_violations", source: "fines", ar: "\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0627\u0644\u0644\u0648\u062D\u0627\u062A", en: "Signage violations" },
  { key: "health_violations", source: "fines", ar: "\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0637\u0627\u062A \u0627\u0644\u0635\u062D\u064A\u0629", en: "Health-condition violations" },
  { key: "inspection_fees", source: "municipal_fees", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0643\u0634\u0641\u064A\u0629 (\u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629)", en: "Inspection fees" },
  { key: "waste_collection", source: "municipal_fees", ar: "\u062C\u0645\u0639 \u0627\u0644\u0646\u0641\u0627\u064A\u0627\u062A", en: "Waste collection" },
  { key: "excavation_permits", source: "municipal_fees", ar: "\u062A\u0631\u0627\u062E\u064A\u0635 \u062D\u0641\u0631 \u0627\u0644\u0634\u0648\u0627\u0631\u0639", en: "Street-excavation permits" },
  { key: "ad_boards", source: "municipal_fees", ar: "\u0627\u0644\u0644\u0648\u062D\u0627\u062A \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064A\u0629", en: "Advertising boards" },
  { key: "commercial_license", source: "licenses", ar: "\u0631\u062E\u0635 \u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629", en: "Commercial-activity licences" },
  { key: "signboard_license", source: "licenses", ar: "\u0644\u0648\u062D\u0627\u062A \u0645\u062D\u0644\u0627\u062A", en: "Shop signboards" },
  { key: "building_permit", source: "licenses", ar: "\u062A\u0631\u0627\u062E\u064A\u0635 \u0627\u0644\u0645\u0628\u0627\u0646\u064A \u0648\u0627\u0644\u0623\u0633\u0648\u0627\u0631", en: "Building and fence permits" },
  { key: "health_certificate", source: "licenses", ar: "\u0627\u0644\u0634\u0647\u0627\u062F\u0627\u062A \u0627\u0644\u0635\u062D\u064A\u0629", en: "Health certificates" },
  { key: "hotel_occupancy", source: "accommodation", ar: "\u0625\u0634\u063A\u0627\u0644 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0625\u064A\u0648\u0627\u0621", en: "Accommodation-facility occupancy" },
  { key: "tobacco_fee", source: "tobacco", ar: "\u0631\u0633\u0645 \u062A\u0642\u062F\u064A\u0645 \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u062A\u0628\u063A", en: "Tobacco-product service fee" },
  { key: "white_land_fee", source: "white_lands", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", en: "White-land fees" },
  { key: "misc_revenue", source: "municipal_fees", ar: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629", en: "Miscellaneous revenue" },
  { key: "housing_sales", source: "housing_sales", ar: "\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629", en: "Residential sales" },
  { key: "housing_fees", source: "housing_sales", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", en: "Sales fees" },
  { key: "ad_boards_amanah", source: "licenses", ar: "\u0627\u0644\u0644\u0648\u062D\u0627\u062A \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064A\u0629 (\u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A)", en: "Advertising boards (Amanah)" }
  // same revenue account as «اللوحات الإعلانية» of the central billing: its main class depends on the biller (IIM D6)
];
var ITEM_INDEX = Object.fromEntries(ITEMS.map((x, i) => [x.key, i]));
var REVENUE_ITEMS = ITEMS.reduce((m, it) => {
  (m[it.source] = m[it.source] || []).push(it);
  return m;
}, {});
var RULE_IDS = ["DUP-1", "CR-1", "STY-1", "NOC-1", "INC-1", "EXE-1", "EFA-1", "OBJ-1", "ENF-1", "SND-1", "ATT-1", "ENC-1"];
var RULE_BIT = Object.fromEntries(RULE_IDS.map((id, i) => [id, 1 << i]));
var CR_STATUS = [null, "Active", "Deleted", "Suspended", "Cancelled"];
var EFAA_STATUS = [null, "\u0645\u0633\u062F\u062F\u0629", "\u0642\u0627\u0626\u0645\u0629", "\u062A\u062D\u062A \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629", "\u0645\u0646\u0641\u0630 \u0636\u062F\u0647"];
var CSTAT = ["not_applicable", "linked", "unmatched", "confirmed_none", "unlinked", "unverified"];
var CHANNELS = ["sadad", "voluntary", "enforcement", "transfer", "card", "wallet"];
var CH_WALLET = 5;
var F = {
  OBJECTION: 1,
  MISSING_ID: 2,
  AMT_CONFLICT: 4,
  EXCEPTIONAL: 8,
  CONTRACT_INV: 16,
  FIXTURE: 32,
  UPLOADED: 64,
  LEGACY_CANCELLED: 128,
  NOT_CHECKABLE: 256,
  DUPLICATE_WF: 512,
  NEEDS_CONTRACT: 1024
};
var GRP_SHIFT = 11;
var EXT_SHIFT = 14;
var grpOf = (flags) => flags >> GRP_SHIFT & 7;
var extOf = (flags) => flags >> EXT_SHIFT & 3;
var GRP = { NONE: 0, TB_REPLACED: 1, TB_REPLACEMENT: 2, WL_HEAD2: 1, WL_HEAD3: 2, WL_OWN2: 3, WL_OWN3: 4 };
var withGrp = (g) => g << GRP_SHIFT;
var withExt = (e) => e << EXT_SHIFT;
var dayNum = (iso) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5);
var isoCache = /* @__PURE__ */ new Map();
var isoOf = (day) => {
  let s = isoCache.get(day);
  if (!s) {
    s = new Date(day * 864e5).toISOString().slice(0, 10);
    if (isoCache.size < 5e3) isoCache.set(day, s);
  }
  return s;
};

// src/data/mock.js
var INVOICES = [
  {
    id: "177-882607310000",
    billerId: "177",
    sadadNo: "882607310000",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Rajhi Construction Group",
    entityEn: "Al-Rajhi Construction Group",
    entityAr: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0631\u0627\u062C\u062D\u064A \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    beneficiaryId: "1042883055",
    amount: 1749e3,
    currency: "SAR",
    source: "Foras",
    co: "CO-88231",
    vat: "3001234567800003",
    date: "2026-07-26",
    status: "pending",
    risk: 12,
    confidence: 0.97,
    tag: "normal"
  },
  {
    id: "177-882607300000",
    billerId: "177",
    sadadNo: "882607300000",
    payType: "deferred",
    centralSource: true,
    entity: "NEOM Logistics",
    entityEn: "NEOM Logistics",
    entityAr: "\u0646\u064A\u0648\u0645 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    amanah: "Tabuk Amanah",
    amanahEn: "Tabuk Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643",
    beneficiaryId: "7009988766",
    violationNumber: "10000020226730",
    amount: 307e3,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-88192",
    vat: "3009988776600001",
    date: "2026-07-26",
    status: "anomaly",
    risk: 82,
    confidence: 0.71,
    tag: "fraud"
  },
  {
    id: "177-882607290000",
    billerId: "177",
    sadadNo: "882607290000",
    payType: "deferred",
    centralSource: true,
    entity: "Saudi Tech Solutions",
    entityEn: "Saudi Tech Solutions",
    entityAr: "\u0627\u0644\u062D\u0644\u0648\u0644 \u0627\u0644\u062A\u0642\u0646\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    municipality: "Al-Olaya",
    municipalityEn: "Al-Olaya Municipality",
    municipalityAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0644\u064A\u0627",
    beneficiaryId: "1022334455",
    amount: 87500,
    currency: "SAR",
    source: "Foras",
    co: "CO-88155",
    vat: "3002233445500007",
    date: "2026-07-25",
    status: "approved",
    risk: 8,
    confidence: 0.99,
    tag: "normal",
    // Cash arrived because the payer settled on their own — the other half
    // of the "collected" split the stakeholder asked for (voluntary vs forced).
    collectedVia: "voluntary"
  },
  {
    id: "177-882607280000",
    billerId: "177",
    sadadNo: "882607280000",
    payType: "deferred",
    centralSource: true,
    entity: "Gulf Facility Mgmt",
    entityEn: "Gulf Facility Mgmt",
    entityAr: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u062E\u0644\u064A\u062C",
    amanah: "Eastern Province Amanah",
    amanahEn: "Eastern Province Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629",
    beneficiaryId: "1041883055",
    violationNumber: "10000020226728",
    amount: 1099e3,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-88231",
    vat: "3001234567800003",
    date: "2026-07-25",
    status: "duplicate",
    risk: 0,
    confidence: 0.95,
    tag: "dup"
  },
  {
    id: "177-882607270000",
    billerId: "177",
    sadadNo: "882607270000",
    payType: "deferred",
    centralSource: true,
    entity: "Aramco Logistics Supply",
    entityEn: "Aramco Logistics Supply",
    entityAr: "\u0623\u0631\u0627\u0645\u0643\u0648 \u0644\u0644\u0625\u0645\u062F\u0627\u062F \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    amanah: "Eastern Province Amanah",
    amanahEn: "Eastern Province Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629",
    municipality: "Al-Khobar",
    municipalityEn: "Al-Khobar Municipality",
    municipalityAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u062E\u0628\u0631",
    beneficiaryId: "2055667788",
    hasOpenObjection: true,
    amount: 4835500,
    currency: "SAR",
    source: "Baladi",
    co: "CO-87990",
    vat: "3005566778800002",
    date: "2026-07-24",
    status: "review",
    risk: 46,
    confidence: 0.68,
    tag: "taxfail"
  },
  {
    id: "010-882607260000",
    billerId: "010",
    sadadNo: "882607260000",
    payType: "prepaid",
    centralSource: false,
    entity: "Riyadh Municipal Works",
    entityEn: "Riyadh Municipal Works",
    entityAr: "\u0623\u0639\u0645\u0627\u0644 \u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    beneficiaryId: "1077889900",
    licenseNumber: "450210465726",
    amount: 1073e3,
    currency: "SAR",
    source: "Amanah Internal Reports (Riyadh Amanah)",
    co: "CO-87921",
    vat: "3007788990000004",
    date: "2026-07-24",
    status: "approved",
    risk: 15,
    confidence: 0.96,
    tag: "normal"
  },
  {
    id: "027-882607250000",
    billerId: "027",
    sadadNo: "882607250000",
    payType: "prepaid",
    centralSource: false,
    entity: "STC Telecom Services",
    entityEn: "STC Telecom Services",
    entityAr: "STC \u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amanah: "Makkah Amanah",
    amanahEn: "Makkah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629",
    municipality: "Al-Aziziyah",
    municipalityEn: "Al-Aziziyah Municipality",
    municipalityAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0632\u064A\u0632\u064A\u0629",
    municipalitySourceValues: ["\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0632\u064A\u0632\u064A\u0629", "\u0628\u0644\u062F\u064A\u0629 \u0639\u0633\u0641\u0627\u0646"],
    // two source systems name different municipalities for this invoice (one is not in the reference): kept as a CONFLICT for review, never merged
    beneficiaryId: "1033445566",
    licenseNumber: "450310556725",
    amount: 272500,
    currency: "SAR",
    source: "Amanah Internal Reports (Makkah Amanah)",
    co: "CO-87880",
    vat: "3003344556600009",
    date: "2026-07-23",
    status: "approved",
    risk: 5,
    confidence: 0.98,
    tag: "normal"
  },
  {
    id: "177-882607240000",
    billerId: "177",
    sadadNo: "882607240000",
    payType: "deferred",
    centralSource: true,
    entity: "Bahri Maritime Logistics",
    entityEn: "Bahri Maritime Logistics",
    entityAr: "\u0627\u0644\u0628\u062D\u0631\u064A \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0627\u0644\u0628\u062D\u0631\u064A\u0629",
    amanah: "Jeddah Amanah",
    amanahEn: "Jeddah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629",
    municipality: "Al-Shati",
    municipalityEn: "Al-Shati Municipality",
    municipalityAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0634\u0627\u0637\u0626",
    beneficiaryId: "3066778899",
    amount: 1601500,
    currency: "SAR",
    source: "Baladi",
    co: "CO-87812",
    vat: "3006677889900005",
    date: "2026-07-23",
    status: "pending",
    risk: 33,
    confidence: 0.9,
    tag: "normal"
  },
  {
    id: "177-882607220000",
    billerId: "177",
    sadadNo: "882607220000",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Noor Trading",
    entityEn: "Al-Noor Trading",
    entityAr: "\u0627\u0644\u0646\u0648\u0631 \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
    amanah: "Jeddah Amanah",
    amanahEn: "Jeddah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629",
    beneficiaryId: "1044556677",
    amount: 687500,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-87764",
    vat: "3004455667700006",
    date: "2026-07-20",
    status: "approved",
    risk: 10,
    confidence: 0.97,
    tag: "normal",
    // Cash arrived only after referral to the judiciary and a forced bank
    // transfer — the "collected via enforcement" half of the same split.
    collectedVia: "enforcement"
  },
  // Trailing 12-month history — gives the Dashboard's period filter
  // (previous month / 3 / 6 / 12 months / by year / custom range) real
  // dated rows to show visibly different totals for, instead of every
  // preset collapsing to the same single-week cluster above.
  {
    id: "177-882508100000",
    billerId: "177",
    sadadNo: "882508100000",
    payType: "deferred",
    centralSource: true,
    entity: "Red Sea Global Contracting",
    entityEn: "Red Sea Global Contracting",
    entityAr: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631 \u0644\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062A",
    amanah: "Tabuk Amanah",
    amanahEn: "Tabuk Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643",
    beneficiaryId: "3088112233",
    amount: 599e3,
    currency: "SAR",
    source: "Baladi",
    co: "CO-86210",
    vat: "3008811223300010",
    date: "2025-08-14",
    status: "approved",
    risk: 9,
    confidence: 0.97,
    tag: "normal"
  },
  {
    id: "028-882508100000",
    billerId: "028",
    sadadNo: "882508100000",
    payType: "prepaid",
    centralSource: false,
    entity: "Jeddah Development Co.",
    entityEn: "Jeddah Development Co.",
    entityAr: "\u062C\u062F\u0629 \u0644\u0644\u062A\u0637\u0648\u064A\u0631",
    amanah: "Jeddah Amanah",
    amanahEn: "Jeddah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629",
    beneficiaryId: "1022001100",
    amount: 266500,
    currency: "SAR",
    source: "Amanah Internal Reports (Jeddah Amanah)",
    co: "CO-86340",
    vat: "3002200110000011",
    date: "2025-09-10",
    status: "approved",
    risk: 6,
    confidence: 0.98,
    tag: "normal"
  },
  {
    id: "177-882509020000",
    billerId: "177",
    sadadNo: "882509020000",
    payType: "deferred",
    centralSource: true,
    entity: "NEOM Logistics",
    entityEn: "NEOM Logistics",
    entityAr: "\u0646\u064A\u0648\u0645 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    amanah: "Tabuk Amanah",
    amanahEn: "Tabuk Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643",
    beneficiaryId: "7009988766",
    amount: 630500,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-86510",
    vat: "3009988776600001",
    date: "2025-10-05",
    status: "approved",
    risk: 11,
    confidence: 0.96,
    tag: "normal"
  },
  {
    id: "177-882509400000",
    billerId: "177",
    sadadNo: "882509400000",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Ahsa Agricultural Est.",
    entityEn: "Al-Ahsa Agricultural Est.",
    entityAr: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621 \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "Al-Ahsa Amanah",
    amanahEn: "Al-Ahsa Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621",
    beneficiaryId: "1044115566",
    amount: 169500,
    currency: "SAR",
    source: "Foras",
    co: "CO-86690",
    vat: "3004411556600012",
    date: "2025-11-18",
    status: "duplicate",
    risk: 0,
    confidence: 0.93,
    tag: "dup"
  },
  {
    id: "177-882509750000",
    billerId: "177",
    sadadNo: "882509750000",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Rajhi Construction Group",
    entityEn: "Al-Rajhi Construction Group",
    entityAr: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0631\u0627\u062C\u062D\u064A \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    beneficiaryId: "1042883055",
    amount: 937500,
    currency: "SAR",
    source: "Foras",
    co: "CO-86840",
    vat: "3001234567800003",
    date: "2025-12-22",
    status: "approved",
    risk: 14,
    confidence: 0.97,
    tag: "normal"
  },
  {
    id: "177-882605200000",
    billerId: "177",
    sadadNo: "882605200000",
    payType: "deferred",
    centralSource: true,
    entity: "Bahri Maritime Logistics",
    entityEn: "Bahri Maritime Logistics",
    entityAr: "\u0627\u0644\u0628\u062D\u0631\u064A \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0627\u0644\u0628\u062D\u0631\u064A\u0629",
    amanah: "Jeddah Amanah",
    amanahEn: "Jeddah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629",
    beneficiaryId: "3066778899",
    amount: 2641e3,
    currency: "SAR",
    source: "Baladi",
    co: "CO-87010",
    vat: "3006677889900005",
    date: "2026-01-12",
    status: "approved",
    risk: 20,
    confidence: 0.92,
    tag: "normal"
  },
  {
    id: "027-882605200000",
    billerId: "027",
    sadadNo: "882605200000",
    payType: "prepaid",
    centralSource: false,
    entity: "STC Telecom Services",
    entityEn: "STC Telecom Services",
    entityAr: "STC \u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amanah: "Makkah Amanah",
    amanahEn: "Makkah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629",
    beneficiaryId: "1033445566",
    amount: 182e3,
    currency: "SAR",
    source: "Amanah Internal Reports (Makkah Amanah)",
    co: "CO-87070",
    vat: "3003344556600009",
    date: "2026-01-28",
    status: "approved",
    risk: 4,
    confidence: 0.99,
    tag: "normal"
  },
  {
    id: "177-882605450000",
    billerId: "177",
    sadadNo: "882605450000",
    payType: "deferred",
    centralSource: true,
    entity: "Tabuk Housing Authority",
    entityEn: "Tabuk Housing Authority",
    entityAr: "\u0647\u064A\u0626\u0629 \u0625\u0633\u0643\u0627\u0646 \u062A\u0628\u0648\u0643",
    amanah: "Tabuk Amanah",
    amanahEn: "Tabuk Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643",
    beneficiaryId: "1055002233",
    amount: 578e3,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-87140",
    vat: "3005500223300013",
    date: "2026-02-15",
    status: "review",
    risk: 39,
    confidence: 0.74,
    tag: "taxfail",
    // Exclusion category: struck-off commercial registry / deceased debtor —
    // excluded from net-invoiced entirely, never counted as collected.
    debtorInvalid: true,
    debtorInvalidReason: "struck_off_registry"
  },
  {
    id: "177-882605600000",
    billerId: "177",
    sadadNo: "882605600000",
    payType: "deferred",
    centralSource: true,
    entity: "Gulf Facility Mgmt",
    entityEn: "Gulf Facility Mgmt",
    entityAr: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u062E\u0644\u064A\u062C",
    amanah: "Eastern Province Amanah",
    amanahEn: "Eastern Province Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629",
    beneficiaryId: "1041883055",
    amount: 1089500,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-87220",
    vat: "3001234567800003",
    date: "2026-03-09",
    status: "approved",
    risk: 10,
    confidence: 0.98,
    tag: "normal"
  },
  {
    id: "177-882605750000",
    billerId: "177",
    sadadNo: "882605750000",
    payType: "deferred",
    centralSource: true,
    entity: "Saudi Tech Solutions",
    entityEn: "Saudi Tech Solutions",
    entityAr: "\u0627\u0644\u062D\u0644\u0648\u0644 \u0627\u0644\u062A\u0642\u0646\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    beneficiaryId: "1022334455",
    amount: 625500,
    currency: "SAR",
    source: "Foras",
    co: "CO-87300",
    vat: "3002233445500007",
    date: "2026-03-30",
    status: "approved",
    risk: 7,
    confidence: 0.98,
    tag: "normal"
  },
  {
    id: "177-882605900000",
    billerId: "177",
    sadadNo: "882605900000",
    payType: "deferred",
    centralSource: true,
    entity: "Aramco Logistics Supply",
    entityEn: "Aramco Logistics Supply",
    entityAr: "\u0623\u0631\u0627\u0645\u0643\u0648 \u0644\u0644\u0625\u0645\u062F\u0627\u062F \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    amanah: "Eastern Province Amanah",
    amanahEn: "Eastern Province Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629",
    beneficiaryId: "2055667788",
    amount: 1465500,
    currency: "SAR",
    source: "Baladi",
    co: "CO-87380",
    vat: "3005566778800002",
    date: "2026-04-20",
    status: "approved",
    risk: 17,
    confidence: 0.95,
    tag: "normal"
  },
  {
    id: "010-882606050000",
    billerId: "010",
    sadadNo: "882606050000",
    payType: "prepaid",
    centralSource: false,
    entity: "Riyadh Municipal Works",
    entityEn: "Riyadh Municipal Works",
    entityAr: "\u0623\u0639\u0645\u0627\u0644 \u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    beneficiaryId: "1077889900",
    amount: 1109e3,
    currency: "SAR",
    source: "Amanah Internal Reports (Riyadh Amanah)",
    co: "CO-87450",
    vat: "3007788990000004",
    date: "2026-05-11",
    status: "approved",
    risk: 12,
    confidence: 0.96,
    tag: "normal"
  },
  {
    id: "177-882606200000",
    billerId: "177",
    sadadNo: "882606200000",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Noor Trading",
    entityEn: "Al-Noor Trading",
    entityAr: "\u0627\u0644\u0646\u0648\u0631 \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
    amanah: "Jeddah Amanah",
    amanahEn: "Jeddah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629",
    beneficiaryId: "1044556677",
    amount: 67e4,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-87560",
    vat: "3004455667700006",
    date: "2026-05-27",
    status: "approved",
    risk: 8,
    confidence: 0.97,
    tag: "normal",
    collectedVia: "voluntary"
  },
  {
    id: "177-882606350000",
    billerId: "177",
    sadadNo: "882606350000",
    payType: "deferred",
    centralSource: true,
    entity: "Metro Transport",
    entityEn: "Metro Transport",
    entityAr: "\u0645\u062A\u0631\u0648 \u0644\u0644\u0646\u0642\u0644",
    amanah: "Riyadh Amanah",
    amanahEn: "Riyadh Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    beneficiaryId: "3066004455",
    amount: 1363500,
    currency: "SAR",
    source: "Baladi",
    co: "CO-87630",
    vat: "3006600445500014",
    date: "2026-06-08",
    status: "approved",
    risk: 15,
    confidence: 0.95,
    tag: "normal",
    collectedVia: "enforcement"
  },
  {
    id: "177-882606500000",
    billerId: "177",
    sadadNo: "882606500000",
    payType: "deferred",
    centralSource: true,
    entity: "Coastal Logistics",
    entityEn: "Coastal Logistics",
    entityAr: "\u0627\u0644\u0633\u0627\u062D\u0644\u064A\u0629 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    amanah: "Eastern Province Amanah",
    amanahEn: "Eastern Province Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629",
    beneficiaryId: "3066770011",
    amount: 572e3,
    currency: "SAR",
    source: "Foras",
    co: "CO-87700",
    vat: "3006677001100015",
    date: "2026-06-24",
    status: "pending",
    risk: 22,
    confidence: 0.9,
    tag: "normal",
    // Investment-category invoice (Foras) with no linked Furas contract —
    // the flag rule confirmed across the Mini-BRD and the raw transcript.
    hasContract: false
  },
  // Remaining 9 provinces (previously "no data in this demo") — one fictional
  // invoice each, so every Amanah/province has at least some coverage across
  // the map, the Amanah filter, and the target-achievement ring gauges.
  {
    id: "177-882608010000",
    billerId: "177",
    sadadNo: "882608010000",
    payType: "deferred",
    centralSource: true,
    entity: "Najran Border Trading Co.",
    entityEn: "Najran Border Trading Co.",
    entityAr: "\u0634\u0631\u0643\u0629 \u0646\u062C\u0631\u0627\u0646 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0627\u0644\u062D\u062F\u0648\u062F\u064A\u0629",
    amanah: "Najran Amanah",
    amanahEn: "Najran Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646",
    beneficiaryId: "1099887701",
    amount: 415e3,
    currency: "SAR",
    source: "Baladi",
    co: "CO-88301",
    vat: "3009988770100016",
    date: "2025-09-05",
    status: "approved",
    risk: 11,
    confidence: 0.97,
    tag: "normal"
  },
  {
    id: "177-882608020000",
    billerId: "177",
    sadadNo: "882608020000",
    payType: "prepaid",
    centralSource: false,
    entity: "Arar Logistics Hub",
    entityEn: "Arar Logistics Hub",
    entityAr: "\u0645\u0631\u0643\u0632 \u0639\u0631\u0639\u0631 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    amanah: "Northern Borders Amanah",
    amanahEn: "Northern Borders Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629",
    beneficiaryId: "1088776602",
    amount: 268e3,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-88321",
    vat: "3008877660200017",
    date: "2026-02-01",
    status: "pending",
    risk: 27,
    confidence: 0.89,
    tag: "normal"
  },
  {
    id: "177-882608030000",
    billerId: "177",
    sadadNo: "882608030000",
    payType: "deferred",
    centralSource: true,
    entity: "Hail Agri Industries",
    entityEn: "Hail Agri Industries",
    entityAr: "\u062D\u0627\u0626\u0644 \u0644\u0644\u0635\u0646\u0627\u0639\u0627\u062A \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "Ha'il Amanah",
    amanahEn: "Ha'il Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644",
    beneficiaryId: "1077665503",
    amount: 512500,
    currency: "SAR",
    source: "Foras",
    co: "CO-88341",
    vat: "3007766550300018",
    date: "2025-10-18",
    status: "approved",
    risk: 9,
    confidence: 0.98,
    tag: "normal"
  },
  {
    id: "177-882608040000",
    billerId: "177",
    sadadNo: "882608040000",
    payType: "deferred",
    centralSource: true,
    entity: "Abha Highland Developers",
    entityEn: "Abha Highland Developers",
    entityAr: "\u0645\u0637\u0648\u0631\u0648 \u0623\u0628\u0647\u0627 \u0644\u0644\u0645\u0631\u062A\u0641\u0639\u0627\u062A",
    amanah: "Asir Amanah",
    amanahEn: "Asir Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631",
    beneficiaryId: "1066554404",
    amount: 891e3,
    currency: "SAR",
    source: "Baladi",
    co: "CO-88361",
    vat: "3006655440400019",
    date: "2025-11-30",
    status: "review",
    risk: 41,
    confidence: 0.7,
    tag: "taxfail"
  },
  {
    id: "006-882608050000",
    billerId: "006",
    sadadNo: "882608050000",
    payType: "prepaid",
    centralSource: false,
    entity: "Madinah Hospitality Group",
    entityEn: "Madinah Hospitality Group",
    entityAr: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0644\u0644\u0636\u064A\u0627\u0641\u0629",
    amanah: "Al Madinah Amanah",
    amanahEn: "Al Madinah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629",
    beneficiaryId: "1055443305",
    amount: 1245e3,
    currency: "SAR",
    source: "Amanah Internal Reports (Al Madinah Amanah)",
    co: "CO-88381",
    vat: "3005544330500020",
    date: "2026-01-15",
    status: "approved",
    risk: 13,
    confidence: 0.96,
    tag: "normal"
  },
  {
    id: "177-882608060000",
    billerId: "177",
    sadadNo: "882608060000",
    payType: "deferred",
    centralSource: true,
    entity: "Qassim AgroTech",
    entityEn: "Qassim AgroTech",
    entityAr: "\u0627\u0644\u0642\u0635\u064A\u0645 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "Al-Qassim Amanah",
    amanahEn: "Al-Qassim Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645",
    beneficiaryId: "1044332206",
    amount: 356500,
    currency: "SAR",
    source: "Foras",
    co: "CO-88401",
    vat: "3004433220600021",
    date: "2026-03-22",
    status: "pending",
    risk: 24,
    confidence: 0.91,
    tag: "normal",
    // Investment-category invoice (Foras) with no linked Furas contract.
    hasContract: false
  },
  {
    id: "177-882608070000",
    billerId: "177",
    sadadNo: "882608070000",
    payType: "prepaid",
    centralSource: false,
    entity: "Al Bahah Tourism Estates",
    entityEn: "Al Bahah Tourism Estates",
    entityAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u0627\u062D\u0629 \u0627\u0644\u0633\u064A\u0627\u062D\u064A\u0629",
    amanah: "Al Bahah Amanah",
    amanahEn: "Al Bahah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629",
    beneficiaryId: "1033221107",
    amount: 198e3,
    currency: "SAR",
    source: "Baladi",
    co: "CO-88421",
    vat: "3003322110700022",
    date: "2025-12-08",
    status: "approved",
    risk: 6,
    confidence: 0.98,
    tag: "normal"
  },
  {
    id: "177-882608080000",
    billerId: "177",
    sadadNo: "882608080000",
    payType: "deferred",
    centralSource: true,
    entity: "Jazan Port Services",
    entityEn: "Jazan Port Services",
    entityAr: "\u062E\u062F\u0645\u0627\u062A \u0645\u064A\u0646\u0627\u0621 \u062C\u0627\u0632\u0627\u0646",
    amanah: "Jazan Amanah",
    amanahEn: "Jazan Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646",
    beneficiaryId: "1022110008",
    amount: 733500,
    currency: "SAR",
    source: "Mumathil",
    co: "CO-88441",
    vat: "3002211000800023",
    date: "2026-04-05",
    status: "duplicate",
    risk: 0,
    confidence: 0.94,
    tag: "dup"
  },
  {
    id: "103-882608090000",
    billerId: "103",
    sadadNo: "882608090000",
    payType: "prepaid",
    centralSource: false,
    entity: "Al Jawf Agricultural Co.",
    entityEn: "Al Jawf Agricultural Co.",
    entityAr: "\u0634\u0631\u0643\u0629 \u0627\u0644\u062C\u0648\u0641 \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "Al Jawf Amanah",
    amanahEn: "Al Jawf Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641",
    beneficiaryId: "1011009909",
    amount: 287e3,
    currency: "SAR",
    source: "Amanah Internal Reports (Al Jawf Amanah)",
    co: "CO-88461",
    vat: "3001100990900024",
    date: "2026-05-19",
    status: "approved",
    risk: 8,
    confidence: 0.97,
    tag: "normal"
  }
];
var RECON = {
  normal: {
    invoiceNo: "177-882607310000",
    payer: "Al-Rajhi Construction Group",
    co: "CO-88231",
    accrual: "AC-2026-4471",
    contract: "SANAD-CT-2231",
    currency: "SAR",
    lines: [
      { no: 1, item: { en: "Site occupation fee (m\xB2)", ar: "\u0631\u0633\u0648\u0645 \u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0645\u0648\u0642\u0639 (\u0645\xB2)" }, qty: 2e3, poQty: 2e3, grnQty: 2e3, invUnit: 375, poUnit: 375, benchUnit: 372 },
      { no: 2, item: { en: "Construction-waste disposal fee (ton)", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u062E\u0644\u0635 \u0645\u0646 \u0645\u062E\u0644\u0641\u0627\u062A \u0627\u0644\u0628\u0646\u0627\u0621 (\u0637\u0646)" }, qty: 250, poQty: 250, grnQty: 250, invUnit: 1400, poUnit: 1400, benchUnit: 1385 },
      { no: 3, item: { en: "Scaffolding permit fee (month)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0631\u062E\u064A\u0635 \u0627\u0644\u0633\u0642\u0627\u0644\u0627\u062A \u0627\u0644\u0634\u0647\u0631\u064A\u0629 (\u0634\u0647\u0631)" }, qty: 5, poQty: 5, grnQty: 5, invUnit: 3e4, poUnit: 3e4, benchUnit: 29500 }
    ],
    vat: { subtotal: 125e4, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: "3001234567800003", valid: true }
  },
  fraud: {
    invoiceNo: "177-882607300000",
    payer: "NEOM Logistics",
    co: "CO-88192",
    accrual: "AC-2026-4460",
    contract: "SANAD-CT-7715",
    currency: "SAR",
    // Invoice↔CO↔Accrual are internally consistent (3-way verification PASSES at Validation);
    // the anomaly signal is fee-vs-tariff, caught downstream by Anomaly & Fraud Detection.
    lines: [
      { no: 1, item: { en: "Heavy-vehicle route permit fee (trip)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0635\u0631\u064A\u062D \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0631\u0643\u0628\u0627\u062A \u0627\u0644\u062B\u0642\u064A\u0644\u0629 (\u0631\u062D\u0644\u0629)" }, qty: 120, poQty: 120, grnQty: 120, invUnit: 3200, poUnit: 3200, benchUnit: 2320 },
      { no: 2, item: { en: "Fuel & environmental levy", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0648\u0642\u0648\u062F \u0648\u0627\u0644\u0628\u064A\u0626\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 102e3, poUnit: 102e3, benchUnit: 98e3 }
    ],
    vat: { subtotal: 486e3, declared: 72900, expected: 72900, rate: 15 },
    taxId: { value: "3009988776600001", valid: true }
  },
  dup: {
    invoiceNo: "177-882607280000",
    payer: "Gulf Facility Mgmt",
    co: "CO-88231",
    accrual: "AC-2026-4471",
    contract: "SANAD-CT-2231",
    currency: "SAR",
    duplicateOf: "177-882607310000",
    lines: [
      { no: 1, item: { en: "Facility operating license fee (month)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0631\u062E\u064A\u0635 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u0631\u0641\u0642 (\u0634\u0647\u0631)" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 125e4, poUnit: 125e4, benchUnit: 125e4 }
    ],
    vat: { subtotal: 125e4, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: "3001234567800003", valid: true }
  },
  taxfail: {
    invoiceNo: "177-882607270000",
    payer: "Aramco Logistics Supply",
    co: "CO-87990",
    accrual: "AC-2026-4402",
    contract: "SANAD-CT-2799",
    currency: "SAR",
    // Line 1 unit rate differs from the Collection Order → total variance +2.4%; VAT declared
    // ≠ ZATCA-expected; tax-ID fails ZATCA check-digit validation.
    lines: [
      { no: 1, item: { en: "Warehouse zoning fee (month)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A (\u0634\u0647\u0631)" }, qty: 12, poQty: 12, grnQty: 12, invUnit: 18e4, poUnit: 173750, benchUnit: 172e3 },
      { no: 2, item: { en: "Fleet registration renewal fee", ar: "\u0631\u0633\u0648\u0645 \u062A\u062C\u062F\u064A\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0623\u0633\u0637\u0648\u0644" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 62e4, poUnit: 62e4, benchUnit: 61e4 },
      { no: 3, item: { en: "Handling & customs levy", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0646\u0627\u0648\u0644\u0629 \u0648\u0627\u0644\u062A\u062E\u0644\u064A\u0635 \u0627\u0644\u062C\u0645\u0631\u0643\u064A" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 4e5, poUnit: 4e5, benchUnit: 395e3 }
    ],
    vat: { subtotal: 318e4, declared: 472800, expected: 477e3, rate: 15 },
    taxId: { value: "3005566778800002", valid: false }
  }
};
var SANAD_ENFORCEMENT = {
  recordsReviewed: 31850,
  missingInvoicePct: 7,
  ordersIssued: 2180,
  // Small residual gap (~7%) — the large majority are already linked from
  // prior manual reconciliation work; this remaining slice is the actual
  // backlog this demo's OCR-linking flow (below) illustrates a fix for.
  ordersUnlinked: 153,
  ordersUnlinkedValue: 1e7,
  sample: [
    { enforceNum: "EN-2607714", amanahEn: "Riyadh Amanah", amanah: "Riyadh Amanah", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", amount: 355e3, defendant: { en: "Individual (investor)", ar: "\u0641\u0631\u062F (\u0645\u0633\u062A\u062B\u0645\u0631)" } },
    { enforceNum: "EN-2119843", amanahEn: "Eastern Province Amanah", amanah: "Eastern Province Amanah", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", amount: 590500, defendant: { en: "Registered company", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } },
    { enforceNum: "EN-2884026", amanahEn: "Jeddah Amanah", amanah: "Jeddah Amanah", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", amount: 875250, defendant: { en: "Registered company", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } },
    { enforceNum: "EN-2093317", amanahEn: "Tabuk Amanah", amanah: "Tabuk Amanah", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", amount: 412500, defendant: { en: "Registered company", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } },
    { enforceNum: "EN-2451982", amanahEn: "Makkah Amanah", amanah: "Makkah Amanah", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629", amount: 268e3, defendant: { en: "Individual (investor)", ar: "\u0641\u0631\u062F (\u0645\u0633\u062A\u062B\u0645\u0631)" } },
    { enforceNum: "EN-2760541", amanahEn: "Al Madinah Amanah", amanah: "Al Madinah Amanah", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", amount: 1245e3, defendant: { en: "Registered company", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } }
  ]
};

// src/data/revenueLedger.js
var DATA_CUTOFF = DEMO_TODAY;
var DATA_START = "2025-01-01";
var REVENUE_SOURCES = {
  investment: { gfs: "1421901", en: "Investment", ar: "\u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631", platform: "Foras" },
  fines: { gfs: "1438001", en: "Fines & penalties", ar: "\u0627\u0644\u063A\u0631\u0627\u0645\u0627\u062A \u0648\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A", platform: "Mumathil" },
  municipal_fees: { gfs: "142113", en: "Municipal fees", ar: "\u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", platform: "Baladi" },
  licenses: { gfs: "142162", en: "Licence fees", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0631\u0627\u062E\u064A\u0635", platform: "Amanah Internal Reports" },
  accommodation: { gfs: "11442", en: "Accommodation facilities", ar: "\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0625\u064A\u0648\u0627\u0621", platform: "Baladi" },
  tobacco: { gfs: "1422110", en: "Tobacco service fee", ar: "\u0631\u0633\u0645 \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u062A\u0628\u063A", platform: "Baladi" },
  white_lands: { gfs: "1422111", en: "White-land fees", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", platform: "Baladi" },
  housing_sales: { gfs: "1422112", en: "Housing sector sales", ar: "\u0645\u0628\u064A\u0639\u0627\u062A \u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646", platform: "Baladi" }
};
var REVENUE_SOURCE_KEYS = Object.keys(REVENUE_SOURCES);
function revenueSourceOf(inv2) {
  if (inv2.source === "Foras") return "investment";
  if (inv2.source === "Mumathil") return "fines";
  if (inv2.source === "Baladi") return inv2.revenueSource || "municipal_fees";
  return "licenses";
}
function addDays(dateStr, n) {
  const d = /* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
var FIXTURE_GFS = { investment: "142163", fines: "1438", municipal_fees: "1421909", licenses: "11452104", tobacco: "11422", accommodation: "11442" };
var FIXTURE_GFS_BY_ID = { "177-882608010000": "1459" };
var REVIEWER = { en: "Revenue data steward (demo reviewer)", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0645\u0631\u0627\u062C\u0639 \u062A\u062C\u0631\u064A\u0628\u064A)" };
var OVERLAY = {
  // Partial payment, short payment terms -> due before the data cutoff.
  "177-882607240000": { dueDate: "2026-07-30", payments: [{ date: "2026-07-29", amount: 4e5, channel: "voluntary" }] },
  // Small partial receipt on an overdue invoice.
  "177-882606500000": { payments: [{ date: "2026-07-27", amount: 15e4, channel: "voluntary" }] },
  // Approved credit note reduces the billed amount.
  "177-882605200000": { adjustments: [{ date: "2026-02-10", amount: -5e4, kind: "credit_note", reason: { en: "Approved credit note (area re-measurement)", ar: "\u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 \u0645\u0639\u062A\u0645\u062F (\u0625\u0639\u0627\u062F\u0629 \u0642\u064A\u0627\u0633 \u0627\u0644\u0645\u0633\u0627\u062D\u0629)" } }] },
  // S9 / D22: cancelled in Sadad BECAUSE it was referred to execution (the confirmed order EN-2455512): it is not a cancellation — it stays billed and is excluded as «منفذ ضده – قضايا (سند)».
  "177-882608060000": { cancelled: { date: "2026-07-06", source: "\u062A\u062D\u0635\u064A\u0644" } },
  // Missing mandatory debtor identifier: invoice cannot be referred as-is.
  "177-882608020000": { missing: ["debtor_id_number"] },
  // Exclusion records (explicit, with evidence and review state).
  "177-882607280000": { exclusion: { category: "duplicate", ruleId: "DUP-1", evidence: { en: "Line items identical to 177-882607310000 (duplicate detection); same contract reference CO-88231.", ar: "\u0628\u0646\u0648\u062F \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 177-882607310000 (\u0643\u0634\u0641 \u0627\u0644\u062A\u0643\u0631\u0627\u0631)\u061B \u0646\u0641\u0633 \u0645\u0631\u062C\u0639 \u0627\u0644\u0639\u0642\u062F CO-88231." }, reviewStatus: "approved", reviewDate: "2026-07-28" } },
  "177-882509400000": { exclusion: { category: "duplicate", ruleId: "DUP-1", evidence: { en: "Re-submission of an invoice already registered under the same contract reference.", ar: "\u0625\u0639\u0627\u062F\u0629 \u062A\u0642\u062F\u064A\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0633\u062C\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0646\u0641\u0633 \u0645\u0631\u062C\u0639 \u0627\u0644\u0639\u0642\u062F." }, reviewStatus: "approved", reviewDate: "2025-12-04" } },
  "177-882608080000": { exclusion: { category: "duplicate", ruleId: "DUP-1", evidence: { en: "Same payer, amount and period as an earlier Jazan invoice.", ar: "\u0646\u0641\u0633 \u0627\u0644\u062F\u0627\u0641\u0639 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u0641\u062A\u0631\u0629 \u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0633\u0627\u0628\u0642\u0629 \u0641\u064A \u062C\u0627\u0632\u0627\u0646." }, reviewStatus: "approved", reviewDate: "2026-04-20" } },
  // An exclusion recorded on an invoice that was LATER fully collected: exclusions come only from uncollected invoices (D10), so the metric layer ignores it and counts it as a data warning.
  "177-882606200000": { exclusion: { category: "incomplete_data", ruleId: "INC-1", evidence: { en: "Listed in the Efaa incomplete-violations report, then paid in full.", ar: "\u0648\u0631\u062F \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0625\u064A\u0641\u0627\u0621 \u0644\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629 \u062B\u0645 \u0633\u064F\u062F\u0651\u062F\u062A \u0628\u0627\u0644\u0643\u0627\u0645\u0644." }, reviewStatus: "approved", reviewDate: "2026-03-12" } },
  "177-882605450000": { exclusion: { category: "struck_off_registry", ruleId: "CR-1", evidence: { en: "Commercial registration reported struck-off by the commerce registry check.", ar: "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0645\u0634\u0637\u0648\u0628 \u0648\u0641\u0642 \u0641\u062D\u0635 \u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u0629." }, reviewStatus: "approved", reviewDate: "2026-03-10" } }
};
var CONFIRMED_SEED = [
  { enforceNum: "EN-2301188", system: "sanad", amanahEn: "Jeddah Amanah", amount: 687500, openedDate: "2026-05-28", links: [{ invoiceId: "177-882607220000", allocated: 687500, status: "confirmed", evidence: ["reference_match"], reviewedBy: "Revenue data steward (demo reviewer)", reviewedAt: "2026-06-30" }] },
  { enforceNum: "EN-2188420", system: "sanad", amanahEn: "Riyadh Amanah", amount: 1363500, openedDate: "2026-04-30", links: [{ invoiceId: "177-882606350000", allocated: 1363500, status: "confirmed", evidence: ["reference_match"], reviewedBy: "Revenue data steward (demo reviewer)", reviewedAt: "2026-06-12" }] },
  { enforceNum: "EN-2455512", system: "sanad", amanahEn: "Al-Qassim Amanah", amount: 356500, openedDate: "2026-07-02", links: [{ invoiceId: "177-882608060000", allocated: 356500, status: "confirmed", evidence: ["reference_match", "amount_exact"], reviewedBy: "Revenue data steward (demo reviewer)", reviewedAt: "2026-07-09" }] }
];
var BACKLOG_SEED = SANAD_ENFORCEMENT.sample.map((c) => ({
  enforceNum: c.enforceNum,
  system: "sanad",
  amanahEn: c.amanahEn,
  amount: c.amount,
  openedDate: "2026-07-01",
  links: [],
  history: []
}));
var ANCHOR_ENFORCEMENT_SEED = [...CONFIRMED_SEED.map((c) => ({ ...c, history: [] })), ...BACKLOG_SEED];
var ENFORCEMENT_SEED = ANCHOR_ENFORCEMENT_SEED;
var AMOUNT_TOLERANCE = 5e-3;
function lineEvidenceFor(invId) {
  for (const r of Object.values(RECON)) {
    if (r.invoiceNo !== invId) continue;
    const lineTotal = r.lines.reduce((s, l) => s + l.qty * l.invUnit, 0);
    return { lineTotal, vatDeclared: r.vat?.declared ?? null, vatExpected: r.vat?.expected ?? null, vatRate: r.vat?.rate ?? null };
  }
  return null;
}
function checkInvoiceAmount(invId, headerAmount) {
  const ev = lineEvidenceFor(invId);
  if (!ev) return { status: "not_checkable", headerAmount };
  const withVat = ev.lineTotal + (ev.vatDeclared || 0);
  const near = (a, b) => b > 0 && Math.abs(a - b) / b <= AMOUNT_TOLERANCE;
  if (near(headerAmount, ev.lineTotal)) return { status: "consistent", basis: "ex_vat", headerAmount, ...ev, impliedTotalWithVat: withVat, difference: 0 };
  if (near(headerAmount, withVat)) return { status: "consistent", basis: "incl_vat", headerAmount, ...ev, impliedTotalWithVat: withVat, difference: 0 };
  return {
    status: "conflict",
    headerAmount,
    ...ev,
    impliedTotalWithVat: withVat,
    // Difference against the closest line-item-based figure.
    difference: headerAmount - (Math.abs(headerAmount - ev.lineTotal) <= Math.abs(headerAmount - withVat) ? ev.lineTotal : withVat),
    differenceVsLineTotal: headerAmount - ev.lineTotal,
    differenceVsWithVat: headerAmount - withVat
  };
}
function stableOffset(id, min, span) {
  const n = Number(String(id).replace(/\D/g, "").slice(-4)) || 0;
  return min + n % span;
}
function sourceStatusFor(inv2, paid, excluded) {
  if (inv2.status === "duplicate") return "cancelled";
  if (paid <= 0) return "uncollected";
  return paid >= inv2.amount ? "collected" : "uncollected";
}
function contractLinkOf(inv2) {
  if (inv2.source !== "Foras") return { required: false, status: "not_applicable" };
  if (inv2.hasContract === true) return { required: true, status: "linked", ref: inv2.co };
  if (inv2.hasContract === false) return { required: true, status: "unlinked", ref: null };
  return { required: true, status: "unverified", ref: inv2.co || null };
}
var normExclusion = (ex, issueDate, extra = {}) => ({
  category: ex.category,
  ruleId: ex.ruleId,
  ruleVersion: 1,
  evidence: ex.evidence,
  sources: ex.sources || [],
  rawValue: ex.rawValue || (ex.sources || []).find((x) => x.field === "Crstatus")?.value || null,
  reviewStatus: ex.reviewStatus,
  reviewer: ex.reviewStatus === "approved" ? REVIEWER : null,
  reviewDate: ex.reviewStatus === "approved" ? ex.reviewDate || "2026-06-15" : null,
  effectiveFrom: ex.reviewStatus === "approved" ? ex.reviewDate || "2026-06-15" : issueDate,
  effectiveTo: null,
  reassessment: ex.reviewStatus === "approved" ? "scheduled_annual" : "not_started",
  ...extra
});
var textId = (prefix, id, len) => `${prefix}${String(id).replace(/\D/g, "").padStart(len, "0")}`.slice(0, len + prefix.length);
function buildLedger({ invoices = INVOICES, enforcement = ENFORCEMENT_SEED, uploaded = [], today = DATA_CUTOFF } = {}) {
  const linkByInvoice = /* @__PURE__ */ new Map();
  for (const c of enforcement) {
    for (const l of c.links) {
      if (l.status !== "confirmed" && l.status !== "candidate") continue;
      if (!linkByInvoice.has(l.invoiceId)) linkByInvoice.set(l.invoiceId, []);
      linkByInvoice.get(l.invoiceId).push({ enforceNum: c.enforceNum, system: c.system, allocated: l.allocated, status: l.status });
    }
  }
  const anchors = invoices.filter((inv2) => inv2.date <= today).map((inv2) => {
    const ov = OVERLAY[inv2.id] || {};
    const issueDate = inv2.date;
    const prepaid = inv2.payType === "prepaid";
    const dueDate = ov.dueDate || (prepaid ? issueDate : addDays(issueDate, 30));
    let payments = ov.payments ? ov.payments.filter((p) => p.date <= today).map((p) => ({ ...p })) : [];
    if (!ov.payments && inv2.status === "approved") {
      const payDate = prepaid ? issueDate : addDays(issueDate, stableOffset(inv2.id, 8, 22));
      payments = [{
        date: payDate > today ? today : payDate,
        amount: inv2.amount,
        channel: inv2.collectedVia === "enforcement" ? "enforcement" : "voluntary"
      }];
    }
    const adjustments = (ov.adjustments || []).filter((x) => x.date <= today);
    const adjustmentTotal = adjustments.reduce((s, a) => s + a.amount, 0);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const ex = ov.exclusion ? normExclusion(ov.exclusion, issueDate) : null;
    const recon = lineEvidenceFor(inv2.id);
    const revenueSource = revenueSourceOf(inv2);
    const vatRate = revenueSource === "fines" ? 0 : 0.15;
    const vat = recon?.vatDeclared ?? Math.round(inv2.amount * vatRate / (1 + vatRate));
    return {
      id: inv2.id,
      billerId: inv2.billerId,
      sadadNo: inv2.sadadNo,
      // invoice id = `${billerId}-${sadadNo}`; the Sadad number alone is not unique
      gfsCode: FIXTURE_GFS_BY_ID[inv2.id] || FIXTURE_GFS[revenueSource] || "1453",
      // رقم حساب الإيراد of the hand-anchored invoices
      entity: inv2.entity,
      entityEn: inv2.entityEn,
      entityAr: inv2.entityAr,
      amanah: inv2.amanah,
      amanahEn: inv2.amanahEn,
      amanahAr: inv2.amanahAr,
      municipalityEn: inv2.municipalityEn,
      municipalityAr: inv2.municipalityAr,
      municipalitySourceValues: inv2.municipalitySourceValues,
      beneficiaryId: (ov.missing || []).includes("debtor_id_number") ? null : inv2.beneficiaryId,
      co: inv2.co,
      sourcePlatform: inv2.source,
      scopeType: inv2.source === "Foras" || inv2.source === "Mumathil" || inv2.source === "Baladi" ? "central" : "internal",
      revenueSource,
      revenueItem: null,
      issueDate,
      dueDate,
      grossAmount: inv2.amount,
      vatAmount: vat,
      vatKnown: !!recon?.vatDeclared,
      currency: inv2.currency || "SAR",
      lineItems: [{ no: 1, name: inv2.entityAr || inv2.entity, amount: inv2.amount }],
      payments,
      adjustments,
      adjustmentTotal,
      sourceStatus: sourceStatusFor(inv2, paid),
      statusRawTahseel: null,
      statusRawEfaa: null,
      workflowStatus: inv2.status,
      objection: inv2.hasOpenObjection ? { open: true, ref: `OBJ-${inv2.id.slice(-4)}`, system: "momtathil", status: inv2.objectionStatus || "awaiting_committee" } : null,
      enforcementLinks: linkByInvoice.get(inv2.id) || [],
      contract: contractLinkOf(inv2),
      exclusion: ex,
      exclusions: ex ? [ex] : [],
      cancelled: ov.cancelled || null,
      subscriptionNo: textId("", inv2.id + "7", 10),
      crNo: null,
      crStatusRaw: null,
      crEvidence: null,
      executionNo: null,
      violationNumber: inv2.violationNumber || null,
      missingFields: ov.missing || [],
      amountCheck: checkInvoiceAmount(inv2.id, inv2.amount),
      aiRisk: { score: inv2.risk, tag: inv2.tag },
      provenance: { kind: "demo", system: "demo-ledger", ref: inv2.id }
    };
  });
  return [...anchors, ...uploaded];
}
var ANCHOR_LEDGER = buildLedger({ enforcement: ANCHOR_ENFORCEMENT_SEED });

// src/data/sourceAssumptions.js
var BI = (ar, en) => ({ ar, en });
var PARAMS = {
  tobacco: {
    feePercents: [2.5, 5, 7.5, 10],
    // TOTAL_PERCENTAGE drawn per disclosure (demo values)
    walletShare: 0.3,
    // share of invoices partly/fully settled from the facility wallet on the issue day
    replacedShare: 0.025,
    // share of disclosures later replaced by an amended disclosure (original invoice cancelled)
    expiryDays: 30
    // SADAD expiry measured from the issue date (also the due date)
  },
  accommodation: {
    feePercents: [2.5, 5, 5, 7.5],
    expiryDays: 30,
    avgRoomsPerFacility: 40
  },
  white_lands: {
    zoneRates: [25, 15, 8, 4],
    // fee per m2 per year by tax zone A..D (SAR) - demo values; area = invoice amount / rate
    ownerSplit: [0.75, 0.17, 0.08],
    // share of deeds with 1 / 2 / 3 owners (one invoice per owner)
    payProbability: 0.32,
    // eventual payment probability (the monthly reports show 11-22% collected within the first quarter)
    earlyPayShare: 0.4,
    // share of payers that pay within the first weeks after publication
    dueDays: 45,
    // LastTimeToPay after publication
    extensionShare: 0.12,
    // unpaid invoices with an extension request
    extensionApproved: 0.55,
    extensionDays: [30, 60, 90],
    objectionShare: 0.05,
    // unpaid invoices with an objection
    enforcementShare: 0.05,
    // never-paid invoices followed in the white-lands enforcement file
    avgDeedFee: 65e4
  },
  licenses: {
    billStatusCodes: { 0: "\u063A\u064A\u0631 \u0645\u062F\u0641\u0648\u0639\u0629", 1: "\u0645\u062F\u0641\u0648\u0639\u0629", 2: "\u0645\u0644\u063A\u0627\u0629", 3: "\u0645\u0644\u063A\u0627\u0629", 9: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", 10: "\u0645\u0631\u0641\u0648\u0636\u0629", 11: "\u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632" }
  },
  fines: {
    differentValueShare: 0.03
    // violations whose "violation value" differs from the "invoice value" (kept as a data-quality note)
  }
};
var IMPORT_VERSIONS = { tahseel_central: 6, tahseel_internal: 4, furas: 4, sanad: 3, efaa_v2: 7, sadad: 9, tobacco: 3, accommodation: 3, white_lands: 5, balady: 4, violations: 7, white_lands_enforcement: 2 };
var GFS_BY_SOURCE = { investment: "1421901", fines: "1438001", municipal_fees: "142113", licenses: "142162", accommodation: "11442", tobacco: "1422110", white_lands: "1422111", housing_sales: "1422112" };
var SOURCE_PROFILE = {
  tobacco: {
    label: BI("\u0627\u0644\u062A\u0628\u063A", "Tobacco"),
    files: ["Tobacco_Schema.xlsx"],
    sheets: ["INVOICES", "DISCLOSURES", "SCHEDULES", "FACILITIES"],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 (INVOICES) \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0625\u0641\u0635\u0627\u062D \u0634\u0647\u0631\u064A (DISCLOSURES) \u0648\u062C\u062F\u0648\u0644\u0629 (SCHEDULES) \u0648\u0645\u0646\u0634\u0623\u0629 (FACILITIES)", "Invoice linked to a monthly disclosure, a schedule and a facility"),
    keys: ["INVOICE_KEY", "DISCLOSURE_KEY", "FACILITY_KEY", "SADAD_NO"],
    supplier: BI("\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u062A\u0628\u063A (\u062C\u062F\u0627\u0648\u0644 TB_*)\u060C \u062B\u0645 \u062A\u062D\u0635\u064A\u0644 \u0644\u0644\u062D\u0627\u0644\u0629 \u0648\u0627\u0644\u0633\u062F\u0627\u062F", "Tobacco disclosure platform (TB_* tables), then Tahseel for status and collection")
  },
  accommodation: {
    label: BI("\u0627\u0644\u0625\u064A\u0648\u0627\u0621", "Accommodation"),
    files: ["ACCOMMODATION_Schema.xlsx (\u063A\u064A\u0631 \u0645\u0631\u0641\u0642 \u0644\u0643\u0646\u0647 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u062C\u0644\u062F)"],
    sheets: ["Invoices", "Disclosures", "Schedules", "Facilities"],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0625\u0641\u0635\u0627\u062D \u0625\u0634\u063A\u0627\u0644 (\u0623\u064A\u0627\u0645 \xD7 \u0633\u0639\u0631 \u064A\u0648\u0645\u064A) \u0648\u062C\u062F\u0648\u0644\u0629 \u0648\u0645\u0646\u0634\u0623\u0629", "Invoice linked to an occupancy disclosure (days x daily price), a schedule and a facility"),
    keys: ["INVOICE_KEY", "DISCLOSURE_KEY", "FACILITY_KEY", "SADAD_NO"],
    supplier: BI("\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0625\u064A\u0648\u0627\u0621\u060C \u062B\u0645 \u062A\u062D\u0635\u064A\u0644", "Accommodation disclosure platform, then Tahseel")
  },
  white_lands: {
    label: BI("\u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", "White lands"),
    files: ["White_Lands_Schema.xlsx", "Idle_lands_Schema.xlsx", "Revenues_Schema.xlsx (LAND_FEES_REVENUES)"],
    sheets: ["DS_038_IdleLandInvoices", "DS_088_IdleLandDeeds", "DS_037_IdleLandDetails", "DS_035_IdleLandOwners", "DS_040_IdleLandObjections", "DS_041_TimeLimitRequest", "DS_039_IdleLand_Violations", "Basic_IDLE_LANDS_INFO_BS", "LAND_FEES_REVENUES"],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0643\u0644 \u0645\u0627\u0644\u0643 (DeedOwnerRequestId) \u0639\u0644\u0649 \u0635\u0643 \u0648\u0642\u0637\u0639\u0629 \u0623\u0631\u0636\u060C \u0636\u0645\u0646 \u062F\u0648\u0631\u0629 \u0641\u0631\u0632 \u0648\u0645\u0631\u062D\u0644\u0629", "One invoice per deed-owner request on a deed and a land plot, inside a sorting cycle and stage"),
    keys: ["InvoiceId", "SadadNum", "LandfessDeedId", "DeedOwnerRequestId", "LandId", "FarzCycleId"],
    supplier: BI("\u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621 (DS_035..DS_088)\u060C \u0648\u062A\u062D\u0635\u064A\u0644 \u0644\u0627 \u064A\u062D\u0645\u0644 \u0631\u0633\u0648\u0645\u0647\u0627 \u062D\u0633\u0628 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639", "White-lands system (DS_035..DS_088); Tahseel does not carry these fees per the meeting")
  },
  licenses: {
    label: BI("\u0627\u0644\u062A\u0631\u0627\u062E\u064A\u0635", "Licences"),
    files: ["LICENSES_DATASET_Schema.xlsx", "Revenues_Schema.xlsx (BALADY_BILLS)"],
    sheets: ["DS_001_Issued_Commercial_Licenses", "DS_002_Commercial_License_Requests", "Building_license_vw", "medical_license_bs", "Housing_DM", "BALADY_BILLS"],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0631\u062E\u0635\u0629 \u0648\u0637\u0644\u0628 \u0641\u064A \u0645\u0646\u0635\u0629 \u0628\u0644\u062F\u064A (\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629 \u0641\u0642\u0637 \u0641\u064A \u0633\u062C\u0644 \u0627\u0644\u0631\u062E\u0635\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629)", "Bill linked to a licence and a request in Balady (a commercial licence row carries only its LAST bill)"),
    keys: ["BILL_NUMBER", "LIC_ID", "REQ_ID", "DATA_KEY"],
    supplier: BI("\u0645\u0646\u0635\u0629 \u0628\u0644\u062F\u064A (BALADY_BILLS) \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629", "Balady (BALADY_BILLS) and the Amanah internal reports")
  },
  fines: {
    label: BI("\u0627\u0644\u063A\u0631\u0627\u0645\u0627\u062A \u0648\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A", "Fines and penalties"),
    files: ["Violations_Report_BS_Schema.xlsx"],
    sheets: ["Violations_report_BV"],
    level: BI("\u0645\u062E\u0627\u0644\u0641\u0629 \u0648\u0627\u062D\u062F\u0629 \u0641\u064A \u0632\u064A\u0627\u0631\u0629 \u0631\u0642\u0627\u0628\u064A\u0629 (\u0635\u0641 \u0644\u0643\u0644 \u0645\u062E\u0627\u0644\u0641\u0629) \u0648\u0642\u064A\u0645\u062A\u0627\u0646: \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "One violation row per inspection visit with two amounts: invoice value and violation value"),
    keys: ["\u0645\u0639\u0631\u0641_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "\u0631\u0642\u0645_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629_\u0641\u064A_\u0627\u064A\u0641\u0627\u0621", "\u0631\u0642\u0645_\u0627\u0644\u0633\u062F\u0627\u062F", "\u0631\u0642\u0645_\u0627\u0644\u0632\u064A\u0627\u0631\u0629"],
    supplier: BI("\u0625\u064A\u0641\u0627\u0621 / \u0645\u0645\u062A\u062B\u0644 (\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A)", "Efaa / Mumathil (violations report)")
  },
  municipal_fees: {
    label: BI("\u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipal fees"),
    files: ["Revenues_Schema.xlsx (ENT_REVENUES)"],
    sheets: ["ENT_REVENUES"],
    level: BI("\u0628\u0646\u062F \u0641\u0627\u062A\u0648\u0631\u0629 (DETAIL_ID) \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0643\u0631\u0631 \u0639\u0644\u0649 \u0643\u0644 \u0628\u0646\u062F", "Invoice line (DETAIL_ID); the invoice total is repeated on every line"),
    keys: ["ACCOUNT_NO", "REVENUE_KEY", "REQUEST_ID"],
    supplier: BI("\u0637\u0628\u0642\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0648\u062D\u062F\u0629", "Consolidated revenue layer")
  },
  housing_sales: {
    label: BI("\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629", "Residential sales"),
    files: ["Housing_DM (\u0636\u0645\u0646 LICENSES_DATASET_Schema.xlsx) - \u0644\u064A\u0633 \u0645\u0635\u062F\u0631 \u0641\u0648\u0627\u062A\u064A\u0631"],
    sheets: ["Housing_DM"],
    level: BI("\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u062E\u0637\u0637 \u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0644\u0641\u0627\u062A\u061B \u0627\u0633\u062A\u064F\u062E\u062F\u0645\u062A \u0628\u0646\u064A\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u062D\u062F\u0629 \u0641\u0642\u0637", "No sales-invoice schema in the files; only the unified invoice structure is used"),
    keys: ["SADAD"],
    supplier: BI("\u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646 (\u0644\u0627 \u0645\u062E\u0637\u0637 \u0645\u0631\u0641\u0642)", "Housing sector (no schema attached)")
  },
  investment: {
    label: BI("\u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631", "Investment"),
    files: ["(\u0644\u0627 \u0645\u0644\u0641 \u062C\u062F\u064A\u062F - \u0645\u0646 \u0627\u0644\u0639\u0642\u0648\u062F \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0633\u0627\u0628\u0642)"],
    sheets: [],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 \u062F\u0641\u0639\u0629 \u0639\u0642\u062F", "Contract installment invoice"),
    keys: ["contract_no", "installment_no"],
    supplier: BI("\u0641\u0631\u0635", "Furas")
  }
};
var ASSUMPTIONS = [
  { id: "A-ALL-1", sources: ["all"], text: BI("\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u062E\u0637\u0637 \u062A\u062D\u062A\u0648\u064A \u0623\u0639\u0645\u062F\u0629 \u0648\u0623\u0648\u0635\u0627\u0641\u0627\u064B \u0641\u0642\u0637 \u0628\u0644\u0627 \u0635\u0641\u0648\u0641: \u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u0642\u064A\u0645 (\u0645\u0628\u0627\u0644\u063A\u060C \u062D\u0627\u0644\u0627\u062A\u060C \u0646\u0633\u0628) \u0627\u0641\u062A\u0631\u0627\u0636\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0645\u0633\u062A\u0648\u062D\u0627\u0629 \u0645\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629.", "The schema files hold columns and descriptions only, no rows: value patterns (amounts, statuses, percentages) are demo assumptions inspired by the monthly reports.") },
  { id: "A-ALL-2", sources: ["all"], text: BI("\u0643\u0644 \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0623\u0634\u062E\u0627\u0635 \u0648\u0627\u0644\u0645\u0646\u0634\u0622\u062A \u0648\u0627\u0644\u0647\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0645\u0648\u0644\u0651\u062F\u0629 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0627\u064B\u061B \u0644\u0627 \u062A\u064F\u0646\u0633\u062E \u0645\u0646 \u0623\u064A \u0645\u0644\u0641.", "All person, facility, identity and registry values are synthetic; none is copied from a file.") },
  { id: "A-ALL-3", sources: ["all"], text: BI("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u062D\u062F\u0629 \u0648\u0627\u062D\u062F\u0629 \u0645\u0647\u0645\u0627 \u062A\u0639\u062F\u062F\u062A \u0623\u0646\u0638\u0645\u0629 \u0623\u0648 \u0628\u0646\u0648\u062F \u0623\u0648 \u0645\u0644\u0641\u0627\u062A \u062A\u062D\u0645\u0644 \u0633\u062C\u0644\u0647\u0627\u061B \u0627\u0644\u0645\u0628\u0644\u063A \u064A\u064F\u062D\u062A\u0633\u0628 \u0645\u0646 \u0631\u0623\u0633 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629.", "There is ONE unified invoice however many systems, items or files carry it; the amount is taken once from the header.") },
  { id: "A-TB-1", sources: ["tobacco"], text: BI("\u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 = \u0623\u0633\u0627\u0633 \u0627\u0644\u0625\u0641\u0635\u0627\u062D \xD7 \u0646\u0633\u0628\u0629 \u0627\u0644\u0627\u062D\u062A\u0633\u0627\u0628 + \u0627\u0644\u0636\u0631\u064A\u0628\u0629\u060C \u0648\u0627\u0644\u0636\u0631\u064A\u0628\u0629 (TAX) \u062C\u0632\u0621 \u0645\u0646 \u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0645\u0639\u0631\u0648\u0636\u0629 \u0645\u0646\u0641\u0635\u0644\u0629 (15%).", "Invoice amount = disclosed base x calculation percentage + VAT; VAT (TAX) is inside the amount and shown apart (15%).") },
  { id: "A-TB-2", sources: ["tobacco"], text: BI("FROM_WALLET \u062F\u0641\u0639\u0629 \u062A\u064F\u062E\u0635\u0645 \u0645\u0646 \u0645\u062D\u0641\u0638\u0629 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u064A\u0648\u0645 \u0627\u0644\u0625\u0635\u062F\u0627\u0631\u061B \u0648\u0627\u0644\u0628\u0627\u0642\u064A \u064A\u064F\u0633\u062F\u062F \u0639\u0628\u0631 \u0633\u062F\u0627\u062F.", "FROM_WALLET is a payment deducted from the facility wallet on the issue day; the rest is paid through SADAD.") },
  { id: "A-TB-3", sources: ["tobacco"], text: BI("\u0623\u0643\u0648\u0627\u062F \u0648\u0623\u0633\u0645\u0627\u0621 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0627\u0644\u0646\u0648\u0639 \u063A\u064A\u0631 \u0645\u0630\u0643\u0648\u0631\u0629 \u0641\u064A \u0627\u0644\u0645\u062E\u0637\u0637: \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0646\u0627 \u0645\u0641\u0631\u062F\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 (\u0635\u0627\u062F\u0631\u0629\u060C \u0645\u0633\u062F\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B\u060C \u0645\u0633\u062F\u062F\u0629\u060C \u0645\u0646\u062A\u0647\u064A\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629\u060C \u0645\u0644\u063A\u0627\u0629).", "Invoice status and type vocabularies are not in the schema; the demo vocabulary is used (issued, partly paid, paid, expired, cancelled).") },
  { id: "A-TB-4", sources: ["tobacco", "accommodation"], text: BI("\u062A\u0627\u0631\u064A\u062E \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u064A\u0639\u0627\u062F\u0644 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642\u061B \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0646\u062A\u0647\u064A\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F\u0629 \u062A\u0628\u0642\u0649 \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0648\u0644\u0627 \u062A\u064F\u0639\u062A\u0628\u0631 \u0645\u0644\u063A\u0627\u0629.", "SADAD expiry equals the due date; an expired unpaid invoice stays a debt and is NOT treated as cancelled.") },
  { id: "A-TB-5", sources: ["tobacco", "accommodation"], text: BI("\u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u062A\u064A \u0644\u0645 \u064A\u064F\u0642\u062F\u064E\u0651\u0645 \u0639\u0646\u0647\u0627 \u0625\u0641\u0635\u0627\u062D \u0644\u0627 \u062A\u0646\u062A\u062C \u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0644\u0627 \u062A\u062F\u062E\u0644 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0644 (\u0627\u0644\u062A\u0632\u0627\u0645 \u0645\u062D\u062A\u0645\u0644 \u0644\u0627 \u0630\u0645\u0629).", "A schedule with no disclosure produces no invoice and is not part of uncollected (a possible obligation, not a receivable).") },
  { id: "A-TB-6", sources: ["tobacco"], text: BI("\u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0645\u0639\u062F\u0651\u0644 (REPLACED_WITH_KEY) \u064A\u0644\u063A\u064A \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0623\u0635\u0644\u064A \u0648\u064A\u0635\u062F\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u062C\u062F\u064A\u062F\u0629\u061B \u064A\u064F\u062E\u0635\u0645 \u0627\u0644\u0645\u0644\u063A\u0649 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629.", "An amended disclosure (REPLACED_WITH_KEY) cancels the original disclosure invoice and issues a new one; the cancelled amount is deducted once.") },
  { id: "A-AC-1", sources: ["accommodation"], text: BI("\u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 = \u0623\u064A\u0627\u0645 \u0627\u0644\u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0645\u0641\u0635\u062D \u0639\u0646\u0647\u0627 \xD7 \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u064A\u0648\u0645\u064A \u0644\u0644\u0646\u0633\u0628\u0629\u060C \u0648\u0647\u0648 \u0623\u064A\u0636\u0627\u064B \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u0634\u063A\u0627\u0644 \xD7 \u0646\u0633\u0628\u0629 \u0627\u0644\u0627\u062D\u062A\u0633\u0627\u0628\u061B \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u0628\u0644\u063A.", "Invoice amount = disclosed occupancy days x daily price of the percentage, which also equals total occupancy x calculation percentage; VAT is inside the amount.") },
  { id: "A-AC-2", sources: ["accommodation"], text: BI("\u0627\u0644\u0625\u0641\u0635\u0627\u062D\u0627\u062A \u0627\u0644\u0645\u0631\u0641\u0648\u0636\u0629 (REJECTED_OCCUPANCIES) \u0644\u0627 \u062A\u0646\u062A\u062C \u0641\u0627\u062A\u0648\u0631\u0629\u061B \u062A\u064F\u0639\u0631\u0636 \u0623\u0639\u062F\u0627\u062F\u0647\u0627 \u0641\u0642\u0637.", "Rejected occupancy lines (REJECTED_OCCUPANCIES) produce no invoice; only their counts are shown.") },
  { id: "A-WL-1", sources: ["white_lands"], text: BI("\u062A\u0635\u062F\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0643\u0644 \u0645\u0627\u0644\u0643 \u0639\u0644\u0649 \u0627\u0644\u0635\u0643 (DeedOwnerRequestId) \u0628\u0646\u0633\u0628\u0629 \u0645\u0644\u0643\u064A\u062A\u0647\u061B \u062A\u0639\u062F\u062F \u0627\u0644\u0645\u0644\u0627\u0643 \u0644\u0627 \u064A\u0639\u0646\u064A \u062A\u0643\u0631\u0627\u0631\u0627\u064B.", "One invoice per owner of a deed (DeedOwnerRequestId) in proportion to the ownership share; several owners are not duplicates.") },
  { id: "A-WL-2", sources: ["white_lands"], text: BI("\u0627\u0644\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u0642\u064A\u0651\u0645\u0629 = \u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \xF7 \u0633\u0639\u0631 \u0627\u0644\u0645\u062A\u0631 \u0644\u0644\u0634\u0631\u064A\u062D\u0629 \u0627\u0644\u0636\u0631\u064A\u0628\u064A\u0629 (\u0642\u064A\u0645 \u062A\u062C\u0631\u064A\u0628\u064A\u0629)\u061B \u0644\u064A\u0633\u062A \u0645\u0639\u0627\u062F\u0644\u0629 \u0645\u0639\u062A\u0645\u062F\u0629.", "Evaluated area = invoice amount / zone rate per m2 (demo values); not an approved formula.") },
  { id: "A-WL-3", sources: ["white_lands"], text: BI("\u0645\u0648\u062C\u0629 \u0627\u0644\u0641\u0648\u062A\u0631\u0629 \u0627\u0644\u0633\u0646\u0648\u064A\u0629 \u0641\u064A \u064A\u0646\u0627\u064A\u0631 \u062A\u062A\u0628\u0639 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629 (\u0627\u0644\u062A\u062D\u0635\u064A\u0644 11-22% \u0641\u064A \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0623\u0648\u0644)\u061B \u0628\u0627\u0642\u064A \u0627\u0644\u0623\u0634\u0647\u0631 \u0641\u0648\u0627\u062A\u064A\u0631 \u062A\u0643\u0645\u064A\u0644\u064A\u0629 \u0635\u063A\u064A\u0631\u0629.", "The annual billing wave is in January as in the monthly reports (11-22% collected in the first quarter); other months are small supplementary invoices.") },
  { id: "A-WL-4", sources: ["white_lands"], text: BI("\u0637\u0644\u0628 \u0627\u0644\u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u064A\u062F\u0641\u0639 \u0622\u062E\u0631 \u0645\u0648\u0639\u062F \u0644\u0644\u0633\u062F\u0627\u062F (LastTimeToPay) \u0628\u0645\u0642\u062F\u0627\u0631 \u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u0645\u0646\u0648\u062D\u0629\u061B \u0627\u0644\u0645\u0631\u0641\u0648\u0636 \u0644\u0627 \u064A\u063A\u064A\u0651\u0631\u0647.", "An approved extension request moves LastTimeToPay by the period granted; a refused one does not.") },
  { id: "A-WL-5", sources: ["white_lands"], text: BI("\u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636 \u0627\u0644\u0645\u0641\u062A\u0648\u062D \u064A\u062C\u0639\u0644 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u062D\u0627\u0644\u0629 \xAB\u0642\u064A\u062F \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636\xBB \u0648\u062A\u0628\u0642\u0649 \u0636\u0645\u0646 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0644\u061B \u0648\u0644\u0627 \u062A\u064F\u0633\u062A\u0628\u0639\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B.", 'An open objection puts the invoice in the "under objection" state; it stays in uncollected and is NOT excluded automatically.') },
  { id: "A-WL-6", sources: ["white_lands"], text: BI("\u063A\u0631\u0627\u0645\u0629 \u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0644\u0623\u0631\u0636 (DS_039) \u0645\u0639\u0644\u0648\u0645\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0644\u0627 \u062A\u064F\u0636\u0627\u0641 \u0625\u0644\u0649 \u0645\u0628\u0644\u063A\u0647\u0627 (\u0645\u0646\u0639\u0627\u064B \u0644\u0644\u0627\u0632\u062F\u0648\u0627\u062C).", "The land-violation fine (DS_039) is information linked to the invoice and is NOT added to its amount (no double counting).") },
  { id: "A-WL-7", sources: ["white_lands"], text: BI("\u0645\u0644\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621 \u0645\u0633\u0627\u0631 \u062B\u0627\u0644\u062B \u0645\u0633\u062A\u0642\u0644 \u0639\u0646 \u0625\u064A\u0641\u0627\u0621 \u0648\u0633\u0646\u062F: \u064A\u0631\u0628\u0637 \u0631\u0642\u0645 \u0623\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0628\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631\u061B \u0648\u0645\u0628\u0644\u063A \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0644\u0627 \u064A\u064F\u0636\u0627\u0641 \u0644\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629.", "The white-lands comprehensive enforcement file is a third track apart from Efaa and Sanad: it maps the order number to invoices; the execution amount is not added to the debt.") },
  { id: "A-LI-1", sources: ["licenses"], text: BI("\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 9 \u064810 \u064811 (\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F\u060C \u0645\u0631\u0641\u0648\u0636\u0629\u060C \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632) \u0644\u064A\u0633\u062A \u0645\u0637\u0627\u0644\u0628\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062A\u062D\u0635\u064A\u0644 \u0648\u0644\u0627 \u062A\u064F\u0648\u0644\u064E\u0651\u062F \u0643\u0641\u0648\u0627\u062A\u064A\u0631\u061B \u062A\u064F\u0639\u062F\u0651 \u0641\u064A \u062C\u0648\u062F\u0629 \u0627\u0644\u0645\u0635\u062F\u0631 \u0641\u0642\u0637.", "Bill statuses 9, 10 and 11 (awaiting approval, rejected, in preparation) are not collectible demands and are not generated as invoices; they are counted in source quality only.") },
  { id: "A-LI-2", sources: ["licenses"], text: BI("\u0627\u0644\u062D\u0627\u0644\u062A\u0627\u0646 2 \u06483 (\u0645\u0644\u063A\u0627\u0629) \u062A\u064F\u0639\u0627\u0645\u0644\u0627\u0646 \u0643\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0644\u063A\u0627\u0629 \u062A\u064F\u062E\u0635\u0645 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629.", "Statuses 2 and 3 (cancelled) are a cancelled invoice, deducted once.") },
  { id: "A-LI-3", sources: ["licenses"], text: BI("\u0633\u062C\u0644 \u0627\u0644\u0631\u062E\u0635\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u064A\u062D\u0645\u0644 \u0622\u062E\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u0641\u0642\u0637\u061B \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0644\u0644\u0631\u062E\u0635\u0629 \u062A\u0623\u062A\u064A \u0645\u0646 BALADY_BILLS \u0648\u0644\u0627 \u062A\u064F\u0639\u062F\u0651 \u0645\u0631\u062A\u064A\u0646.", "A commercial-licence row carries only its last bill; earlier bills come from BALADY_BILLS and are not counted twice.") },
  { id: "A-LI-4", sources: ["licenses"], text: BI("\u0644\u0627 \u064A\u0648\u062C\u062F \u0641\u064A \u0645\u062E\u0637\u0637\u0627\u062A \u0627\u0644\u0631\u062E\u0635 \u0645\u0628\u0644\u063A \u0631\u0633\u0648\u0645 \u0627\u0644\u0631\u062E\u0635\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0623\u0648 \u0631\u062E\u0635\u0629 \u0627\u0644\u0628\u0646\u0627\u0621: \u0627\u0644\u0645\u0628\u0644\u063A \u0645\u0646 BALADY_BILLS (BILL_AMOUNT) \u0648\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u062D\u0644 \u062A\u0634\u062A\u0642 \u0645\u0646\u0647 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0627\u064B.", "The commercial and building licence views carry no fee amount: the amount comes from BALADY_BILLS (BILL_AMOUNT) and the shop area is derived from it by assumption.") },
  { id: "A-LI-5", sources: ["licenses"], text: BI("Housing_DM \u0631\u062E\u0635\u0629 \u0633\u0643\u0646 \u0628\u0642\u064A\u0645\u0629 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0648\u0644\u064A\u0633 \u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0633\u0648\u0645: \u0644\u0627 \u062A\u064F\u0648\u0644\u064E\u0651\u062F \u0645\u0646\u0647 \u0641\u0648\u0627\u062A\u064A\u0631.", "Housing_DM is a housing licence with a rent-contract value, not a fee invoice: no invoices are generated from it.") },
  { id: "A-FI-1", sources: ["fines"], text: BI("\xAB\u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629\xBB \u0648\xAB\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629\xBB \u0631\u0642\u0645\u0627\u0646 \u0645\u062E\u062A\u0644\u0641\u0627\u0646 \u0641\u064A \u0627\u0644\u062A\u0642\u0631\u064A\u0631: \u062A\u064F\u062D\u062A\u0633\u0628 \u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629\u060C \u0648\u062A\u064F\u0639\u0631\u0636 \u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629\u060C \u0648\u0627\u0644\u0627\u062E\u062A\u0644\u0627\u0641 \u064A\u064F\u0639\u062F\u0651 \u0645\u0644\u0627\u062D\u0638\u0629 \u062C\u0648\u062F\u0629.", '"Invoice value" and "violation value" are two different fields: the invoice value is counted, the violation value is shown, and a difference is a data-quality note.') },
  { id: "A-FI-2", sources: ["fines"], text: BI("\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629 (\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F) \u0644\u064A\u0633\u062A \u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0639\u062F \u0648\u0644\u0627 \u062A\u064F\u0648\u0644\u064E\u0651\u062F\u061B \u0648\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0644\u062A\u064A \u062A\u062A\u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u0644\u0623\u0648\u0644 \u0645\u0631\u0629 \u0644\u0627 \u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0647\u0627.", "An unapproved violation is not an invoice yet and is not generated; a violation that only requires a first-time warning has no invoice.") },
  { id: "A-FI-3", sources: ["fines"], text: BI("\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0641\u064A \u0625\u064A\u0641\u0627\u0621 (14 \u0631\u0642\u0645\u0627\u064B) \u0646\u0635\u061B \u0648\u064A\u0631\u0628\u0637 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0625\u064A\u0641\u0627\u0621 \u062F\u0648\u0646 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u062D\u0627\u0644\u0629 \u062A\u062D\u0635\u064A\u0644.", "The Efaa violation number (14 digits) is text; it links the invoice to Efaa without replacing the Tahseel status.") },
  { id: "A-RV-1", sources: ["all"], text: BI("\u0641\u064A ENT_REVENUES \u064A\u062A\u0643\u0631\u0631 TOTAL_AMOUNT \u0639\u0644\u0649 \u0643\u0644 \u0628\u0646\u062F: \u062A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u0629 \u0628\u0645\u0628\u0644\u063A\u0647\u0627 \u0648\u064A\u062C\u0628 \u0623\u0646 \u064A\u0633\u0627\u0648\u064A \u0645\u062C\u0645\u0648\u0639 DETAIL_AMOUNT \u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629.", "In ENT_REVENUES TOTAL_AMOUNT repeats on every line: the invoice is counted once and the sum of DETAIL_AMOUNT must equal the invoice value.") },
  { id: "A-RV-2", sources: ["all"], text: BI("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0633\u0648\u064A\u0629 (RECONCILITION_DATE) \u064A\u0644\u064A \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F \u0628\u064A\u0648\u0645 \u0625\u0644\u0649 \u062B\u0644\u0627\u062B\u0629\u061B \u0644\u0627 \u064A\u064F\u0633\u062A\u062E\u062F\u0645 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0628\u062F\u064A\u0644\u0627\u064B \u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F.", "The reconciliation date follows the payment date by one to three days; it is never used in place of the payment date.") },
  { id: "A-HS-1", sources: ["housing_sales"], text: BI("\u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646 \u0641\u064A \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629 = \u0631\u0633\u0648\u0645 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621 + \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629 (\u0645\u0628\u0627\u0644\u063A \u0635\u063A\u064A\u0631\u0629)\u061B \u0644\u0627 \u0645\u062E\u0637\u0637 \u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0644\u0645\u0628\u064A\u0639\u0627\u062A.", "In the monthly reports the housing sector = white-land fees + residential sales (small amounts); there is no sales-invoice schema.") }
];
var assumptionsFor = (source) => ASSUMPTIONS.filter((a) => a.sources.includes("all") || a.sources.includes(source));

// src/data/iim.js
var CENTRAL_BILLER_IDS = ["177"];
var CENTRAL_BILLER = { id: "177", ar: "\u0627\u0644\u0641\u0648\u062A\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629 \u2014 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A \u0648\u0627\u0644\u0625\u0633\u0643\u0627\u0646", en: "Central billing \u2014 Ministry of Municipalities and Housing" };
var HOUSING_BILLER = { id: "171", ar: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646", en: "Housing sector" };
var REFERRED_CANCELLED_STAYS_BILLED = true;
var EXCLUSIONS_AUTO_APPLY = true;
var HAFR_AL_BATIN = 14;
var AMANAH_BILLER_IDS = ["010", "028", "025", "027", "006", "084", "113", "070", "112", "064", "062", "061", "102", "087", "315", "104", "103"];
function billerOf(ent, scope) {
  if (ent === ENT_HOUSING) return HOUSING_BILLER;
  if (scope === 0 || ent == null) return CENTRAL_BILLER;
  const e = ENTITIES[ent];
  return { id: AMANAH_BILLER_IDS[ent], ar: e.ar, en: e.en, verified: ent !== HAFR_AL_BATIN };
}
var entityTypeOf = (ent) => ent === ENT_HOUSING ? "entity" : "amanah";
var ENTITY_TYPE_AR = { amanah: "\u0623\u0645\u0627\u0646\u0629", entity: "\u062C\u0647\u0629" };
var isCentralBiller = (billerId) => CENTRAL_BILLER_IDS.includes(String(billerId));
var originOf = (billerId) => isCentralBiller(billerId) ? "central" : "internal";
var ORIGIN_AR = { central: "\u0645\u0631\u0643\u0632\u064A", internal: "\u062F\u0627\u062E\u0644\u064A" };
var ORIGIN_EN = { central: "Central", internal: "Internal" };
var BILLERS = [CENTRAL_BILLER, ...ENTITIES.slice(0, N_AMANAH).map((e, i) => ({ id: AMANAH_BILLER_IDS[i], ar: e.ar, en: e.en, verified: i !== HAFR_AL_BATIN })), HOUSING_BILLER];
function parseInvoiceKey(s) {
  const m = /^(\d{3,4})-(\d{6,14})$/.exec(String(s || "").trim());
  return m ? { billerId: m[1], sadad: m[2] } : null;
}
var PRODUCTS = {
  foras: { ar: "\u0641\u0631\u0635", en: "Furas" },
  screen: { ar: "\u0634\u0627\u0634\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629", en: "Electronic screen" },
  baladi: { ar: "\u0628\u0644\u062F\u064A", en: "Baladi" },
  mumtathil: { ar: "\u0645\u0645\u062A\u062B\u0644", en: "Mumtathil" },
  tobacco: { ar: "\u062A\u0628\u063A", en: "Tobacco platform" },
  accommodation: { ar: "\u0625\u064A\u0648\u0627\u0621", en: "Accommodation platform" },
  whiteLands: { ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", en: "White-land fees" },
  internal: { ar: "\u0627\u0644\u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629", en: "Internal systems" }
};
var PRODUCT_KEYS = Object.keys(PRODUCTS);
var PRODUCT_OF_SOURCE = { investment: "foras", fines: "mumtathil", municipal_fees: "baladi", licenses: "internal", accommodation: "accommodation", tobacco: "tobacco", white_lands: "whiteLands", housing_sales: "baladi" };
var productOf = (sourceKey, itemKey, originIdx = 0) => sourceKey === "investment" && itemKey === "ad_sites" ? "screen" : sourceKey === "investment" && originIdx === 1 ? "internal" : PRODUCT_OF_SOURCE[sourceKey] || "baladi";
var PROD_POS = Object.fromEntries(PRODUCT_KEYS.map((k, i) => [k, i]));
var PROD_TABLE = new Uint8Array(SOURCES.length * ITEMS.length * 2);
SOURCES.forEach((sr, si) => ITEMS.forEach((it, ii) => {
  for (let o = 0; o < 2; o += 1) PROD_TABLE[(si * ITEMS.length + ii) * 2 + o] = PROD_POS[productOf(sr.key, it.key, o)];
}));
var productIdxOf = (srcIdx, itemIdx, originIdx = 0) => PROD_TABLE[(srcIdx * ITEMS.length + itemIdx) * 2 + originIdx];
var DISCLOSURE_PRODUCTS = ["tobacco", "accommodation"];
var MAIN = { municipal: "\u0631\u0633\u0648\u0645 \u0628\u0644\u062F\u064A\u0629", investment: "\u0627\u0633\u062A\u062B\u0645\u0627\u0631", penalties: "\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u063A\u0631\u0627\u0645\u0627\u062A", misc: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629", accommodation: "\u0625\u064A\u0648\u0627\u0621", tobacco: "\u062A\u0628\u063A", other: "\u0623\u062E\u0631\u0649" };
var UNCLASSIFIED = "\u063A\u064A\u0631 \u0645\u0635\u0646\u0641";
var OTHER_CLASS = MAIN.other;
var GFS = {
  "14155": { sub: "\u0631\u064A\u0639 \u0627\u0644\u0623\u0631\u0627\u0636\u064A (\u0623\u062C\u0648\u0631 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621\u060C \u0623\u062C\u0648\u0631 \u0633\u0637\u062D\u064A\u0629)", main: MAIN.investment },
  "141229": { sub: "\u0623\u0631\u0628\u0627\u062D \u0623\u062E\u0631\u0649", main: MAIN.investment },
  "142134": { sub: "\u0623\u062C\u0648\u0631 \u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629", main: MAIN.investment },
  "142162": { sub: "\u062A\u0623\u062C\u064A\u0631 \u0645\u0631\u0627\u0641\u0642", main: MAIN.investment },
  "142163": { sub: "\u062A\u0623\u062C\u064A\u0631 \u0645\u0628\u0627\u0646\u064A \u062A\u062C\u0627\u0631\u064A\u0629", main: MAIN.investment },
  "1421912": { sub: "\u062A\u0623\u062C\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0644\u0623\u063A\u0631\u0627\u0636 \u0645\u0624\u0642\u062A\u0629", main: MAIN.investment },
  "142113": { sub: "\u0627\u0644\u0644\u0648\u062D\u0627\u062A \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064A\u0629", main: MAIN.investment },
  "142161": { sub: "\u0627\u0644\u0625\u064A\u062C\u0627\u0631\u0627\u062A \u0648\u0623\u0642\u0633\u0627\u0637 \u0627\u0644\u0645\u0633\u0627\u0643\u0646", main: MAIN.investment },
  "11200-11201": { sub: "\u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u2014 \u062A\u0623\u062C\u064A\u0631 \u0623\u0631\u0627\u0636\u064A", main: MAIN.investment },
  "11200-11203": { sub: "\u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u2014 \u062A\u0623\u062C\u064A\u0631 \u0627\u0644\u0645\u0631\u0627\u0641\u0642", main: MAIN.investment },
  "11200-11204": { sub: "\u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u2014 \u062A\u0623\u062C\u064A\u0631 \u0645\u0628\u0627\u0646\u064A \u062A\u062C\u0627\u0631\u064A\u0629", main: MAIN.investment },
  "11100-11105": { sub: "\u0631\u0633\u0648\u0645 \u0648\u0623\u062C\u0648\u0631 \u062E\u062F\u0645\u0627\u062A \u2014 \u0627\u0644\u0644\u0648\u062D\u0627\u062A \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064A\u0629", main: MAIN.investment },
  // overridden by biller: see OVERRIDES
  "11000-11006": { sub: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u2014 \u0645\u0628\u064A\u0639\u0627\u062A \u0646\u0627\u062A\u062C\u0629 \u0645\u0646 \u0627\u0644\u0646\u0634\u0627\u0637 \u063A\u064A\u0631 \u0645\u0635\u0646\u0641\u0629 \u0623\u0639\u0644\u0627\u0647", main: MAIN.misc },
  "11000-11007": { sub: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u2014 \u0627\u0644\u0623\u0631\u0627\u0636\u064A", main: MAIN.misc },
  "1421999": { sub: "\u0645\u0628\u064A\u0639\u0627\u062A \u0623\u062E\u0631\u0649", main: MAIN.misc },
  "14": { sub: "\u0645\u0628\u064A\u0639\u0627\u062A \u0623\u062E\u0631\u0649", main: MAIN.misc },
  "11442": { sub: "\u0625\u0634\u063A\u0627\u0644 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0625\u064A\u0648\u0627\u0621", main: MAIN.accommodation },
  "11422": { sub: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0628\u063A", main: MAIN.tobacco },
  "1421911": { sub: "\u0631\u0633\u0645 \u0645\u0628\u064A\u0639\u0627\u062A \u0645\u062D\u0644\u0627\u062A \u062A\u0642\u062F\u064A\u0645 \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u062A\u0628\u063A", main: MAIN.tobacco },
  "1422121": { sub: "\u0631\u0633\u0645 \u062A\u0631\u062E\u064A\u0635 \u0646\u0634\u0627\u0637 \u062A\u0642\u062F\u064A\u0645 \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u062A\u0628\u063A", main: MAIN.tobacco },
  "1438": { sub: "\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u063A\u0631\u0627\u0645\u0627\u062A \u0645\u0641\u0631\u0648\u0636\u0629 \u0628\u0645\u0648\u062C\u0628 \u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u062C\u0647\u0629", main: MAIN.penalties },
  "1439": { sub: "\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u063A\u0631\u0627\u0645\u0627\u062A \u0623\u062E\u0631\u0649 \u063A\u064A\u0631 \u0645\u0635\u0646\u0641\u0629 (\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0645\u0635\u0627\u062F\u0631\u0627\u062A \u0648\u063A\u064A\u0631\u0647\u0627)", main: MAIN.penalties },
  "11400-11401": { sub: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u062A\u0646\u0648\u0639\u0629 \u2014 \u062C\u0632\u0627\u0621\u0627\u062A \u0648\u063A\u0631\u0627\u0645\u0627\u062A \u0645\u0641\u0631\u0648\u0636\u0629 \u0628\u0645\u0648\u062C\u0628 \u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u062C\u0647\u0629", main: MAIN.penalties },
  "1438001": { sub: "\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u063A\u0631\u0627\u0645\u0627\u062A \u0645\u0641\u0631\u0648\u0636\u0629 \u0628\u0645\u0648\u062C\u0628 \u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u062C\u0647\u0629", main: MAIN.penalties },
  "1438002": { sub: "\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u063A\u0631\u0627\u0645\u0627\u062A \u0645\u0641\u0631\u0648\u0636\u0629 \u0628\u0645\u0648\u062C\u0628 \u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u062C\u0647\u0629", main: MAIN.penalties },
  "142139": { sub: "\u0623\u062C\u0648\u0631 \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0623\u062E\u0631\u0649 \u0644\u0644\u0645\u0648\u0627\u0646\u0626", main: MAIN.municipal },
  "11100-11101": { sub: "\u0631\u0633\u0648\u0645 \u0648\u0623\u062C\u0648\u0631 \u062E\u062F\u0645\u0627\u062A \u2014 \u0631\u0633\u0648\u0645 \u062E\u062F\u0645\u0627\u062A \u0628\u0644\u062F\u064A\u0629", main: MAIN.municipal },
  "1437": { sub: "\u0639\u0648\u0627\u0626\u062F \u0623\u0631\u0636\u064A\u0627\u062A", main: MAIN.municipal },
  "11102": { sub: "\u062A\u0631\u0627\u062E\u064A\u0635 \u0627\u0644\u0645\u062D\u0644\u0627\u062A", main: MAIN.municipal },
  "11107": { sub: "\u0644\u0648\u062D\u0627\u062A \u0645\u062D\u0644\u0627\u062A", main: MAIN.municipal },
  "11110": { sub: "\u0627\u0644\u0628\u0646\u0627\u0621 \u0648\u0627\u0644\u062A\u0631\u0645\u064A\u0645 \u0648\u0627\u0644\u0647\u062F\u0645", main: MAIN.municipal },
  "11114": { sub: "\u0627\u0644\u0643\u0634\u0641\u064A\u0629", main: MAIN.municipal },
  "1421908": { sub: "\u0631\u0633\u0648\u0645 \u062E\u062F\u0645\u0627\u062A \u0628\u0644\u062F\u064A\u0629", main: MAIN.municipal },
  "1421909": { sub: "\u062C\u0645\u0639 \u0627\u0644\u0646\u0641\u0627\u064A\u0627\u062A", main: MAIN.municipal },
  "1421910": { sub: "\u0625\u0635\u062F\u0627\u0631 \u062A\u0631\u0627\u062E\u064A\u0635 \u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0623\u0631\u0635\u0641\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0637\u0631\u0642", main: MAIN.municipal },
  "1422103": { sub: "\u062A\u0631\u0627\u062E\u064A\u0635 \u0627\u0644\u0645\u062D\u0644\u0627\u062A", main: MAIN.municipal },
  "1422104": { sub: "\u0631\u0633\u0648\u0645 \u0648\u0623\u062C\u0648\u0631 \u0646\u0627\u062A\u062C\u0629 \u0645\u0646 \u0627\u0644\u0646\u0634\u0627\u0637 \u063A\u064A\u0631 \u0645\u0635\u0646\u0641\u0629 \u0623\u0639\u0644\u0627\u0647", main: MAIN.municipal },
  "1422105": { sub: "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0628\u062A\u0631", main: MAIN.misc },
  "1422106": { sub: "\u0627\u0644\u0628\u0646\u0627\u0621 \u0648\u0627\u0644\u062A\u0631\u0645\u064A\u0645 \u0648\u0627\u0644\u0647\u062F\u0645", main: MAIN.municipal },
  "1422107": { sub: "\u0627\u0644\u062D\u0641\u0631", main: MAIN.municipal },
  "1422108": { sub: "\u0627\u0644\u0634\u0647\u0627\u062F\u0627\u062A \u0627\u0644\u0635\u062D\u064A\u0629 (\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0634\u0647\u0627\u062F\u0627\u062A \u0627\u0644\u0635\u062D\u064A\u0629)", main: MAIN.municipal },
  "1422109": { sub: "\u0627\u0644\u0643\u0634\u0641\u064A\u0629 (\u0627\u0644\u0642\u064A\u0627\u0645 \u0628\u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0623\u0648 \u0627\u0644\u0643\u0634\u0641\u064A\u0629)", main: MAIN.municipal },
  "1422112": { sub: "\u0625\u0635\u062F\u0627\u0631 \u0631\u062E\u0635\u0629", main: MAIN.municipal },
  "1422113": { sub: "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0631\u062E\u064A\u0635 \u0627\u0644\u0639\u0642\u0627\u0631 \u0623\u0648 \u062A\u062C\u062F\u064A\u062F \u0645\u0632\u0627\u0648\u0644\u0629 \u0627\u0644\u0646\u0634\u0627\u0637", main: MAIN.municipal },
  "1422199": { sub: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0627\u0644\u0623\u062E\u0631\u0649", main: MAIN.municipal },
  "11452103": { sub: "\u0625\u0635\u062F\u0627\u0631 \u062A\u0631\u0627\u062E\u064A\u0635 \u0627\u0644\u0645\u0628\u0627\u0646\u064A \u0648\u0627\u0644\u0623\u0633\u0648\u0627\u0631", main: MAIN.municipal },
  "11452104": { sub: "\u0625\u0635\u062F\u0627\u0631 \u0631\u062E\u0635 \u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629", main: MAIN.municipal },
  "11452105": { sub: "\u0625\u0635\u062F\u0627\u0631 \u062A\u0631\u0627\u062E\u064A\u0635 \u062D\u0641\u0631 \u0627\u0644\u0634\u0648\u0627\u0631\u0639", main: MAIN.municipal },
  "11452106": { sub: "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0631\u0627\u062E\u064A\u0635 \u0628\u062A\u0623\u0633\u064A\u0633 \u0623\u0648 \u062A\u0634\u063A\u064A\u0644 \u0623\u0628\u0631\u0627\u062C \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A", main: MAIN.municipal },
  "11452109": { sub: "\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u062E\u0637\u0637\u0627\u062A \u0627\u0644\u062A\u0637\u0648\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u064A", main: MAIN.municipal },
  "11452107": { sub: "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0631\u0627\u062E\u064A\u0635 \u0628\u062A\u0623\u0633\u064A\u0633 \u0623\u0648 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A", main: MAIN.municipal },
  "11452110": { sub: "\u0625\u0635\u062F\u0627\u0631 \u062A\u0631\u0627\u062E\u064A\u0635 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0623\u0645\u0644\u0627\u0643 \u062E\u0627\u0635\u0629 \u0644\u0625\u0642\u0627\u0645\u0629 \u0641\u0639\u0627\u0644\u064A\u0627\u062A", main: MAIN.municipal },
  "11452111": { sub: "\u0627\u0644\u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0644\u0633\u0645\u0627\u062D \u0644\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0628\u0627\u0644\u0639\u0645\u0644 24 \u0633\u0627\u0639\u0629", main: MAIN.municipal },
  "11452505": { sub: "\u0631\u0633\u0648\u0645 \u0646\u0642\u0644 \u0627\u0644\u062E\u062F\u0645\u0627\u062A", main: MAIN.municipal },
  "11452512": { sub: "\u0644\u0648\u062D\u0627\u062A \u0645\u062D\u0644\u0627\u062A", main: MAIN.municipal },
  "11452513": { sub: "\u0644\u0648\u062D\u0627\u062A \u0625\u0631\u0634\u0627\u062F\u064A\u0629", main: MAIN.municipal },
  "11100-11106": { sub: "\u0631\u0633\u0648\u0645 \u0648\u0623\u062C\u0648\u0631 \u062E\u062F\u0645\u0627\u062A \u2014 \u0631\u0633\u0648\u0645 \u0648\u0623\u062C\u0648\u0631 \u0646\u0627\u062A\u062C\u0629 \u0645\u0646 \u0627\u0644\u0646\u0634\u0627\u0637 \u063A\u064A\u0631 \u0645\u0635\u0646\u0641\u0629 \u0623\u0639\u0644\u0627\u0647", main: MAIN.municipal },
  "11452108": { sub: "\u0628\u0644\u062F\u064A \u2014 \u0627\u0644\u0631\u062E\u0635 \u0627\u0644\u0625\u0646\u0634\u0627\u0626\u064A\u0629", main: MAIN.municipal },
  "1421905": { sub: "\u0631\u0633\u0648\u0645 \u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A (\u0625\u064A\u0635\u0627\u0644 \u0645\u064A\u0627\u0647 \u0648\u0635\u0631\u0641 \u0635\u062D\u064A)", main: MAIN.misc },
  "11452511": { sub: "\u0631\u0633\u0648\u0645 \u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621", main: MAIN.misc },
  "11100-11103": { sub: "\u0631\u0633\u0648\u0645 \u0648\u0623\u062C\u0648\u0631 \u062E\u062F\u0645\u0627\u062A \u2014 \u0631\u0633\u0648\u0645 \u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621", main: MAIN.misc },
  "1453": { sub: "\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u0646\u0648\u0639\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0635\u0646\u0641\u0629 \u0641\u064A \u0645\u0643\u0627\u0646 \u0622\u062E\u0631", main: MAIN.misc },
  "11519": { sub: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0623\u062E\u0631\u0649", main: MAIN.misc },
  "1421904": { sub: "\u0645\u0628\u064A\u0639\u0627\u062A \u0645\u064A\u0627\u0647", main: MAIN.misc },
  "1422119": { sub: "\u0646\u0642\u0644 \u0645\u0644\u0643\u064A\u0629 \u0627\u0644\u0639\u0642\u0627\u0631", main: MAIN.misc },
  "144122": { sub: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u062A\u0646\u0648\u0639\u0629 \u063A\u064A\u0631 \u0645\u0635\u0646\u0641\u0629 \u0641\u064A \u0645\u0643\u0627\u0646 \u0622\u062E\u0631", main: MAIN.misc },
  "1421903": { sub: "\u0645\u0628\u064A\u0639\u0627\u062A \u062A\u064A\u0627\u0631 \u0643\u0647\u0631\u0628\u0627\u0626\u064A", main: MAIN.misc },
  "11400-11402": { sub: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u062A\u0646\u0648\u0639\u0629 \u2014 \u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629 \u0646\u0627\u062A\u062C\u0629 \u0639\u0646 \u0627\u0644\u0646\u0634\u0627\u0637 \u063A\u064A\u0631 \u0645\u0635\u0646\u0641\u0629", main: MAIN.misc },
  "1421907": { sub: "\u0627\u0644\u0645\u062E\u0637\u0637\u0627\u062A", main: MAIN.misc },
  "1422202": { sub: "\u0646\u0642\u0644 \u0627\u0644\u0645\u0644\u0643\u064A\u0629", main: MAIN.misc },
  "33182147": { sub: "\u0623\u0645\u0627\u0646\u0627\u062A \u0645\u062A\u0646\u0648\u0639\u0629 \u0623\u062E\u0631\u0649", main: MAIN.misc },
  // «أخرى» — never part of إجمالي المفوتر (D7)
  "11411": { sub: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629", main: OTHER_CLASS },
  "1421901": { sub: "\u0628\u064A\u0639 \u0627\u0644\u0648\u062B\u0627\u0626\u0642 \u0648\u0627\u0644\u0623\u0646\u0638\u0645\u0629", main: OTHER_CLASS },
  "1431": { sub: "\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u0627\u0644\u063A\u0631\u0627\u0645\u0627\u062A", main: OTHER_CLASS },
  "3318212": { sub: "\u0645\u0631\u062A\u062C\u0639 \u0631\u0648\u0627\u062A\u0628", main: OTHER_CLASS },
  "144121": { sub: "\u0645\u0628\u0627\u0644\u063A \u0645\u0633\u062A\u0631\u062F\u0629 \u0645\u0646 \u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0633\u0646\u0648\u0627\u062A \u0633\u0627\u0628\u0642\u0629", main: OTHER_CLASS },
  "180201": { sub: "\u0623\u062C\u0648\u0631 \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0627\u0644\u062A\u064A \u062A\u0642\u062F\u0645\u0647\u0627 \u0634\u0631\u0643\u0629 \u0639\u0644\u0645", main: OTHER_CLASS }
};
var OTHER_CODES = Object.keys(GFS).filter((k) => GFS[k].main === OTHER_CLASS);
var OVERRIDES = { "11100-11105": { central: MAIN.municipal, internal: MAIN.investment } };
function classify(code, origin) {
  const g = GFS[String(code)];
  if (!g) return { code: code || null, sub: null, main: UNCLASSIFIED };
  const ov = OVERRIDES[String(code)];
  return { code: String(code), sub: g.sub, main: ov && ov[origin] || g.main };
}
var GFS_OF_ITEM = {
  land_lease: "14155",
  ad_sites: "142113",
  commercial_units: "142163",
  ad_boards_amanah: "11100-11105",
  building_violations: "1438",
  signage_violations: "1438001",
  health_violations: "1438002",
  inspection_fees: "11114",
  waste_collection: "1421909",
  excavation_permits: "11452105",
  ad_boards: "11100-11105",
  commercial_license: "11452104",
  signboard_license: "11107",
  building_permit: "11452103",
  health_certificate: "1422108",
  hotel_occupancy: "11442",
  tobacco_fee: "11422",
  white_land_fee: "1437",
  misc_revenue: "1453",
  housing_sales: "11000-11007",
  housing_fees: "1421999"
};
var OTHER_SHARE = 0.38;
var UNKNOWN_CODE = "1459";
var UNKNOWN_SHARE = 0.03;
function gfsCodeOf(itemKey, h = 0) {
  if (itemKey === "misc_revenue") {
    const u = h % 1e3 / 1e3;
    if (u < OTHER_SHARE) return OTHER_CODES[(h >>> 10) % OTHER_CODES.length];
    if (u < OTHER_SHARE + UNKNOWN_SHARE) return UNKNOWN_CODE;
  }
  return GFS_OF_ITEM[itemKey] || null;
}
var GFS_CODES = Object.keys(GFS);
var GFS_POS = new Map(GFS_CODES.map((c, i) => [c, i]));
var UNKNOWN_IDX = 255;
var gfsIndexOf = (code) => code == null ? UNKNOWN_IDX : GFS_POS.has(String(code)) ? GFS_POS.get(String(code)) : UNKNOWN_IDX;
var gfsCodeAt = (idx) => idx === UNKNOWN_IDX ? UNKNOWN_CODE : GFS_CODES[idx];
var MAIN_LIST = [MAIN.municipal, MAIN.investment, MAIN.penalties, MAIN.misc, MAIN.accommodation, MAIN.tobacco, MAIN.other, UNCLASSIFIED];
var MAIN_POS = Object.fromEntries(MAIN_LIST.map((m, i) => [m, i]));
var OTHER_MAIN_IDX = MAIN_POS[MAIN.other];
var UNCLASSIFIED_MAIN_IDX = MAIN_POS[UNCLASSIFIED];
var MAIN_TABLE = new Uint8Array(256 * 2).fill(UNCLASSIFIED_MAIN_IDX);
GFS_CODES.forEach((c, i) => {
  MAIN_TABLE[i * 2] = MAIN_POS[classify(c, "central").main];
  MAIN_TABLE[i * 2 + 1] = MAIN_POS[classify(c, "internal").main];
});
var mainClassIdx = (gfsIdx, originIdx) => MAIN_TABLE[gfsIdx * 2 + originIdx];
var originIdxOf = (ent, scope) => ent === ENT_HOUSING ? 1 : scope === 1 ? 1 : 0;
var classOfRow = (gfsIdx, originIdx) => {
  const code = gfsCodeAt(gfsIdx);
  return gfsIdx === UNKNOWN_IDX ? { code, sub: null, main: UNCLASSIFIED } : classify(code, originIdx === 0 ? "central" : "internal");
};
var EXCLUSION_REASONS = [
  {
    n: 1,
    code: "NO_CONTRACT",
    ruleId: "NOC-1",
    ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0627 \u062A\u0633\u062A\u0646\u062F \u0639\u0644\u0649 \u0639\u0642\u0648\u062F",
    en: "Invoices not based on contracts",
    ruleAr: "\u0623\u064A \u0641\u0627\u062A\u0648\u0631\u0629\u060C \u0645\u0646 \u0623\u064A \u0623\u0645\u0627\u0646\u0629 \u0623\u0648 \u062C\u0647\u0629 (\u0645\u0631\u0643\u0632\u064A\u0629 \u0623\u0648 \u062F\u0627\u062E\u0644\u064A\u0629)\u060C \u0628\u062D\u0633\u0627\u0628 \u0625\u064A\u0631\u0627\u062F \u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A \u0648\u0644\u0627 \u0639\u0642\u062F \u0644\u0647\u0627 \u0641\u064A \u0641\u0631\u0635.",
    ruleEn: "Any invoice, from any Amanah or entity (central or internal), with an investment revenue account and no contract in Furas."
  },
  {
    n: 2,
    code: "SERVICE_CO_STAY",
    ruleId: "STY-1",
    ar: "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u2013 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u064A\u0629",
    en: "Stay of execution \u2013 service companies",
    workingLabel: true,
    ruleAr: "\u0627\u0644\u0639\u0645\u064A\u0644 \u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u064A\u0627\u0647 \u0627\u0644\u0648\u0637\u0646\u064A\u0629 \u0623\u0648 \u0634\u0631\u0643\u0629 \u062E\u062F\u0645\u064A\u0629 \u062A\u062D\u062A \u0623\u0645\u0631 \u0639\u0627\u0644\u064D \u0628\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u062C\u0646\u0629. \u062A\u0633\u0628\u0642 \xAB\u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0627 \u062A\u0633\u062A\u0646\u062F \u0639\u0644\u0649 \u0639\u0642\u0648\u062F\xBB. \u0627\u0644\u062A\u0633\u0645\u064A\u0629 \u0645\u0624\u0642\u062A\u0629.",
    ruleEn: "The customer is the National Water Company or a service company under a high-order stay of execution pending a committee. Takes precedence over R1. Working label."
  },
  {
    n: 3,
    code: "SANAD_EXECUTED",
    ruleId: "SND-1",
    ar: "\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0623\u0645\u0631 \u062A\u0646\u0641\u064A\u0630 \u0645\u0624\u0643\u062F",
    en: "Linked to a confirmed enforcement order",
    ruleAr: "\u0623\u064A \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062D\u0635\u0651\u0644\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0623\u0645\u0631 \u062A\u0646\u0641\u064A\u0630 \u0645\u0624\u0643\u062F \u0641\u064A \u0633\u0646\u062F (\u0631\u0642\u0645 \u062A\u0646\u0641\u064A\u0630 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631\u060C \u0623\u0648 \u0631\u0628\u0637 \u0623\u0643\u0651\u062F\u0647 \u0645\u0631\u0627\u062C\u0639 \u0645\u0646 \u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0623\u0645\u0631)\u060C \u0645\u0647\u0645\u0627 \u0643\u0627\u0646\u062A \u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0645\u0631. \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0623\u0648 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0645\u0642\u062A\u0631\u062D \u0648\u062D\u062F\u0647\u0645\u0627 \u0644\u0627 \u064A\u0637\u0628\u0651\u0642\u0627\u0646 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F. \u0627\u0644\u0642\u0627\u0639\u062F\u0629 SND-1 (\u0633\u0627\u0628\u0642\u0627\u064B \xAB\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 \u2013 \u0642\u0636\u0627\u064A\u0627 (\u0633\u0646\u062F)\xBB).",
    ruleEn: "Any uncollected invoice linked to a confirmed Sanad enforcement order (an execution number in the source, or a link a reviewer confirmed from the order document), whatever the status of the order. Extraction or a proposed link alone never applies the exclusion. Rule SND-1 (formerly \xABExecuted against \u2013 cases (Sanad)\xBB)."
  },
  {
    n: 4,
    code: "EEFAA_INCOMPLETE",
    ruleId: "INC-1",
    ar: "\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644",
    en: "Incomplete",
    ruleAr: "\u0627\u0644\u062D\u0627\u0644\u0629 \xAB\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\xBB \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u0623\u062F\u0627\u0621: \u064A\u0624\u062E\u0630 \u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0648\u064A\u064F\u0631\u0628\u0637 \u0628\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629.",
    ruleEn: "Status \xABincomplete\xBB in the payment-claim notice report: the violation number is linked to the invoice number."
  },
  {
    n: 5,
    code: "OUTSIDE_EEFAA",
    ruleId: "EFA-1",
    ar: "\u062E\u0627\u0631\u062C \u0625\u064A\u0641\u0627\u0621",
    en: "Outside Efaa",
    ruleAr: "\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A \u0636\u0645\u0646 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0627\u0644\u062A\u064A \u0644\u0627 \u062A\u0638\u0647\u0631 \u0641\u064A \u0625\u064A\u0641\u0627\u0621\u061B \u064A\u064F\u0631\u0628\u0637 \u0631\u0642\u0645 \u0625\u064A\u0641\u0627\u0621 \u0628\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629.",
    ruleEn: "Penalties within the uncollected invoices that do not appear in Efaa; the Efaa number is linked to the invoice number."
  },
  {
    n: 6,
    code: "EEFAA_EXECUTED",
    ruleId: "EXE-1",
    ar: "\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 \u2013 \u0625\u064A\u0641\u0627\u0621",
    en: "Executed against \u2013 Efaa",
    ruleAr: "\u0643\u0644 \u0645\u062E\u0627\u0644\u0641\u0629 \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 (\u0631\u0642\u0645 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629) \u062A\u064F\u0631\u0628\u0637 \u0628\u0641\u0627\u062A\u0648\u0631\u062A\u0647\u0627 \u0648\u062A\u064F\u0633\u062A\u0628\u0639\u062F.",
    ruleEn: "Every violation in the executed-against report (execution and violation numbers) is linked to its invoice and excluded."
  },
  {
    n: 7,
    code: "OPEN_OBJECTION",
    ruleId: "OBJ-1",
    ar: "\u0627\u0639\u062A\u0631\u0627\u0636\u0627\u062A \u0642\u0627\u0626\u0645\u0629",
    en: "Open objections",
    ruleAr: "\u062A\u064F\u0633\u062A\u0628\u0639\u062F: \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0639\u0636\u0648\u060C \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0644\u062C\u0646\u0629\u060C \u0645\u0642\u0628\u0648\u0644 \u062C\u0632\u0626\u064A\u064B\u0627\u060C \u0645\u0643\u062A\u0645\u0644 \u0645\u0642\u0628\u0648\u0644. \u062A\u0628\u0642\u0649: \u0645\u0643\u062A\u0645\u0644 \u0645\u0631\u0641\u0648\u0636.",
    ruleEn: "Excluded: awaiting the member, awaiting the committee, partly accepted, complete \u2013 accepted. Kept: complete \u2013 rejected."
  },
  {
    n: 8,
    code: "ENCROACHMENT",
    ruleId: "ENC-1",
    ar: "\u0627\u0644\u062A\u0639\u062F\u064A\u0627\u062A \u0648\u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 (\u0645\u062D\u0636\u0631 \u0627\u0644\u062A\u0639\u062F\u064A)",
    en: "Encroachments and site exploitation (encroachment report)",
    ruleAr: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 (\u062E\u0627\u0631\u062C \u0641\u0631\u0635 \u0648\u0642\u062F \u062A\u0643\u0648\u0646 \u062F\u0627\u062E\u0644\u064A\u0629) \u062A\u0641\u064A\u062F \u0628\u0647\u0627 \u0627\u0644\u0623\u0645\u0627\u0646\u0629\u060C \u0648\u062A\u064F\u062D\u0645\u064E\u0651\u0644 \u0628\u0642\u0627\u0644\u0628 \u0627\u0644\u0631\u0641\u0639.",
    ruleEn: "Investment invoices (outside Furas, may be internal) reported by the Amanah, loaded through the upload template."
  },
  {
    n: 9,
    code: "AMANAH_STATEMENT",
    ruleId: "ATT-1",
    ar: "\u0625\u0641\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A",
    en: "Amanah statements",
    ruleAr: "\u0627\u0644\u0642\u0646\u0627\u0629 \u0648\u0627\u0644\u0642\u0627\u0644\u0628 \u0646\u0641\u0633\u0647\u0645\u0627 \u0644\u0644\u062A\u0639\u062F\u064A\u0627\u062A\u061B \u062A\u064F\u062D\u0645\u064E\u0651\u0644 \u0628\u0642\u0627\u0644\u0628 \u0627\u0644\u0631\u0641\u0639 \u0641\u0642\u0637.",
    ruleEn: "Same channel and template as encroachments; loaded through the upload template only."
  },
  {
    n: 10,
    code: "STRUCK_OFF_CR",
    ruleId: "CR-1",
    ar: "\u0633\u062C\u0644\u0627\u062A \u0645\u0634\u0637\u0648\u0628\u0629",
    en: "Struck-off records",
    ruleAr: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0645\u062D\u0630\u0648\u0641 \u0623\u0648 \u0645\u0644\u063A\u0649 (\u0628\u0644\u062F\u064A + \u0639\u0631\u0636 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A).",
    ruleEn: "Commercial-registration status Deleted or Cancelled (Balady + the CR view)."
  },
  {
    n: 11,
    code: "DUPLICATE",
    ruleId: "DUP-1",
    ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0643\u0631\u0631\u0629",
    en: "Duplicate invoice",
    ruleAr: "\u0646\u0641\u0633 \u0627\u0644\u0639\u0645\u064A\u0644 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u0645\u0646\u062A\u062C \u0648\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u064A\u0631\u0627\u062F \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u062F\u0627\u0631 \u0628\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u062E\u062A\u0644\u0641\u061B \u062A\u0628\u0642\u0649 \u0627\u0644\u0623\u0642\u062F\u0645 \u0631\u0642\u0645\u064B\u0627. \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0644\u064A\u0633 \u062A\u0643\u0631\u0627\u0631\u064B\u0627.",
    ruleEn: "Same customer, amount, product, revenue account and issue date with a different invoice number; the earliest-numbered is kept. A repeat in another year is not a duplicate."
  }
];
var EXCLUSION_REASON_OF_RULE = Object.fromEntries(EXCLUSION_REASONS.map((r) => [r.ruleId, r]));
var EXCLUSION_SOURCE_OF_RULE = {
  "NOC-1": { ar: "\u0641\u0631\u0635", en: "Furas" },
  "STY-1": { ar: "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0648\u0632\u0627\u0631\u0629", en: "Ministry list" },
  "SND-1": { ar: "\u0633\u0646\u062F", en: "Sanad" },
  "INC-1": { ar: "\u0625\u064A\u0641\u0627\u0621 \u2013 \u062A\u0642\u0631\u064A\u0631 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u0623\u062F\u0627\u0621", en: "Efaa \u2013 payment-claim notice report" },
  "EFA-1": { ar: "\u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A \u0645\u0642\u0627\u0628\u0644 \u0642\u0627\u0626\u0645\u0629 \u0625\u064A\u0641\u0627\u0621", en: "Uncollected debt vs the Efaa list" },
  "EXE-1": { ar: "\u0625\u064A\u0641\u0627\u0621 \u2013 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647", en: "Efaa \u2013 executed-against report" },
  "OBJ-1": { ar: "\u0625\u064A\u0641\u0627\u0621 + \u0645\u0645\u062A\u062B\u0644 (\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641)", en: "Efaa + Mumtathil (appeal status)" },
  "ENC-1": { ar: "\u0645\u0644\u0641 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 (\u0631\u0641\u0639 \u064A\u062F\u0648\u064A)", en: "Amanah file (manual upload)" },
  "ATT-1": { ar: "\u0645\u0644\u0641 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 (\u0631\u0641\u0639 \u064A\u062F\u0648\u064A)", en: "Amanah file (manual upload)" },
  "CR-1": { ar: "\u0628\u0644\u062F\u064A + \u0639\u0631\u0636 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", en: "Balady + the CR view" },
  "DUP-1": { ar: "\u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", en: "AI duplicate detection" }
};
var OBJECTION_STATUSES = [
  { key: "awaiting_member", ar: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0639\u0636\u0648", en: "Awaiting the member\u2019s direction", exclude: true },
  { key: "awaiting_committee", ar: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0644\u062C\u0646\u0629", en: "Awaiting committee review", exclude: true },
  { key: "partly_accepted", ar: "\u0645\u0642\u0628\u0648\u0644 \u062C\u0632\u0626\u064A\u064B\u0627", en: "Partly accepted", exclude: true },
  // the whole invoice is excluded (Q6 default)
  { key: "complete_accepted", ar: "\u0645\u0643\u062A\u0645\u0644 \u0645\u0642\u0628\u0648\u0644", en: "Complete \u2013 accepted", exclude: true },
  { key: "complete_rejected", ar: "\u0645\u0643\u062A\u0645\u0644 \u0645\u0631\u0641\u0648\u0636", en: "Complete \u2013 rejected", exclude: false }
];
var OBJECTION_STATUS_OF = Object.fromEntries(OBJECTION_STATUSES.map((x) => [x.key, x]));
var objectionStatusIndex = (key) => Math.max(0, OBJECTION_STATUSES.findIndex((x) => x.key === key)) + 1;
var SERVICE_COMPANY_LIST = [
  { payerIdx: 0, ar: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u064A\u0627\u0647 \u0627\u0644\u0648\u0637\u0646\u064A\u0629", en: "National Water Company" },
  { payerIdx: 1, ar: "\u0634\u0631\u0643\u0629 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644\u0629", en: "Integrated Utilities Services Company" }
];
var isServiceCompanyPayer = (idx) => SERVICE_COMPANY_LIST.some((c) => c.payerIdx === idx);

// server/names.js
var M12 = 1000000000000n;
var M10 = 10000000000n;
var M14 = 100000000000000n;
var A12 = 19999991n;
var B12 = 407700123456n % M12;
var A10 = 19999993n;
var B10 = 5171234567n;
var A14 = 19999999n;
var B14 = 31415926535897n % M14;
function inv(a, m) {
  let [t, nt, r, nr] = [0n, 1n, m, (a % m + m) % m];
  while (nr !== 0n) {
    const q3 = r / nr;
    [t, nt] = [nt, t - q3 * nt];
    [r, nr] = [nr, r - q3 * nr];
  }
  return (t % m + m) % m;
}
var I12 = inv(A12, M12);
var I10 = inv(A10, M10);
var I14 = inv(A14, M14);
var keyOf = (idKey) => {
  const y = Math.floor(idKey / 1e8);
  return (y - 2020) * 1e7 + idKey % 1e8;
};
var idKeyOf = (x) => (2020 + Math.floor(x / 1e7)) * 1e8 + x % 1e7;
var sadadOf = (idKey) => String((BigInt(keyOf(idKey)) * A12 + B12) % M12).padStart(12, "0");
var subscriptionOf = (idKey) => String((BigInt(keyOf(idKey)) * A10 + B10) % M10).padStart(10, "0");
var violationOf = (idKey) => String((BigInt(keyOf(idKey)) * A14 + B14) % M14).padStart(14, "0");
function decode(num2, I, B, M4) {
  if (!/^\d+$/.test(num2)) return null;
  const x = Number(((BigInt(num2) - B) % M4 + M4) % M4 * I % M4);
  return x < 3e8 ? idKeyOf(x) : null;
}
var invoiceIdFor = (ent, scope, idKey) => `${billerOf(ent, scope).id}-${sadadOf(idKey)}`;
var idKeyFromSadad = (s) => decode(s, I12, B12, M12);
var idKeyFromSubscription = (s) => decode(s, I10, B10, M10);
var idKeyFromViolation = (s) => decode(s, I14, B14, M14);
var NAME_A = [["\u0634\u0631\u0643\u0629", "Co."], ["\u0645\u0624\u0633\u0633\u0629", "Est."], ["\u0645\u062C\u0645\u0648\u0639\u0629", "Group"]];
var NAME_B = [["\u0627\u0644\u0623\u0641\u0642", "Al-Ofuq"], ["\u0627\u0644\u0646\u062E\u0628\u0629", "Al-Nukhba"], ["\u0627\u0644\u0645\u062F\u0627\u0631", "Al-Madar"], ["\u0627\u0644\u0631\u064A\u0627\u062F\u0629", "Al-Riyada"], ["\u0648\u0627\u062D\u0629", "Waha"], ["\u0628\u0646\u064A\u0627\u0646", "Bunyan"], ["\u0627\u0644\u0631\u0624\u064A\u0629", "Al-Ruaya"], ["\u0627\u0644\u0633\u0644\u0627\u0645", "Al-Salam"], ["\u0622\u0641\u0627\u0642", "Afaq"], ["\u0627\u0644\u062C\u0632\u064A\u0631\u0629", "Al-Jazira"], ["\u0646\u0645\u0627\u0621", "Namaa"], ["\u0627\u0644\u0648\u0627\u062D\u0629", "Al-Waha"], ["\u0627\u0644\u0633\u062D\u0627\u0628", "Al-Sahab"], ["\u0627\u0644\u0631\u0645\u0627\u0644", "Al-Rimal"], ["\u0627\u0644\u062E\u0644\u064A\u062C", "Al-Khaleej"], ["\u0627\u0644\u0635\u0642\u0631", "Al-Saqr"], ["\u0627\u0644\u0645\u0646\u0627\u0631\u0629", "Al-Manara"], ["\u0627\u0644\u062F\u0631\u0629", "Al-Durra"], ["\u062A\u0644\u0627\u0644", "Tilal"], ["\u0628\u0648\u0627\u0628\u0629", "Bawwaba"], ["\u0627\u0644\u0646\u062F\u0649", "Al-Nada"], ["\u0627\u0644\u0642\u0645\u0629", "Al-Qimma"], ["\u0627\u0644\u0634\u0631\u0648\u0642", "Al-Shurooq"], ["\u0627\u0644\u0641\u062C\u0631", "Al-Fajr"]];
var NAME_C = [["\u0644\u0644\u062A\u0637\u0648\u064A\u0631", "Development"], ["\u0644\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062A", "Contracting"], ["\u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629", "Trading"], ["\u0644\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631", "Investment"], ["\u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629", "Real Estate"], ["\u0644\u0644\u062E\u062F\u0645\u0627\u062A", "Services"], ["\u0644\u0644\u0625\u0639\u0644\u0627\u0646", "Advertising"], ["\u0644\u0644\u062A\u0634\u063A\u064A\u0644", "Operations"], ["\u0644\u0644\u062A\u0645\u0648\u064A\u0646", "Catering"], ["\u0644\u0644\u0646\u0642\u0644", "Transport"]];
var POOL = null;
function payerPool() {
  if (POOL) return POOL;
  const r = new Rng();
  POOL = [];
  for (let i = 0; i < PAYER_POOL; i += 1) {
    r.reset(mix(77, i));
    const a = NAME_A[r.int(NAME_A.length)];
    const b = NAME_B[r.int(NAME_B.length)];
    const c = NAME_C[r.int(NAME_C.length)];
    POOL.push({ ar: `${a[0]} ${b[0]} ${c[0]}`, en: `${b[1]} ${c[1]} ${a[1]}` });
  }
  return POOL;
}
function payerName(idx) {
  if (idx >= WL_PAYER_BASE) {
    const n = String(idx - WL_PAYER_BASE + 1e3).slice(-5);
    return { ar: `\u0645\u0627\u0644\u0643 \u0623\u0631\u0636 ${n}`, en: `Land owner ${n}` };
  }
  if (idx >= HOUSING_PAYER_BASE) {
    const n = String(idx - HOUSING_PAYER_BASE + 1e3).slice(-5);
    return { ar: `\u0645\u0634\u062A\u0631\u064A \u0633\u0643\u0646\u064A ${n}`, en: `Residential buyer ${n}` };
  }
  return payerPool()[idx % PAYER_POOL];
}
var beneficiaryIdOf = (idx) => `10${String(mix(8, idx) % 1e8).padStart(8, "0")}`;
var crNoOf = (c) => `10${String(Math.floor(mix(7, c) / 43)).padStart(8, "0").slice(-8)}`;
var codec = (prefix, A, B, width) => {
  const M4 = 10n ** BigInt(width);
  const Ainv = inv(BigInt(A), M4);
  const Bn = BigInt(B) % M4;
  return {
    of: (idKey) => `${prefix}${String((BigInt(keyOf(idKey)) * BigInt(A) + Bn) % M4).padStart(width, "0")}`,
    num: (idKey) => String((BigInt(keyOf(idKey)) * BigInt(A) + Bn) % M4).padStart(width, "0"),
    decode: (s) => {
      const t = String(s || "").trim().toUpperCase();
      if (!t.startsWith(prefix)) return null;
      const d = t.slice(prefix.length);
      if (!/^\d+$/.test(d) || d.length !== width) return null;
      const x = Number(((BigInt(d) - Bn) % M4 + M4) % M4 * Ainv % M4);
      return x < 3e8 ? idKeyOf(x) : null;
    }
  };
};
var DEED = codec("DEED-", 20000003, 3141592653, 10);
var LICENCE = codec("LIC-", 20000009, 2718281828, 10);
var DISCLOSURE = codec("DSC-", 20000011, 1618033988, 9);
var VISIT = codec("VIS-", 20000017, 1414213562, 9);
var SCHEDULE = codec("SCH-", 20000023, 1732050807, 9);
var REQUEST = codec("RQ-", 20000029, 2236067977, 12);
var facilityKeyOf = (payerIdx) => `FAC-${String(payerIdx).padStart(5, "0")}`;
var parseFacilityKey = (s) => {
  const m = /^FAC-(\d{5})$/.exec(String(s || "").trim().toUpperCase());
  return m ? Number(m[1]) : null;
};
var personName = (seed) => {
  const A = ["\u0623\u062D\u0645\u062F", "\u062E\u0627\u0644\u062F", "\u0633\u0639\u062F", "\u0641\u0647\u062F", "\u0646\u0627\u0635\u0631", "\u0639\u0628\u062F\u0627\u0644\u0644\u0647", "\u0645\u062D\u0645\u062F", "\u0633\u0644\u0637\u0627\u0646", "\u0645\u0627\u062C\u062F", "\u0628\u062F\u0631"];
  const B = ["\u0627\u0644\u0631\u0627\u0634\u062F", "\u0627\u0644\u0639\u0646\u0632\u064A", "\u0627\u0644\u062D\u0631\u0628\u064A", "\u0627\u0644\u062F\u0648\u0633\u0631\u064A", "\u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A", "\u0627\u0644\u0634\u0645\u0631\u064A", "\u0627\u0644\u0645\u0637\u064A\u0631\u064A", "\u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064A", "\u0627\u0644\u063A\u0627\u0645\u062F\u064A", "\u0627\u0644\u0633\u0628\u064A\u0639\u064A"];
  const h = mix(81, seed);
  return { ar: `${A[h % 10]} ${B[(h >>> 8) % 10]} (\u062A\u062C\u0631\u064A\u0628\u064A)`, en: `Demo person ${String(h % 1e5).padStart(5, "0")}` };
};
var nationalIdOf = (seed) => `1${String(mix(82, seed) % 1e9).padStart(9, "0")}`;
var mobileOf = (seed) => `05${String(mix(83, seed) % 1e8).padStart(8, "0")}`;
var hash = (...a) => mix(90, ...a);

// src/data/textNorm.js
var AR_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
var FA_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
var toWesternDigits = (t) => String(t ?? "").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
var ZERO_WIDTH = /[​-‏‪-‮⁦-⁩﻿­]/g;
function cleanRaw(t) {
  return toWesternDigits(String(t ?? "").normalize("NFKC")).replace(ZERO_WIDTH, "").replace(/[ً-ٰٟۖ-ۭ]/g, "").replace(/ـ/g, "").replace(/[  -  ]/g, " ").replace(/\s+/g, " ").trim();
}
var normText = (t) => cleanRaw(t).toLowerCase().replace(/[أإآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/ی/g, "\u064A").replace(/ک/g, "\u0643").replace(/[؟?!.,،؛;:]/g, " ").replace(/\s+/g, " ").trim();
function looseKey(t) {
  let s = normText(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`ʿʾ‘]/g, "");
  s = s.replace(/ؤ/g, "\u0648").replace(/ئ/g, "\u064A").replace(/ء/g, "").replace(/ظ/g, "\u0636").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/dh\b/g, "d").replace(/(.)\1+/g, "$1");
  return s;
}

// src/data/municipalityModel.js
var MUNICIPALITY_DIRECT = { ar: "\u0645\u0628\u0627\u0634\u0631 \u0639\u0644\u0649 \u0627\u0644\u0623\u0645\u0627\u0646\u0629", en: "Issued directly by the Amanah" };
var MUNICIPALITY_UNRESOLVED = { ar: "\u062A\u062D\u062A\u0627\u062C \u0645\u0631\u0627\u062C\u0639\u0629 (\u063A\u064A\u0631 \u0645\u0637\u0627\u0628\u0642\u0629 \u0623\u0648 \u0645\u062A\u0639\u0627\u0631\u0636\u0629)", en: "Needs review (unmatched or conflicting)" };
var MUNICIPALITY_OPTION_NONE = { ar: "\u0628\u0644\u0627 \u0628\u0644\u062F\u064A\u0629 (\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631)", en: "No municipality (not specified in source)" };
var STATUS_LABEL = {
  mapped: { ar: "\u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0645\u0631\u062C\u0639", en: "Matched to the reference" },
  not_specified: MUNICIPALITY_NOT_SPECIFIED,
  direct_amanah: MUNICIPALITY_DIRECT,
  unmapped_source_value: { ar: "\u0627\u0633\u0645 \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0645\u0631\u062C\u0639", en: "The source municipality is not in the reference" },
  conflict: { ar: "\u062A\u0639\u0627\u0631\u0636 \u0628\u064A\u0646 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0641\u064A \u0627\u0644\u0628\u0644\u062F\u064A\u0629", en: "Sources disagree on the municipality" }
};
var MCODE = { NOT_SPECIFIED: 0, DIRECT: 1, UNMAPPED: 2, CONFLICT: 3, FIRST_MAPPED: 4 };
var MUNI_SLOTS = MCODE.FIRST_MAPPED + MAX_MUNICIPALITIES;
var isAmanah = (ent) => ent != null && ent >= 0 && ent < N_AMANAH;
function slotOf(ent, code) {
  const st = statusOfCode(ent, code);
  return st === "mapped" ? code : st === "direct_amanah" ? MCODE.DIRECT : st === "not_specified" ? MCODE.NOT_SPECIFIED : MCODE.UNMAPPED;
}
function statusOfCode(ent, code) {
  if (code === MCODE.DIRECT) return "direct_amanah";
  if (code === MCODE.UNMAPPED) return "unmapped_source_value";
  if (code === MCODE.CONFLICT) return "conflict";
  if (code >= MCODE.FIRST_MAPPED && isAmanah(ent) && code - MCODE.FIRST_MAPPED < municipalityCountOf(ENTITIES[ent].en)) return "mapped";
  return "not_specified";
}
var municipalityOfCode = (ent, code) => statusOfCode(ent, code) === "mapped" ? municipalitiesOf(ENTITIES[ent].en)[code - MCODE.FIRST_MAPPED] : null;
function codeOfRef(ent, refId) {
  if (!isAmanah(ent)) return null;
  const i = municipalitiesOf(ENTITIES[ent].en).findIndex((m) => m.refId === refId);
  return i < 0 ? null : MCODE.FIRST_MAPPED + i;
}
var TOKEN_OF_STATUS = { not_specified: "NOT_SPECIFIED", direct_amanah: "DIRECT", unmapped_source_value: "UNRESOLVED", conflict: "UNRESOLVED" };
function muniKeyOfCode(ent, code) {
  if (!isAmanah(ent) && ent !== ENTITY_INDEX["Housing Sector"]) return null;
  const st = statusOfCode(ent, code);
  const a = ENTITIES[ent].en;
  if (st === "mapped") return municipalityOfCode(ent, code).key;
  return `${a}|${TOKEN_OF_STATUS[st]}`;
}
function parseMuniKey(key) {
  const s = String(key ?? "all");
  if (s === "all" || s === "") return null;
  const i = s.lastIndexOf("|");
  if (i < 0) return { invalid: true };
  const amanahEn = s.slice(0, i);
  const token = s.slice(i + 1);
  const ent = ENTITY_INDEX[amanahEn];
  if (ent == null) return { invalid: true };
  if (token === "NOT_SPECIFIED") return { amanahEn, ent, kind: "not_specified", codes: [MCODE.NOT_SPECIFIED] };
  if (token === "DIRECT") return { amanahEn, ent, kind: "direct_amanah", codes: [MCODE.DIRECT] };
  if (token === "UNRESOLVED") return { amanahEn, ent, kind: "unresolved", codes: [MCODE.UNMAPPED, MCODE.CONFLICT] };
  const m = municipalityByKey(s);
  if (!m || m.amanahKey !== amanahEn) return { invalid: true };
  return { amanahEn, ent, kind: "mapped", refId: m.refId, codes: [codeOfRef(ent, m.refId)] };
}
var DEMO_SHARE = { direct_amanah: 28, not_specified: 12 };
var mix2 = (n) => {
  let h = Math.imul(Math.abs(n) % 2147483629 | 0, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
};
function demoMunicipalityCode(ent, seed, sourceKey) {
  if (!isAmanah(ent)) return MCODE.DIRECT;
  if (sourceKey === "white_lands") return MCODE.NOT_SPECIFIED;
  const n = municipalityCountOf(ENTITIES[ent].en);
  const h = mix2(seed * 31 + ent);
  const r = h % 100;
  if (r < DEMO_SHARE.direct_amanah) return MCODE.DIRECT;
  if (r < DEMO_SHARE.direct_amanah + DEMO_SHARE.not_specified || n === 0) return MCODE.NOT_SPECIFIED;
  return MCODE.FIRST_MAPPED + mix2(seed * 17 + ent * 7 + 3) % n;
}
var normName = (s) => looseKey(String(s ?? "").replace(/[()]/g, " "));
function classifySourceValues(ent, values) {
  const given = [].concat(values ?? []).map((v) => v == null ? "" : String(v).trim()).filter(Boolean);
  if (!isAmanah(ent)) return { status: given.length ? "unmapped_source_value" : "direct_amanah", code: given.length ? MCODE.UNMAPPED : MCODE.DIRECT, refId: null, values: given };
  if (!given.length) return { status: "not_specified", code: MCODE.NOT_SPECIFIED, refId: null, values: given };
  const a = ENTITIES[ent];
  const self = amanahSelfOf(a.en);
  const outcomes = given.map((v) => {
    const k = normName(v);
    if (k === normName(a.ar) || k === normName(a.en) || self && (k === normName(self.sourceNameAr) || k === normName(self.nameAr))) return { s: "direct_amanah" };
    const m = findMunicipality(a.en, v, normName);
    return m ? { s: "mapped", refId: m.refId } : { s: "unmapped_source_value" };
  });
  const distinct = new Set(outcomes.map((o2) => `${o2.s}|${o2.refId || ""}`));
  if (distinct.size > 1) return { status: "conflict", code: MCODE.CONFLICT, refId: null, values: given };
  const o = outcomes[0];
  if (o.s === "mapped") return { status: "mapped", code: codeOfRef(ent, o.refId), refId: o.refId, values: given };
  if (o.s === "direct_amanah") return { status: "direct_amanah", code: MCODE.DIRECT, refId: null, values: given };
  return { status: "unmapped_source_value", code: MCODE.UNMAPPED, refId: null, values: given };
}
var SOURCE_MUNICIPALITY_FIELDS = {
  investment: { system: "Foras (Furas contracts, Databank)", amanahFields: ["MUNICIPALITYID", "MUNICIPALITY"], municipalityFields: ["SUBMUNICIPALITYID", "SUBMUNICIPALITY"], note: { ar: "\u0641\u064A \u0639\u0642\u0648\u062F \u0641\u0631\u0635 \u064A\u062D\u0645\u0644 MUNICIPALITYID \u062C\u0647\u0629 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0623\u0645\u0627\u0646\u0629\u061B \u0648\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0623\u062F\u0646\u0649 \u0641\u064A SUBMUNICIPALITY (\u0644\u0645 \u064A\u064F\u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0639\u0628\u0626\u062A\u0647\u0627).", en: "In the Furas contracts MUNICIPALITYID holds an Amanah-level entity; the municipality below it would be SUBMUNICIPALITY (population not verified)." } },
  fines: { system: "Mumathil (compliance family)", amanahFields: ["AmanaNo", "ArabicAmanaName"], municipalityFields: ["MunicipalityId", "ArabicMainBaladya", "SUBMUNICIPALITYID", "ArabicBranchBaladya"], note: { ar: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0626\u064A\u0633\u064A\u0629 \u0648\u0628\u0644\u062F\u064A\u0629 \u0641\u0631\u0639\u064A\u0629.", en: "A main municipality and a branch municipality." } },
  municipal_fees: { system: "Baladi (Finance / Tahseel, ENT_REVENUES)", amanahFields: ["AMANA_NO", "ARABIC_AMANA_NAME"], municipalityFields: ["BALADYA_KEY", "BALADYA_NO", "MAIN_BALADYA_NO", "ARABIC_BALADYA_NAME", "ARABIC_MAIN_BALADYA_NAME"], note: { ar: "BALADYA_KEY \u0641\u064A ENT_REVENUES\u061B \u064A\u062A\u0639\u0644\u0642 \u0628\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0623\u0648 \u0627\u0644\u0641\u0631\u0639\u064A\u0629 \u0628\u062D\u0633\u0628 \u0627\u0644\u0645\u0635\u062F\u0631.", en: "BALADYA_KEY on ENT_REVENUES; main or branch municipality depending on the source." } },
  licenses: { system: "Amanah internal reports (Licences)", amanahFields: ["AMANAID", "AMANANAME", "AMANA_CODE"], municipalityFields: ["BALADIAID", "BALADIANAME", "BALADYA_TYPE", "MUNICIPALITY_ID"], note: { ar: "BALADYA_TYPE \u064A\u0645\u064A\u0632 \u0646\u0648\u0639 \u0627\u0644\u0628\u0644\u062F\u064A\u0629.", en: "BALADYA_TYPE tells the kind of municipality." } },
  accommodation: { system: "Baladi (Tobacco & accommodation)", amanahFields: ["AMANA_CODE", "AMANA_NO", "AMANA_GUID", "ARABIC_AMANA_NAME"], municipalityFields: ["BALADYA_CODE", "BALADYA_NO", "BALADYA_GUID", "ARABIC_BALADYA_NAME", "ARABIC_MUNICIPALITY_NAME", "BRANCH_BALADYA_ID"], note: { ar: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0626\u064A\u0633\u064A\u0629 \u0648\u0641\u0631\u0639\u064A\u0629 (BRANCH_BALADYA_*).", en: "Main and branch municipality (BRANCH_BALADYA_*)." } },
  tobacco: { system: "Baladi (Tobacco & accommodation)", amanahFields: ["AMANA_CODE", "AMANA_NO", "AMANA_GUID", "ARABIC_AMANA_NAME"], municipalityFields: ["BALADYA_CODE", "BALADYA_NO", "BALADYA_GUID", "ARABIC_BALADYA_NAME", "ARABIC_MUNICIPALITY_NAME", "BRANCH_BALADYA_ID"], note: { ar: "\u0628\u0644\u062F\u064A\u0629 \u0631\u0626\u064A\u0633\u064A\u0629 \u0648\u0641\u0631\u0639\u064A\u0629 (BRANCH_BALADYA_*).", en: "Main and branch municipality (BRANCH_BALADYA_*)." } },
  white_lands: { system: "Baladi (white lands DS-037 / DS-038)", amanahFields: [], municipalityFields: [], verified: false, note: { ar: "\u062C\u062F\u0627\u0648\u0644 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621 \u062A\u062D\u0645\u0644 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0648\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0641\u0642\u0637 (CityName, RegionName) \u0648\u0644\u0627 \u062D\u0642\u0644 \u0628\u0644\u062F\u064A\u0629: \u062A\u0628\u0642\u0649 \xAB\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631\xBB.", en: "The white-land datasets carry a city and a region only (CityName, RegionName), no municipality field: the municipality stays not specified." } },
  housing_sales: { system: "Baladi (housing sales)", amanahFields: [], municipalityFields: [], verified: false, note: { ar: "\u063A\u064A\u0631 \u0645\u063A\u0637\u0649 \u0628\u0642\u0648\u0627\u0645\u064A\u0633 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0641\u062D\u0648\u0635\u0629\u061B \u062A\u0635\u062F\u0631 \u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646 \u0645\u0628\u0627\u0634\u0631\u0629.", en: "Not covered by the inspected dictionaries; the Housing Sector issues directly." } }
};
function municipalityFields({ ent, code, sourceKey, sourceValue = null, synthetic = true }) {
  const status = statusOfCode(ent, code);
  const a = ENTITIES[ent];
  const m = status === "mapped" ? municipalityOfCode(ent, code) : null;
  const map = SOURCE_MUNICIPALITY_FIELDS[sourceKey] || null;
  const fieldList = map && map.municipalityFields.length ? map.municipalityFields.slice(0, 2).join(" / ") : null;
  const self = isAmanah(ent) ? amanahSelfOf(a.en) : null;
  let value = sourceValue != null && String(sourceValue).trim() !== "" ? String(sourceValue).trim() : null;
  if (value == null && synthetic) value = status === "mapped" ? m.sourceNameAr : status === "direct_amanah" ? self ? self.sourceNameAr : a.ar : null;
  const note = status === "not_specified" ? MUNICIPALITY_NOT_SPECIFIED : STATUS_LABEL[status];
  return {
    municipalityRefId: m ? m.refId : null,
    // INTERNAL reference id — not an official code
    municipalityKey: muniKeyOfCode(ent, code),
    municipalityAr: m ? m.ar : null,
    municipalityEn: m ? m.en : null,
    municipalityStatus: status,
    municipalityNote: note,
    municipalityFlags: m ? m.flags : [],
    municipalitySource: { value, system: map ? map.system : null, field: fieldList, simulated: !!synthetic, mapping: map ? map.note : null },
    municipalitySourceValue: value,
    municipalitySourceSystem: map ? map.system : null
  };
}

// src/data/sanadSource.js
var S = (id, text, cls, basis) => ({ id, text, cls, basis });
var SOURCE_STATUSES = [
  S(1, "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642", "unclassified", "unconfirmed"),
  S(2, "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0644\u0628", "unclassified", "unconfirmed"),
  S(3, "\u062A\u062D\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629", "unclassified", "unconfirmed"),
  S(4, "\u0637\u0644\u0628 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0646\u0648\u0627\u0642\u0635", "unclassified", "unconfirmed"),
  S(8, "\u0637\u0644\u0628 \u0645\u062D\u0641\u0648\u0638", "unclassified", "unconfirmed"),
  S(9, "\u0645\u0633\u0648\u062F\u0629 \u0645\u062D\u0630\u0648\u0641\u0629", "unclassified", "unconfirmed"),
  S(11, "\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0628\u0627\u062B\u0628\u0627\u062A \u062A\u0631\u0643 \u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", "unclassified", "unconfirmed"),
  S(13, "\u0645\u063A\u0644\u0642 - \u062A\u0645 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", "closed", "stated"),
  S(17, "\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0623\u0645\u0631 \u062A\u0646\u0641\u064A\u0630", "unclassified", "unconfirmed"),
  S(20, "\u062A\u062D\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0627\u0645\u0631 \u0645\u0646\u0639 \u0645\u0646 \u0627\u0644\u0633\u0641\u0631", "unclassified", "unconfirmed"),
  S(22, "\u062A\u062D\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0627\u0645\u0631 \u0628\u0648\u0642\u0641 \u0627\u0644\u0645\u0647\u0644", "unclassified", "unconfirmed"),
  S(25, "\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0628\u0631\u0641\u0636 \u0637\u0644\u0628 \u0648\u0642\u0641 \u0627\u0644\u0645\u0647\u0644", "unclassified", "unconfirmed"),
  S(27, "\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A", "unclassified", "unconfirmed"),
  S(28, "\u062E\u062F\u0645\u0627\u062A \u0647\u064A\u0626\u0629 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0627\u0644\u064A\u0629", "unclassified", "unconfirmed"),
  S(29, "\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0623\u0645\u0631 \u0625\u064A\u0642\u0627\u0641 \u062E\u062F\u0645\u0627\u062A", "unclassified", "unconfirmed"),
  S(32, "\u062A\u062D\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0627\u0645\u0631 \u062A\u0645\u062F\u064A\u062F \u0645\u0646\u0639 \u0645\u0646 \u0627\u0644\u0633\u0641\u0631", "unclassified", "unconfirmed"),
  S(33, "\u062A\u062D\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0625\u0644\u063A\u0627\u0621 \u0627\u0623\u0644\u0648\u0645\u0631 \u0627\u0644\u0635\u0627\u062F\u0631\u0629", "unclassified", "unconfirmed"),
  S(36, "\u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0628\u0631\u0641\u0636 \u0637\u0644\u0628 \u0641\u0631\u0636 \u0627\u0644\u063A\u0631\u0627\u0645\u0629", "unclassified", "unconfirmed"),
  S(38, "\u0637\u0644\u0628 \u0645\u0642\u0628\u0648\u0644", "unclassified", "unconfirmed"),
  S(39, "\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644", "unclassified", "unconfirmed"),
  S(40, "\u0645\u063A\u0644\u0642 - \u0644\u0639\u062F\u0645 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0646\u0648\u0627\u0642\u0635 \u062E\u0644\u0627\u0644 \u0627\u0644\u0645\u0647\u0644\u0629", "closed", "stated"),
  S(41, "\u0645\u063A\u0644\u0642 - \u062D\u0643\u0645 \u0628\u0639\u062F\u0645 \u0627\u0644\u0627\u062E\u062A\u0635\u0627\u0635", "closed", "stated"),
  S(42, "\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u062D\u0643\u0645 \u0628\u0639\u062F\u0645 \u0627\u0644\u0642\u0628\u0648\u0644 \u0627\u0644\u0643\u0644\u064A", "unclassified", "unconfirmed"),
  S(43, "\u062A\u062D\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u062F\u0649 \u0627\u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u062D\u0643\u0645 \u0628\u0639\u062F\u0645 \u0627\u0644\u0642\u0628\u0648\u0644 \u0627\u0644\u062C\u0632\u0626\u064A", "unclassified", "unconfirmed"),
  S(44, "\u0645\u063A\u0644\u0642 \u2013 \u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", "closed", "stated"),
  S(45, "\u0645\u063A\u0644\u0642 - \u0644\u0639\u062F\u0645 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0646\u0648\u0627\u0642\u0635", "closed", "stated"),
  S(48, "\u0645\u063A\u0644\u0642 \u2013 \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0627\u0625\u0644\u064A\u0642\u0627\u0641 \u0627\u0644\u062F\u0627\u0626\u0645", "closed", "stated"),
  S(49, "\u0645\u063A\u0644\u0642 \u2013 \u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0623\u0645\u0631 \u0627\u0625\u0644\u064A\u0642\u0627\u0641 \u0645\u0624\u0642\u062A\u0627", "closed", "stated"),
  S(51, "\u0645\u063A\u0644\u0642 \u2013 \u062A\u0645 \u062A\u0631\u0643 \u0627\u0644\u0637\u0644\u0628", "closed", "stated"),
  S(52, "\u0645\u063A\u0644\u0642 \u2013 \u062A\u0645 \u062A\u0631\u0643 \u0627\u0644\u0637\u0644\u0628 \u062C\u0632\u0626\u064A\u0627", "closed", "stated"),
  S(53, "\u0645\u063A\u0644\u0642 - \u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u062D\u0648\u064A\u0644 \u0627\u0623\u0644\u0645\u0648\u0627\u0644", "closed", "stated"),
  S(54, "\u0633\u062A\u0643\u0645\u0627\u0644 \u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062A\u0646\u0641\u064A\u0630", "unclassified", "unconfirmed"),
  S(55, "\u0645\u063A\u0644\u0642 - \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", "closed", "stated")
];
var exactNotation = (digits) => `${digits[0]}.${digits.slice(1)}E+${digits.length - 1}`;
var hash2 = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
var toSciNotation = (digits) => Number(digits).toExponential(2 + hash2(digits) % 3).replace("e+", "E+");

// server/world.js
var SEED = 20261008;
var GEN_START = "2024-10-01";
function mix(a, b = 0, c = 0, d = 0) {
  let h = 2654435769 ^ SEED | 0;
  h = Math.imul(h ^ (a | 0), 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 3266489909);
  h ^= h >>> 16;
  h = Math.imul(h ^ (c | 0), 668265263);
  h ^= h >>> 15;
  h = Math.imul(h ^ (d | 0), 374761393);
  h ^= h >>> 13;
  return h >>> 0;
}
var Rng = class {
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  reset(seed) {
    this.s = seed >>> 0;
    return this;
  }
  next() {
    let t = (this.s += 1831565813) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  gauss() {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  lognormal(sigma) {
    return Math.exp(sigma * this.gauss() - sigma * sigma / 2);
  }
  expo(mean) {
    return -Math.log(1 - this.next()) * mean;
  }
  int(n) {
    return Math.floor(this.next() * n);
  }
};
var clamp = (x, a, b) => Math.min(b, Math.max(a, x));
var pad = (n, w) => String(n).padStart(w, "0");
var COLS = {
  idKey: Float64Array,
  issue: Int32Array,
  due: Int32Array,
  gross: Float64Array,
  adjAmt: Float64Array,
  adjDay: Int32Array,
  ent: Uint8Array,
  muni: Uint8Array,
  mref: Uint16Array,
  scope: Uint8Array,
  src: Uint8Array,
  item: Uint8Array,
  lines: Uint8Array,
  payStart: Int32Array,
  payCount: Uint8Array,
  cancelDay: Int32Array,
  exMask: Uint16Array,
  exAppr: Uint16Array,
  exRev: Uint8Array,
  flags: Uint16Array,
  contract: Int32Array,
  inst: Uint16Array,
  cstat: Uint8Array,
  crSt: Uint8Array,
  exec: Int16Array,
  efaa: Uint8Array,
  payer: Uint16Array,
  owner: Uint16Array,
  gfs: Uint8Array,
  objSt: Uint8Array
  // objSt: Mumtathil appeal status of an invoice with an objection (1…5 = OBJECTION_STATUSES, 0 none)
};
var PCOLS = { pInv: Int32Array, pDay: Int32Array, pAmt: Float64Array, pCh: Uint8Array };
var Store = class {
  constructor(cap = 1 << 16) {
    this.n = 0;
    this.cap = cap;
    this.pn = 0;
    this.pcap = cap;
    for (const [k, T4] of Object.entries(COLS)) this[k] = new T4(cap);
    for (const [k, T4] of Object.entries(PCOLS)) this[k] = new T4(cap);
    this.nGen = 0;
    this.fixtures = /* @__PURE__ */ new Map();
    this.fixtureById = /* @__PURE__ */ new Map();
    this.contracts = [];
    this.requests = [];
    this.crView = /* @__PURE__ */ new Map();
    this.meta = {};
    this.dupOf = /* @__PURE__ */ new Map();
  }
  grow() {
    const nc = this.cap * 2;
    for (const [k, T4] of Object.entries(COLS)) {
      const a = new T4(nc);
      a.set(this[k]);
      this[k] = a;
    }
    this.cap = nc;
  }
  growPay() {
    const nc = this.pcap * 2;
    for (const [k, T4] of Object.entries(PCOLS)) {
      const a = new T4(nc);
      a.set(this[k]);
      this[k] = a;
    }
    this.pcap = nc;
  }
  addInvoice() {
    if (this.n >= this.cap) this.grow();
    return this.n++;
  }
  addPayment(inv2, day, amt, ch) {
    if (this.pn >= this.pcap) this.growPay();
    const p = this.pn++;
    this.pInv[p] = inv2;
    this.pDay[p] = day;
    this.pAmt[p] = amt;
    this.pCh[p] = ch;
    return p;
  }
  // make room for fixtures / uploaded rows after generation (no doubling copy later)
  reserve(extra, extraPay = extra * 3) {
    const nc = this.n + extra;
    for (const [k, T4] of Object.entries(COLS)) {
      const a = new T4(nc);
      a.set(this[k].subarray(0, this.n));
      this[k] = a;
    }
    this.cap = nc;
    const pc = this.pn + extraPay;
    for (const [k, T4] of Object.entries(PCOLS)) {
      const a = new T4(pc);
      a.set(this[k].subarray(0, this.pn));
      this[k] = a;
    }
    this.pcap = pc;
  }
  trim() {
    for (const k of Object.keys(COLS)) this[k] = this[k].slice(0, this.n);
    for (const k of Object.keys(PCOLS)) this[k] = this[k].slice(0, this.pn);
    this.cap = this.n;
    this.pcap = this.pn;
  }
};
var W = {
  //          Riy   Jed   Eas   Mak   Mad   Asr   Tai  Qas  Ahs  Jaz  Tab  Hai  NBd  Naj  Haf  Bah  Jwf
  investment: [164, 136, 177, 17, 118, 91, 15, 28, 11, 25, 20, 8, 11, 9, 6, 6, 8],
  fines: [117, 325, 36, 51, 34, 48, 32, 10, 9, 11, 13, 8, 2, 4, 3, 3, 3],
  accommodation: [26, 12, 8, 50, 31, 1, 1, 1, 1, 1, 3, 0.5, 0.1, 0.3, 0.2, 0.1, 0.2],
  tobacco: [11.6, 5.3, 3.9, 0.5, 0.8, 0.7, 1, 0.2, 0.7, 0.6, 0.6, 0.2, 0.15, 0.3, 0.1, 0.1, 0.2],
  fees: [106, 47, 39, 20, 19, 15, 10, 15, 11, 8, 5, 6, 3, 4, 4, 3, 5],
  other: [425, 525, 264, 139, 203, 156, 59, 54, 33, 46, 42, 23, 16, 18, 13, 12, 16]
};
var RATIO = [0.67, 0.43, 0.43, 0.79, 0.73, 0.3, 0.62, 0.74, 0.74, 0.56, 0.54, 0.72, 0.54, 0.64, 0.65, 0.57, 0.67];
var collectFactor = (e) => e >= N_AMANAH ? 0.9 : clamp(RATIO[e] / 0.56, 0.55, 1.25);
var BASE_MONTHLY = {
  fines: [710, 450, 570, 520, 480, 500, 540, 560, 530, 560, 540, 600],
  fees: [306, 200, 250, 260, 240, 250, 270, 280, 260, 270, 260, 300],
  accommodation: [136, 118, 114, 125, 130, 140, 150, 150, 135, 120, 118, 125],
  tobacco: [27, 21, 20, 23, 22, 24, 25, 25, 23, 22, 21, 24],
  other: [15, 40, 130, 60, 50, 80, 60, 50, 70, 60, 50, 200],
  housing: [2184, 237, 55, 120, 160, 140, 150, 170, 160, 150, 140, 200],
  // WHITE-LAND fees of the Housing sector (annual billing wave in January, report: 2,184 -> 2,418 -> 2,470 cumulative)
  housingSales: [0.3, 2.5, 3.8, 4, 4.2, 4, 4.5, 4.5, 4.2, 4, 4, 5]
  // residential sales (report: 0.3 -> 2.8 -> 6.6 cumulative)
};
var YEAR_FACTOR = { 2024: 0.74, 2025: 0.86, 2026: 1, 2027: 1.08, 2028: 1.15 };
var yearFactor = (y) => YEAR_FACTOR[y] ?? Math.pow(1.07, y - 2026);
var HOUSING_FACTOR = { 2024: 0.4, 2025: 0.55, 2026: 1 };
var housingFactor = (y) => HOUSING_FACTOR[y] ?? Math.pow(1.05, y - 2026);
var SRC = {
  fines: { avg: 14e3, sigma: 1.15, pay: 0.58, lag: 55, due: 30, src: "fines", vat: 0 },
  fees: { avg: 11e3, sigma: 1.1, pay: 0.82, lag: 4, due: 15, src: "municipal_fees", vat: 0.15 },
  accommodation: { avg: 24e3, sigma: 1, pay: 0.99, lag: 1, due: 4, src: "accommodation", vat: 0.15 },
  // disclosure platform: invoices are settled within days (reports: 96-97% collected)
  tobacco: { avg: 7500, sigma: 0.95, pay: 0.9, lag: 4, due: 10, src: "tobacco", vat: 0.15 },
  // reports: 78-82% collected
  other: { avg: 26e3, sigma: 1.1, pay: 1, lag: 1, due: 5, src: "municipal_fees", vat: 0.15 },
  white_lands: { avg: PARAMS.white_lands.avgDeedFee, sigma: 1.2, pay: PARAMS.white_lands.payProbability, lag: 90, due: PARAMS.white_lands.dueDays, src: "white_lands", vat: 0 },
  housing_sales: { avg: 88e4, sigma: 0.9, pay: 0.5, lag: 110, due: 30, src: "housing_sales", vat: 0.15 }
};
var INTERNAL_SHARE = 0.3;
var CONTRACT_COUNT = 640;
var CONTRACT_MIX = [{ months: 1, w: 0.7 }, { months: 3, w: 0.18 }, { months: 6, w: 0.06 }, { months: 12, w: 0.06 }];
var CONTRACT_ANNUAL_AVG = 105e5;
var PAYER_POOL = 6e3;
var HOUSING_PAYER_BASE = 1e4;
var WL_PAYER_BASE = 3e4;
var EXCEPTIONAL = [
  ["2025-02-24", 0, 28e7, "2025-04-29"],
  ["2025-05-19", 2, 38e7, "2025-06-24"],
  ["2025-10-08", 4, 3e8, "2025-11-12"],
  ["2026-02-17", 0, 41e7, "2026-04-27"],
  ["2026-05-13", 1, 45e7, "2026-06-11"],
  ["2026-09-15", 2, 52e7, "2026-10-20"],
  ["2027-03-10", 0, 48e7, "2027-04-14"]
];
function pickIdx(rng, weights) {
  const t = weights.reduce((s, x2) => s + x2, 0);
  let x = rng.next() * t;
  for (let i = 0; i < weights.length; i += 1) {
    x -= weights[i];
    if (x <= 0) return i;
  }
  return weights.length - 1;
}
var plan = [];
function planPayment(r, dueDay, amount, pay, lagMean) {
  plan.length = 0;
  if (r.next() > pay) return plan;
  let lag = r.next() < 0.3 ? -Math.floor(r.next() * 5) : Math.round(r.expo(lagMean));
  lag = Math.min(lag, 240);
  const day = dueDay + lag;
  if (r.next() < 0.09) {
    const first = Math.round(amount * (0.35 + r.next() * 0.35));
    plan.push({ day, amt: first, ch: 0 });
    if (r.next() < 0.6) plan.push({ day: day + 10 + r.int(60), amt: amount - first, ch: 0 });
    return plan;
  }
  plan.push({ day, amt: amount, ch: r.next() < 0.08 ? 3 : 0 });
  return plan;
}
function planWhiteLand(r, issueN, dueN, amount) {
  plan.length = 0;
  const A = PARAMS.white_lands;
  if (r.next() > A.payProbability) return plan;
  let day;
  if (r.next() < A.earlyPayShare) day = issueN + 3 + r.int(22);
  else {
    const lag = r.next() < 0.6 ? r.int(30) - 5 : 30 + Math.round(r.expo(70));
    day = dueN + Math.min(lag, 300);
  }
  if (r.next() < 0.08) {
    const first = Math.round(amount * (0.3 + r.next() * 0.4));
    plan.push({ day, amt: first, ch: 0 });
    if (r.next() < 0.5) plan.push({ day: day + 15 + r.int(80), amt: amount - first, ch: 0 });
    return plan;
  }
  plan.push({ day, amt: amount, ch: r.next() < 0.05 ? 3 : 0 });
  return plan;
}
var worldCache = /* @__PURE__ */ new Map();
function generateWorld(today, { scale = 1 } = {}) {
  const legacyGroup = /* @__PURE__ */ new Set();
  let legacyHit = false;
  const key = `${today}|${scale}`;
  if (worldCache.has(key)) return worldCache.get(key);
  const t0 = Date.now();
  const todayN = dayNum(today);
  const startN = dayNum(GEN_START);
  const st = new Store(Math.max(1024, Math.round(19e5 * scale)));
  const serialByYear = /* @__PURE__ */ new Map();
  const rI = new Rng();
  const rC = new Rng();
  const fixedAvg = (a) => a / scale;
  const COMPACT_BOOST = { white_lands: 14, housing_sales: 30, tobacco: 4, accommodation: 3 };
  const avgFor = (a, key2) => a / (scale < 1 ? Math.min(1, scale * (COMPACT_BOOST[key2] || 1)) : scale);
  const nextSerial = (y) => {
    const n = (serialByYear.get(y) || 0) + 1;
    serialByYear.set(y, n);
    return n;
  };
  const monthsList = [];
  {
    const f = GEN_START.slice(0, 7);
    const l = today.slice(0, 7);
    let y = Number(f.slice(0, 4));
    let m = Number(f.slice(5, 7));
    while (`${y}-${pad(m, 2)}` <= l) {
      monthsList.push([y, m]);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function writeInvoice(o) {
    const i = st.addInvoice();
    st.idKey[i] = o.idKey;
    st.issue[i] = o.issue;
    st.due[i] = o.due;
    st.gross[i] = o.gross;
    st.adjAmt[i] = 0;
    st.adjDay[i] = 0;
    st.ent[i] = o.ent;
    st.muni[i] = o.muni;
    st.scope[i] = o.scope;
    st.mref[i] = o.mref != null ? o.mref : demoMunicipalityCode(o.ent, (o.contract ?? -1) >= 0 ? 1073741824 + o.contract : o.idKey, SOURCES[o.src].key);
    st.src[i] = o.src;
    st.item[i] = o.item;
    st.lines[i] = o.lines;
    st.payStart[i] = st.pn;
    let pc = 0;
    for (const p of o.pay) {
      if (p.day <= todayN) {
        st.addPayment(i, p.day, p.amt, p.ch);
        pc += 1;
      }
    }
    st.payCount[i] = pc;
    st.cancelDay[i] = o.cancelDay && o.cancelDay <= todayN ? o.cancelDay : 0;
    let exMask = o.exMask || 0;
    let exAppr = o.exAppr || 0;
    if (exMask && !(exMask & exMask - 1)) {
      const h = Math.imul(o.idKey % 2147483629 | 0, 2654435761) >>> 0;
      if (h % 100 < 7) {
        const pool = [2, 8, 16, 32, 64].filter((b) => b !== exMask);
        const extra = pool[(h >>> 8) % pool.length];
        exMask |= extra;
        if (exAppr & o.exMask) exAppr |= extra;
      }
    }
    st.exMask[i] = exMask;
    st.exAppr[i] = exAppr;
    st.exRev[i] = o.exRev || 0;
    st.flags[i] = o.flags || 0;
    st.contract[i] = o.contract ?? -1;
    st.inst[i] = o.inst || 0;
    st.cstat[i] = o.cstat || 0;
    st.crSt[i] = o.crSt || 0;
    st.exec[i] = -1;
    st.efaa[i] = o.efaa || 0;
    st.payer[i] = o.payer;
    st.owner[i] = 0;
    st.gfs[i] = gfsIndexOf(gfsCodeOf(ITEMS[o.item].key, Math.imul(o.idKey % 2147483629 | 0, 2246822507) >>> 0));
    return i;
  }
  function pickExclusions(r, src, ent, issueN, forever) {
    let mask = 0;
    let appr = 0;
    let efaa = 0;
    let flags = 0;
    let rev = 20 + r.int(50);
    const approve = (bit, certain) => {
      mask |= bit;
      if (certain || r.next() < 0.55) {
        if (issueN + rev <= todayN) appr |= bit;
      }
    };
    if (!forever) return { mask, appr, efaa, flags, rev, noContract: false };
    if (src === "fines") {
      const roll = r.next();
      if (roll < 0.06) {
        approve(RULE_BIT["OBJ-1"]);
        flags |= F.OBJECTION;
        efaa = 3;
      } else if (roll < 0.26) {
        approve(RULE_BIT["INC-1"]);
        flags |= F.MISSING_ID;
        efaa = 4;
      } else if (roll < 0.34) {
        mask |= RULE_BIT["EXE-1"];
        efaa = 5;
      } else if (roll < 0.56) {
        approve(RULE_BIT["EFA-1"]);
        efaa = 0;
      }
    } else if (src === "investment") {
      const p = ent === 1 || ent === 5 ? 0.3 : 0.04;
      if (r.next() < p) {
        approve(RULE_BIT["NOC-1"]);
        return { mask, appr, efaa, flags, rev, noContract: true };
      }
    } else if (src !== "housing_sales" && r.next() < 0.08) approve(RULE_BIT["INC-1"]);
    return { mask, appr, efaa, flags, rev, noContract: false };
  }
  const SRC_KEYS = ["fines", "fees", "accommodation", "tobacco", "other"];
  const SRC_ID = { fines: 1, fees: 2, accommodation: 3, tobacco: 4, other: 5 };
  const feesItems = ["inspection_fees", "waste_collection", "excavation_permits", "ad_boards"].map((k) => ITEM_INDEX[k]);
  const licItems = ["commercial_license", "commercial_license", "signboard_license", "building_permit", "health_certificate", "ad_boards_amanah"].map((k) => ITEM_INDEX[k]);
  const finesItems = ["building_violations", "signage_violations", "health_violations"].map((k) => ITEM_INDEX[k]);
  const linesFor = (r) => {
    const x = r.next();
    return x < 0.77 ? 1 : x < 0.89 ? 2 : x < 0.95 ? 3 : 4 + r.int(3);
  };
  const contractNoOf = (c, startY) => c < 2 ? "CT-" + startY + "-" + pad(c * 7 + 13, 4) : ["CT-" + startY + "-" + pad(c * 7 + 13, 4), "CN-" + (10007 + c * 13), "ECN-" + (30011 + c * 11), "EDROCN-" + (50021 + c * 17)][c % 4];
  const contracts = st.contracts;
  const horizonN = todayN + 370;
  const nContracts = Math.max(8, Math.round(CONTRACT_COUNT * scale));
  const instByMonth = /* @__PURE__ */ new Map();
  for (let c = 0; c < nContracts; c += 1) {
    const r = rC.reset(mix(101, c));
    const ent = pickIdx(r, W.investment);
    const startY = 2020 + Math.floor(r.next() * 6.9);
    const startMonth = 1 + r.int(12);
    const startDay = 1 + r.int(27);
    const start = dayNum(`${startY}-${pad(startMonth, 2)}-${pad(startDay, 2)}`);
    const term = 4 + r.int(9);
    let mixRoll = r.next() * CONTRACT_MIX.reduce((s, x) => s + x.w, 0);
    let mixMonths = 1;
    for (const m2 of CONTRACT_MIX) {
      mixRoll -= m2.w;
      if (mixRoll <= 0) {
        mixMonths = m2.months;
        break;
      }
    }
    const anchor = r.next() < 0.8 ? 1 : 1 + r.int(12);
    const dueDay = 1 + r.int(27);
    const annual = fixedAvg(CONTRACT_ANNUAL_AVG) * (CONTRACT_COUNT * scale / nContracts) * r.lognormal(0.95);
    const payer = r.int(PAYER_POOL);
    const muni = r.int(3);
    const item = ITEM_INDEX[["land_lease", "ad_sites", "commercial_units"][r.int(3)]];
    const crRoll = r.next();
    const crSt = crRoll < 0.9 ? 1 : crRoll < 0.94 ? 2 : crRoll < 0.97 ? 3 : 4;
    const status = r.next() < 0.06 ? "\u0645\u0648\u0642\u0648\u0641" : "\u0633\u0627\u0631\u064A";
    const end = start + Math.round(term * 365);
    const ct = { future: start > todayN, idx: c, contractNo: contractNoOf(c, startY), ent, muni, payer, item, start, end, intervalMonths: mixMonths, anchor, dueDay, annual: Math.round(annual), annualValue: Math.round(annual), crNo: `10${pad(Math.floor(mix(7, c) / 43), 8).slice(-8)}`, crSt, status, dues: [], sched: [], invs: [], totalValue: 0 };
    let y = startY;
    let m = startMonth;
    let no = 0;
    for (let g = 0; g < 600; g += 1) {
      if (((m - anchor) % mixMonths + mixMonths) % mixMonths === 0) {
        const dueN = dayNum(`${y}-${pad(m, 2)}-${pad(dueDay, 2)}`);
        if (dueN - 10 >= start && dueN <= end) {
          const yearsIn = Math.floor((dueN - start) / 365);
          const amount = Math.round(annual * mixMonths / 12 * Math.pow(1.03, yearsIn) / 10) * 10;
          no += 1;
          ct.totalValue += amount;
          let d = { no, due: dueN, amount, inv: -1 };
          if (dueN - 10 >= startN - 10 && dueN <= horizonN) {
            ct.dues.push(d);
            const issueN = dueN - 10;
            if (issueN < startN) d.hist = true;
            if (issueN >= startN && issueN <= todayN + 40) {
              const ym = isoOf(issueN).slice(0, 7);
              if (!instByMonth.has(ym)) instByMonth.set(ym, []);
              instByMonth.get(ym).push([c, ct.dues.length - 1]);
            }
          }
          ct.sched.push(d);
        }
      }
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (dayNum(`${y}-${pad(m, 2)}-01`) > end) break;
    }
    if (ct.sched.length) {
      let rem = ct.totalValue;
      for (const d of ct.sched) {
        rem -= d.amount;
        d.balance = Math.max(0, rem);
      }
    }
    contracts.push(ct);
  }
  const wlEnforce = [];
  const plannedByInv = /* @__PURE__ */ new Map();
  for (const [y, mo] of monthsList) {
    const ym = `${y}-${pad(mo, 2)}`;
    const mi = mo - 1;
    const dim = daysIn(y, mo);
    for (const sk of SRC_KEYS) {
      const cfg = SRC[sk];
      const wl = W[sk];
      const wTotal = wl.reduce((s, x) => s + x, 0);
      for (let e = 0; e < N_AMANAH; e += 1) {
        const r = rC.reset(mix(1, y * 12 + mo, SRC_ID[sk], e));
        const noise = r.lognormal(0.14);
        const G = BASE_MONTHLY[sk][mi] * 1e6 * yearFactor(y) * (wl[e] / wTotal) * noise;
        const avg = avgFor(cfg.avg, sk);
        const single = scale < 1 && G < avg;
        if (!single && G < avg * 0.12) continue;
        let N = Math.floor(G / avg);
        if (r.next() < G / avg - N) N += 1;
        N = Math.max(single ? 0 : 1, N);
        if (N === 0) continue;
        const rS = single ? new Rng(mix(6, y * 12 + mo, SRC_ID[sk], e)) : null;
        const Gc = single ? avg * rS.lognormal(cfg.sigma) : G;
        const monthPay = sk === "accommodation" || sk === "tobacco" ? clamp(1 + 0.03 * r.gauss(), 0.94, 1.04) : collectFactor(e) * clamp(1 + 0.1 * r.gauss(), 0.8, 1.2);
        let sumW = 0;
        const rW = new Rng(mix(2, y * 12 + mo, SRC_ID[sk], e));
        for (let k = 0; k < N; k += 1) sumW += rW.lognormal(cfg.sigma);
        rW.reset(mix(2, y * 12 + mo, SRC_ID[sk], e));
        for (let k = 0; k < N; k += 1) {
          const wgt = rW.lognormal(cfg.sigma);
          const ri = rI.reset(mix(3, y * 12 + mo, SRC_ID[sk] * 32 + e, k));
          const gross = Math.max(100, Math.round(Gc * wgt / sumW / 10) * 10);
          const day = sk === "other" ? Math.min(dim, 24 + ri.int(5)) : 1 + ri.int(dim);
          const issueN = dayNum(`${ym}-${pad(day, 2)}`);
          const serial = nextSerial(y);
          const rr = sk === "tobacco" ? new Rng(mix(12, y * 12 + mo, SRC_ID[sk] * 32 + e, k)) : null;
          const replaced = !!rr && rr.next() < PARAMS.tobacco.replacedShare;
          const replSerial = replaced ? nextSerial(y) : 0;
          if (issueN > todayN) continue;
          const dueN = issueN + cfg.due;
          const internal = sk === "fees" && ri.next() < INTERNAL_SHARE;
          const srcKey = internal ? "licenses" : cfg.src;
          const itemIdx = sk === "fines" ? finesItems[ri.int(3)] : internal ? licItems[ri.int(licItems.length)] : sk === "fees" ? feesItems[ri.int(4)] : sk === "accommodation" ? ITEM_INDEX.hotel_occupancy : sk === "tobacco" ? ITEM_INDEX.tobacco_fee : ITEM_INDEX.misc_revenue;
          const srcFinal = srcKey;
          const payProb = clamp(cfg.pay * (sk === "other" ? 1 : monthPay), 0, 1);
          const lagM = cfg.lag * (sk === "fines" || sk === "housing" ? 1 / Math.max(0.6, monthPay) : 1);
          let pl = planPayment(ri, dueN, gross, payProb, lagM).map((p) => ({ ...p }));
          if (sk === "tobacco" && !replaced && ri.next() < PARAMS.tobacco.walletShare) {
            const w = Math.min(gross, Math.round(gross * (0.3 + 0.7 * ri.next())));
            if (w >= gross - 1) pl = [{ day: issueN, amt: gross, ch: CH_WALLET }];
            else pl = [{ day: issueN, amt: w, ch: CH_WALLET }, ...planPayment(ri, dueN, gross - w, payProb, lagM).map((p) => ({ ...p }))];
          }
          if (replaced) pl = [];
          const forever = pl.length === 0;
          let cancelDay = 0;
          let replIssue = 0;
          if (replaced) {
            replIssue = issueN + 1 + rr.int(6);
            cancelDay = replIssue;
          } else if (forever && ri.next() < 0.2) cancelDay = issueN + 3 + ri.int(55);
          const ex = pickExclusions(ri, sk === "fines" ? "fines" : srcFinal, e, issueN, forever && !replaced);
          let exMask = ex.mask;
          let exAppr = ex.appr;
          if (cancelDay && !replaced && !exMask && ri.next() < 0.03) {
            exMask |= RULE_BIT["INC-1"];
            if (issueN + 20 <= todayN) exAppr |= RULE_BIT["INC-1"];
          }
          let flags = ex.flags | (ri.next() < 6e-3 ? F.AMT_CONFLICT : 0) | (replaced ? withGrp(GRP.TB_REPLACED) : 0);
          let efaa = 0;
          if (sk === "fines") efaa = ex.efaa || (pl.length ? 1 : 2);
          const legacyMiss = !internal && ri.next() < 0.04;
          const muniIdx = ri.int(3);
          const payerIdx = ri.int(PAYER_POOL);
          writeInvoice({
            idKey: y * 1e8 + serial,
            issue: issueN,
            due: dueN,
            gross,
            ent: e,
            muni: muniIdx,
            scope: internal ? 1 : 0,
            src: SOURCE_INDEX[srcFinal],
            item: itemIdx,
            lines: linesFor(ri),
            pay: pl,
            cancelDay,
            exMask,
            exAppr,
            exRev: ex.rev,
            flags,
            efaa,
            payer: payerIdx
          });
          if (legacyMiss) legacyGroup.add(st.n - 1);
          if (replaced && replIssue <= todayN) {
            const g2 = Math.max(100, Math.round(gross * (0.9 + 0.2 * rr.next()) / 10) * 10);
            const due2 = replIssue + cfg.due;
            const pl2 = planPayment(rr, due2, g2, payProb, lagM).map((p) => ({ ...p }));
            writeInvoice({
              idKey: y * 1e8 + replSerial,
              issue: replIssue,
              due: due2,
              gross: g2,
              ent: e,
              muni: muniIdx,
              scope: 0,
              src: SOURCE_INDEX[srcFinal],
              item: itemIdx,
              lines: 1,
              pay: pl2,
              flags: withGrp(GRP.TB_REPLACEMENT),
              efaa: 0,
              payer: payerIdx
            });
            if (legacyMiss) legacyGroup.add(st.n - 1);
          }
        }
      }
    }
    {
      const A = PARAMS.white_lands;
      const cfg = SRC.white_lands;
      const r = rC.reset(mix(1, y * 12 + mo, 9, ENT_HOUSING));
      const G = BASE_MONTHLY.housing[mi] * 1e6 * housingFactor(y) * r.lognormal(0.1);
      const avgDeed = avgFor(cfg.avg, "white_lands");
      const singleW = scale < 1 && G < avgDeed;
      let ND = Math.max(1, Math.round(G / avgDeed));
      if (singleW) ND = new Rng(mix(7, y * 12 + mo, 9, ENT_HOUSING)).next() < G / avgDeed ? 1 : 0;
      const Gw = singleW ? avgDeed * new Rng(mix(8, y * 12 + mo, 9, ENT_HOUSING)).lognormal(cfg.sigma) : G;
      let sumW = 0;
      const rW = new Rng(mix(2, y * 12 + mo, 9, ENT_HOUSING));
      for (let k = 0; k < ND; k += 1) sumW += rW.lognormal(cfg.sigma);
      rW.reset(mix(2, y * 12 + mo, 9, ENT_HOUSING));
      for (let k = 0; k < ND; k += 1) {
        const deedFee = Gw * rW.lognormal(cfg.sigma) / sumW;
        const rd = new Rng(mix(13, y * 12 + mo, k));
        const roll = rd.next();
        const owners2 = roll < A.ownerSplit[0] ? 1 : roll < A.ownerSplit[0] + A.ownerSplit[1] ? 2 : 3;
        let shares = [];
        let sh = 0;
        for (let j = 0; j < owners2; j += 1) {
          const x = owners2 === 1 ? 1 : 0.6 + rd.next();
          shares.push(x);
          sh += x;
        }
        shares = shares.map((x) => x / sh);
        const day = mi === 0 ? 1 + rd.int(15) : 1 + rd.int(dim);
        const issueN = dayNum(`${ym}-${pad(day, 2)}`);
        const extRoll = rd.next();
        const extDays = A.extensionDays[rd.int(A.extensionDays.length)];
        const ext = extRoll < A.extensionShare * A.extensionApproved ? 1 : extRoll < A.extensionShare * (A.extensionApproved + 0.3) ? 2 : extRoll < A.extensionShare ? 3 : 0;
        const dueN = issueN + cfg.due + (ext === 1 ? extDays : 0);
        const ent = ENT_HOUSING;
        for (let j = 0; j < owners2; j += 1) {
          const serial = nextSerial(y);
          if (issueN > todayN) continue;
          const ri = rI.reset(mix(3, y * 12 + mo, 9 * 32 + ENT_HOUSING, k * 4 + j));
          const gross = Math.max(1e3, Math.round(deedFee * shares[j] / 10) * 10);
          const pl = planWhiteLand(ri, issueN, dueN, gross).map((p) => ({ ...p }));
          const never = pl.length === 0;
          const objection = never && ri.next() < A.objectionShare / 0.72;
          const cancelDay = never && !objection && ri.next() < 0.06 ? issueN + 20 + ri.int(120) : 0;
          const grp = owners2 === 1 ? 0 : j === 0 ? owners2 === 2 ? GRP.WL_HEAD2 : GRP.WL_HEAD3 : j === 1 ? GRP.WL_OWN2 : GRP.WL_OWN3;
          const flags = withGrp(grp) | withExt(ext) | (objection ? F.OBJECTION : 0);
          const i = writeInvoice({
            idKey: y * 1e8 + serial,
            issue: issueN,
            due: dueN,
            gross,
            ent,
            muni: 3,
            scope: 0,
            src: SOURCE_INDEX.white_lands,
            item: ITEM_INDEX.white_land_fee,
            lines: 1,
            pay: pl,
            cancelDay,
            exMask: objection ? RULE_BIT["OBJ-1"] : 0,
            flags,
            payer: WL_PAYER_BASE + ri.int(3e4)
          });
          if (never && !cancelDay && !objection && ri.next() < A.enforcementShare / 0.7) wlEnforce.push({ i, opened: dueN + 200 + ri.int(60) });
        }
      }
    }
    {
      const cfg = SRC.housing_sales;
      const r = rC.reset(mix(1, y * 12 + mo, 10, ENT_HOUSING));
      const G = BASE_MONTHLY.housingSales[mi] * 1e6 * housingFactor(y) * r.lognormal(0.1);
      const avg = avgFor(cfg.avg, "housing_sales");
      const singleH = scale < 1 && G < avg;
      const N = singleH ? new Rng(mix(7, y * 12 + mo, 10, ENT_HOUSING)).next() < G / avg ? 1 : 0 : Math.max(1, Math.round(G / avg));
      const Gh = singleH ? avg * new Rng(mix(8, y * 12 + mo, 10, ENT_HOUSING)).lognormal(cfg.sigma) : G;
      let sumW = 0;
      const rW = new Rng(mix(2, y * 12 + mo, 10, ENT_HOUSING));
      for (let k = 0; k < N; k += 1) sumW += rW.lognormal(cfg.sigma);
      rW.reset(mix(2, y * 12 + mo, 10, ENT_HOUSING));
      for (let k = 0; k < N; k += 1) {
        const wgt = rW.lognormal(cfg.sigma);
        const ri = rI.reset(mix(3, y * 12 + mo, 10 * 32 + ENT_HOUSING, k));
        const gross = Math.max(1e3, Math.round(Gh * wgt / sumW / 10) * 10);
        const day = 1 + ri.int(dim);
        const issueN = dayNum(`${ym}-${pad(day, 2)}`);
        const serial = nextSerial(y);
        if (issueN > todayN) continue;
        const dueN = issueN + cfg.due;
        const pl = planPayment(ri, dueN, gross, cfg.pay, cfg.lag).map((p) => ({ ...p }));
        const cancelDay = pl.length === 0 && ri.next() < 0.15 ? issueN + 5 + ri.int(50) : 0;
        writeInvoice({ idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross, ent: ENT_HOUSING, muni: 0, scope: 0, src: SOURCE_INDEX.housing_sales, item: ri.next() < 0.7 ? ITEM_INDEX.housing_sales : ITEM_INDEX.housing_fees, lines: 1, pay: pl, cancelDay, payer: HOUSING_PAYER_BASE + ri.int(2e4) });
      }
    }
    const list2 = instByMonth.get(ym) || [];
    for (const [c, di] of list2) {
      const ct = contracts[c];
      const d = ct.dues[di];
      const issueN = d.due - 10;
      if (issueN < startN) continue;
      const ri = rI.reset(mix(4, c, d.no, 0));
      const serial = nextSerial(y);
      if (issueN > todayN) continue;
      const payP = clamp(0.62 * collectFactor(ct.ent) * (0.9 + 0.2 * ri.next()), 0, 1);
      const pl = planPayment(ri, d.due, d.amount, payP, 38).map((p) => ({ ...p }));
      const forever = pl.length === 0;
      const ex = pickExclusions(ri, "investment", ct.ent, issueN, forever);
      const unmatched = !ex.noContract && ri.next() < 0.04;
      const linked = !ex.noContract && !unmatched;
      const planFirst = pl.length ? pl[0].day : 0;
      const planSum = pl.reduce((s, p) => s + p.amt, 0);
      const i = writeInvoice({
        idKey: y * 1e8 + serial,
        issue: issueN,
        due: d.due,
        gross: d.amount,
        ent: ct.ent,
        muni: ct.muni,
        scope: 0,
        src: SOURCE_INDEX.investment,
        item: ct.item,
        lines: linesFor(ri) > 2 ? 2 : linesFor(ri),
        pay: pl,
        exMask: ex.mask,
        exAppr: ex.appr,
        exRev: ex.rev,
        flags: F.CONTRACT_INV | (ri.next() < 4e-3 ? F.AMT_CONFLICT : 0),
        contract: linked ? c : -1,
        inst: d.no,
        cstat: ex.noContract ? 3 : unmatched ? 2 : 1,
        payer: ex.noContract && mix(22, c, d.no) % 100 < 22 ? mix(23, c, d.no) % 2 : ct.payer,
        drawKept: legacyHit = ri.next() < 0.04
        /* kept so the deterministic demo world (and its stable ids) does not move */
      });
      if (legacyHit) legacyGroup.add(i);
      if (linked) {
        d.inv = i;
        ct.invs.push(i);
      }
      plannedByInv.set(i, { planSum, planFirst, due: d.due, amount: d.amount });
    }
    EXCEPTIONAL.forEach(([issue, ent, amount, paidOn], k) => {
      if (issue.slice(0, 7) !== ym) return;
      const issueN = dayNum(issue);
      const serial = nextSerial(y);
      if (issueN > todayN) return;
      const ri = rI.reset(mix(5, k));
      const amt = amount * Math.max(scale, 0.05);
      const dueN = issueN + 30;
      const i = writeInvoice({ idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross: Math.round(amt), ent, muni: 1, scope: 0, src: SOURCE_INDEX.investment, item: ITEM_INDEX.land_lease, lines: 2, pay: [{ day: dayNum(paidOn), amt: Math.round(amt), ch: 3 }], flags: F.CONTRACT_INV | F.EXCEPTIONAL, contract: -1, cstat: 1, payer: ri.int(PAYER_POOL) });
    });
  }
  for (let c = 0; c < contracts.length; c += 1) if (contracts[c]?.future) contracts[c] = null;
  {
    const FN = SOURCE_INDEX.fines;
    const MFS = SOURCE_INDEX.municipal_fees;
    const DUPB = RULE_BIT["DUP-1"];
    let made = 0;
    let serial = 99e5;
    const open = (i) => st.payCount[i] === 0 && !st.cancelDay[i] && !st.exMask[i] && (st.src[i] === FN || st.src[i] === MFS) && st.payer[i] >= 2 && st.payer[i] < HOUSING_PAYER_BASE && st.due[i] < todayN;
    const twin = (i, issue, flagged) => {
      const due = issue + (st.due[i] - st.issue[i]);
      serial += 1;
      const j = writeInvoice({ idKey: 2026 * 1e8 + serial, issue, due, gross: st.gross[i], ent: st.ent[i], muni: st.muni[i], scope: st.scope[i], src: st.src[i], item: st.item[i], lines: st.lines[i], pay: [], cancelDay: 0, exMask: flagged ? DUPB : 0, exAppr: flagged ? DUPB : 0, exRev: 15, flags: flagged ? F.DUPLICATE_WF : 0, efaa: st.efaa[i], payer: st.payer[i] });
      st.gfs[j] = st.gfs[i];
      st.mref[j] = st.mref[i];
      if (legacyGroup.has(i)) legacyGroup.add(j);
      if (flagged) st.dupOf.set(j, i);
      return j;
    };
    const n0 = st.n;
    const j26 = dayNum("2026-01-05");
    const j25a = dayNum("2025-03-01");
    const j25b = dayNum("2025-12-31");
    for (let i = Math.floor(n0 * 0.5); i < n0 && made < 3; i += 1) if (open(i) && st.issue[i] >= j26 && st.issue[i] <= todayN) {
      twin(i, st.issue[i], true);
      made += 1;
    }
    let rep = 0;
    for (let i = 0; i < n0 && rep < 1; i += 1) if (open(i) && st.issue[i] >= j25a && st.issue[i] <= j25b && st.issue[i] + 365 <= todayN) {
      twin(i, st.issue[i] + 365, false);
      rep += 1;
    }
  }
  st.nGen = st.n;
  st.dataStartN = startN;
  let reqCount = 0;
  for (const ct of contracts) {
    if (!ct || ct.invs.length < 2) continue;
    const r = rC.reset(mix(6, ct.idx));
    const problem = ct.invs.filter((i) => {
      const p = plannedByInv.get(i);
      return p && (p.planSum < p.amount * 0.5 || p.planFirst && p.planFirst > p.due + 120);
    });
    if (problem.length < 2 || r.next() > 0.55) continue;
    const opened = st.due[problem[1]] + 45 + r.int(30);
    if (opened > todayN) continue;
    const amount = Math.round(problem.reduce((s, i) => s + st.gross[i], 0) * (0.8 + r.next() * 0.4) / 100) * 100;
    const identified = r.next() < 0.4;
    const method = r.next() < 0.5 ? 0 : 1;
    const confidence = method === 1 ? Math.round((0.7 + r.next() * 0.28) * 100) / 100 : 1;
    const stRoll = r.next();
    const req = { idx: reqCount, enforceNum: `EN-${3100 + ct.idx * 11}`, system: "sanad", ent: ct.ent, amount, openedDay: opened, contractIdx: ct.idx, contractNo: ct.contractNo, status: stRoll < 0.5 ? "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : stRoll < 0.75 ? "\u0645\u0648\u0642\u0648\u0641" : "\u0645\u063A\u0644\u0642", identified: [], crNo: ct.crNo, method, confidence, debtor: ct.payer };
    if (identified) req.identified = problem.slice(0, 1 + r.int(3));
    st.requests.push(req);
    reqCount += 1;
    st.crView.set(ct.crNo, { crNo: ct.crNo, status: ct.crSt, name: ct.payer });
    for (const i of ct.invs) {
      st.crSt[i] = ct.crSt;
      if ([2, 3, 4].includes(ct.crSt) && st.payCount[i] === 0 && !st.cancelDay[i] && !(st.exMask[i] & RULE_BIT["CR-1"])) st.exMask[i] |= RULE_BIT["CR-1"];
    }
    for (const i of req.identified) st.exec[i] = req.idx;
  }
  {
    const ORDER_GEN_CUTOFF = dayNum("2026-08-31");
    const eg = (i) => legacyGroup.has(i) ? 18 : st.ent[i];
    const elig = [];
    for (let i = 0; i < st.n; i += 1) {
      if (st.exec[i] >= 0 || grpOf(st.flags[i]) !== 0 || st.cancelDay[i] || st.payCount[i] > 0 || st.exMask[i] !== 0 || st.adjDay[i] !== 0 || st.flags[i] & F.OBJECTION) continue;
      if (st.due[i] + 150 > ORDER_GEN_CUTOFF || st.scope[i] !== 0) continue;
      elig.push(i);
    }
    const used = /* @__PURE__ */ new Set();
    const serialOf = (i) => st.idKey[i] % 1e8;
    const bySerial = /* @__PURE__ */ new Map();
    for (let i = 0; i < st.n; i += 1) {
      const k = serialOf(i);
      if (!bySerial.has(k)) bySerial.set(k, []);
      bySerial.get(k).push(i);
    }
    const ARCH = ["single", "multi_exact", "multi_partial_refs", "multi_no_refs", "multi_typo_ref", "serial_ambiguous", "amount_discrepancy", "duplicate_across_orders"];
    const target = scale < 1 ? 16 : Math.min(4e3, Math.round(elig.length * 0.01));
    const pickMore = (lead, n, differentSrc = true) => {
      const out = [lead];
      const seenSrc = /* @__PURE__ */ new Set([st.src[lead]]);
      for (const j of elig) {
        if (out.length >= n) break;
        if (used.has(j) || out.includes(j) || eg(j) !== eg(lead)) continue;
        if (differentSrc && seenSrc.has(st.src[j]) && elig.length > 60) continue;
        out.push(j);
        seenSrc.add(st.src[j]);
      }
      return out;
    };
    let firstSingle = null;
    for (let k = 0; k < target; k += 1) {
      const arch = ARCH[k % ARCH.length];
      const r = rC.reset(mix(15, k));
      let lead = -1;
      for (let t = 0; t < elig.length && lead < 0; t += 1) {
        const j = elig[(k * 37 + t * 11 + 3) % elig.length];
        if (used.has(j)) continue;
        if (arch === "serial_ambiguous" && !(bySerial.get(serialOf(j)) || []).some((x) => x !== j && st.idKey[x] !== st.idKey[j])) continue;
        lead = j;
      }
      if (lead < 0) continue;
      let covers;
      let hidden = [];
      if (arch === "single" || arch === "serial_ambiguous") covers = [lead];
      else if (arch === "duplicate_across_orders") {
        covers = firstSingle != null ? pickMore(lead, 2).filter((x) => x !== firstSingle) : pickMore(lead, 2);
        if (firstSingle != null) covers = [firstSingle, ...covers.slice(0, 1)];
      } else if (arch === "amount_discrepancy") {
        const m = pickMore(lead, 3);
        covers = m.slice(0, 2);
        hidden = m.slice(2);
      } else if (arch === "multi_exact" || arch === "multi_partial_refs") covers = pickMore(lead, 3);
      else covers = pickMore(lead, 2);
      covers = [...new Set(covers)];
      if (covers.length < (arch === "single" || arch === "serial_ambiguous" ? 1 : 2)) continue;
      const all = [...covers, ...hidden];
      const owner = arch === "duplicate_across_orders" && firstSingle != null ? st.payer[firstSingle] : st.payer[lead];
      const lastDue = Math.max(...all.map((i) => st.due[i]));
      const opened = Math.min(ORDER_GEN_CUTOFF + 40, lastDue + 160 + r.int(30));
      if (opened > todayN) {
        all.forEach((i) => used.add(i));
        continue;
      }
      all.forEach((i) => {
        used.add(i);
        if (arch !== "duplicate_across_orders" || i !== firstSingle) st.payer[i] = owner;
      });
      const amount = all.reduce((sum2, i) => sum2 + st.gross[i], 0);
      const idOfi = (i) => invoiceIdFor(st.ent[i], st.scope[i], st.idKey[i]);
      const est_idKey = (i) => st.idKey[i];
      const typo = (id) => `${id.slice(0, 9)}${String(Number(id.slice(9)) + 4e6).padStart(7, "0")}`;
      let refs = [];
      let identified = [];
      if (arch === "single" || arch === "multi_exact" || arch === "duplicate_across_orders") {
        refs = covers.map((i) => ({ kind: "invoice_no", value: idOfi(i) }));
        identified = covers.filter((i) => st.exec[i] < 0);
      } else if (arch === "multi_partial_refs") {
        refs = [{ kind: "invoice_no", value: idOfi(covers[0]) }];
        identified = [covers[0]];
      } else if (arch === "multi_no_refs") refs = [];
      else if (arch === "multi_typo_ref") {
        refs = [{ kind: "invoice_no", value: idOfi(covers[0]) }, { kind: "invoice_no", value: typo(idOfi(covers[1])) }];
        identified = [covers[0]];
      } else if (arch === "serial_ambiguous") refs = [{ kind: "invoice_serial", value: String(serialOf(lead)).padStart(7, "0") }];
      else if (arch === "amount_discrepancy") {
        refs = covers.map((i) => ({ kind: "invoice_no", value: idOfi(i) }));
        identified = covers.slice();
      }
      const roll = r.next();
      const roll2 = r.next();
      const status = arch === "single" && firstSingle == null ? "\u0645\u063A\u0644\u0642" : arch === "duplicate_across_orders" ? roll < 0.7 ? "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : "\u0645\u0648\u0642\u0648\u0641" : roll < 0.5 ? "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : roll2 < 0.5 ? "\u0645\u0648\u0642\u0648\u0641" : "\u0645\u063A\u0644\u0642";
      const closeReason = status === "\u0645\u063A\u0644\u0642" ? [null, "withdrawn_by_authority", "order_expired", "replaced_by_other_order"][Math.floor(roll2 * 3.999) % 4] : null;
      const req = { idx: reqCount, enforceNum: `EN-${5e3 + k * 13}`, system: "sanad", ent: st.ent[lead], amount, openedDay: opened, contractIdx: -1, contractNo: null, status, identified, crNo: null, method: 0, confidence: 1, refs, covers, hidden, archetype: arch, debtor: owner, closeReason };
      st.requests.push(req);
      reqCount += 1;
      for (const i of identified) if (st.exec[i] < 0) st.exec[i] = req.idx;
      if (arch === "single" && firstSingle == null) firstSingle = covers[0];
    }
    {
      const E2 = ["attach_pdf", "attach_docx", "one_attached", "contract_mention", "same_serial_two_years", "genuine_conflict", "mixed_sources", "desc_sadad", "corrupted_structured", "attach_unreadable", "desc_multi", "desc_only", "cancelled_open", "cancelled_closed", "notation_exact"];
      const eligSet = new Set(elig);
      const partnerOk = (x) => eligSet.has(x) || st.exec[x] < 0 && !st.cancelDay[x] && st.exMask[x] === 0 && grpOf(st.flags[x]) === 0 && st.due[x] + 150 <= ORDER_GEN_CUTOFF && st.scope[x] === 0;
      const cancelledPool = [];
      for (let i = 0; i < st.nGen; i += 1) if (st.cancelDay[i] && st.cancelDay[i] <= ORDER_GEN_CUTOFF && st.payCount[i] === 0 && st.exMask[i] === 0 && st.exec[i] < 0 && grpOf(st.flags[i]) === 0 && !used.has(i)) cancelledPool.push(i);
      const idOfi = (i) => invoiceIdFor(st.ent[i], st.scope[i], st.idKey[i]);
      const fmt = (id, v) => v === 0 ? id : v === 1 ? id.toLowerCase() : v === 2 ? id.replace(/-/g, " ") : id.replace("-", " / ");
      const contracts2 = st.contracts.filter(Boolean);
      const E2_IDS = { "attach_pdf:0": "EN-6000", "attach_docx:0": "EN-6007", "one_attached:0": "EN-6014", "contract_mention:0": "EN-6021", "same_serial_two_years:0": "EN-6028", "genuine_conflict:0": "EN-6035", "mixed_sources:0": "EN-6042", "desc_sadad:0": "EN-6049", "corrupted_structured:0": "EN-6056", "attach_unreadable:0": "EN-6063", "desc_multi:0": "EN-6070", "desc_only:0": "EN-6077", "cancelled_open:0": "EN-6084", "cancelled_closed:0": "EN-6091", "attach_docx:1": "EN-6098", "contract_mention:1": "EN-6105", "desc_only:1": "EN-6112" };
      const E2_BASE = 14;
      const E2_PASSES = [];
      for (let rep = 0; rep < 2; rep += 1) for (let a = 0; a < E2_BASE; a += 1) E2_PASSES.push([rep, a]);
      for (let a = E2_BASE; a < E2.length; a += 1) for (let rep = 0; rep < 2; rep += 1) E2_PASSES.push([rep, a]);
      for (const [rep, a] of E2_PASSES) {
        const arch = E2[a];
        if (rep === 1 && (arch === "notation_exact" || arch === "desc_sadad" || arch === "corrupted_structured" || arch === "attach_unreadable" || arch === "mixed_sources" || arch === "one_attached" || arch === "same_serial_two_years" || arch === "genuine_conflict" || arch === "attach_pdf" || arch === "cancelled_closed" || arch === "desc_multi")) continue;
        const k = rep * 20 + a;
        const r = rC.reset(mix(16, k));
        const cancelled = arch.startsWith("cancelled");
        const pool = cancelled ? cancelledPool : elig;
        let lead = -1;
        for (let t = 0; t < pool.length && lead < 0; t += 1) {
          const j = pool[(k * 29 + t * 13 + 5) % pool.length];
          if (used.has(j)) continue;
          if (arch === "same_serial_two_years" && !(bySerial.get(serialOf(j)) || []).some((x) => x !== j && st.idKey[x] !== st.idKey[j] && partnerOk(x) && !used.has(x) && eg(x) === eg(j))) continue;
          if (!cancelled && !["same_serial_two_years", "genuine_conflict", "one_attached"].includes(arch) && !elig.some((x) => !used.has(x) && x !== j && eg(x) === eg(j))) continue;
          if (arch === "genuine_conflict" && !elig.some((x) => !used.has(x) && x !== j && st.payer[x] !== st.payer[j] && eg(x) === eg(j))) continue;
          lead = j;
        }
        if (lead < 0) {
          continue;
        }
        let covers = [lead];
        let other = -1;
        if (arch === "cancelled_closed") covers = [lead];
        else if (arch === "cancelled_open") {
          covers = [lead];
          for (const j of cancelledPool) if (covers.length < 2 && !used.has(j) && j !== lead && eg(j) === eg(lead)) covers.push(j);
        } else if (arch === "same_serial_two_years") {
          other = (bySerial.get(serialOf(lead)) || []).find((x) => x !== lead && st.idKey[x] !== st.idKey[lead] && partnerOk(x) && !used.has(x) && eg(x) === eg(lead));
          covers = [lead, other];
        } else if (arch === "genuine_conflict") {
          covers = [lead];
          other = elig.find((x) => !used.has(x) && x !== lead && st.payer[x] !== st.payer[lead] && eg(x) === eg(lead));
        } else if (arch === "one_attached") covers = [lead];
        else {
          covers = pickMore(lead, arch === "contract_mention" || arch === "desc_sadad" || arch === "corrupted_structured" || arch === "notation_exact" ? 2 : 3, false);
        }
        covers = [...new Set(covers)];
        if (!cancelled && arch !== "genuine_conflict" && arch !== "one_attached" && covers.length < 2) {
          continue;
        }
        for (const j of [...covers, other]) if (j >= 0 && legacyGroup.has(j)) st.ent[j] = st.ent[lead];
        const owner = st.payer[lead];
        const lastDue = Math.max(...covers.map((i) => st.due[i]));
        const opened = Math.min(ORDER_GEN_CUTOFF + 40, lastDue + 160 + r.int(30));
        if (opened > todayN) {
          covers.forEach((i) => used.add(i));
          continue;
        }
        covers.forEach((i) => {
          used.add(i);
          st.payer[i] = owner;
        });
        if (arch === "genuine_conflict" && other >= 0) used.add(other);
        const amount = covers.reduce((sum2, i) => sum2 + st.gross[i], 0);
        const ids = covers.map(idOfi);
        let refs = [];
        let identified = [];
        let description = "";
        let notes = "";
        let attachments = [];
        let status = ["\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630", "\u0645\u0648\u0642\u0648\u0641", "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630"][(k + 1) % 3];
        const enforceNum = E2_IDS[`${arch}:${rep}`] || `EN-${6200 + 7 * k}`;
        if (arch === "desc_multi") {
          refs = [{ kind: "invoice_no", value: ids[0] }];
          identified = [covers[0]];
          description = `\u0625\u062D\u0627\u0644\u0629 \u0644\u0644\u062A\u0646\u0641\u064A\u0630 \u2014 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0641\u064A \u0627\u0644\u062D\u0642\u0644 \u0627\u0644\u0645\u062E\u0635\u0635\u060C \u0648\u0643\u0630\u0644\u0643 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631: ${fmt(ids[1], 1)} \u0648 ${fmt(ids[2] || ids[1], 2)}. \u0648\u0644\u0644\u062A\u0623\u0643\u064A\u062F \u0646\u0643\u0631\u0631 ${fmt(ids[0], 3)}.`;
        } else if (arch === "one_attached") {
          description = "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u0631\u0641\u0642.";
          attachments = [{ name: `${enforceNum}-attachment.pdf`, type: "pdf" }];
        } else if (arch === "desc_sadad") {
          const sd = covers.map((i) => sadadOf(st.idKey[i]));
          description = `\u0625\u0644\u0632\u0627\u0645 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 \u0628\u0633\u062F\u0627\u062F \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ${sd[0]} \u0648 ${sd[1]}${sd[2] ? ` \u0648 ${sd[2]}` : ""} \u0648\u0641\u0642 \u0627\u0644\u0633\u0646\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A.`;
        } else if (arch === "notation_exact") {
          const sd = covers.map((i) => sadadOf(st.idKey[i]));
          refs = [{ kind: "invoice_no", value: exactNotation(sd[0]) }, { kind: "invoice_no", value: toSciNotation(sd[1]) }];
        } else if (arch === "corrupted_structured") {
          const sd = covers.map((i) => sadadOf(st.idKey[i]));
          refs = [{ kind: "invoice_no", value: toSciNotation(sd[0]) }];
          description = `\u0633\u062F\u0627\u062F \u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ${sd[0]} \u0628\u0645\u0628\u0644\u063A ${st.gross[covers[0]].toFixed(2)} \u0648\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ${sd[1]}.`;
        } else if (arch === "desc_only") {
          description = `Referral to enforcement for invoices ${fmt(ids[0], 0)}, ${fmt(ids[1], 2)} and ${fmt(ids[2] || ids[1], 1)}. \u0628\u062F\u0648\u0646 \u062A\u0639\u0628\u0626\u0629 \u062D\u0642\u0644 \u0627\u0644\u0645\u0631\u0627\u062C\u0639.`;
          notes = `\u062A\u0645\u062A \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0639 \u0627\u0644\u062C\u0647\u0629\u061B \u0627\u0644\u0645\u0631\u062C\u0639 ${fmt(ids[0], 1)}.`;
        } else if (arch === "attach_pdf") {
          description = "\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u0634\u0645\u0648\u0644\u0629 \u0645\u0630\u0643\u0648\u0631\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u0631\u0641\u0642.";
          attachments = [{ name: `${enforceNum}-attachment.pdf`, type: "pdf" }];
        } else if (arch === "attach_docx") {
          description = "\u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0641\u064A \u0645\u0644\u0641 Word \u0627\u0644\u0645\u0631\u0641\u0642 (\u062C\u062F\u0648\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631).";
          attachments = [{ name: `${enforceNum}-attachment.docx`, type: "docx" }];
        } else if (arch === "mixed_sources") {
          refs = [{ kind: "invoice_no", value: ids[0] }];
          identified = [covers[0]];
          description = `\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0641\u064A \u0627\u0644\u062D\u0642\u0644 \u0627\u0644\u0645\u062E\u0635\u0635\u060C \u0648\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 ${fmt(ids[1], 1)} \u0641\u064A \u0627\u0644\u0648\u0635\u0641\u060C \u0648\u0627\u0644\u0628\u0642\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u0631\u0641\u0642.`;
          attachments = [{ name: `${enforceNum}-attachment.pdf`, type: "pdf" }];
        } else if (arch === "same_serial_two_years") {
          refs = [{ kind: "invoice_no", value: ids[0] }];
          identified = [covers[0]];
          description = `\u0648\u0643\u0630\u0644\u0643 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 ${ids[1]} (\u0627\u0644\u062A\u0633\u0644\u0633\u0644 \u0646\u0641\u0633\u0647\u060C \u0633\u0646\u0629 \u0645\u062E\u062A\u0644\u0641\u0629).`;
          attachments = [{ name: `${enforceNum}-attachment.pdf`, type: "pdf" }];
        } else if (arch === "genuine_conflict") {
          refs = [{ kind: "invoice_no", value: ids[0] }];
          identified = [covers[0]];
          description = `\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0644\u0629 ${ids[0]} \u0648\u0643\u0630\u0644\u0643 ${other >= 0 ? idOfi(other) : ids[0]}.`;
          attachments = [{ name: `${enforceNum}-attachment.pdf`, type: "pdf" }];
        } else if (arch === "attach_unreadable") {
          description = "";
          attachments = [{ name: `${enforceNum}-scan.pdf`, type: "pdf" }, { name: `${enforceNum}-legacy.doc`, type: "doc" }];
        } else if (arch === "cancelled_open") {
          refs = covers.map((i) => ({ kind: "invoice_no", value: idOfi(i) }));
          identified = covers.slice();
          status = rep === 0 ? "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : "\u0645\u0648\u0642\u0648\u0641";
          description = "\u0623\u0645\u0631 \u0625\u0646\u0641\u0627\u0630 \u0639\u0644\u0649 \u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0644\u063A\u0627\u0629 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u2014 \u064A\u062D\u062A\u0627\u062C \u0645\u0631\u0627\u062C\u0639\u0629.";
        } else if (arch === "cancelled_closed") {
          refs = covers.map((i) => ({ kind: "invoice_no", value: idOfi(i) }));
          identified = covers.slice();
          status = "\u0645\u063A\u0644\u0642";
        } else if (arch === "contract_mention") {
          refs = ids.map((id) => ({ kind: "invoice_no", value: id }));
          identified = covers.slice();
          const ctNo = rep === 0 && contracts2.length ? contracts2[Math.min(1, contracts2.length - 1)].contractNo : "CT-2099-0001";
          description = `\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0623\u0639\u0644\u0627\u0647 \u0636\u0645\u0646 \u0627\u0644\u0639\u0642\u062F \u0631\u0642\u0645 ${ctNo} (\u0630\u0643\u0631 \u0641\u064A \u0627\u0644\u0648\u0635\u0641 \u0641\u0642\u0637).`;
        }
        const closeReason = status === "\u0645\u063A\u0644\u0642" ? [null, "withdrawn_by_authority", "order_expired"][k % 3] : null;
        const req = { idx: reqCount, enforceNum, system: "sanad", ent: st.ent[lead], amount, openedDay: opened, contractIdx: -1, contractNo: null, status, identified, crNo: null, method: 0, confidence: 1, refs, description, notes, attachments, covers, hidden: [], archetype: arch, rep, debtor: owner, closeReason, conflictWith: other >= 0 ? other : null };
        st.requests.push(req);
        reqCount += 1;
        for (const i of identified) if (st.exec[i] < 0) st.exec[i] = req.idx;
      }
    }
  }
  for (const w of wlEnforce) {
    if (w.opened > todayN) continue;
    const roll = mix(14, st.idKey[w.i] % 1000003) / 4294967296;
    const req = { idx: reqCount, enforceNum: `WLX-${String(st.idKey[w.i] % 1e8).padStart(7, "0")}`, system: "white_lands", ent: ENT_HOUSING, amount: st.gross[w.i], openedDay: w.opened, contractIdx: -1, contractNo: null, status: roll < 0.55 ? "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : roll < 0.8 ? "\u0645\u0648\u0642\u0648\u0641" : "\u0645\u063A\u0644\u0642", identified: [w.i], crNo: null, method: 0, confidence: 1, debtor: st.payer[w.i] };
    st.requests.push(req);
    st.exec[w.i] = req.idx;
    reqCount += 1;
  }
  {
    const LIC = SOURCE_INDEX.licenses;
    for (let i = 0; i < st.nGen; i += 1) {
      if (st.src[i] !== LIC || st.exec[i] >= 0) continue;
      const p = st.addPayment(i, st.issue[i], st.gross[i], 0);
      st.payStart[i] = p;
      st.payCount[i] = 1;
      st.cancelDay[i] = 0;
      st.exMask[i] = 0;
      st.exAppr[i] = 0;
      st.flags[i] &= ~F.OBJECTION;
    }
  }
  {
    const MF = SOURCE_INDEX.municipal_fees;
    const INV = SOURCE_INDEX.investment;
    const A = RULE_BIT["ATT-1"];
    const E2 = RULE_BIT["ENC-1"];
    for (let i = 0; i < st.nGen; i += 1) {
      if (st.payCount[i] > 0 || st.cancelDay[i] || st.exMask[i] || st.exec[i] >= 0 || st.issue[i] > todayN) continue;
      const h = mix(19, st.idKey[i] % 1000003) % 100;
      if (st.src[i] === MF && h < 8) {
        st.exMask[i] = A;
        st.exAppr[i] = A;
        st.exRev[i] = 15 + h % 30;
      } else if (st.src[i] === INV && h < 12) {
        st.exMask[i] = E2;
        st.exAppr[i] = E2;
        st.exRev[i] = 15 + h % 30;
      }
    }
  }
  {
    const uncollected = (i) => i < st.nGen && st.payCount[i] === 0 && !st.cancelDay[i] && st.exec[i] < 0 && st.issue[i] <= todayN;
    const NOC = RULE_BIT["NOC-1"];
    const CRB = RULE_BIT["CR-1"];
    const DUPB = RULE_BIT["DUP-1"];
    const svc = () => {
      let n = 0;
      for (let i = 0; i < st.nGen; i += 1) if (uncollected(i) && st.payer[i] < 2) n += 1;
      return n;
    };
    for (let i = 0, k = svc(); i < st.nGen && k < 4; i += 1) if (uncollected(i) && st.payer[i] >= 2 && st.exMask[i] & NOC) {
      st.payer[i] = k % 2;
      k += 1;
    }
    {
      let have = 0;
      for (let i = 0; i < st.nGen; i += 1) if (st.exMask[i] & CRB && uncollected(i)) have += 1;
      const byContract = /* @__PURE__ */ new Map();
      for (let i = 0; i < st.nGen; i += 1) if (st.contract[i] >= 0 && uncollected(i) && !st.exMask[i] && ![2, 4].includes(st.crSt[i])) {
        if (!byContract.has(st.contract[i])) byContract.set(st.contract[i], []);
        byContract.get(st.contract[i]).push(i);
      }
      let c2 = 0;
      for (const [c, list2] of byContract) {
        if (have >= 3) break;
        const ct = st.contracts[c];
        if (!ct) continue;
        list2.sort((x, y) => st.gross[x] - st.gross[y]);
        ct.crSt = c2 % 2 === 0 ? 2 : 4;
        c2 += 1;
        st.crView.set(ct.crNo, { crNo: ct.crNo, status: ct.crSt, name: ct.payer });
        for (let q3 = 0; q3 < list2.length; q3 += 1) {
          const i = list2[q3];
          st.crSt[i] = ct.crSt;
          if (q3 < 2) {
            st.exMask[i] |= CRB;
            st.exAppr[i] |= CRB;
            have += 1;
          }
        }
      }
    }
    {
      let k = 0;
      for (let i = 0; i < st.nGen; i += 1) if (st.scope[i] === 1 && st.src[i] !== SOURCE_INDEX.investment && uncollected(i) && !st.exMask[i]) {
        if (k >= 3) break;
        st.exMask[i] = NOC;
        st.exAppr[i] = NOC;
        st.exRev[i] = 15 + i % 30;
        st.src[i] = SOURCE_INDEX.investment;
        st.item[i] = ITEM_INDEX.ad_boards_amanah;
        st.gfs[i] = gfsIndexOf("11100-11105");
        st.cstat[i] = 3;
        k += 1;
      }
    }
    for (const [bit, srcIdx] of [[RULE_BIT["ENC-1"], SOURCE_INDEX.investment], [RULE_BIT["ATT-1"], SOURCE_INDEX.municipal_fees]]) {
      let have = 0;
      for (let i = 0; i < st.nGen; i += 1) if (st.exMask[i] & bit && uncollected(i)) have += 1;
      for (let i = 0; i < st.nGen && have < 4; i += 1) if (st.src[i] === srcIdx && uncollected(i) && !st.exMask[i]) {
        st.exMask[i] = bit;
        st.exAppr[i] = bit;
        st.exRev[i] = 15 + i % 30;
        have += 1;
      }
    }
  }
  {
    let k = 0;
    for (let i = 0; i < st.nGen; i += 1) if (st.flags[i] & F.OBJECTION) {
      st.objSt[i] = k % 5 + 1;
      k += 1;
    }
  }
  st.trim();
  st.meta = { today, scale, generatedFrom: GEN_START, seed: SEED, ms: Date.now() - t0, contracts: contracts.filter(Boolean).length, requests: reqCount };
  worldCache.set(key, st);
  if (worldCache.size > 3) worldCache.delete(worldCache.keys().next().value);
  return st;
}

// src/data/invoiceIdentity.js
var KEY_VERSION = "ick1";
var REQUIRED = ["invoiceId", "gfsCode", "amanahId"];
var OPTIONAL = ["municipalityId"];
var TAG = { invoiceId: "inv", gfsCode: "gfs", amanahId: "am", municipalityId: "mu" };
var NAME_OF_TAG = Object.fromEntries(Object.entries(TAG).map(([k, v]) => [v, k]));
function norm(v) {
  if (v == null) return { v: null };
  if (typeof v === "number") return Number.isSafeInteger(v) ? { v: String(v) } : { bad: "imprecise" };
  const t = String(v).trim();
  return t === "" ? { v: null } : { v: t };
}
var enc = (s) => encodeURIComponent(s);
var dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};
function compositeKey(parts = {}) {
  const out = {};
  const missing = [];
  const invalid2 = [];
  for (const f of [...REQUIRED, ...OPTIONAL]) {
    const n = norm(parts[f]);
    if (n.bad) {
      invalid2.push(f);
      out[f] = null;
    } else {
      out[f] = n.v;
      if (n.v == null && REQUIRED.includes(f)) missing.push(f);
    }
  }
  const complete = missing.length === 0 && invalid2.length === 0;
  const key = complete ? [KEY_VERSION, ...Object.keys(TAG).filter((f) => out[f] != null).map((f) => `${TAG[f]}=${enc(out[f])}`)].join("|") : null;
  return { complete, key, parts: out, missing, invalid: invalid2 };
}
function parseCompositeKey(s) {
  const t = String(s ?? "").trim();
  const seg = t.split("|");
  if (seg[0] !== KEY_VERSION) return null;
  const parts = {};
  for (const x of seg.slice(1)) {
    const m = /^(inv|gfs|am|mu)=(.*)$/.exec(x);
    if (!m) return null;
    const f = NAME_OF_TAG[m[1]];
    if (f in parts) return null;
    const d = dec(m[2]);
    if (d == null || d === "") return null;
    parts[f] = d;
  }
  const r = compositeKey(parts);
  return r.complete && r.key === t ? r.parts : null;
}
var resolveByNumber = (candidates2) => ({ status: candidates2.length === 0 ? "none" : candidates2.length === 1 ? "unique" : "ambiguous", matches: candidates2 });
var demoAmanahId = (ent) => ent == null || ent < 0 ? null : String(ent + 1).padStart(3, "0");
var demoMunicipalityId = (muni) => muni == null || muni < 0 || muni > 2 ? null : String(muni + 1).padStart(3, "0");

// server/fixtures.js
function recordCompositeKey(rec) {
  const e = ENTITY_INDEX[rec.amanahEn];
  return compositeKey({ invoiceId: rec.invoiceNo || rec.sadadNo, gfsCode: rec.gfsCode, amanahId: e == null ? null : demoAmanahId(e) }).key;
}
function appendRecord(st, rec, { owner = 0, kind = "fixture" } = {}) {
  const i = st.addInvoice();
  const e = ENTITY_INDEX[rec.amanahEn];
  if (e == null) throw new Error(`unknown Amanah: ${rec.amanahEn}`);
  st.idKey[i] = 0;
  st.issue[i] = dayNum(rec.issueDate);
  st.due[i] = dayNum(rec.dueDate);
  st.gross[i] = rec.grossAmount;
  const adj = (rec.adjustments || [])[0];
  st.adjAmt[i] = adj ? adj.amount : 0;
  st.adjDay[i] = adj ? dayNum(adj.date) : 0;
  st.ent[i] = e;
  st.muni[i] = 255;
  st.mref[i] = classifySourceValues(e, rec.municipalitySourceValues || (rec.municipalityAr ? [rec.municipalityAr] : [])).code;
  st.scope[i] = rec.scopeType === "internal" ? 1 : 0;
  st.src[i] = SOURCE_INDEX[rec.revenueSource] ?? SOURCE_INDEX.municipal_fees;
  st.item[i] = rec.revenueItem?.key && ITEM_INDEX[rec.revenueItem.key] !== void 0 ? ITEM_INDEX[rec.revenueItem.key] : 0;
  st.lines[i] = Math.max(1, (rec.lineItems || []).length);
  {
    let h = 5381;
    for (const ch of String(rec.id)) h = (h * 33 ^ ch.charCodeAt(0)) >>> 0;
    st.gfs[i] = gfsIndexOf(rec.gfsCode || gfsCodeOf(ITEMS[st.item[i]].key, h));
  }
  st.payStart[i] = st.pn;
  const pays = [...rec.payments || []].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of pays) st.addPayment(i, dayNum(p.date), p.amount, Math.max(0, CHANNELS.indexOf(p.channel)));
  st.payCount[i] = pays.length;
  st.cancelDay[i] = rec.cancelled?.date ? dayNum(rec.cancelled.date) : 0;
  let mask = 0;
  let appr = 0;
  const ex = rec.exclusions?.length ? rec.exclusions : rec.exclusion ? [rec.exclusion] : [];
  for (const x of ex) {
    const bit = RULE_BIT[x.ruleId];
    if (!bit) continue;
    mask |= bit;
    if (x.reviewStatus === "approved") appr |= bit;
  }
  st.exMask[i] = mask;
  st.exAppr[i] = appr;
  st.exRev[i] = 0;
  let flags = kind === "upload" ? F.UPLOADED : F.FIXTURE;
  if (rec.objection?.open) {
    flags |= F.OBJECTION;
    st.objSt[i] = objectionStatusIndex(rec.objection.status || "awaiting_member");
  } else st.objSt[i] = 0;
  if ((rec.missingFields || []).length) flags |= F.MISSING_ID;
  if (rec.amountCheck?.status === "conflict") flags |= F.AMT_CONFLICT;
  if (rec.amountCheck?.status === "not_checkable") flags |= F.NOT_CHECKABLE;
  if (rec.sourceStatus === "cancelled" && !rec.cancelled) flags |= F.LEGACY_CANCELLED;
  if (rec.workflowStatus === "duplicate") flags |= F.DUPLICATE_WF;
  st.flags[i] = flags;
  st.contract[i] = -1;
  st.inst[i] = 0;
  st.cstat[i] = Math.max(0, CSTAT.indexOf(rec.contract?.status || "not_applicable"));
  st.crSt[i] = Math.max(0, CR_STATUS.indexOf(rec.crStatusRaw || null));
  st.exec[i] = -1;
  st.efaa[i] = 0;
  st.payer[i] = 0;
  st.owner[i] = owner;
  st.fixtures.set(i, rec);
  st.fixtureById.set(rec.id, i);
  return i;
}

// server/store.js
var stores = /* @__PURE__ */ new Map();
var RESERVE = 6e3;
var DEMO_SIZES = { compact: 3e-4, full: 1 };
var defaultSize = () => typeof process !== "undefined" && process.env?.DEMO_SIZE === "full" ? "full" : "compact";
var sizeOf = (s) => s === "full" || s === "compact" ? s : defaultSize();
function loadStore(today, { scale, size, withFixtures = true } = {}) {
  const sz = sizeOf(size);
  if (scale == null) scale = DEMO_SIZES[sz];
  const key = `${today}|${scale}|${withFixtures}`;
  if (stores.has(key)) return stores.get(key);
  const base = generateWorld(today, { scale });
  const st = base;
  if (withFixtures && !st.fixtureLoaded) {
    st.reserve(RESERVE);
    const anchors = buildLedger({ today, enforcement: ANCHOR_ENFORCEMENT_SEED });
    for (const rec of anchors) appendRecord(st, rec);
    st.fixtureLoaded = true;
  }
  st.meta.size = scale >= 1 ? "full" : "compact";
  stores.set(key, st);
  if (stores.size > 3) stores.delete(stores.keys().next().value);
  return st;
}
function currentStore(override2, size) {
  const today = override2 && /^\d{4}-\d{2}-\d{2}$/.test(override2) ? override2 : riyadhToday();
  return loadStore(today, { size });
}

// src/data/lateness.js
var overdueDays = (refN, dueN, grace = 0) => Math.max(0, refN - (dueN + (grace || 0)));
var paymentLateness = (payN, dueN, grace = 0) => ({ offset: payN - dueN, lateBy: Math.max(0, payN - (dueN + (grace || 0))) });
var openOverdueDays = (D) => D.outstanding > 0 && !D.excluded && !D.cancelled ? D.daysOverdue : null;

// src/data/appropriations.js
var APPROPRIATION_YEAR = 2026;
var HQ_KEY = "__HQ__";
var M = 1e6;
var TABLE = {
  "Riyadh Amanah": { revOriginal: 2065, revAdjusted: 2150, expOriginal: 4290, expAdjusted: 5010 },
  "Jeddah Amanah": { revOriginal: 2480, revAdjusted: 2480, expOriginal: 5065, expAdjusted: 5240 },
  "Eastern Province Amanah": { revOriginal: 500, revAdjusted: 540, expOriginal: 1100, expAdjusted: 1280 },
  "Makkah Amanah": { revOriginal: 1295, revAdjusted: 1310, expOriginal: 3025, expAdjusted: 3760 },
  "Al Madinah Amanah": { revOriginal: 715, revAdjusted: 760, expOriginal: 1910, expAdjusted: 2125 },
  "Asir Amanah": { revOriginal: 750, revAdjusted: 835, expOriginal: 1810, expAdjusted: 2190 },
  "Taif Amanah": { revOriginal: 280, revAdjusted: 295, expOriginal: 710, expAdjusted: 735 },
  "Al-Qassim Amanah": { revOriginal: 240, revAdjusted: 245, expOriginal: 535, expAdjusted: 615 },
  "Al-Ahsa Amanah": { revOriginal: 105, revAdjusted: 105, expOriginal: 210, expAdjusted: 225 },
  "Jazan Amanah": { revOriginal: 370, revAdjusted: 385, expOriginal: 695, expAdjusted: 815 },
  "Tabuk Amanah": { revOriginal: 315, revAdjusted: 330, expOriginal: 650, expAdjusted: 810 },
  "Ha'il Amanah": { revOriginal: 55, revAdjusted: 60, expOriginal: 130, expAdjusted: 150 },
  "Northern Borders Amanah": { revOriginal: 435, revAdjusted: 475, expOriginal: 850, expAdjusted: 1005 },
  "Najran Amanah": { revOriginal: 65, revAdjusted: 70, expOriginal: 165, expAdjusted: 185 },
  "Al Bahah Amanah": { revOriginal: 80, revAdjusted: 85, expOriginal: 160, expAdjusted: 200 },
  "Al Jawf Amanah": { revOriginal: 150, revAdjusted: 160, expOriginal: 435, expAdjusted: 490 },
  "Housing Sector": { revOriginal: 1075, revAdjusted: 1120, expOriginal: 2515, expAdjusted: 2820 },
  "Hafr Al-Batin Amanah": { revOriginal: 90, revAdjusted: 90, expOriginal: 160, expAdjusted: 190 },
  "__HQ__": { revOriginal: 0, revAdjusted: 0, expOriginal: 4420, expAdjusted: 4860 }
};
var appropriationOf = (key, year = APPROPRIATION_YEAR) => {
  const t = year === APPROPRIATION_YEAR ? TABLE[key] : null;
  return t ? { revOriginal: t.revOriginal * M, revAdjusted: t.revAdjusted * M, expOriginal: t.expOriginal * M, expAdjusted: t.expAdjusted * M } : null;
};
var appropriationKeys = () => Object.keys(TABLE);

// src/data/plans/planMath.js
var pad2 = (n) => String(n).padStart(2, "0");
var ISO2 = /^\d{4}-\d{2}-\d{2}$/;
var isISODate = (s) => typeof s === "string" && ISO2.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && (/* @__PURE__ */ new Date(`${s}T00:00:00Z`)).toISOString().slice(0, 10) === s;
var T = (s) => Date.parse(`${s}T00:00:00Z`);
var addDays2 = (s, n) => new Date(T(s) + n * 864e5).toISOString().slice(0, 10);
var daysInclusive = (a, b) => T(b) < T(a) ? 0 : Math.round((T(b) - T(a)) / 864e5) + 1;
var daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
var ymOf = (s) => s.slice(0, 7);
var monthStart = (ym) => `${ym}-01`;
var monthEnd = (ym) => `${ym}-${pad2(daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))))}`;
var nextYm = (ym) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
};
var fiscalYearPeriod = (year) => ({ start: `${year}-01-01`, end: `${year}-12-31`, preset: "fiscal-year" });
var periodValid = (p) => !!p && isISODate(p.start) && isISODate(p.end) && T(p.end) >= T(p.start);
var isCalendarYear = (p) => periodValid(p) && p.start.slice(5) === "01-01" && p.end.slice(5) === "12-31" && p.start.slice(0, 4) === p.end.slice(0, 4);
var periodsOverlap = (a, b) => periodValid(a) && periodValid(b) && T(a.start) <= T(b.end) && T(b.start) <= T(a.end);
function monthRows(period) {
  if (!periodValid(period)) return [];
  const rows = [];
  let ym = ymOf(period.start);
  const last = ymOf(period.end);
  for (; ; ) {
    const s = monthStart(ym) < period.start ? period.start : monthStart(ym);
    const e = monthEnd(ym) > period.end ? period.end : monthEnd(ym);
    const monthDays = daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)));
    const days = daysInclusive(s, e);
    rows.push({ ym, start: s, end: e, days, monthDays, fraction: days / monthDays, partial: days < monthDays });
    if (ym === last) break;
    ym = nextYm(ym);
  }
  return rows;
}
function apportion(total, weights) {
  const n = weights.length;
  const tot = Math.round(Number(total) || 0);
  const w = weights.map((x) => Number.isFinite(x) && x > 0 ? x : 0);
  const sum2 = w.reduce((a, b) => a + b, 0);
  if (!n || !(sum2 > 0) || !(tot >= 0)) return { amounts: new Array(n).fill(0), remainder: { units: 0, rows: [] }, ok: false };
  const exact = w.map((x) => tot * x / sum2);
  const base = exact.map(Math.floor);
  let left = tot - base.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i);
  const rows = [];
  for (let k = 0; k < order.length && left > 0; k += 1) {
    if (order[k].f <= 1e-12 && left === 0) break;
    base[order[k].i] += 1;
    rows.push(order[k].i);
    left -= 1;
  }
  return { amounts: base, remainder: { units: rows.length, rows: rows.sort((a, b) => a - b) }, ok: true };
}
var BP_TOTAL = 1e4;
function distributionWeights(distribution, rows) {
  if (distribution?.profile === "manual") return rows.map((r) => Math.max(0, Number(distribution.weights?.[r.ym]) || 0));
  return rows.map((r) => r.fraction);
}
function weightsTotal(distribution, rows) {
  const total = rows.reduce((a, r) => a + Math.max(0, Number(distribution?.weights?.[r.ym]) || 0), 0);
  return { total, remaining: BP_TOTAL - total, complete: total === BP_TOTAL };
}
function monthAmounts(amount, distribution, rows) {
  return apportion(amount, distributionWeights(distribution, rows));
}
function planMonthly(content, period) {
  const rows = monthRows(period);
  const alloc = content?.allocations || [];
  const entities = {};
  for (const a of alloc) entities[a.entityKey] = monthAmounts(a.amount || 0, content.entityDistributions?.[a.entityKey] || content.distribution, rows).amounts;
  const allocated = alloc.reduce((t, a) => t + (Math.round(a.amount) || 0), 0);
  const plan2 = alloc.length ? rows.map((_, i) => alloc.reduce((t, a) => t + entities[a.entityKey][i], 0)) : monthAmounts(content?.target?.amount || 0, content?.distribution, rows).amounts;
  return { rows, entities, plan: plan2, allocated, complete: alloc.length > 0 && allocated === Math.round(content?.target?.amount || 0) };
}
function municipalMonthlyBreakdown(content, period, entityKey) {
  const rows = monthRows(period);
  const c = content || {};
  const dist = c.entityDistributions?.[entityKey] || c.distribution;
  const amanahAmount = Math.round(Number((c.allocations || []).find((a) => a.entityKey === entityKey)?.amount) || 0);
  const by = /* @__PURE__ */ new Map();
  for (const m of c.municipalAllocations || []) if (m && m.entityKey === entityKey && typeof m.muniId === "string") by.set(m.muniId, (by.get(m.muniId) || 0) + (Math.round(Number(m.amount)) || 0));
  const ids = [...by.keys()].sort();
  const allocated = ids.reduce((t, id) => t + by.get(id), 0);
  const excess = Math.max(0, allocated - amanahAmount);
  const amanah = monthAmounts(amanahAmount, dist, rows).amounts;
  const municipalities = {};
  let unallocated;
  if (!excess) {
    let cap = amanah.slice();
    for (const id of ids) {
      const x = by.get(id) > 0 ? apportion(by.get(id), cap).amounts : cap.map(() => 0);
      municipalities[id] = x;
      cap = cap.map((v, i) => v - x[i]);
    }
    unallocated = cap;
  } else {
    for (const id of ids) municipalities[id] = monthAmounts(by.get(id), dist, rows).amounts;
    unallocated = rows.map(() => 0);
  }
  const reconciles = !excess && rows.every((_, i) => ids.reduce((t, id) => t + municipalities[id][i], 0) + unallocated[i] === amanah[i]);
  return { rows, entityKey, amanah, municipalities, unallocated, amanahAmount, allocated, unallocatedAmount: Math.max(0, amanahAmount - allocated), excess, reconciles };
}
function plannedTo(amounts, rows, cutoff) {
  if (!rows.length || !isISODate(cutoff)) return null;
  if (cutoff < rows[0].start) return 0;
  let sum2 = 0;
  rows.forEach((r, i) => {
    if (cutoff >= r.end) sum2 += amounts[i];
    else if (cutoff >= r.start) sum2 += amounts[i] * (daysInclusive(r.start, cutoff) / r.days);
  });
  return sum2;
}

// src/data/geoScope.js
var ALL_SCOPE = Object.freeze({ all: true });
var EMPTY_SCOPE = Object.freeze({ all: false, grants: Object.freeze([]), nonMunicipal: false });
var AMANAH_KEYS = Object.freeze(ENTITIES.slice(0, N_AMANAH).map((e) => e.en));
var AMANAH_RANK = Object.fromEntries(AMANAH_KEYS.map((k, i) => [k, i]));
var GEO_HIERARCHY = Object.freeze({
  has: (amanah) => Object.prototype.hasOwnProperty.call(AMANAH_RANK, amanah),
  refsOf: (amanah) => municipalitiesOf(amanah).map((m) => m.refId)
});
var isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
var byAmanah = (a, b) => (AMANAH_RANK[a.amanah] ?? 99) - (AMANAH_RANK[b.amanah] ?? 99) || (a.amanah < b.amanah ? -1 : a.amanah > b.amanah ? 1 : 0);
var uniqSorted = (arr) => [...new Set(arr.filter((x) => typeof x === "string" && x))].sort();
var emptyGrant = (g) => g.municipalities !== "all" && g.municipalities.length === 0 && !g.direct && !g.notSpecified;
function normGrant(g) {
  if (!isObj(g) || typeof g.amanah !== "string") return null;
  const m = g.municipalities === "all" ? "all" : Array.isArray(g.municipalities) ? uniqSorted(g.municipalities) : [];
  return { amanah: g.amanah, municipalities: m, direct: g.direct === true, notSpecified: g.notSpecified === true };
}
function mergeGrants(a, b) {
  return { amanah: a.amanah, municipalities: a.municipalities === "all" || b.municipalities === "all" ? "all" : uniqSorted([...a.municipalities, ...b.municipalities]), direct: a.direct || b.direct, notSpecified: a.notSpecified || b.notSpecified };
}
var isFullGrant = (g) => g.municipalities === "all" && g.direct && g.notSpecified;
function normalizeGeoScope(x) {
  if (!isObj(x)) return EMPTY_SCOPE;
  if (x.all === true) return ALL_SCOPE;
  const grants = /* @__PURE__ */ new Map();
  for (const raw of Array.isArray(x.grants) ? x.grants : []) {
    const g = normGrant(raw);
    if (!g) continue;
    grants.set(g.amanah, grants.has(g.amanah) ? mergeGrants(grants.get(g.amanah), g) : g);
  }
  const list2 = [...grants.values()].filter((g) => !emptyGrant(g)).sort(byAmanah);
  const nonMunicipal = x.nonMunicipal === true;
  if (nonMunicipal && AMANAH_KEYS.every((k) => {
    const g = grants.get(k);
    return g && isFullGrant(g);
  })) return ALL_SCOPE;
  return { all: false, grants: list2, nonMunicipal };
}
var isAllGeoScope = (s) => normalizeGeoScope(s).all === true;
var isEmptyGeoScope = (s) => {
  const n = normalizeGeoScope(s);
  return !n.all && n.grants.length === 0 && !n.nonMunicipal;
};
var E = (code, path5, ar, en, extra = {}) => ({ code, path: path5, ar, en, ...extra });
function validateGeoScope(scope, hierarchy = GEO_HIERARCHY) {
  const errors = [];
  if (!isObj(scope)) return { ok: false, errors: [E("scope_invalid", "scope", "\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", "The geographic scope is not valid.")] };
  if (scope.all === true) return { ok: true, errors };
  if (scope.all !== false) errors.push(E("scope_invalid", "scope.all", "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \xAB\u0627\u0644\u0643\u0644\xBB \u0623\u0648 \u0642\u0627\u0626\u0645\u0629 \u0645\u0646\u062D.", 'Choose "all" or a list of grants.'));
  if (scope.nonMunicipal !== void 0 && typeof scope.nonMunicipal !== "boolean") errors.push(E("scope_invalid", "scope.nonMunicipal", "\u0642\u064A\u0645\u0629 \xAB\u0627\u0644\u062C\u0647\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0628\u0644\u062F\u064A\u0629\xBB \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.", "The non-municipal flag is not valid."));
  if (!Array.isArray(scope.grants)) {
    errors.push(E("scope_invalid", "scope.grants", "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u0645\u0637\u0644\u0648\u0628\u0629.", "The list of Amanahs is required."));
    return { ok: false, errors };
  }
  const seen = /* @__PURE__ */ new Set();
  scope.grants.forEach((g, i) => {
    const p = `scope.grants[${i}]`;
    if (!isObj(g) || typeof g.amanah !== "string") {
      errors.push(E("grant_invalid", p, "\u0645\u0646\u062D\u0629 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.", "The Amanah grant is not valid."));
      return;
    }
    if (!hierarchy.has(g.amanah)) {
      errors.push(E("unknown_amanah", `${p}.amanah`, "\u0623\u0645\u0627\u0646\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.", "Unknown Amanah.", { amanah: g.amanah }));
      return;
    }
    if (seen.has(g.amanah)) errors.push(E("duplicate_amanah", `${p}.amanah`, "\u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0645\u0643\u0631\u0631\u0629 \u0641\u064A \u0627\u0644\u0646\u0637\u0627\u0642.", "The Amanah appears twice in the scope.", { amanah: g.amanah }));
    seen.add(g.amanah);
    for (const f of ["direct", "notSpecified"]) if (g[f] !== void 0 && typeof g[f] !== "boolean") errors.push(E("grant_invalid", `${p}.${f}`, "\u0642\u064A\u0645\u0629 \u0645\u0646\u0637\u0642\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629.", "A true/false value is required."));
    const m = g.municipalities;
    if (m !== "all" && !Array.isArray(m)) {
      errors.push(E("grant_invalid", `${p}.municipalities`, "\u0627\u062E\u062A\u0631 \xAB\u0643\u0644 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A\xBB \u0623\u0648 \u0642\u0627\u0626\u0645\u0629 \u0628\u0644\u062F\u064A\u0627\u062A.", 'Choose "all municipalities" or a list of municipalities.'));
      return;
    }
    if (Array.isArray(m)) {
      const refs = new Set(hierarchy.refsOf(g.amanah));
      for (const r of m) if (typeof r !== "string" || !refs.has(r)) errors.push(E("municipality_not_in_amanah", `${p}.municipalities`, "\u0628\u0644\u062F\u064A\u0629 \u0644\u0627 \u062A\u062A\u0628\u0639 \u0647\u0630\u0647 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0641\u064A \u0627\u0644\u0645\u0631\u062C\u0639 \u0627\u0644\u0645\u0639\u062A\u0645\u062F.", "A municipality that does not belong to this Amanah in the verified reference.", { amanah: g.amanah, ref: String(r) }));
    }
    const n = normGrant(g);
    if (n && emptyGrant(n)) errors.push(E("empty_grant", p, "\u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0628\u0644\u0627 \u0623\u064A \u0628\u0644\u062F\u064A\u0629 \u0623\u0648 \u062E\u064A\u0627\u0631 \u0645\u0628\u0627\u0634\u0631/\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629.", "The Amanah has no municipality and no direct / not-specified option.", { amanah: g.amanah }));
  });
  return { ok: errors.length === 0, errors };
}
function unionGeoScopes(a, b) {
  const x = normalizeGeoScope(a);
  const y = normalizeGeoScope(b);
  if (x.all || y.all) return ALL_SCOPE;
  const m = new Map(x.grants.map((g) => [g.amanah, g]));
  for (const g of y.grants) m.set(g.amanah, m.has(g.amanah) ? mergeGrants(m.get(g.amanah), g) : g);
  return normalizeGeoScope({ all: false, grants: [...m.values()], nonMunicipal: x.nonMunicipal || y.nonMunicipal });
}
function intersectGeoScopes(a, b) {
  const x = normalizeGeoScope(a);
  const y = normalizeGeoScope(b);
  if (x.all) return y;
  if (y.all) return x;
  const ym = new Map(y.grants.map((g) => [g.amanah, g]));
  const out = [];
  for (const g of x.grants) {
    const h = ym.get(g.amanah);
    if (!h) continue;
    const m = g.municipalities === "all" ? h.municipalities : h.municipalities === "all" ? g.municipalities : g.municipalities.filter((r) => h.municipalities.includes(r));
    out.push({ amanah: g.amanah, municipalities: m, direct: g.direct && h.direct, notSpecified: g.notSpecified && h.notSpecified });
  }
  return normalizeGeoScope({ all: false, grants: out, nonMunicipal: x.nonMunicipal && y.nonMunicipal });
}
function geoScopeSubset(a, b, hierarchy = GEO_HIERARCHY) {
  const x = normalizeGeoScope(a);
  const y = normalizeGeoScope(b);
  if (y.all) return true;
  if (x.all) return false;
  if (x.nonMunicipal && !y.nonMunicipal) return false;
  const ym = new Map(y.grants.map((g) => [g.amanah, g]));
  return x.grants.every((g) => {
    const h = ym.get(g.amanah);
    if (!h) return false;
    if (g.direct && !h.direct) return false;
    if (g.notSpecified && !h.notSpecified) return false;
    if (h.municipalities === "all") return true;
    if (g.municipalities === "all") {
      const all = hierarchy.refsOf(g.amanah);
      return all.length > 0 && all.every((r) => h.municipalities.includes(r));
    }
    return g.municipalities.every((r) => h.municipalities.includes(r));
  });
}
var geoScopesEqual = (a, b) => geoScopeSubset(a, b) && geoScopeSubset(b, a);
var NOT_SPECIFIED_LIKE = /* @__PURE__ */ new Set(["not_specified", "unmapped_source_value", "conflict"]);
function geoScopeAllowsRecord(scope, rec) {
  const s = scope && scope.all === true ? ALL_SCOPE : normalizeGeoScope(scope);
  if (s.all) return true;
  if (!rec) return false;
  if (rec.nonMunicipal || rec.amanah && !GEO_HIERARCHY.has(rec.amanah)) return s.nonMunicipal === true;
  const g = s.grants.find((x) => x.amanah === rec.amanah);
  if (!g) return false;
  return allowsInGrant(g, rec.municipalityStatus, rec.municipalityRefId);
}
function allowsInGrant(g, status, refId) {
  const st = status || (refId ? "mapped" : "not_specified");
  if (st === "mapped") return g.municipalities === "all" || !!refId && g.municipalities.includes(refId);
  if (st === "direct_amanah") return g.direct;
  if (NOT_SPECIFIED_LIKE.has(st)) return g.notSpecified;
  return g.notSpecified;
}
var entireAmanahGrant = (amanah) => ({ amanah, municipalities: "all", direct: true, notSpecified: true });
function geoScopeMunicipalityCount(scope, hierarchy = GEO_HIERARCHY) {
  const n = normalizeGeoScope(scope);
  if (n.all) return AMANAH_KEYS.reduce((t, k) => t + hierarchy.refsOf(k).length, 0);
  return n.grants.reduce((t, g) => t + (g.municipalities === "all" ? hierarchy.refsOf(g.amanah).length : g.municipalities.length), 0);
}
var arCount = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;
var amanahsText = (n, lang) => lang === "ar" ? arCount(n, "\u0623\u0645\u0627\u0646\u0629 \u0648\u0627\u062D\u062F\u0629", "\u0623\u0645\u0627\u0646\u062A\u0627\u0646", "\u0623\u0645\u0627\u0646\u0627\u062A", "\u0623\u0645\u0627\u0646\u0629") : `${n} ${n === 1 ? "Amanah" : "Amanahs"}`;
var munisText = (n, lang) => lang === "ar" ? arCount(n, "\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062D\u062F\u0629", "\u0628\u0644\u062F\u064A\u062A\u0627\u0646", "\u0628\u0644\u062F\u064A\u0627\u062A", "\u0628\u0644\u062F\u064A\u0629") : `${n} ${n === 1 ? "municipality" : "municipalities"}`;
function describeGeoScope(scope, lang = "ar", hierarchy = GEO_HIERARCHY) {
  const ar = lang !== "en";
  const n = normalizeGeoScope(scope);
  if (n.all) return ar ? "\u0643\u0644 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A" : "All Amanahs and municipalities";
  const suffix = [];
  if (n.grants.some((g) => g.direct)) suffix.push(ar ? "\u0645\u0628\u0627\u0634\u0631" : "direct");
  if (n.grants.some((g) => g.notSpecified)) suffix.push(ar ? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629" : "not specified");
  if (n.nonMunicipal) suffix.push(ar ? "\u062C\u0647\u0627\u062A \u063A\u064A\u0631 \u0628\u0644\u062F\u064A\u0629" : "non-municipal entities");
  if (!n.grants.length) return n.nonMunicipal ? ar ? "\u0627\u0644\u062C\u0647\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0641\u0642\u0637" : "Non-municipal entities only" : ar ? "\u0628\u0644\u0627 \u0646\u0637\u0627\u0642 \u062C\u063A\u0631\u0627\u0641\u064A" : "No geographic access";
  let base = amanahsText(n.grants.length, lang);
  const withMunis = n.grants.filter((g) => g.municipalities === "all" || g.municipalities.length > 0);
  if (withMunis.length) base += ` \xB7 ${n.grants.every((g) => g.municipalities === "all") ? ar ? "\u0643\u0644 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A" : "all municipalities" : munisText(geoScopeMunicipalityCount(n, hierarchy), lang)}`;
  return suffix.length ? `${base} ${suffix.map((s) => `+ ${s}`).join(" ")}` : base;
}
var fnv = (s, seed) => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
};
function geoScopeKey(scope) {
  const n = normalizeGeoScope(scope);
  if (n.all) return "ALL";
  const body = n.grants.map((g) => `${g.amanah}:${g.municipalities === "all" ? "*" : g.municipalities.join(",")}:${g.direct ? 1 : 0}${g.notSpecified ? 1 : 0}`).join(";") + (n.nonMunicipal ? "|N" : "");
  return body.length <= 120 ? `G(${body})` : `G#${fnv(body, 2166136261)}${fnv(body, 5381)}.${body.length}`;
}

// src/data/plans/planAccess.js
var entityUniverse = () => appropriationKeys().filter((k) => k !== HQ_KEY);
var isAmanah2 = (k) => GEO_HIERARCHY.has(k);
var uniq = (a) => [...new Set(a)];
function scopeEntityKeys(scope, universe = entityUniverse()) {
  if (scope?.kind === "ministry") return [...universe];
  if (scope?.kind === "entities" && Array.isArray(scope.entityKeys)) return uniq(scope.entityKeys.filter((k) => typeof k === "string"));
  return [];
}
function requiredGeoScope(planScope2, universe = entityUniverse()) {
  const keys = scopeEntityKeys(planScope2, universe);
  if (!keys.length) return null;
  if (keys.some((k) => !universe.includes(k))) return null;
  const am = keys.filter(isAmanah2);
  return normalizeGeoScope({ all: false, grants: am.map(entireAmanahGrant), nonMunicipal: keys.some((k) => !isAmanah2(k)) });
}
function mutateDecision(geoScope, planScope2, { readOnly = false, municipalities = null } = {}) {
  if (readOnly) return { ok: false, reason: "read_only_role" };
  const need = requiredGeoScope(planScope2);
  if (!need) return { ok: false, reason: "unknown_scope" };
  if (!geoScopeSubset(need, geoScope)) return { ok: false, reason: "scope" };
  if (Array.isArray(municipalities)) {
    const bad = municipalRowsOutsideGrants(geoScope, municipalities);
    if (bad.length) return { ok: false, reason: "municipality", municipalities: bad };
  }
  return { ok: true, reason: null };
}
function visibleEntityKeysOfScope(geoScope, universe = entityUniverse()) {
  const s = normalizeGeoScope(geoScope);
  if (s.all) return [...universe];
  const am = new Set(s.grants.map((g) => g.amanah));
  return universe.filter((k) => isAmanah2(k) ? am.has(k) : s.nonMunicipal === true);
}
function canViewScope(geoScope, planScope2) {
  const s = normalizeGeoScope(geoScope);
  if (s.all) return true;
  const keys = scopeEntityKeys(planScope2);
  if (!keys.length) return false;
  const vis = new Set(visibleEntityKeysOfScope(s));
  return keys.some((k) => vis.has(k));
}
var canSetReference = (geoScope, { readOnly = false } = {}) => !readOnly && normalizeGeoScope(geoScope).all === true;
var muniIdsOf = (entityKey) => municipalitiesOf(entityKey).map((m) => m.refId);
function municipalCoverage(geoScope, entityKey) {
  const s = normalizeGeoScope(geoScope);
  const ids = muniIdsOf(entityKey);
  const none = { entityKey, covered: false, whole: false, all: false, muniIds: [], direct: false, notSpecified: false };
  if (s.all) return { entityKey, covered: true, whole: true, all: true, muniIds: ids, direct: true, notSpecified: true };
  if (!isAmanah2(entityKey)) {
    const ok = s.nonMunicipal === true;
    return ok ? { ...none, covered: true, whole: true } : none;
  }
  const g = s.grants.find((x) => x.amanah === entityKey);
  if (!g) return none;
  const list2 = g.municipalities === "all" ? ids : ids.filter((r) => g.municipalities.includes(r));
  const all = g.municipalities === "all" || ids.length > 0 && list2.length === ids.length;
  return { entityKey, covered: true, whole: all && g.direct === true && g.notSpecified === true, all, muniIds: list2, direct: g.direct === true, notSpecified: g.notSpecified === true };
}
var authorisedMunicipalities = (geoScope, entityKey) => municipalCoverage(geoScope, entityKey).muniIds;
var canViewMunicipality = (geoScope, entityKey, muniId) => typeof muniId === "string" && authorisedMunicipalities(geoScope, entityKey).includes(muniId);
var municipalRowsOutsideGrants = (geoScope, rows) => (Array.isArray(rows) ? rows : []).filter((r) => !canViewMunicipality(geoScope, r?.entityKey, r?.muniId));

// src/data/plans/planRules.js
var ALLOCATION_ORIGINS = ["manual", "distributed", "migrated", "seed", "derived"];
var MUNICIPAL_ORIGINS = ["manual", "distributed"];
var UNALLOCATED_TO_MUNICIPALITIES_LABEL = Object.freeze({ ar: "\u063A\u064A\u0631 \u0645\u0648\u0632\u0639 \u0639\u0644\u0649 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A", en: "Not distributed to municipalities" });
var NO_MUNICIPAL_TARGET_LABEL = Object.freeze({ ar: "\u0644\u0645 \u064A\u064F\u062D\u062F\u062F \u0645\u0633\u062A\u0647\u062F\u0641 \u0644\u0647\u0630\u0647 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", en: "No target has been set for this municipality" });
var EQUAL_PROFILE_LABEL = Object.freeze({ ar: "\u062A\u0648\u0632\u064A\u0639 \u0645\u062A\u0633\u0627\u0648\u064D \u2014 \u0627\u0641\u062A\u0631\u0627\u0636", en: "Equal split \u2014 assumption" });
var MASKED_TARGET_LABEL = Object.freeze({ ar: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062C\u0647\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0643", en: "Total of the entities available to you" });
var clone = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
var isObj2 = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var T2 = (ar, en) => ({ ar, en });
var YM = /^\d{4}-(0[1-9]|1[0-2])$/;
var str = (x) => typeof x === "string" ? x.trim() : "";
var uniq2 = (a) => [...new Set(a)];
var numOrNull = (v) => {
  if (v === null || v === void 0 || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
};
function emptyContent({ name = "", scope = { kind: "ministry" }, period = null, year = APPROPRIATION_YEAR } = {}) {
  return normalizeContent({ name, scope, period: period || fiscalYearPeriod(year), target: { amount: null }, allocations: [], distribution: { profile: null }, advanced: {} });
}
function normDistribution(d) {
  const profile = d?.profile === "equal" || d?.profile === "manual" ? d.profile : null;
  if (profile !== "manual") return { profile };
  const weights = {};
  if (isObj2(d.weights)) for (const k of Object.keys(d.weights).sort()) {
    if (!YM.test(k)) continue;
    const n = numOrNull(d.weights[k]);
    weights[k] = Number.isFinite(n) ? Math.round(n) : 0;
  }
  return { profile, weights };
}
function normBaseline(b) {
  if (!isObj2(b) || b.kind !== "remaining_of_annual") return null;
  const int = (v) => {
    const n = numOrNull(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  };
  const bi22 = (o) => isObj2(o) ? { ar: str(o.ar), en: str(o.en) } : null;
  const out = {
    kind: "remaining_of_annual",
    cutoff: str(b.cutoff),
    annualPlanId: str(b.annualPlanId) || null,
    annualPlanRevision: Number.isInteger(b.annualPlanRevision) ? b.annualPlanRevision : null,
    derivedAt: typeof b.derivedAt === "string" ? b.derivedAt : null,
    annualPeriod: isObj2(b.annualPeriod) ? { start: str(b.annualPeriod.start), end: str(b.annualPeriod.end) } : null,
    convention: bi22(b.convention),
    note: bi22(b.note),
    entities: (Array.isArray(b.entities) ? b.entities : []).filter(isObj2).map((e) => ({ entityKey: str(e.entityKey), annual: int(e.annual), actual: int(e.actual), remaining: int(e.remaining), surplus: int(e.surplus) })),
    annualTarget: int(b.annualTarget),
    actualToCutoff: int(b.actualToCutoff),
    remaining: int(b.remaining),
    surplus: int(b.surplus)
  };
  return out;
}
function normalizeContent(c) {
  const src = isObj2(c) ? c : {};
  const scope = src.scope?.kind === "ministry" ? { kind: "ministry" } : { kind: "entities", entityKeys: Array.isArray(src.scope?.entityKeys) ? uniq2(src.scope.entityKeys.filter((k) => typeof k === "string").map((k) => k.trim()).filter(Boolean)) : [] };
  const p = isObj2(src.period) ? src.period : {};
  const start = typeof p.start === "string" ? p.start.trim() : null;
  const end = typeof p.end === "string" ? p.end.trim() : null;
  const preset = p.preset !== "range" && isCalendarYear({ start, end }) ? "fiscal-year" : "range";
  const amt = numOrNull(src.target?.amount);
  const target = { amount: Number.isFinite(amt) ? Math.round(amt) : null };
  const b = src.target?.basis;
  if (isObj2(b) && b.method === "budget_x_coverage" && Number.isFinite(Number(b.coverage)) && Number.isFinite(Number(b.budget))) target.basis = { method: "budget_x_coverage", coverage: Number(b.coverage), budget: Math.round(Number(b.budget)), at: typeof b.at === "string" ? b.at : null, ...Number.isInteger(b.carriedFromYear) ? { carriedFromYear: b.carriedFromYear } : {} };
  const allocations = (Array.isArray(src.allocations) ? src.allocations : []).filter(isObj2).map((a) => {
    const n = numOrNull(a.amount);
    const row = { entityKey: str(a.entityKey), amount: Number.isFinite(n) ? Math.round(n) : 0, origin: ALLOCATION_ORIGINS.includes(a.origin) ? a.origin : "manual" };
    const note = str(a.note);
    if (note) row.note = note;
    return row;
  });
  const out = { name: str(src.name), scope, period: { start, end, preset }, target, allocations, distribution: normDistribution(src.distribution), advanced: {} };
  const mrows = (Array.isArray(src.municipalAllocations) ? src.municipalAllocations : []).filter(isObj2).map((a) => {
    const n = numOrNull(a.amount);
    const row = { entityKey: str(a.entityKey), muniId: str(a.muniId), amount: Number.isFinite(n) ? Math.round(n) : 0, origin: MUNICIPAL_ORIGINS.includes(a.origin) ? a.origin : "manual" };
    const note = str(a.note);
    if (note) row.note = note;
    return row;
  });
  if (mrows.length) out.municipalAllocations = mrows;
  if (isObj2(src.entityDistributions)) {
    const ed = {};
    for (const k of Object.keys(src.entityDistributions)) {
      const d = normDistribution(src.entityDistributions[k]);
      if (d.profile) ed[k] = d;
    }
    if (Object.keys(ed).length) out.entityDistributions = ed;
  }
  const bl = normBaseline(src.baseline);
  if (bl) out.baseline = bl;
  const cr = numOrNull(src.advanced?.collectionRate);
  if (Number.isFinite(cr)) out.advanced.collectionRate = cr;
  const bt = numOrNull(src.advanced?.billingTarget);
  if (Number.isFinite(bt)) out.advanced.billingTarget = Math.round(bt);
  return out;
}
var isSavedRecord = (plan2) => isObj2(plan2) && isObj2(plan2.content);
function planView(plan2, which = "inForce") {
  if (!isSavedRecord(plan2)) return null;
  if (which === "working") return null;
  let content;
  let versionId;
  let versionNumber;
  let isHistorical = false;
  if (which === "inForce" || which === "current" || which == null) {
    content = plan2.content;
    versionNumber = plan2.revision ?? null;
    versionId = `${plan2.id}@r${plan2.revision ?? 0}`;
  } else {
    const s = (plan2.versions || []).find((x) => x.n === Number(which));
    if (!s || !s.content) return null;
    content = s.content;
    versionNumber = s.n;
    versionId = `${plan2.id}@s${s.n}`;
    isHistorical = s.revision == null ? true : s.revision !== plan2.revision;
  }
  const c = clone(content);
  return { planId: plan2.id, versionId, versionNumber, name: c.name, ...plan2.nameEn ? { nameEn: plan2.nameEn } : {}, state: "active", origin: plan2.origin, period: c.period, scope: c.scope, content: c, isHistorical, isSystem: !!plan2.isSystem, labelSource: T2(c.name, c.name) };
}
var err = (code, path5, params, ar, en) => ({ code, path: path5, params: params || {}, ar, en });
function validateDraft(content, ctx = {}) {
  const errors = [];
  const universe = ctx.universe || entityUniverse();
  const c = isObj2(content) ? content : {};
  const p = isObj2(c.period) ? c.period : {};
  if (!isISODate(p.start)) errors.push(err("period_invalid_start", "period.start", {}, "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0641\u062A\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "The period start date is not valid"));
  if (!isISODate(p.end)) errors.push(err("period_invalid_end", "period.end", {}, "\u062A\u0627\u0631\u064A\u062E \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0641\u062A\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "The period end date is not valid"));
  const periodOk = isISODate(p.start) && isISODate(p.end);
  if (periodOk && p.end < p.start) errors.push(err("period_end_before_start", "period.end", { start: p.start, end: p.end }, "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0642\u0628\u0644 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0628\u062F\u0627\u064A\u0629", "The end date is before the start date"));
  const rows = periodValid({ start: p.start, end: p.end }) ? monthRows({ start: p.start, end: p.end }) : [];
  const sc = isObj2(c.scope) ? c.scope : {};
  let keys = [];
  if (sc.kind === "entities") {
    keys = Array.isArray(sc.entityKeys) ? sc.entityKeys : [];
    keys.forEach((k, i) => {
      if (typeof k !== "string" || !universe.includes(k.trim())) errors.push(err("unknown_entity", `scope.entityKeys.${i}`, { entityKey: k }, "\u062C\u0647\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629 \u0641\u064A \u0646\u0637\u0627\u0642 \u0627\u0644\u062E\u0637\u0629", "Unknown entity in the plan scope"));
    });
  } else if (sc.kind !== "ministry") errors.push(err("scope_invalid", "scope", {}, "\u0646\u0637\u0627\u0642 \u0627\u0644\u062E\u0637\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "The plan scope is not valid"));
  if (ctx.actorScope !== void 0 || ctx.readOnly) {
    const d = mutateDecision(ctx.actorScope, sc, { readOnly: !!ctx.readOnly });
    if (!d.ok && d.reason !== "unknown_scope") errors.push(err(d.reason === "read_only_role" ? "read_only_role" : "scope_forbidden", "scope", { reason: d.reason }, "\u0646\u0637\u0627\u0642 \u0627\u0644\u062E\u0637\u0629 \u062E\u0627\u0631\u062C \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643", "The plan scope is outside your authority"));
  }
  const bad = (v) => {
    const n = numOrNull(v);
    return n !== null && (!Number.isFinite(n) || n < 0);
  };
  if (bad(c.target?.amount)) errors.push(err("invalid_amount", "target.amount", {}, "\u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u064B\u0627 \u063A\u064A\u0631 \u0633\u0627\u0644\u0628", "The target must be a non-negative number"));
  const seen = /* @__PURE__ */ new Set();
  (Array.isArray(c.allocations) ? c.allocations : []).forEach((a, i) => {
    const key = str(a?.entityKey);
    if (!universe.includes(key)) errors.push(err("unknown_entity", `allocations.${i}.entityKey`, { entityKey: a?.entityKey }, "\u062C\u0647\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629 \u0641\u064A \u0627\u0644\u062A\u062E\u0635\u064A\u0635", "Unknown entity in the allocation"));
    else if (seen.has(key)) errors.push(err("duplicate_allocation", `allocations.${i}.entityKey`, { entityKey: key }, "\u0627\u0644\u062C\u0647\u0629 \u0645\u0643\u0631\u0631\u0629 \u0641\u064A \u0627\u0644\u062A\u062E\u0635\u064A\u0635", "The entity appears twice in the allocation"));
    seen.add(key);
    const n = numOrNull(a?.amount);
    if (n === null || !Number.isFinite(n) || n < 0) errors.push(err("invalid_amount", `allocations.${i}.amount`, { entityKey: key }, "\u0645\u0628\u0644\u063A \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u064B\u0627 \u063A\u064A\u0631 \u0633\u0627\u0644\u0628", "The allocation amount must be a non-negative number"));
  });
  if (c.municipalAllocations != null && !Array.isArray(c.municipalAllocations)) errors.push(err("municipal_invalid", "municipalAllocations", {}, "\u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "The municipal allocations are not valid"));
  const scopeSet = new Set(sc.kind === "ministry" ? universe : keys.filter((k) => typeof k === "string").map((k) => k.trim()));
  const seenM = /* @__PURE__ */ new Set();
  (Array.isArray(c.municipalAllocations) ? c.municipalAllocations : []).forEach((m, i) => {
    const path5 = `municipalAllocations.${i}`;
    if (!isObj2(m)) {
      errors.push(err("municipal_invalid", path5, {}, "\u0635\u0641 \u062A\u062E\u0635\u064A\u0635 \u0628\u0644\u062F\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "Invalid municipal allocation row"));
      return;
    }
    const ek = str(m.entityKey);
    const mid = str(m.muniId);
    if (!universe.includes(ek)) errors.push(err("unknown_entity", `${path5}.entityKey`, { entityKey: m.entityKey }, "\u062C\u0647\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629 \u0641\u064A \u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Unknown entity in the municipal allocation"));
    else if (!scopeSet.has(ek)) errors.push(err("municipal_entity_not_in_scope", `${path5}.entityKey`, { entityKey: ek }, "\u0627\u0644\u062C\u0647\u0629 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0627\u0644\u062E\u0637\u0629", "The entity is outside the plan scope"));
    const known = mid ? municipalityByRef(mid) : null;
    if (!known) errors.push(err("unknown_municipality", `${path5}.muniId`, { muniId: m.muniId }, "\u0628\u0644\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629", "Unknown municipality"));
    else if (universe.includes(ek) && !municipalitiesOf(ek).some((x) => x.refId === mid)) errors.push(err("municipality_not_in_entity", `${path5}.muniId`, { entityKey: ek, muniId: mid }, "\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0644\u0627 \u062A\u062A\u0628\u0639 \u0647\u0630\u0647 \u0627\u0644\u0623\u0645\u0627\u0646\u0629", "The municipality does not belong to this Amanah"));
    const dk = `${ek}\0${mid}`;
    if (seenM.has(dk)) errors.push(err("duplicate_municipal_allocation", `${path5}.muniId`, { entityKey: ek, muniId: mid }, "\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0645\u0643\u0631\u0631\u0629 \u0641\u064A \u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0623\u0645\u0627\u0646\u0629", "The municipality appears twice in the Amanah allocation"));
    seenM.add(dk);
    const n = numOrNull(m.amount);
    if (n === null || !Number.isFinite(n) || n < 0) errors.push(err("invalid_amount", `${path5}.amount`, { entityKey: ek, muniId: mid }, "\u0645\u0628\u0644\u063A \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u064B\u0627 \u063A\u064A\u0631 \u0633\u0627\u0644\u0628", "The municipal amount must be a non-negative number"));
    else if (!Number.isInteger(n)) errors.push(err("amount_not_integer", `${path5}.amount`, { entityKey: ek, muniId: mid }, "\u0645\u0628\u0644\u063A \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0639\u062F\u062F\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627 \u0628\u0627\u0644\u0631\u064A\u0627\u0644", "The municipal amount must be a whole number of riyals"));
  });
  const checkDist = (d, path5) => {
    if (!isObj2(d)) return;
    if (d.profile != null && d.profile !== "equal" && d.profile !== "manual") errors.push(err("invalid_profile", `${path5}.profile`, {}, "\u0646\u0645\u0637 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "The distribution profile is not valid"));
    if (d.profile === "manual" && isObj2(d.weights)) for (const ym of Object.keys(d.weights)) {
      const n = numOrNull(d.weights[ym]);
      if (!YM.test(ym)) {
        errors.push(err("month_outside_period", `${path5}.weights.${ym}`, { ym }, "\u0634\u0647\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0641\u064A \u0627\u0644\u062A\u0648\u0632\u064A\u0639", "Invalid month in the distribution"));
        continue;
      }
      if (n === null || !Number.isFinite(n) || n < 0) errors.push(err("invalid_weight", `${path5}.weights.${ym}`, { ym }, "\u0648\u0632\u0646 \u0627\u0644\u0634\u0647\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u064B\u0627 \u063A\u064A\u0631 \u0633\u0627\u0644\u0628", "The month weight must be a non-negative number"));
      if (rows.length && !rows.some((r) => r.ym === ym)) errors.push(err("month_outside_period", `${path5}.weights.${ym}`, { ym }, "\u0634\u0647\u0631 \u062E\u0627\u0631\u062C \u0641\u062A\u0631\u0629 \u0627\u0644\u062E\u0637\u0629", "Month outside the plan period"));
    }
  };
  checkDist(c.distribution, "distribution");
  if (isObj2(c.entityDistributions)) for (const k of Object.keys(c.entityDistributions)) {
    if (!universe.includes(k)) errors.push(err("unknown_entity", `entityDistributions.${k}`, { entityKey: k }, "\u062C\u0647\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629 \u0641\u064A \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0634\u0647\u0631\u064A", "Unknown entity in the monthly distribution"));
    checkDist(c.entityDistributions[k], `entityDistributions.${k}`);
  }
  const cr = numOrNull(c.advanced?.collectionRate);
  if (cr !== null && !(Number.isFinite(cr) && cr > 0 && cr <= 1)) errors.push(err("invalid_collection_rate", "advanced.collectionRate", {}, "\u0646\u0633\u0628\u0629 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0628\u064A\u0646 0 \u0648100%", "The collection rate must be above 0 and at most 100%"));
  if (bad(c.advanced?.billingTarget)) errors.push(err("invalid_amount", "advanced.billingTarget", {}, "\u0645\u0633\u062A\u0647\u062F\u0641 \u0627\u0644\u0641\u0648\u062A\u0631\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u064B\u0627 \u063A\u064A\u0631 \u0633\u0627\u0644\u0628", "The billing target must be a non-negative number"));
  return { ok: errors.length === 0, errors };
}
function allocationSummary(content) {
  const c = content || {};
  const target = Math.round(Number(c.target?.amount) || 0);
  const rows = (c.allocations || []).map((a) => ({ entityKey: a.entityKey, amount: Math.round(a.amount) || 0, origin: a.origin || "manual", note: a.note || null }));
  const allocated = rows.reduce((t, r) => t + r.amount, 0);
  return {
    target,
    hasTarget: target > 0,
    allocated,
    unallocated: Math.max(0, target - allocated),
    excess: Math.max(0, allocated - target),
    complete: target > 0 && allocated === target,
    count: rows.length,
    rows: rows.map((r) => ({ ...r, share: target > 0 ? r.amount / target : null }))
  };
}
var municipalRowsOf = (content, entityKey = null) => (Array.isArray(content?.municipalAllocations) ? content.municipalAllocations : []).filter((m) => m && (entityKey == null || m.entityKey === entityKey));
var muniName = (m) => ({ ar: m.ar, en: m.en });
function foldMunicipal(content, entityKey) {
  const by = /* @__PURE__ */ new Map();
  for (const r of municipalRowsOf(content, entityKey)) {
    const amount = Math.round(Number(r.amount)) || 0;
    const cur = by.get(r.muniId);
    if (cur) cur.amount += amount;
    else by.set(r.muniId, { muniId: r.muniId, amount, origin: r.origin || "manual", note: r.note || null });
  }
  return by;
}
function municipalSummary(content, entityKey) {
  const c = content || {};
  const list2 = municipalitiesOf(entityKey);
  const hidden = Array.isArray(c.maskedAmanahKeys) && c.maskedAmanahKeys.includes(entityKey);
  const seeIds = hidden ? new Set(c.municipalVisibility?.[entityKey] || []) : null;
  const al = (c.allocations || []).find((a) => a.entityKey === entityKey);
  const amanahAmount = hidden ? null : Math.round(Number(al?.amount)) || 0;
  const by = foldMunicipal(c, entityKey);
  const allocated = [...by.values()].reduce((t, r) => t + r.amount, 0);
  const share = (amount) => amanahAmount > 0 ? amount / amanahAmount : null;
  const order = new Map(list2.map((m, i) => [m.refId, i]));
  const rows = [...by.values()].sort((a, b) => (order.has(a.muniId) ? order.get(a.muniId) : 1e9) - (order.has(b.muniId) ? order.get(b.muniId) : 1e9) || (a.muniId < b.muniId ? -1 : 1)).map((r) => {
    const m = order.has(r.muniId) ? list2[order.get(r.muniId)] : null;
    return { muniId: r.muniId, name: m ? muniName(m) : null, amount: r.amount, share: share(r.amount), origin: r.origin, note: r.note, known: !!m };
  });
  const municipalities = list2.filter((m) => !seeIds || seeIds.has(m.refId)).map((m) => {
    const r = by.get(m.refId);
    return { muniId: m.refId, name: muniName(m), amount: r ? r.amount : null, origin: r ? r.origin : null, share: r ? share(r.amount) : null, hasTarget: !!r, label: r ? null : NO_MUNICIPAL_TARGET_LABEL };
  });
  return {
    entityKey,
    hasMunicipalities: list2.length > 0,
    hasAllocation: !!al,
    amanahHidden: hidden,
    amanahAmount,
    allocated,
    unallocated: hidden ? null : Math.max(0, amanahAmount - allocated),
    unallocatedLabel: UNALLOCATED_TO_MUNICIPALITIES_LABEL,
    excess: hidden ? null : Math.max(0, allocated - amanahAmount),
    complete: !hidden && amanahAmount > 0 && allocated === amanahAmount,
    rows,
    municipalities,
    count: by.size
  };
}
var CHECK_LABELS = {
  target_positive: T2("\u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631", "The target is above zero"),
  allocation_complete: T2("\u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u064A\u0633\u0627\u0648\u064A \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0625\u0644\u0649 \u0627\u0644\u0631\u064A\u0627\u0644", "The allocation equals the target to the riyal"),
  allocations_in_scope: T2("\u0643\u0644 \u0627\u0644\u062A\u062E\u0635\u064A\u0635\u0627\u062A \u0636\u0645\u0646 \u0646\u0637\u0627\u0642 \u0627\u0644\u062E\u0637\u0629", "Every allocation is inside the plan scope"),
  profile_explicit: T2("\u0646\u0645\u0637 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0634\u0647\u0631\u064A \u0645\u062D\u062F\u062F \u0635\u0631\u0627\u062D\u0629\u064B", "The monthly profile is chosen explicitly"),
  months_complete: T2("\u0627\u0644\u0623\u0634\u0647\u0631 \u0627\u0644\u064A\u062F\u0648\u064A\u0629 \u062A\u0633\u0627\u0648\u064A 100% \u0628\u0627\u0644\u0636\u0628\u0637", "Manual months add up to exactly 100%"),
  actor_authorised: T2("\u0623\u0646\u062A \u0645\u062E\u0648\u0651\u0644 \u0639\u0644\u0649 \u0643\u0644 \u062C\u0647\u0627\u062A \u0627\u0644\u062E\u0637\u0629", "You are authorised for every entity of the plan"),
  municipal_within_entity: T2("\u0645\u062C\u0645\u0648\u0639 \u062A\u062E\u0635\u064A\u0635\u0627\u062A \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A \u0644\u0627 \u064A\u062A\u062C\u0627\u0648\u0632 \u0645\u062E\u0635\u0635 \u0627\u0644\u0623\u0645\u0627\u0646\u0629", "The municipal allocations do not exceed the Amanah's allocation")
};
var BASE_SAVE_CHECK_IDS = ["target_positive", "allocation_complete", "allocations_in_scope", "profile_explicit", "months_complete", "actor_authorised"];
var SAVE_CHECK_IDS = [...BASE_SAVE_CHECK_IDS, "municipal_within_entity"];
function saveChecks(content, ctx = {}) {
  const c = normalizeContent(content);
  const universe = ctx.universe || entityUniverse();
  const sum2 = allocationSummary(c);
  const out = [];
  const add = (id, ok, params = {}) => out.push({ id, ok: !!ok, params, label: CHECK_LABELS[id] });
  add("target_positive", sum2.hasTarget, { target: sum2.target });
  add("allocation_complete", sum2.complete, { target: sum2.target, allocated: sum2.allocated, unallocated: sum2.unallocated, excess: sum2.excess });
  const scopeKeys = scopeEntityKeys(c.scope, universe);
  const outside = c.scope?.kind === "ministry" ? (c.allocations || []).map((a) => a.entityKey).filter((k) => !universe.includes(k)) : (c.allocations || []).map((a) => a.entityKey).filter((k) => !scopeKeys.includes(k));
  const emptyScope = c.scope?.kind !== "ministry" && scopeKeys.length === 0;
  add("allocations_in_scope", outside.length === 0 && !emptyScope, { outside, emptyScope });
  const rows = monthRows(c.period);
  const planProfile = c.distribution?.profile;
  const overrides = Object.entries(c.entityDistributions || {});
  const profilesOk = (planProfile === "equal" || planProfile === "manual") && overrides.every(([, d2]) => d2.profile === "equal" || d2.profile === "manual") && rows.length > 0;
  add("profile_explicit", profilesOk, { profile: planProfile || null });
  const incomplete = [];
  if (planProfile === "manual") {
    const t = weightsTotal(c.distribution, rows);
    if (!t.complete) incomplete.push({ entityKey: null, total: t.total, remaining: t.remaining });
  }
  for (const [k, d2] of overrides) if (d2.profile === "manual") {
    const t = weightsTotal(d2, rows);
    if (!t.complete) incomplete.push({ entityKey: k, total: t.total, remaining: t.remaining });
  }
  add("months_complete", incomplete.length === 0, { incomplete, applicable: planProfile === "manual" || overrides.some(([, d2]) => d2.profile === "manual") });
  const d = mutateDecision(ctx.actorScope, c.scope, { readOnly: !!ctx.readOnly });
  add("actor_authorised", d.ok, { reason: d.reason });
  if (municipalRowsOf(c).length) {
    const keys = uniq2(municipalRowsOf(c).map((m) => m.entityKey));
    const over = [];
    for (const k of keys) {
      const s2 = municipalSummary(c, k);
      if (s2.excess > 0) over.push({ entityKey: k, amanahAmount: s2.amanahAmount, allocated: s2.allocated, excess: s2.excess });
    }
    add("municipal_within_entity", over.length === 0, { entities: over, entityCount: keys.length });
  }
  const failed = out.filter((x) => !x.ok).map((x) => x.id);
  return { ok: failed.length === 0, checks: out, failed };
}
var PLAN_NAME_MAX = 80;
var nameKey = (s) => String(s).trim().normalize("NFC").toLowerCase();
function validatePlanName(name, visibleNames2 = []) {
  const s = typeof name === "string" ? name.trim() : "";
  const errors = [];
  if (!s) errors.push(err("name_required", "name", {}, "\u0627\u0633\u0645 \u0627\u0644\u062E\u0637\u0629 \u0645\u0637\u0644\u0648\u0628", "The plan name is required"));
  else if (Array.from(s).length > PLAN_NAME_MAX) errors.push(err("name_too_long", "name", { max: PLAN_NAME_MAX }, `\u0627\u0633\u0645 \u0627\u0644\u062E\u0637\u0629 \u064A\u062C\u0628 \u0623\u0644\u0627 \u064A\u062A\u062C\u0627\u0648\u0632 ${PLAN_NAME_MAX} \u062D\u0631\u0641\u064B\u0627`, `The plan name must not exceed ${PLAN_NAME_MAX} characters`));
  else {
    const k = nameKey(s);
    if ((Array.isArray(visibleNames2) ? visibleNames2 : []).some((n) => (typeof n === "string" ? n : n && n.name) != null && nameKey(typeof n === "string" ? n : n.name) === k)) errors.push(err("name_taken", "name", {}, "\u064A\u0648\u062C\u062F \u0644\u062F\u064A\u0643 \u062E\u0637\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645\u061B \u0627\u062E\u062A\u0631 \u0627\u0633\u0645\u064B\u0627 \u0622\u062E\u0631", "A plan with this name already exists; choose another name"));
  }
  return { ok: errors.length === 0, name: s, errors };
}
var SYSTEM_PLAN_LABEL = Object.freeze({ ar: "\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0644\u0644\u0646\u0638\u0627\u0645 \xB7 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629", en: "System default plan \xB7 illustrative data" });
var planNameOf = (p) => String(p?.name ?? p?.content?.name ?? "");
function defaultPlanResolution({ plans = [], userDefaultPlanId = null, globalDefaultPlanId, visibleIds = null } = {}) {
  const vis = Array.isArray(visibleIds) || visibleIds instanceof Set ? new Set(visibleIds) : null;
  const list2 = (Array.isArray(plans) ? plans : []).filter((p) => p && typeof p.id === "string" && (!vis || vis.has(p.id)));
  const byName = (a, b) => {
    const x = planNameOf(a);
    const y = planNameOf(b);
    return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1;
  };
  const sorted = [...list2].sort(byName);
  const user = userDefaultPlanId && list2.some((p) => p.id === userDefaultPlanId) ? userDefaultPlanId : null;
  const firstSystem = sorted.find((p) => p.isSystem)?.id || null;
  const configured = globalDefaultPlanId === void 0 ? firstSystem : globalDefaultPlanId;
  const global = configured && list2.some((p) => p.id === configured) ? configured : null;
  const fallback = firstSystem || sorted[0]?.id || null;
  const effectiveDefaultPlanId = user || global || fallback || null;
  return { userDefaultPlanId: user, globalDefaultPlanId: global, systemDefaultPlanId: global, effectiveDefaultPlanId, source: user ? "personal" : global ? "global" : fallback ? "fallback" : "none" };
}
var isAmanahKey = (k) => GEO_HIERARCHY.has(k);
var contentEntityKeys = (c, universe) => uniq2([...scopeEntityKeys(c?.scope, universe), ...(c?.allocations || []).map((a) => a.entityKey), ...municipalRowsOf(c).map((m) => m.entityKey)]);
function maskContent(c, vis, partial = [], geo = null) {
  const out = clone(c);
  const part = new Set(partial);
  out.allocations = (out.allocations || []).filter((a) => vis.has(a.entityKey) && !part.has(a.entityKey));
  let visibleTotal = out.allocations.reduce((t, a) => t + (a.amount || 0), 0);
  if (c.municipalAllocations !== void 0) {
    const visIds = {};
    for (const k of part) visIds[k] = authorisedMunicipalities(geo, k);
    out.municipalAllocations = municipalRowsOf(c).filter((m) => vis.has(m.entityKey) && (!part.has(m.entityKey) || visIds[m.entityKey].includes(m.muniId))).map(clone);
    if (!out.municipalAllocations.length) delete out.municipalAllocations;
    for (const m of out.municipalAllocations || []) if (part.has(m.entityKey)) visibleTotal += m.amount || 0;
  }
  const contributions = out.allocations.length + (out.municipalAllocations || []).filter((m) => part.has(m.entityKey)).length;
  out.target = { amount: part.size && !contributions ? null : visibleTotal, masked: true, label: MASKED_TARGET_LABEL };
  out.advanced = {};
  if (out.baseline) {
    if (part.size) delete out.baseline;
    else {
      const es = out.baseline.entities.filter((e) => vis.has(e.entityKey));
      const sm = (k) => es.reduce((t, e) => t + (e[k] || 0), 0);
      out.baseline = { ...out.baseline, entities: es, annualTarget: sm("annual"), actualToCutoff: sm("actual"), remaining: sm("remaining"), surplus: sm("surplus") };
    }
  }
  if (part.size) {
    out.maskedAmanahKeys = [...part];
    out.municipalVisibility = {};
    for (const k of part) out.municipalVisibility[k] = authorisedMunicipalities(geo, k);
  }
  if (out.scope?.kind === "entities") out.scope = { kind: "entities", entityKeys: out.scope.entityKeys.filter((k) => vis.has(k)) };
  if (out.entityDistributions) {
    const ed = {};
    for (const k of Object.keys(out.entityDistributions)) if (vis.has(k)) ed[k] = out.entityDistributions[k];
    if (Object.keys(ed).length) out.entityDistributions = ed;
    else delete out.entityDistributions;
  }
  return out;
}
function maskPlanForViewer(plan2, visibleEntityKeys, geoScope) {
  if (!plan2) return plan2;
  const vis = new Set(Array.isArray(visibleEntityKeys) ? visibleEntityKeys : []);
  const universe = entityUniverse();
  const geo = geoScope === void 0 ? null : normalizeGeoScope(geoScope);
  const partialOf = (c) => geo ? contentEntityKeys(c, universe).filter((k) => vis.has(k) && isAmanahKey(k) && !municipalCoverage(geo, k).whole) : [];
  const whole = (c) => {
    const keys = scopeEntityKeys(c?.scope, universe);
    return keys.length > 0 && keys.every((k) => vis.has(k)) && partialOf(c).length === 0;
  };
  const mask = (c) => c && !whole(c) ? maskContent(c, vis, partialOf(c), geo) : clone(c);
  const next = clone(plan2);
  const all = [plan2.content, plan2.working?.content, ...(plan2.versions || []).map((v) => v.content)].filter(Boolean);
  if (plan2.content) next.content = mask(plan2.content);
  if (next.working) next.working = { ...next.working, content: mask(plan2.working.content) };
  next.versions = (plan2.versions || []).map((v) => ({ ...clone(v), ...v.content ? { content: mask(v.content) } : {} }));
  if (all.some((c) => !whole(c))) {
    next.masked = true;
    next.visibleEntityKeys = [...vis];
    next.legacy = null;
    const mo = uniq2(all.flatMap((c) => whole(c) ? [] : partialOf(c)));
    if (mo.length) next.municipalOnlyEntityKeys = mo;
  }
  return next;
}

// src/data/plans/referenceRules.js
var REFERENCE_SOURCE_LABELS = Object.freeze({
  configured: Object.freeze({ ar: "\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629", en: "The configured reference plan" }),
  only_eligible: Object.freeze({ ar: "\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0648\u062D\u064A\u062F\u0629 \u0627\u0644\u0645\u0624\u0647\u0644\u0629", en: "The only eligible plan" })
});
var summary = (p) => {
  const v = planView(p, "inForce");
  return v ? { planId: p.id, name: v.name, versionId: v.versionId, versionNumber: v.versionNumber, scope: v.scope, period: v.period, origin: p.origin, isSystem: !!p.isSystem, plan: p } : null;
};
var isSaved = (p) => !!p && !!p.content && typeof p.content === "object";
function eligibleReferencePlans(year, plans = []) {
  const y = fiscalYearPeriod(year);
  return (plans || []).filter(isSaved).filter((p) => {
    const v = planView(p, "inForce");
    return v && periodsOverlap(v.period, y);
  });
}
function resolveReferencePlan({ year, plans = [], references = {} } = {}) {
  const eligible = eligibleReferencePlans(year, plans);
  const conf = references?.[year] || null;
  if (conf && conf.planId) {
    const p = (plans || []).find((x) => x && x.id === conf.planId);
    let reason = null;
    if (!p) reason = "not_found";
    else if (!eligible.includes(p)) reason = "period_mismatch";
    if (reason) return { state: "reference_invalid", reason, planId: conf.planId, configured: conf };
    const view2 = planView(p, "inForce");
    return { state: "ok", plan: p, view: view2, source: "configured", sourceLabel: REFERENCE_SOURCE_LABELS.configured, versionId: view2.versionId, name: view2.name };
  }
  if (eligible.length === 1) {
    const p = eligible[0];
    const view2 = planView(p, "inForce");
    return { state: "ok", plan: p, view: view2, source: "only_eligible", sourceLabel: REFERENCE_SOURCE_LABELS.only_eligible, versionId: view2.versionId, name: view2.name };
  }
  if (eligible.length > 1) return { state: "ambiguous", candidates: eligible.map(summary).filter(Boolean) };
  return { state: "none" };
}

// src/data/plans/planStore.js
var emptyDefaults = () => ({ userDefaultPlanId: null, globalDefaultPlanId: null, systemDefaultPlanId: null, effectiveDefaultPlanId: null, source: "none" });
var emptyState = () => ({ status: "idle", plans: [], references: {}, defaults: emptyDefaults(), capabilities: null, storage: null, error: null, loadedAt: null, version: 0 });
var state = emptyState();
var snapshot = null;
var memo = /* @__PURE__ */ new Map();
var freeze = () => {
  snapshot = Object.freeze({ ...state });
};
freeze();
var getSnapshot = () => snapshot;
var getPlans = () => state.plans;
var plansStatus = () => state.status;
function referenceFor(year) {
  const y = Number(year);
  if (memo.has(y)) return memo.get(y);
  const r = resolveReferencePlan({ year: y, plans: state.plans, references: state.references });
  memo.set(y, r);
  return r;
}
function referenceViewFor(year) {
  const r = referenceFor(year);
  if (r.state === "ok") return { ...r.view, referenceState: "ok", source: r.source, sourceLabel: r.sourceLabel };
  const { state: s, ...rest } = r;
  return { referenceState: s, state: s, ...rest };
}

// src/utils/money.js
var UNITS = {
  B: { key: "B", div: 1e9, ar: "\u0645\u0644\u064A\u0627\u0631", en: "bn" },
  M: { key: "M", div: 1e6, ar: "\u0645\u0644\u064A\u0648\u0646", en: "M" },
  K: { key: "K", div: 1e3, ar: "\u0623\u0644\u0641", en: "K" },
  S: { key: "S", div: 1, ar: "", en: "" }
};
function pickUnit(maxAbs) {
  const a = Math.abs(Number(maxAbs) || 0);
  if (a >= 9995e5) return UNITS.B;
  if (a >= 999500) return UNITS.M;
  if (a >= 999.5) return UNITS.K;
  return UNITS.S;
}
var unitLabel = (u, lang = "ar") => `${u.key === "S" ? "" : `${lang === "ar" ? u.ar : u.en} `}${lang === "ar" ? "\u0631\u064A\u0627\u0644" : "SAR"}`;
var trim = (s) => s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
var group = (intPart) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function scaled(amountSar, unit = "auto", mode = "card") {
  const a = Number(amountSar);
  if (!Number.isFinite(a)) return "\u2014";
  if (a === 0) return "0";
  const u = unit === "auto" ? pickUnit(a) : unit;
  const sign2 = a < 0 ? "-" : "";
  const x = Math.abs(a) / u.div;
  if (u.key === "S") {
    const [i2, d2] = trim(mode === "card" ? x.toFixed(x < 1 ? 2 : 0) : x.toFixed(2)).split(".");
    return `${sign2}${group(i2)}${d2 ? `.${d2}` : ""}`;
  }
  if (mode === "card") {
    if (x < 5e-3) return `${sign2 ? ">-" : "<"}0.01`;
    const [i2, d2] = trim(x.toFixed(2)).split(".");
    return `${sign2}${group(i2)}${d2 ? `.${d2}` : ""}`;
  }
  const [i, d] = trim(x.toFixed(9)).split(".");
  return `${sign2}${group(i)}${d ? `.${d}` : ""}`;
}
function fmtParts(amountSar, { lang = "ar", unit = "auto", mode = "card" } = {}) {
  const u = unit === "auto" || Number(amountSar) === 0 ? pickUnit(amountSar) : unit;
  return { num: scaled(amountSar, u, mode), label: unitLabel(u, lang), unit: u };
}
function fmtMoney(amountSar, { lang = "ar", mode = "card", unit = "auto", withUnit = true } = {}) {
  if (!Number.isFinite(Number(amountSar))) return "\u2014";
  const p = fmtParts(amountSar, { lang, unit: unit === false || unit === true ? "auto" : unit, mode });
  return withUnit && unit !== false ? `${p.num} ${p.label}` : p.num;
}

// src/data/plans/planBasis.js
var bi = (ar, en) => ({ ar, en });
var fin = (v) => typeof v === "number" && Number.isFinite(v);
var sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
var dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
var EQUAL_ASSUMPTION = bi("\u062A\u0648\u0632\u064A\u0639 \u0645\u062A\u0633\u0627\u0648\u064D \u2014 \u0627\u0641\u062A\u0631\u0627\u0636", "Equal distribution \u2014 an assumption");
var CALENDAR_YEAR_ASSUMPTION = bi("\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u064A\u0646\u0627\u064A\u0631\u2013\u062F\u064A\u0633\u0645\u0628\u0631 \u0627\u0641\u062A\u0631\u0627\u0636 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0645\u0639\u0646\u064A\u0629", "The January\u2013December fiscal year is an assumption pending business confirmation");
var RESTRICTED_LABEL = bi("\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062C\u0647\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0643", "Total of the entities available to you");
var MINISTRY_LABEL = bi("\u0627\u0644\u0648\u0632\u0627\u0631\u0629 (\u0643\u0644 \u0627\u0644\u062C\u0647\u0627\u062A)", "The Ministry (all entities)");
var UNALLOCATED_MUNI_KEY = "__unallocated_muni__";
var UNALLOCATED_MUNI_LABEL = bi("\u063A\u064A\u0631 \u0645\u0648\u0632\u0639 \u0639\u0644\u0649 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A", "Not distributed to municipalities");
var NO_MUNICIPAL_TARGET = bi("\u0644\u0645 \u064A\u064F\u062D\u062F\u062F \u0645\u0633\u062A\u0647\u062F\u0641 \u0644\u0647\u0630\u0647 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "No target has been set for this municipality");
var PLAN_STATE_TEXT = {
  ok: null,
  future_period: bi("\u0641\u062A\u0631\u0629 \u0627\u0644\u062E\u0637\u0629 \u0644\u0645 \u062A\u0628\u062F\u0623 \u0628\u0639\u062F: \u0644\u0627 \u0645\u062D\u0635\u0651\u0644 \u0648\u0644\u0627 \u0627\u0646\u062D\u0631\u0627\u0641 \u0648\u0644\u0627 \u062A\u0648\u0642\u0639", "The plan period has not started: no actual, no deviation, no forecast"),
  completed: bi("\u0627\u0646\u062A\u0647\u062A \u0641\u062A\u0631\u0629 \u0627\u0644\u062E\u0637\u0629: \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064A\u0629 \u0644\u0644\u062A\u062D\u0642\u064A\u0642\u060C \u0628\u0644\u0627 \u0648\u062A\u064A\u0631\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u0644\u0627 \u062A\u0648\u0642\u0639", "The plan period has ended: final achievement, no required pace, no forecast"),
  no_target: bi("\u0644\u0627 \u0645\u0633\u062A\u0647\u062F\u0641 \u0644\u0647\u0630\u0647 \u0627\u0644\u062E\u0637\u0629: \u0644\u0627 \u0646\u0633\u0628\u0629 \u062A\u062D\u0642\u0642 \u0648\u0644\u0627 \u0627\u0646\u062D\u0631\u0627\u0641 \u0648\u0644\u0627 \u0641\u062C\u0648\u0629", "This plan has no target: no achievement, no deviation, no gap"),
  no_data: bi("\u0644\u0627 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0639\u0644\u064A\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u062A\u0631\u0629 \u0628\u0639\u062F", "No actual data for this period yet"),
  incompatible_input: bi("\u0645\u062F\u062E\u0644\u0627\u062A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0627 \u062A\u062E\u0635 \u0647\u0630\u0647 \u0627\u0644\u062E\u0637\u0629/\u0627\u0644\u0625\u0635\u062F\u0627\u0631/\u0627\u0644\u0646\u0637\u0627\u0642/\u0627\u0644\u0641\u062A\u0631\u0629: \u0644\u0627 \u062A\u064F\u0639\u0631\u0636 \u0623\u0631\u0642\u0627\u0645", "The data input does not belong to this plan / version / scope / period: no figures are shown"),
  stale_input: bi("\u0645\u062F\u062E\u0644\u0627\u062A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062D\u0633\u0648\u0628\u0629 \u0644\u062A\u0627\u0631\u064A\u062E \u0625\u063A\u0644\u0627\u0642 \u0645\u062E\u062A\u0644\u0641: \u0644\u0627 \u062A\u064F\u0639\u0631\u0636 \u0623\u0631\u0642\u0627\u0645", "The data input was computed for a different cut-off date: no figures are shown"),
  invalid_period: bi("\u0641\u062A\u0631\u0629 \u0627\u0644\u062E\u0637\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629", "The plan period is not valid"),
  no_municipal_target: NO_MUNICIPAL_TARGET,
  invalid_view_scope: bi("\u0646\u0637\u0627\u0642 \u0627\u0644\u0639\u0631\u0636 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D: \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0623\u0648 \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629", "The view scope is not valid: the Amanah or municipality is unavailable or does not match"),
  insufficient_history: bi("\u0644\u0627 \u064A\u0643\u0641\u064A \u0633\u062C\u0644 \u0644\u062E\u0637 \u0627\u0644\u0623\u0633\u0627\u0633: \u0627\u0644\u0645\u0637\u0644\u0648\u0628 3 \u0623\u0634\u0647\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0645\u0631\u0635\u0648\u062F\u0629", "Not enough history for the baseline: 3 complete observed months are needed")
};
function planScope(scope, entityKeys = null) {
  const kind = scope?.kind === "entities" ? "entities" : "ministry";
  const universe = kind === "ministry" ? appropriationKeys().filter((k) => k !== HQ_KEY) : [...scope?.entityKeys || []];
  const visible = Array.isArray(entityKeys) ? universe.filter((k) => entityKeys.includes(k)) : universe.slice();
  const restricted = Array.isArray(entityKeys) && visible.length < universe.length;
  const key = (kind === "ministry" ? "ministry" : `entities:${universe.slice().sort().join(",")}`) + (restricted ? `|visible:${visible.slice().sort().join(",")}` : "");
  return { kind, universe, visible, restricted, key, amanah: kind === "ministry" && !restricted ? "all" : visible };
}
var DEFAULT_VIEW_SCOPE = Object.freeze({ amanah: "all", muni: "all" });
var entLabel = (key) => {
  const e = ENTITIES.find((x) => x.en === key);
  return e ? bi(e.ar, e.en) : bi(key, key);
};
function normalizeViewScope(vs) {
  const t = (x) => typeof x === "string" && x && x !== "all" ? x : "all";
  return { amanah: t(vs?.amanah), muni: t(vs?.muni) };
}
function resolveViewScope({ scope = null, entityKeys = null, viewScope = null } = {}) {
  const vs = normalizeViewScope(viewScope);
  const viewer = planScope(scope, entityKeys);
  const suffix = (vs.amanah !== "all" ? `|view:${vs.amanah}` : "") + (vs.muni !== "all" ? `|muni:${vs.muni}` : "");
  const out = (mode, extra = {}) => ({ vs, mode, invalid: null, sc: viewer, viewer, scopeKey: viewer.key + suffix, amanah: null, muniId: null, muniKey: null, muni: null, label: null, ...extra });
  if (vs.amanah === "all" && vs.muni === "all") return out("none");
  if (vs.amanah === "all") return out("invalid", { invalid: "municipality_without_amanah" });
  if (!viewer.visible.includes(vs.amanah)) return out("invalid", { invalid: "amanah_not_available" });
  const sc = planScope(scope, [vs.amanah]);
  if (vs.muni === "all") return out("amanah", { sc, amanah: vs.amanah, label: entLabel(vs.amanah) });
  const m = municipalityByRef(vs.muni);
  if (!m || m.amanahKey !== vs.amanah) return out("invalid", { invalid: "municipality_not_in_amanah" });
  const a = entLabel(vs.amanah);
  return out("municipality", { sc, amanah: vs.amanah, muniId: m.refId, muniKey: m.key, muni: m, label: bi(`${m.ar} \u2014 ${a.ar}`, `${m.en} \u2014 ${a.en}`) });
}
function municipalAllocationsOf(content, amanahKey) {
  const by = /* @__PURE__ */ new Map();
  for (const m of content?.municipalAllocations || []) {
    if (!m || m.entityKey !== amanahKey || typeof m.muniId !== "string" || !fin(m.amount) || m.amount < 0) continue;
    const cur = by.get(m.muniId);
    by.set(m.muniId, cur ? { ...cur, amount: cur.amount + Math.round(m.amount) } : { id: m.muniId, amount: Math.round(m.amount), origin: m.origin ?? null, note: m.note ?? null });
  }
  const order = new Map(municipalitiesOf(amanahKey).map((x, i) => [x.refId, i]));
  return [...by.values()].sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e6) - (order.has(b.id) ? order.get(b.id) : 1e6));
}
function lastCompleteMonthBefore(cutoff) {
  if (!isISODate(cutoff)) return null;
  const ym = cutoff.slice(0, 7);
  if (cutoff === monthEnd(ym)) return ym;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function historyMonths(cutoff, n = 3) {
  let ym = lastCompleteMonthBefore(cutoff);
  if (!ym) return [];
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.unshift(ym);
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7));
    ym = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }
  return out;
}
var UPCOMING_FORECAST_MAX_GAP_DAYS = 31;
function upcomingForecastSupport({ asOf, periodStart } = {}) {
  if (!isISODate(asOf) || !isISODate(periodStart)) return { supported: false, gapDays: null, reason: "no_data_date" };
  const gapDays = dayDiff(asOf, periodStart);
  if (gapDays < 1) return { supported: false, gapDays, reason: "not_upcoming" };
  return gapDays <= UPCOMING_FORECAST_MAX_GAP_DAYS ? { supported: true, gapDays, reason: null } : { supported: false, gapDays, reason: "too_far" };
}
function remainingOf(rows, cutoff) {
  const byMonth = rows.map((r) => {
    const from = cutoff >= r.end ? null : addDays2(cutoff, 1) > r.start ? addDays2(cutoff, 1) : r.start;
    const days = from ? daysInclusive(from, r.end) : 0;
    return { ym: r.ym, days, monthDays: r.monthDays, fraction: days / r.monthDays };
  });
  return { days: sum(byMonth, (x) => x.days), months: sum(byMonth, (x) => x.fraction), byMonth };
}
function deviationAmount(actual, planned) {
  if (!fin(planned)) return { amount: null, pct: null, unavailable: "no_plan" };
  if (!fin(actual)) return { amount: null, pct: null, unavailable: "no_actual" };
  return { amount: actual - planned, pct: planned > 0 ? (actual - planned) / planned : null, unavailable: null };
}
var ratioOf = (actual, planned) => !fin(planned) ? { value: null, reason: "no_plan" } : !fin(actual) ? { value: null, reason: "no_actual" } : !(planned > 0) ? { value: null, reason: "planned_zero" } : { value: actual / planned, reason: null };
var notice = (code, tone, m) => ({ code, tone, ar: m.ar, en: m.en });
var sameRange = (a, b) => !!a && !!b && a.start === b.start && a.end === b.end;
function planningBasisFromPlan({ view: view2, today = null, latestDataDate = null, entityKeys = null, actual = null, staleDays = 3, viewScope = null } = {}) {
  const v = view2 || {};
  const content = v.content || {};
  const period = v.period || content.period || null;
  const rv = resolveViewScope({ scope: v.scope || content.scope, entityKeys, viewScope });
  const sc = rv.sc;
  const viewMode = rv.mode;
  const restrictedLike = viewMode === "none" ? sc.restricted : true;
  const latest = latestDataDate || today || null;
  const base = {
    planId: v.planId ?? null,
    versionId: v.versionId ?? null,
    versionNumber: v.versionNumber ?? null,
    name: v.name ?? content.name ?? null,
    planState: v.state ?? null,
    origin: v.origin ?? null,
    isHistorical: !!v.isHistorical,
    period,
    scope: v.scope || content.scope || null,
    scopeKind: viewMode === "amanah" ? "amanah" : viewMode === "municipality" ? "municipality" : sc.kind === "ministry" ? sc.restricted ? "available" : "ministry" : sc.restricted ? "available" : "entities",
    scopeKey: rv.scopeKey,
    restricted: rv.viewer.restricted,
    today: today || null,
    forecastGeneratedAt: null,
    scopeLabel: rv.label || (sc.restricted ? RESTRICTED_LABEL : sc.kind === "ministry" ? MINISTRY_LABEL : null),
    viewScope: rv.vs,
    viewLabel: rv.label,
    municipalState: null,
    municipal: null
  };
  const bare = (state4, reason2 = null, extra = {}) => ({
    ...base,
    state: state4,
    reason: reason2,
    message: PLAN_STATE_TEXT[state4] || null,
    flags: flagsOf({ isHistorical: base.isHistorical }),
    reportingCutoff: null,
    latestActualDataDate: latest,
    lastCompleteMonth: null,
    target: { value: null, basis: null },
    actualToDate: null,
    plannedToDate: null,
    achievementToDate: null,
    vsPlanRatio: null,
    vsPlanReason: reason2,
    deviation: { amount: null, pct: null, unavailable: reason2 || "no_plan" },
    months: [],
    periodInfo: null,
    entities: [],
    rowsKind: "entity",
    remainder: null,
    allocation: null,
    notices: [],
    cumulative: { planned: [], actual: [] },
    pace: { required: { state: "none", reason: reason2 || state4, monthly: null, daily: null, remainingDays: null, remainingMonths: null } },
    remaining: null,
    upcoming: null,
    outcome: null,
    stale: { is: false, days: 0, threshold: staleDays },
    ...extra
  });
  if (!periodValid(period)) return bare("invalid_period", "invalid_period");
  const rows = monthRows(period);
  const periodInfo = { start: period.start, end: period.end, preset: period.preset ?? null, days: daysInclusive(period.start, period.end), months: rows.length, isCalendarYear: isCalendarYear(period), year: isCalendarYear(period) ? Number(period.start.slice(0, 4)) : null };
  if (viewMode === "invalid") return bare("invalid_view_scope", rv.invalid, { periodInfo });
  const meta2 = actual?.meta || null;
  if (meta2) {
    if (meta2.planId !== base.planId || meta2.versionId !== base.versionId || meta2.scopeKey !== rv.scopeKey || !sameRange(meta2.period, period)) return bare("incompatible_input", "input_mismatch", { periodInfo });
  }
  const masked = content.target?.masked === true || v.masked === true || content.masked === true;
  let mp = null;
  let noMuniTarget = false;
  let rowsKind = "entity";
  if (viewMode === "amanah" || viewMode === "municipality") {
    const A = rv.amanah;
    const arow = (content.allocations || []).find((a) => a.entityKey === A);
    const hidden = Array.isArray(content.maskedAmanahKeys) && content.maskedAmanahKeys.includes(A) || masked && !(arow && fin(arow.amount));
    const parts = municipalAllocationsOf(content, A);
    const sumM = sum(parts, (p) => p.amount);
    const AM = hidden ? null : arow && fin(arow.amount) ? Math.round(arow.amount) : 0;
    const mm = municipalMonthlyBreakdown(content, period, A);
    mp = { A, hidden, parts, sumM, AM, mm, excess: !hidden && sumM > AM, byId: Object.fromEntries(parts.map((p) => [p.id, p])) };
    rowsKind = viewMode === "amanah" && parts.length > 0 ? "municipality" : "entity";
  }
  let allocs;
  let allocated;
  let T4;
  let targetSet;
  let pm;
  let allocation;
  const roundingOf = (list2) => list2.map((a) => ({ entityKey: a.entityKey, ...monthAmounts(a.amount || 0, content.entityDistributions?.[a.entityKey] || content.distribution, rows).remainder }));
  if (viewMode === "municipality") {
    const own = mp.byId[rv.muniId] || null;
    allocs = [];
    allocated = own ? own.amount : 0;
    targetSet = true;
    noMuniTarget = !own;
    T4 = own ? own.amount : null;
    pm = { rows, entities: {}, plan: own ? mp.mm.municipalities[own.id] : rows.map(() => 0), allocated, complete: !!own };
    allocation = { allocated, unallocated: own ? 0 : null, excess: own ? 0 : null, complete: !!own, rows: own ? 1 : 0, rounding: { units: 0, byEntity: [] }, level: "municipality" };
  } else if (rowsKind === "municipality" || viewMode === "amanah" && mp.hidden) {
    allocs = [];
    targetSet = true;
    if (mp.parts.length === 0) {
      noMuniTarget = true;
      T4 = null;
      allocated = 0;
      pm = { rows, entities: {}, plan: rows.map(() => 0), allocated: 0, complete: false };
      allocation = { allocated: 0, unallocated: null, excess: null, complete: false, rows: 0, rounding: { units: 0, byEntity: [] }, level: "municipality" };
    } else {
      allocated = mp.sumM;
      T4 = mp.hidden ? mp.sumM : mp.AM;
      const plan2 = mp.hidden ? rows.map((_, i) => sum(mp.parts, (p) => mp.mm.municipalities[p.id][i])) : mp.mm.amanah;
      pm = { rows, entities: {}, plan: plan2, allocated, complete: !mp.hidden && !mp.excess && mp.AM === mp.sumM };
      allocation = { allocated, unallocated: mp.hidden ? null : Math.max(mp.AM - mp.sumM, 0), excess: mp.hidden ? null : Math.max(mp.sumM - mp.AM, 0), complete: pm.complete, rows: mp.parts.length, rounding: { units: 0, byEntity: [] }, level: "municipality" };
    }
  } else {
    allocs = (content.allocations || []).filter((a) => !restrictedLike || sc.visible.includes(a.entityKey));
    allocated = sum(allocs, (a) => Math.round(Number(a.amount) || 0));
    const rawTarget = content.target?.amount;
    targetSet = fin(rawTarget);
    T4 = restrictedLike ? allocated : targetSet ? Math.round(rawTarget) : null;
    const planContent = { ...content, allocations: allocs, target: { ...content.target || {}, amount: T4 } };
    pm = planMonthly(planContent, period);
    const rounding = roundingOf(allocs);
    allocation = { allocated, unallocated: T4 != null ? Math.max(T4 - allocated, 0) : null, excess: T4 != null ? Math.max(allocated - T4, 0) : null, complete: restrictedLike ? allocs.length > 0 : pm.complete, rows: allocs.length, rounding: { units: sum(rounding, (r) => r.units), byEntity: rounding.filter((r) => r.units > 0) } };
  }
  const dist = content.distribution || null;
  const profile = { kind: dist?.profile ?? null, assumption: dist?.profile === "equal", label: dist?.profile === "equal" ? EQUAL_ASSUMPTION : dist?.profile === "manual" ? bi("\u062A\u0648\u0632\u064A\u0639 \u0634\u0647\u0631\u064A \u064A\u062F\u0648\u064A", "Manual monthly distribution") : bi("\u0644\u0645 \u064A\u064F\u062D\u062F\u064E\u0651\u062F \u062A\u0648\u0632\u064A\u0639 \u0634\u0647\u0631\u064A", "No monthly distribution chosen") };
  const target = { value: T4, basis: viewMode === "none" ? content.target?.basis ?? null : null, restricted: rv.viewer.restricted || !!mp?.hidden, ...mp?.hidden ? { label: RESTRICTED_LABEL } : {} };
  const futurePeriod = !!today && today < period.start;
  let cutoff = null;
  if (!futurePeriod) {
    const cands = [period.end];
    if (today) cands.push(today);
    if (latest) cands.push(latest);
    cutoff = cands.reduce((a, b) => a < b ? a : b);
  }
  const stale = { is: false, days: 0, threshold: staleDays };
  if (today && latest) {
    const ref = today < period.end ? today : period.end;
    stale.days = Math.max(dayDiff(latest, ref), 0);
    stale.is = stale.days > staleDays;
  }
  if (meta2 && cutoff && meta2.cutoff !== cutoff) return bare("stale_input", "cutoff_mismatch", { periodInfo, reportingCutoff: cutoff, latestActualDataDate: latest });
  const noDataYet = !futurePeriod && (!cutoff || cutoff < period.start || latest != null && latest < period.start);
  const monthly = rows.map((r, i) => cutoff && r.start <= cutoff && !futurePeriod && Array.isArray(actual?.monthly) && fin(actual.monthly[i]) ? actual.monthly[i] : null);
  const monthsToCutoff = rows.filter((r) => cutoff && r.start <= cutoff && !futurePeriod);
  const observed = monthly.filter((x) => x != null);
  const missingMonths = monthsToCutoff.filter((r, i) => monthly[i] == null).map((r) => r.ym);
  const hasActual = !noDataYet && !futurePeriod && Array.isArray(actual?.monthly) && observed.length > 0;
  const actualToDate = hasActual ? sum(observed) : null;
  let state3 = "ok";
  let reason = null;
  if (futurePeriod) {
    state3 = "future_period";
    reason = "not_started";
  } else if (noMuniTarget) {
    state3 = "no_municipal_target";
    reason = "no_municipal_target";
  } else if (!(T4 > 0)) {
    state3 = "no_target";
    reason = targetSet || restrictedLike ? "zero_target" : "target_missing";
  } else if (noDataYet) {
    state3 = "no_data";
    reason = "no_data_in_period";
  } else if (!hasActual) {
    state3 = "no_data";
    reason = "actual_not_loaded";
  } else if (cutoff >= period.end) {
    state3 = "completed";
    reason = "period_ended";
  }
  const calculable = state3 === "ok" || state3 === "completed" || state3 === "no_data" || state3 === "no_municipal_target";
  const planned = cutoff && T4 > 0 && cutoff >= period.start ? plannedTo(pm.plan, rows, cutoff) : null;
  const dev = T4 > 0 ? deviationAmount(actualToDate, planned) : { amount: null, pct: null, unavailable: reason || "no_target" };
  const vs = T4 > 0 ? ratioOf(actualToDate, planned) : { value: null, reason: reason || "no_target" };
  const achievementToDate = T4 > 0 && actualToDate != null ? actualToDate / T4 : null;
  const remainingTarget = T4 > 0 && actualToDate != null ? Math.max(T4 - actualToDate, 0) : T4 > 0 && futurePeriod ? T4 : null;
  const exceededBy = T4 > 0 && actualToDate != null && actualToDate > T4 ? actualToDate - T4 : 0;
  const aboveTarget = T4 > 0 && actualToDate != null && actualToDate >= T4;
  const dataDates = [today, latest].filter(Boolean);
  const asOf = futurePeriod && dataDates.length ? dataDates.reduce((a, b) => a < b ? a : b) : null;
  const remaining = cutoff && !futurePeriod ? remainingOf(rows, cutoff) : futurePeriod ? remainingOf(rows, addDays2(period.start, -1)) : null;
  const upcoming = futurePeriod ? { asOf, daysToStart: asOf ? dayDiff(asOf, period.start) : null, days: remaining.days, months: remaining.months, support: upcomingForecastSupport({ asOf, periodStart: period.start }) } : null;
  const partialMonth = !!cutoff && !futurePeriod && cutoff < period.end && cutoff !== monthEnd(cutoff.slice(0, 7));
  let required;
  if (futurePeriod && T4 > 0 && !noMuniTarget) required = { state: "ok", reason: null, upcoming: true, monthly: T4 / remaining.months, daily: T4 / remaining.days, remainingDays: remaining.days, remainingMonths: remaining.months };
  else if (!(T4 > 0) || !cutoff || futurePeriod || actualToDate == null) required = { state: "none", reason: futurePeriod ? "not_started" : !(T4 > 0) ? reason || "no_target" : "no_actual", monthly: null, daily: null, remainingDays: remaining?.days ?? null, remainingMonths: remaining?.months ?? null };
  else if (state3 === "completed" || remaining.days === 0) required = { state: "none", reason: "period_ended", monthly: null, daily: null, remainingDays: 0, remainingMonths: 0 };
  else if (remainingTarget === 0) required = { state: "none", reason: "target_reached", monthly: null, daily: null, remainingDays: remaining.days, remainingMonths: remaining.months };
  else required = { state: "ok", reason: null, monthly: remainingTarget / remaining.months, daily: remainingTarget / remaining.days, remainingDays: remaining.days, remainingMonths: remaining.months };
  let cp = 0;
  let ca = 0;
  const months = rows.map((r, i) => {
    cp += pm.plan[i];
    const a = monthly[i];
    if (a != null) ca += a;
    return { ym: r.ym, start: r.start, end: r.end, days: r.days, monthDays: r.monthDays, partial: r.partial, planned: noMuniTarget ? null : pm.plan[i], plannedCum: noMuniTarget ? null : cp, actual: a, actualCum: a != null ? ca : null, reached: !!cutoff && !futurePeriod && cutoff >= r.start, complete: !!cutoff && !futurePeriod && cutoff >= r.end, cutoffMonth: !!cutoff && !futurePeriod && cutoff >= r.start && cutoff < r.end };
  });
  const byEntity = hasActual && actual.byEntity ? actual.byEntity : null;
  const rowOf = (key, extra, t, monthsOf, act, hasMonths = true) => {
    const hasT = t != null && t > 0;
    const p = planned != null && hasT && hasMonths ? plannedTo(monthsOf, rows, cutoff) : null;
    const noT = t == null ? "no_municipal_target" : "no_target";
    const d = hasT ? deviationAmount(act, p) : { amount: null, pct: null, unavailable: noT };
    const r = hasT ? ratioOf(act, p) : { value: null, reason: noT };
    return { key, ...extra, target: t, hasTarget: hasT, plannedToDate: p, actual: act, deviation: d.amount, deviationPct: d.pct, deviationUnavailable: d.unavailable, vsPlanRatio: r.value, vsPlanReason: r.reason, achievementToDate: hasT && act != null ? act / t : null, monthly: hasMonths ? monthsOf : null };
  };
  let entities;
  let remainder;
  if (rowsKind === "municipality") {
    const byM = hasActual && actual.byMunicipality ? actual.byMunicipality : null;
    const unattr = hasActual && actual.byMunicipality ? actual.unattributed?.total ?? 0 : null;
    const ids = [.../* @__PURE__ */ new Set([...mp.parts.map((x) => x.id), ...Object.keys(byM || {}).filter((k) => byM[k])])];
    const order = new Map(municipalitiesOf(mp.A).map((x, i) => [x.refId, i]));
    ids.sort((a, b) => (order.has(a) ? order.get(a) : 1e6) - (order.has(b) ? order.get(b) : 1e6));
    entities = ids.map((id) => {
      const part = mp.byId[id] || null;
      const ref = municipalityByRef(id);
      return rowOf(id, { rowKind: "municipality", muniId: id, amanah: mp.A, label: ref ? bi(ref.ar, ref.en) : bi(id, id), origin: part?.origin ?? null, note: part?.note ?? null, targetState: part ? null : "no_municipal_target" }, part ? part.amount : null, part ? mp.mm.municipalities[id] : null, byM ? byM[id] || 0 : null, !!part);
    });
    if (!mp.hidden || unattr != null && unattr !== 0) {
      const UT = mp.hidden ? null : Math.max(mp.AM - mp.sumM, 0);
      entities.push(rowOf(UNALLOCATED_MUNI_KEY, { rowKind: "unallocated_muni", amanah: mp.A, label: UNALLOCATED_MUNI_LABEL, origin: null, note: null, targetState: mp.hidden ? "hidden" : null, excess: mp.excess }, UT, mp.hidden ? null : mp.mm.unallocated, unattr, !mp.hidden));
    }
    remainder = byM && !mp.hidden && actualToDate != null ? actualToDate - sum(entities, (e) => e.actual || 0) : null;
  } else if (viewMode === "municipality") {
    entities = [];
    remainder = null;
  } else {
    entities = allocs.map((a) => {
      const t = Math.round(Number(a.amount) || 0);
      return rowOf(a.entityKey, { rowKind: "entity", origin: a.origin ?? null, note: a.note ?? null }, t, pm.entities[a.entityKey], byEntity ? byEntity[a.entityKey] || 0 : null);
    });
    remainder = byEntity && !restrictedLike && actualToDate != null ? actualToDate - sum(entities, (e) => e.actual || 0) : null;
  }
  const notices = [];
  if (base.isHistorical) notices.push(notice("historical", "info", bi("\u0625\u0635\u062F\u0627\u0631 \u0633\u0627\u0628\u0642 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637", "An earlier version, read-only")));
  if (v.origin === "seed") notices.push(notice("illustrative_plan", "warn", bi("\u062E\u0637\u0629 \u062A\u0648\u0636\u064A\u062D\u064A\u0629 (\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629) \u2014 \u0644\u064A\u0633\u062A \u0645\u0633\u062A\u0647\u062F\u0641\u064B\u0627 \u0631\u0633\u0645\u064A\u064B\u0627", "An illustrative plan (illustrative data) \u2014 not an official target")));
  if (T4 > 0 && profile.assumption) notices.push(notice("equal_distribution", "warn", EQUAL_ASSUMPTION));
  if (periodInfo.isCalendarYear && period.preset === "fiscal-year") notices.push(notice("calendar_assumption", "info", CALENDAR_YEAR_ASSUMPTION));
  if (noMuniTarget && state3 !== "future_period") notices.push(notice("no_municipal_target", "warn", NO_MUNICIPAL_TARGET));
  if (!(T4 > 0) && !noMuniTarget && state3 !== "future_period") notices.push(notice("zero_target", "warn", PLAN_STATE_TEXT.no_target));
  if (T4 > 0 && !allocation.complete && !restrictedLike) notices.push(notice("allocation_incomplete", "warn", allocation.excess > 0 ? bi(`\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u062A\u062E\u0635\u064A\u0635\u0627\u062A \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0628\u0645\u0642\u062F\u0627\u0631 ${fmtMoney(allocation.excess, { lang: "ar" })}`, `The allocations exceed the target by ${fmtMoney(allocation.excess, { lang: "en" })}`) : bi(`\u063A\u064A\u0631 \u0645\u062E\u0635\u0651\u0635 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 ${fmtMoney(allocation.unallocated, { lang: "ar" })}`, `${fmtMoney(allocation.unallocated, { lang: "en" })} of the target is unallocated`)));
  if (partialMonth && cutoff) notices.push(notice("partial_month", "info", bi(`\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u062D\u062A\u0649 ${cutoff}\u061B \u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0623\u062E\u064A\u0631 \u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u0648\u064A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u0645\u062E\u0637\u0637 \u0628\u0627\u0644\u062A\u0646\u0627\u0633\u0628 \u0639\u0644\u0649 \u0623\u064A\u0627\u0645\u0647`, `Figures are to ${cutoff}; the last month is not complete and the plan is prorated by its days`)));
  if (stale.is) notices.push(notice("stale_data", "warn", bi(`\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u0651\u062B\u0629: \u0622\u062E\u0631 \u0628\u064A\u0627\u0646\u0627\u062A ${latest} \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E ${today} (${stale.days} \u0623\u064A\u0627\u0645)`, `Data is not up to date: latest data ${latest}, today ${today} (${stale.days} days)`)));
  if (hasActual && missingMonths.length) notices.push(notice("data_gap", "warn", bi(`\u0623\u0634\u0647\u0631 \u0628\u0644\u0627 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0631\u0635\u0648\u062F\u0629 \u062F\u0627\u062E\u0644 \u0627\u0644\u0641\u062A\u0631\u0629: ${missingMonths.join("\u060C ")} \u2014 \u0644\u0627 \u062A\u064F\u0639\u062F\u0651 \u0635\u0641\u0631\u064B\u0627`, `Months with no observed data inside the period: ${missingMonths.join(", ")} \u2014 not treated as zero`)));
  if (aboveTarget) notices.push(notice("above_target", "good", bi(`\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u2014 \u062A\u062C\u0627\u0648\u0632 \u0628\u0645\u0642\u062F\u0627\u0631 ${fmtMoney(exceededBy, { lang: "ar" })}`, `Target reached \u2014 exceeded by ${fmtMoney(exceededBy, { lang: "en" })}`)));
  const outcome = state3 === "completed" && T4 > 0 ? { achieved: actualToDate >= T4, amount: actualToDate - T4, pct: actualToDate / T4, label: actualToDate >= T4 ? bi(`\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u0641\u062A\u0631\u0629: \u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0628\u062A\u062C\u0627\u0648\u0632 ${fmtMoney(actualToDate - T4, { lang: "ar" })}`, `The period has ended: the target was reached, exceeded by ${fmtMoney(actualToDate - T4, { lang: "en" })}`) : bi(`\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u0641\u062A\u0631\u0629: \u0644\u0645 \u064A\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u2014 \u0627\u0644\u0641\u0631\u0642 ${fmtMoney(T4 - actualToDate, { lang: "ar" })}`, `The period has ended: the target was not reached \u2014 short by ${fmtMoney(T4 - actualToDate, { lang: "en" })}`) } : null;
  if (outcome) notices.push(notice("period_end", outcome.achieved ? "good" : "warn", outcome.label));
  return {
    ...base,
    state: state3,
    reason,
    message: PLAN_STATE_TEXT[state3] || null,
    flags: flagsOf({ isHistorical: base.isHistorical, zeroTarget: !(T4 > 0) && !noMuniTarget, noMunicipalTarget: noMuniTarget, assumedDistribution: T4 > 0 && profile.assumption, partialMonth, aboveTarget, staleData: stale.is, periodEnded: state3 === "completed", incompleteActual: hasActual && missingMonths.length > 0, allocationIncomplete: viewMode === "none" && T4 > 0 && !allocation.complete }),
    periodInfo,
    profile,
    reportingCutoff: cutoff,
    latestActualDataDate: latest,
    lastCompleteMonth: cutoff && !futurePeriod ? lastCompleteMonthBefore(cutoff) : null,
    stale,
    partialMonth,
    remaining,
    upcoming,
    missingMonths,
    target,
    allocation,
    actualToDate,
    plannedToDate: planned,
    achievementToDate,
    vsPlanRatio: vs.value,
    vsPlanReason: vs.reason,
    deviation: dev,
    remainingTarget,
    exceededBy,
    pace: { required },
    outcome,
    months,
    cumulative: { planned: months.map((m) => m.plannedCum), actual: months.map((m) => m.actualCum) },
    entities,
    rowsKind,
    remainder,
    calculable,
    notices,
    municipalState: viewMode === "municipality" ? noMuniTarget ? "no_municipal_target" : "allocated" : viewMode === "amanah" ? mp.parts.length > 0 ? "distributed" : mp.hidden ? "no_municipal_target" : "not_distributed" : null,
    municipal: mp ? { view: viewMode, amanah: mp.A, muniId: rv.muniId, allocatedCount: mp.parts.length, allocatedTotal: mp.sumM, unallocated: mp.hidden ? null : Math.max(mp.AM - mp.sumM, 0), excess: mp.hidden ? null : Math.max(mp.sumM - mp.AM, 0), targetHidden: mp.hidden, amanahTarget: mp.hidden ? null : mp.AM, reconciled: !mp.hidden && !!mp.mm.reconciles } : null
  };
}
function flagsOf(o) {
  return { noMunicipalTarget: !!o.noMunicipalTarget, isHistorical: !!o.isHistorical, zeroTarget: !!o.zeroTarget, assumedDistribution: !!o.assumedDistribution, partialMonth: !!o.partialMonth, aboveTarget: !!o.aboveTarget, staleData: !!o.staleData, periodEnded: !!o.periodEnded, incompleteActual: !!o.incompleteActual, allocationIncomplete: !!o.allocationIncomplete };
}

// src/data/referenceTarget.js
var bi2 = (ar, en) => ({ ar, en });
var MONTHS = 12;
var pad22 = (n) => String(n).padStart(2, "0");
var REFERENCE_LINK = "/planning";
var REF_REASON = {
  not_found: bi2("\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", "the configured plan no longer exists"),
  period_mismatch: bi2("\u0641\u062A\u0631\u0629 \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0644\u0627 \u062A\u063A\u0637\u064A \u0647\u0630\u0647 \u0627\u0644\u0633\u0646\u0629", "the configured plan\u2019s period does not cover this year")
};
function referenceFor2(year = APPROPRIATION_YEAR) {
  const st = plansStatus();
  const have = getPlans().length > 0;
  if (st === "forbidden") return { referenceState: "no_access", state: "no_access" };
  if ((st === "idle" || st === "loading" || st === "error") && !have) return { referenceState: "not_loaded", state: "not_loaded" };
  return referenceViewFor(year);
}
var nm = (c) => c.name || c.planId;
function referenceLine(ref, lang = "ar") {
  if (!ref || ref.state !== "ok") return null;
  const pre = ref.source === "only_eligible" ? bi2("\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0648\u062D\u064A\u062F\u0629 \u0627\u0644\u0645\u0624\u0647\u0644\u0629", "The only eligible plan") : bi2("\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629", "Reference plan");
  const line = bi2(`${pre.ar}: ${ref.name}`, `${pre.en}: ${ref.name}`);
  return lang ? line[lang === "ar" ? "ar" : "en"] : line;
}
function referenceNotice(ref, lang = "ar") {
  if (!ref) return null;
  const pick = (m2) => lang ? m2[lang === "ar" ? "ar" : "en"] : m2;
  const y = ref.year;
  if (ref.state === "ok") {
    if (ref.targetState === "no_municipal_target") return pick(NO_MUNICIPAL_TARGET);
    if (ref.targetState === "no_target") return pick(PLAN_STATE_TEXT.no_target);
    if (ref.targetState === "invalid_view_scope") return pick(PLAN_STATE_TEXT.invalid_view_scope);
    return null;
  }
  const list2 = (ref.candidates || []).map((c) => nm(c));
  const m = {
    ambiguous: bi2(
      `\u0644\u0627 \u062E\u0637\u0629 \u0645\u0631\u062C\u0639\u064A\u0629 \u0645\u062D\u062F\u062F\u0629 \u0644\u0639\u0627\u0645 ${y} \u0648\u0647\u0646\u0627\u0643 \u0623\u0643\u062B\u0631 \u0645\u0646 \u062E\u0637\u0629 \u0645\u062D\u0641\u0648\u0638\u0629 \u0645\u0624\u0647\u0644\u0629 (${list2.join("\u060C ")}): \u0644\u0627 \u064A\u064F\u0639\u0631\u0636 \u0645\u0633\u062A\u0647\u062F\u0641 \u0648\u0644\u0627 \u064A\u064F\u062E\u062A\u0627\u0631 \u0623\u062D\u062F\u0647\u0627 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627. \u062D\u062F\u0651\u062F \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 \u0645\u0646 \u0635\u0641\u062D\u0629 \xAB\u062E\u0637\u0637 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A\xBB (${REFERENCE_LINK}).`,
      `No reference plan is set for ${y} and more than one saved plan is eligible (${list2.join(", ")}): no target is shown and none is picked automatically. Set the reference plan on the revenue plans page (${REFERENCE_LINK}).`
    ),
    none: bi2(`\u0644\u0627 \u062A\u0648\u062C\u062F \u062E\u0637\u0629 \u0645\u062D\u0641\u0648\u0638\u0629 \u0644\u0639\u0627\u0645 ${y}: \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D (\u0648\u0644\u064A\u0633 \u0635\u0641\u0631\u064B\u0627). \u0623\u0646\u0634\u0626 \u062E\u0637\u0629 \u0648\u0627\u062D\u0641\u0638\u0647\u0627 \u0645\u0646 \u0635\u0641\u062D\u0629 \xAB\u062E\u0637\u0637 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A\xBB (${REFERENCE_LINK}).`, `There is no saved plan for ${y}: the target is unavailable (not zero). Create and save a plan on the revenue plans page (${REFERENCE_LINK}).`),
    reference_invalid: bi2(
      `\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0644\u0639\u0627\u0645 ${y} \u0644\u0645 \u062A\u0639\u062F \u0635\u0627\u0644\u062D\u0629 (${(REF_REASON[ref.reason] || bi2(ref.reason || "\u2014", ref.reason || "\u2014")).ar}): \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0648\u0644\u0627 \u064A\u064F\u0633\u062A\u0628\u062F\u0644 \u0628\u062E\u0637\u0629 \u0623\u062E\u0631\u0649. \u0631\u0627\u062C\u0639 ${REFERENCE_LINK}.`,
      `The reference plan set for ${y} is no longer valid (${(REF_REASON[ref.reason] || bi2(ref.reason || "\u2014", ref.reason || "\u2014")).en}): the target is unavailable and no other plan is substituted. See ${REFERENCE_LINK}.`
    ),
    not_loaded: bi2("\u062E\u0637\u0637 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0644\u0645 \u062A\u064F\u062D\u0645\u064E\u0651\u0644 \u0628\u0639\u062F \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629: \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0645\u0624\u0642\u062A\u064B\u0627 (\u0648\u0644\u064A\u0633 \u0635\u0641\u0631\u064B\u0627).", "The revenue plans are not loaded in this session yet: the target is temporarily unavailable (not zero)."),
    no_access: bi2("\u0644\u0627 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 (\u0648\u062D\u062F\u0629 \u0627\u0644\u062A\u062E\u0637\u064A\u0637): \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0643.", "You do not have access to read the reference plan (planning module): the target is unavailable to you.")
  }[ref.state];
  return m ? pick(m) : null;
}
var monthKey = (year, i) => `${year}-${pad22(i + 1)}`;
function unavailable(ref, year, extra = {}) {
  return { ok: false, reference: { state: ref.referenceState || ref.state, ok: false, year, candidates: ref.candidates ? ref.candidates.map((c) => ({ planId: c.planId, name: c.name, versionId: c.versionId, versionNumber: c.versionNumber })) : void 0, reason: ref.reason, planId: ref.planId ?? null, link: REFERENCE_LINK, label: null, targetState: null, ...extra }, T: null, weights: Array(MONTHS).fill(0), scopeKind: "ministry", scopeLabel: MINISTRY_LABEL, profile: null, entityKeys: null };
}
var restrictedOf = (b, masked) => !!b.restricted || !!masked;
var profileOf = (view2) => {
  const p = view2?.content?.distribution?.profile ?? null;
  return { kind: p, assumption: p === "equal", label: p === "equal" ? bi2("\u062A\u0648\u0632\u064A\u0639 \u0645\u062A\u0633\u0627\u0648\u064D \u2014 \u0627\u0641\u062A\u0631\u0627\u0636", "Equal distribution \u2014 an assumption") : p === "manual" ? bi2("\u062A\u0648\u0632\u064A\u0639 \u0634\u0647\u0631\u064A \u064A\u062F\u0648\u064A", "Manual monthly distribution") : bi2("\u0644\u0645 \u064A\u064F\u062D\u062F\u064E\u0651\u062F \u062A\u0648\u0632\u064A\u0639 \u0634\u0647\u0631\u064A", "No monthly distribution chosen") };
};
function compute(year, entityKeys, viewScope, { muniGroup: muniGroup2 = false } = {}) {
  const ref = referenceFor2(year);
  if (ref.referenceState !== "ok") return unavailable(ref, year);
  const view2 = ref;
  const content = view2.content || {};
  const vs = normalizeViewScope(viewScope);
  const bound = vs.amanah !== "all";
  const keys = Array.isArray(entityKeys) && entityKeys.length ? entityKeys : null;
  const base = { state: "ok", ok: true, year, planId: view2.planId, versionId: view2.versionId, versionNumber: view2.versionNumber, name: view2.name, origin: view2.origin ?? null, illustrative: view2.origin === "seed" || view2.isSystem === true, source: view2.source, sourceLabel: view2.sourceLabel, period: view2.period, planScopeKind: view2.scope?.kind ?? null, link: REFERENCE_LINK };
  const masked = content.target?.masked === true || view2.masked === true;
  const b = planningBasisFromPlan({ view: view2, entityKeys: keys, viewScope: bound ? vs : null });
  if (b.state === "invalid_view_scope" || b.state === "invalid_period") {
    const reference2 = { ...base, targetState: b.state, reason: b.reason, viewScope: vs, viewLabel: null, municipalState: null, masked: restrictedOf(b, masked), label: null };
    reference2.label = referenceLine(reference2, null);
    return { ok: true, reference: reference2, T: null, weights: Array(MONTHS).fill(0), scopeKind: "ministry", scopeLabel: MINISTRY_LABEL, profile: profileOf(view2), entityKeys: null, period: view2.period };
  }
  const plannedOf = (basis) => Array.from({ length: MONTHS }, (_, i) => {
    const m = (basis.months || []).find((x) => x.ym === monthKey(year, i));
    return m ? m.planned : 0;
  });
  let T4 = b.target?.value ?? null;
  let planned = plannedOf(b);
  let scopeKind;
  let scopeLabel;
  let restricted = !!b.restricted || masked || !bound && b.scopeKind === "available";
  const maskedAmanahs = !bound && Array.isArray(content.maskedAmanahKeys) ? content.maskedAmanahKeys : [];
  if (maskedAmanahs.length) {
    let t = T4 > 0 ? T4 : 0;
    const pl = planned.map((x) => x || 0);
    let any = T4 > 0;
    for (const A of maskedAmanahs) {
      const ba = planningBasisFromPlan({ view: view2, entityKeys: keys, viewScope: { amanah: A, muni: "all" } });
      if (ba.target?.value > 0) {
        any = true;
        t += ba.target.value;
        plannedOf(ba).forEach((x, i) => {
          pl[i] += x || 0;
        });
      }
    }
    T4 = any ? t : null;
    planned = pl;
    restricted = true;
  }
  const mp = b.municipalState || null;
  if (bound) {
    scopeKind = b.scopeKind === "municipality" ? "municipality" : "amanah";
    scopeLabel = b.target?.label || b.viewLabel || b.scopeLabel || null;
  } else if (restricted) {
    scopeKind = "available";
    scopeLabel = RESTRICTED_LABEL;
  } else if (view2.scope?.kind === "entities") {
    scopeKind = "plan_entities";
    scopeLabel = bi2("\u0627\u0644\u062C\u0647\u0627\u062A \u0627\u0644\u0645\u0634\u0645\u0648\u0644\u0629 \u0628\u0627\u0644\u062E\u0637\u0629", "The entities covered by the plan");
  } else {
    scopeKind = "ministry";
    scopeLabel = MINISTRY_LABEL;
  }
  if (muniGroup2) {
    T4 = null;
    planned = Array(MONTHS).fill(0);
  }
  let targetState = "ok";
  if (muniGroup2 || b.state === "no_municipal_target") targetState = "no_municipal_target";
  else if (!(T4 > 0)) targetState = "no_target";
  const weights = T4 > 0 ? planned.map((x) => (x || 0) / T4) : Array(MONTHS).fill(0);
  const sc = planScope(view2.scope, keys);
  const planEntityKeys = view2.scope?.kind === "entities" && !bound ? sc.visible.slice() : null;
  const reference = { ...base, targetState, viewScope: vs, viewLabel: bound ? scopeLabel : null, municipalState: mp, masked: restricted, label: null };
  reference.label = referenceLine(reference, null);
  return { ok: true, reference, T: targetState === "ok" ? T4 : T4 === 0 && targetState === "no_target" ? 0 : null, weights, scopeKind, scopeLabel, profile: profileOf(view2), entityKeys: planEntityKeys, period: view2.period };
}
var memoKey = null;
var memo2 = /* @__PURE__ */ new Map();
function cached(year, entityKeys, viewScope, flags) {
  const ver = getSnapshot().version;
  if (memoKey !== ver) {
    memo2.clear();
    memoKey = ver;
  }
  const k = `${year}|${entityKeys ? entityKeys.join(",") : "-"}|${viewScope ? `${viewScope.amanah}/${viewScope.muni}` : "-"}|${flags?.muniGroup ? "g" : ""}`;
  if (!memo2.has(k)) memo2.set(k, compute(year, entityKeys, viewScope, flags));
  return memo2.get(k);
}
function referenceTargets(entityKeys = null, { year = APPROPRIATION_YEAR, base = {}, viewScope = null, muniGroup: muniGroup2 = false } = {}) {
  const keys = Array.isArray(entityKeys) && entityKeys.length ? entityKeys.slice() : null;
  const vs = viewScope ? normalizeViewScope(viewScope) : null;
  const read = () => cached(year, keys, vs && (vs.amanah !== "all" || vs.muni !== "all") ? vs : null, { muniGroup: muniGroup2 });
  const statusOf = (r) => r.reference.state !== "ok" ? "unavailable" : r.reference.illustrative ? "demo" : "plan";
  const amountOf = () => {
    const r = read();
    const ref = r.reference;
    const ok = ref.state === "ok" && r.T != null && ref.targetState !== "no_municipal_target";
    return {
      value: ok ? r.T : null,
      status: ok ? statusOf(r) : "unavailable",
      unavailable: ok && ref.targetState === "ok" ? null : ref.state !== "ok" ? ref.state : ref.targetState,
      version: ref.versionId ?? null,
      versionId: ref.versionId ?? null,
      versionNumber: ref.versionNumber ?? null,
      planId: ref.planId ?? null,
      planName: ref.name ?? null,
      owner: null,
      editedAt: null,
      source: "plan",
      provenance: ref.state === "ok" ? bi2(`${referenceLine(ref, null).ar}${ref.illustrative ? " \u2014 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629" : ""}.`, `${referenceLine(ref, null).en}${ref.illustrative ? " \u2014 illustrative data" : ""}.`) : bi2(referenceNotice(ref, "ar"), referenceNotice(ref, "en"))
    };
  };
  const o = { fiscalYear: base.fiscalYear ?? year, collectionRate: base.collectionRate ?? { value: 0.6, status: "demo", version: 1 } };
  if (keys) o.scopeEntityKeys = keys.slice();
  const defs = {
    collectionAmountAnnual: { enumerable: true, get: amountOf },
    monthlyCurve: { enumerable: true, get: () => {
      const r = read();
      return { curveMode: "plan", weights: r.weights, equalWeights: r.weights, status: "demo", source: "plan", profile: r.profile };
    } },
    scopeKind: { enumerable: true, get: () => read().scopeKind },
    scopeLabel: { enumerable: true, get: () => read().scopeLabel },
    reference: { enumerable: true, get: () => read().reference },
    viewScope: { enumerable: true, get: () => read().reference.viewScope || { amanah: "all", muni: "all" } },
    planEntityKeys: { enumerable: true, get: () => read().entityKeys }
  };
  const t = Object.defineProperties(o, defs);
  Object.defineProperty(t, "__rebuild", { enumerable: false, value: { entityKeys: keys, year, base: { fiscalYear: o.fiscalYear, collectionRate: o.collectionRate } } });
  return t;
}

// src/data/revenueMetrics.js
function ratio(num2, den) {
  const ok = Number.isFinite(num2) && Number.isFinite(den) && den > 0;
  return { calculable: ok, value: ok ? num2 / den : null, num: num2, den };
}
function ppChange(curr, prev) {
  if (!curr?.calculable || !prev?.calculable) return { calculable: false, value: null };
  return { calculable: true, value: Math.round((curr.value - prev.value) * 1e3) / 10 };
}
var EXCLUSION_RULE_SET_VERSION = "EXCL-RULES v4 (meeting 21 Oct \u2014 demo configuration)";
var EXCLUSION_RULES = [
  {
    id: "DUP-1",
    category: "duplicate",
    version: 1,
    priority: 11,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-07-01",
    owner: { en: "Revenue data steward", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A" },
    label: { en: "Duplicate invoice (R11)", ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0643\u0631\u0631\u0629" },
    note: { en: "Same customer, amount, product, revenue account and issue DATE with a different invoice number (AI duplicate detection). The earliest-numbered invoice is kept and the others are excluded. The same values in different years are NOT duplicates.", ar: "\u0646\u0641\u0633 \u0627\u0644\u0639\u0645\u064A\u0644 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u0645\u0646\u062A\u062C \u0648\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u064A\u0631\u0627\u062F \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u062F\u0627\u0631 \u0628\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u062E\u062A\u0644\u0641 (\u0643\u0634\u0641 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A). \u062A\u0628\u0642\u0649 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u0642\u062F\u0645 \u0631\u0642\u0645\u0627\u064B \u0648\u062A\u064F\u0633\u062A\u0628\u0639\u062F \u0627\u0644\u0628\u0642\u064A\u0629. \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0642\u064A\u0645 \u0641\u064A \u0633\u0646\u0648\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629 \u0644\u064A\u0633 \u062A\u0643\u0631\u0627\u0631\u0627\u064B." }
  },
  {
    id: "CR-1",
    category: "struck_off_registry",
    version: 1,
    priority: 8,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-07-01",
    owner: { en: "Revenue data steward", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A" },
    label: { en: "Struck-off commercial registration (R10)", ar: "\u0633\u062C\u0644\u0627\u062A \u0645\u0634\u0637\u0648\u0628\u0629" },
    note: { en: "Balady invoice joined with the commercial-registration view: status Deleted or Cancelled \u2192 excluded. The raw status is kept as received; Suspended is not listed.", ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0644\u062F\u064A \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0639\u0631\u0636 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A: \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u062D\u0630\u0648\u0641 \u0623\u0648 \u0645\u0644\u063A\u0649 \u2192 \u062A\u064F\u0633\u062A\u0628\u0639\u062F. \u062A\u064F\u062D\u0641\u0638 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062E\u0627\u0645 \u0643\u0645\u0627 \u0648\u0631\u062F\u062A\u061B \u0648\u0644\u0627 \u062A\u064F\u062F\u0631\u062C \xAB\u0645\u0639\u0644\u0651\u0642\xBB." }
  },
  {
    id: "STY-1",
    category: "service_company_stay",
    version: 1,
    priority: 6,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-21",
    owner: { en: "Revenue management (meeting 21 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 21 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Stay of execution \u2013 service companies (working label)", ar: "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u2013 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u064A\u0629" },
    note: { en: "Added in the 21 Oct meeting: invoices of the National Water Company and service companies under a high-order stay of execution pending a committee. Customer on a configurable list (SERVICE_COMPANY_LIST). Takes precedence over R1. The label is a working label to confirm.", ar: "\u0623\u064F\u0636\u064A\u0641 \u0641\u064A \u0627\u062C\u062A\u0645\u0627\u0639 21 \u0623\u0643\u062A\u0648\u0628\u0631: \u0641\u0648\u0627\u062A\u064A\u0631 \u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u064A\u0627\u0647 \u0627\u0644\u0648\u0637\u0646\u064A\u0629 \u0648\u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u064A\u0629 \u0627\u0644\u0648\u0627\u0642\u0639\u0629 \u062A\u062D\u062A \u0623\u0645\u0631 \u0639\u0627\u0644\u064D \u0628\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u062C\u0646\u0629. \u0627\u0644\u0639\u0645\u064A\u0644 \u0636\u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0636\u0628\u0637. \u062A\u0633\u0628\u0642 \xAB\u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0627 \u062A\u0633\u062A\u0646\u062F \u0639\u0644\u0649 \u0639\u0642\u0648\u062F\xBB. \u0627\u0644\u062A\u0633\u0645\u064A\u0629 \u0645\u0624\u0642\u062A\u0629 \u0644\u0644\u062A\u0623\u0643\u064A\u062F." }
  },
  {
    id: "NOC-1",
    category: "no_contract",
    version: 1,
    priority: 7,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-18",
    owner: { en: "Revenue management (meeting 18 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 18 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Invoices not based on contracts (R1)", ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0627 \u062A\u0633\u062A\u0646\u062F \u0639\u0644\u0649 \u0639\u0642\u0648\u062F" },
    note: { en: "Any invoice, from any Amanah or entity (central or internal), with an investment revenue account and no contract in Furas. The invoice is excluded as uncollected.", ar: "\u0623\u064A \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0646 \u0623\u064A \u0623\u0645\u0627\u0646\u0629 \u0623\u0648 \u062C\u0647\u0629 (\u0645\u0631\u0643\u0632\u064A\u0629 \u0623\u0648 \u062F\u0627\u062E\u0644\u064A\u0629) \u0628\u062D\u0633\u0627\u0628 \u0625\u064A\u0631\u0627\u062F \u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A \u0648\u0644\u0627 \u0639\u0642\u062F \u0644\u0647\u0627 \u0641\u064A \u0641\u0631\u0635. \u062A\u064F\u0633\u062A\u0628\u0639\u062F \u0643\u063A\u064A\u0631 \u0645\u062D\u0635\u0651\u0644\u0629." }
  },
  {
    id: "INC-1",
    category: "incomplete_data",
    version: 1,
    priority: 4,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-18",
    owner: { en: "Revenue management (meeting 18 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 18 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Incomplete (R4)", ar: "\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644" },
    note: { en: "Efaa \xAB\u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u0623\u062F\u0627\u0621\xBB report: status \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644 \u2192 take the violation number, link it to the invoice number, exclude.", ar: "\u062A\u0642\u0631\u064A\u0631 \u0625\u064A\u0641\u0627\u0621 \xAB\u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u0623\u062F\u0627\u0621\xBB: \u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644 \u2192 \u064A\u0624\u062E\u0630 \u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0648\u064A\u064F\u0631\u0628\u0637 \u0628\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u062A\u064F\u0633\u062A\u0628\u0639\u062F." }
  },
  {
    id: "EXE-1",
    category: "executed_against",
    version: 1,
    priority: 2,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-18",
    owner: { en: "Revenue management (meeting 18 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 18 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Executed against \u2013 Efaa (R6)", ar: "\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 \u2013 \u0625\u064A\u0641\u0627\u0621" },
    note: { en: "Efaa \xAB\u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647\xBB report: every violation in the report (execution and violation numbers) is linked to its invoice and excluded. Complete / incomplete does not come from this report.", ar: "\u062A\u0642\u0631\u064A\u0631 \u0625\u064A\u0641\u0627\u0621 \xAB\u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647\xBB: \u0643\u0644 \u0645\u062E\u0627\u0644\u0641\u0629 \u0641\u064A \u0627\u0644\u062A\u0642\u0631\u064A\u0631 (\u0631\u0642\u0645 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629) \u062A\u064F\u0631\u0628\u0637 \u0628\u0641\u0627\u062A\u0648\u0631\u062A\u0647\u0627 \u0648\u062A\u064F\u0633\u062A\u0628\u0639\u062F. \u0648\u0644\u0627 \u064A\u0624\u062E\u0630 \u0645\u0646\u0647 \u0627\u0644\u0627\u0643\u062A\u0645\u0627\u0644/\u0639\u062F\u0645\u0647." }
  },
  {
    id: "EFA-1",
    category: "outside_efaa",
    version: 1,
    priority: 5,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-18",
    owner: { en: "Revenue management (meeting 18 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 18 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Outside Efaa (R5)", ar: "\u062E\u0627\u0631\u062C \u0625\u064A\u0641\u0627\u0621" },
    note: { en: "Penalties (main class \u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A \u0648\u0627\u0644\u063A\u0631\u0627\u0645\u0627\u062A) within the uncollected invoices that do not appear in Efaa. The Efaa number is linked to the invoice number. Written against Tahseel uncollected data.", ar: "\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A \u0636\u0645\u0646 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0627\u0644\u062A\u064A \u0644\u0627 \u062A\u0638\u0647\u0631 \u0641\u064A \u0625\u064A\u0641\u0627\u0621. \u064A\u064F\u0631\u0628\u0637 \u0631\u0642\u0645 \u0625\u064A\u0641\u0627\u0621 \u0628\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629. \u0627\u0644\u0642\u0627\u0639\u062F\u0629 \u0645\u0643\u062A\u0648\u0628\u0629 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062D\u0635\u064A\u0644 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629." }
  },
  {
    id: "OBJ-1",
    category: "objection",
    version: 1,
    priority: 3,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-18",
    owner: { en: "Revenue management (meeting 18 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 18 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Open objections (R7)", ar: "\u0627\u0639\u062A\u0631\u0627\u0636\u0627\u062A \u0642\u0627\u0626\u0645\u0629" },
    note: { en: "Source: Efaa in the current form, Mumtathil also in future (appeal status column). Excluded: \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0639\u0636\u0648 \xB7 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0644\u062C\u0646\u0629 \xB7 \u0645\u0642\u0628\u0648\u0644 \u062C\u0632\u0626\u064A\u064B\u0627 \xB7 \u0645\u0643\u062A\u0645\u0644 \u0645\u0642\u0628\u0648\u0644. Kept collectable: \u0645\u0643\u062A\u0645\u0644 \u0645\u0631\u0641\u0648\u0636. The status is shown on the invoice.", ar: "\u0627\u0644\u0645\u0635\u062F\u0631: \u0625\u064A\u0641\u0627\u0621 \u0641\u064A \u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u060C \u0648\u0645\u0645\u062A\u062B\u0644 \u0623\u064A\u0636\u064B\u0627 \u0645\u0633\u062A\u0642\u0628\u0644\u064B\u0627 (\u0639\u0645\u0648\u062F \u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641). \u062A\u064F\u0633\u062A\u0628\u0639\u062F: \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0639\u0636\u0648 \xB7 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0644\u062C\u0646\u0629 \xB7 \u0645\u0642\u0628\u0648\u0644 \u062C\u0632\u0626\u064A\u064B\u0627 \xB7 \u0645\u0643\u062A\u0645\u0644 \u0645\u0642\u0628\u0648\u0644. \u062A\u0628\u0642\u0649 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062A\u062D\u0635\u064A\u0644: \u0645\u0643\u062A\u0645\u0644 \u0645\u0631\u0641\u0648\u0636. \u0648\u062A\u0638\u0647\u0631 \u0627\u0644\u062D\u0627\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629." }
  },
  {
    id: "ENF-1",
    category: "enforcement",
    version: 1,
    priority: 99,
    defaultEnabled: false,
    locked: true,
    basis: "not_an_exclusion",
    approval: "approved",
    effectiveFrom: "2026-07-01",
    owner: { en: "Revenue data steward", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A" },
    label: { en: "Referred to enforcement (reported as a separate dimension)", ar: "\u0645\u062D\u0627\u0644 \u0625\u0644\u0649 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 (\u064A\u064F\u0639\u0631\u0636 \u0643\u0628\u064F\u0639\u062F \u0645\u0646\u0641\u0635\u0644)" },
    note: { en: "Not applied: a source-cancelled invoice referred to enforcement stays cancelled (conditions and approver unconfirmed); enforcement is reported as a separate dimension.", ar: "\u063A\u064A\u0631 \u0645\u0637\u0628\u0651\u0642\u0629: \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0644\u063A\u0627\u0629 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u0648\u0627\u0644\u0645\u062D\u0627\u0644\u0629 \u0644\u0644\u062A\u0646\u0641\u064A\u0630 \u062A\u0628\u0642\u0649 \u0645\u0644\u063A\u0627\u0629 (\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u062C\u0647\u0629 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u063A\u064A\u0631 \u0645\u0624\u0643\u062F\u0629)\u061B \u0648\u064A\u064F\u0639\u0631\u0636 \u0627\u0644\u0625\u0646\u0641\u0627\u0630 \u0628\u064F\u0639\u062F\u0627\u064B \u0645\u0646\u0641\u0635\u0644\u0627\u064B." }
  },
  {
    id: "SND-1",
    category: "executed_against_sanad",
    version: 1,
    priority: 1,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-18",
    owner: { en: "Revenue management (meeting 18 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 18 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Linked to a confirmed enforcement order", ar: "\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0623\u0645\u0631 \u062A\u0646\u0641\u064A\u0630 \u0645\u0624\u0643\u062F" },
    note: { en: "Any UNCOLLECTED invoice found in Sanad (new cases) is excluded, whatever its Sanad status (D12). Applies only to uncollected invoices.", ar: "\u0623\u064A \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062D\u0635\u0651\u0644\u0629 \u062A\u0638\u0647\u0631 \u0641\u064A \u0633\u0646\u062F (\u0642\u0636\u0627\u064A\u0627 \u062C\u062F\u064A\u062F\u0629) \u062A\u064F\u0633\u062A\u0628\u0639\u062F \u0645\u0647\u0645\u0627 \u0643\u0627\u0646\u062A \u062D\u0627\u0644\u062A\u0647\u0627 \u0641\u064A \u0633\u0646\u062F (D12). \u062A\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0641\u0642\u0637." }
  },
  {
    id: "ATT-1",
    category: "amanah_statements",
    version: 1,
    priority: 10,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-19",
    owner: { en: "Revenue management (meeting 19 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 19 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Amanah statements (R9)", ar: "\u0625\u0641\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A" },
    note: { en: "Loaded only through the exclusion upload template (the Amanah's file). Applies only to uncollected invoices.", ar: "\u062A\u064F\u062D\u0645\u064E\u0651\u0644 \u0641\u0642\u0637 \u0639\u0628\u0631 \u0642\u0627\u0644\u0628 \u0631\u0641\u0639 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A (\u0645\u0644\u0641 \u0627\u0644\u0623\u0645\u0627\u0646\u0629). \u0648\u062A\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0641\u0642\u0637." }
  },
  {
    id: "ENC-1",
    category: "site_encroachment",
    version: 1,
    priority: 9,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-10-19",
    owner: { en: "Revenue management (meeting 19 Oct)", ar: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0627\u062C\u062A\u0645\u0627\u0639 19 \u0623\u0643\u062A\u0648\u0628\u0631)" },
    label: { en: "Encroachments and site exploitation (R8)", ar: "\u0627\u0644\u062A\u0639\u062F\u064A\u0627\u062A \u0648\u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 (\u0645\u062D\u0636\u0631 \u0627\u0644\u062A\u0639\u062F\u064A)" },
    note: { en: "Investment invoices (outside Furas, may be internal) reported by the Amanah, loaded through the exclusion upload template. Applies only to uncollected invoices.", ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 (\u062E\u0627\u0631\u062C \u0641\u0631\u0635 \u0648\u0642\u062F \u062A\u0643\u0648\u0646 \u062F\u0627\u062E\u0644\u064A\u0629) \u062A\u0641\u064A\u062F \u0628\u0647\u0627 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0648\u062A\u064F\u062D\u0645\u064E\u0651\u0644 \u0639\u0628\u0631 \u0642\u0627\u0644\u0628 \u0631\u0641\u0639 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A. \u0648\u062A\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0641\u0642\u0637." }
  }
];
var EXCLUSION_CATEGORIES = EXCLUSION_RULES.map((r) => r.category);
var DEFAULT_CONFIG = {
  cutoff: DATA_CUTOFF,
  // Grace period treatment is UNRESOLVED in the supplied material. 0 = overdue the day after due date.
  graceDays: 0,
  // HEADLINE basis (EQ1, approved): 'periodEnd' = only payments up to the end of the selected period (a closed period is measured at its own end;
  // an open period at the data cutoff). 'cutoff' = every payment up to the data cutoff — shown ONLY as a separate, labelled figure on request.
  collectionsAsOf: "periodEnd",
  // Which RAW commercial-registration statuses qualify under CR-1. The raw status is always kept as received;
  // "Suspended" is deliberately not listed (unresolved with the business).
  crStatuses: ["Deleted", "Cancelled"],
  // 'total' = amounts as invoiced (VAT included where the source includes it). VAT is shown separately, never netted silently.
  amountBasis: "total",
  rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.defaultEnabled]))
};
function normalizeConfig(cfg) {
  const c = { ...DEFAULT_CONFIG, ...cfg || {} };
  c.rules = { ...DEFAULT_CONFIG.rules, ...cfg && cfg.rules || {} };
  for (const r of EXCLUSION_RULES) if (r.locked) c.rules[r.id] = r.defaultEnabled;
  return c;
}
var NONCOLLECTION_CATEGORIES = [
  "cancelled",
  "excluded",
  "objection",
  "linkage_unresolved",
  "ineligible_referral",
  "partial",
  "overdue",
  "not_due"
];
var DEFAULT_TARGETS = referenceTargets(null, {
  year: APPROPRIATION_YEAR,
  base: { fiscalYear: Number(DATA_CUTOFF.slice(0, 4)), collectionRate: { value: 0.6, status: "demo", provenance: { en: "Illustrative demo input \u2014 no approved collection-rate target was supplied. Replace via configuration.", ar: "\u0645\u064F\u062F\u062E\u0644 \u062A\u0648\u0636\u064A\u062D\u064A \u2014 \u0644\u0645 \u064A\u064F\u0632\u0648\u064E\u0651\u062F \u0628\u0647\u062F\u0641 \u0645\u0639\u062A\u0645\u062F \u0644\u0645\u0639\u062F\u0644 \u0627\u0644\u062A\u062D\u0635\u064A\u0644. \u0627\u0633\u062A\u0628\u062F\u0644\u0647 \u0639\u0628\u0631 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A." }, version: 1 } }
});

// server/iimRow.js
var hashOf = (n) => Math.imul(n % 2147483629 | 0, 2654435761) >>> 0;
var DIFFERENCES_SHARE = 14;
function municipalityOfRow(st, i) {
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const sourceValue = fx ? fx.municipalitySourceValues ? fx.municipalitySourceValues.join(" / ") : fx.municipalityAr || null : null;
  return municipalityFields({ ent: st.ent[i], code: st.mref[i], sourceKey: SOURCES[st.src[i]].key, sourceValue, synthetic: !fx });
}
function iimFields(st, i) {
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ent = st.ent[i];
  const sc = st.scope[i];
  const b = fx?.billerId ? { id: fx.billerId, ar: billerOf(ent, sc).ar, en: billerOf(ent, sc).en } : billerOf(ent, sc);
  const origin = originOf(b.id);
  const oIdx = originIdxOf(ent, sc);
  const sourceKey = SOURCES[st.src[i]].key;
  const pk = productOf(sourceKey, ITEMS[st.item[i]].key, oIdx);
  const cls = classOfRow(st.gfs[i], origin === "central" ? 0 : 1);
  const disclosure = DISCLOSURE_PRODUCTS.includes(pk);
  const kind = disclosure && !fx ? hashOf(st.idKey[i]) % 100 < DIFFERENCES_SHARE ? "differences" : "occupancy" : null;
  const invoiceNo = fx ? fx.invoiceNo || fx.sadadNo || "" : sadadOf(st.idKey[i]);
  const amanahId = demoAmanahId(ent);
  const municipalityId = fx ? null : demoMunicipalityId(st.muni[i]);
  const ck = compositeKey({ invoiceId: invoiceNo, gfsCode: cls.code, amanahId, municipalityId });
  return {
    invoiceNo,
    amanahId,
    municipalityId,
    compositeKey: ck.key,
    ...municipalityOfRow(st, i),
    keyComplete: ck.complete,
    keyMissing: ck.missing,
    sadadNo: fx ? fx.sadadNo || "" : sadadOf(st.idKey[i]),
    billerId: b.id,
    billerAr: b.ar,
    billerEn: b.en,
    origin,
    originAr: ORIGIN_AR[origin],
    originIdx: oIdx,
    productKey: pk,
    productAr: PRODUCTS[pk].ar,
    productEn: PRODUCTS[pk].en,
    gfsCode: cls.code,
    gfsSub: cls.sub,
    mainClass: cls.main,
    gfsIdx: st.gfs[i],
    invoiceKind: kind,
    entityType: entityTypeOf(ent),
    entityTypeAr: ENTITY_TYPE_AR[entityTypeOf(ent)]
  };
}
var INVOICE_KIND_SHORT_AR = { occupancy: "\u0625\u0634\u063A\u0627\u0644\u0627\u062A", differences: "\u0641\u0631\u0648\u0642\u0627\u062A" };
function exclusionOf(D) {
  if (!D.excluded || !D.primaryBit) return null;
  const ruleId = RULE_IDS[Math.round(Math.log2(D.primaryBit))];
  const r = EXCLUSION_REASON_OF_RULE[ruleId];
  const s = EXCLUSION_SOURCE_OF_RULE[ruleId];
  return r ? { ruleId, n: r.n, code: r.code, reasonAr: r.ar, reasonEn: r.en, sourceAr: s?.ar || null, sourceEn: s?.en || null } : null;
}
function exclusionReasonsOf(D) {
  if (!D.excluded || !D.primaryBit) return [];
  const pb = Math.round(Math.log2(D.primaryBit));
  const out = [];
  const add = (b) => {
    const ruleId = RULE_IDS[b];
    const r = EXCLUSION_REASON_OF_RULE[ruleId];
    if (r) out.push({ ruleId, reasonAr: r.ar, reasonEn: r.en, primary: b === pb });
  };
  add(pb);
  for (let b = 0; b < RULE_IDS.length; b += 1) if (b !== pb && D.mask & 1 << b) add(b);
  return out;
}
var INVESTMENT_NO_CONTRACT_CAUSES = [
  { ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0634\u0627\u0634\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0635\u0627\u062F\u0631\u0629 \u064A\u062F\u0648\u064A\u064B\u0627", en: "An electronic-screen invoice issued manually" },
  { ar: "\u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u0627\u0644\u0645\u0648\u0642\u0639 \u0628\u0639\u062F \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F", en: "Use of the site after the contract ended" },
  { ar: "\u0627\u062D\u062A\u0645\u0627\u0644 \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062A\u0635\u0646\u064A\u0641", en: "A possible classification error" },
  { ar: "\u0639\u0642\u062F \u0645\u0646\u062A\u0647\u064D \u062F\u0648\u0646 \u062A\u062C\u062F\u064A\u062F", en: "A contract that expired without renewal" }
];
function investmentOutcome(st, i, im) {
  if (im.mainClass !== MAIN.investment) return null;
  if (im.origin === "internal") return "internal_note";
  const cs = st.cstat[i];
  return cs === 1 ? "linked" : cs === 2 || cs === 3 || cs === 4 ? "not_linked" : "linked_unverified";
}
function iimDetail(st, i, rec, D) {
  const im = iimFields(st, i);
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const idKey = st.idKey[i];
  const gen = !fx;
  const pk = im.productKey;
  const company = gen ? st.payer[i] < 1e4 : true;
  const last = rec.payments?.length ? rec.payments.reduce((m, p) => p.date > m ? p.date : m, "") : null;
  const full = D.collected > 0 && D.outstanding <= 0 && !D.cancelled ? last : null;
  const settle = full ? isoOf(Math.round(Date.parse(full) / 864e5 + 1 + idKey % 3)) : null;
  const out = {
    ...im,
    exclusion: exclusionOf(D),
    referenceNo: gen ? subscriptionOf(idKey) : null,
    requestNo: gen && ["municipal_fees", "licenses", "white_lands"].includes(rec.revenueSource) ? REQUEST.of(idKey) : null,
    beneficiary: {
      idType: company ? { ar: "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A", en: "Commercial registration" } : { ar: "\u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629", en: "National ID" },
      id: rec.beneficiaryId || null,
      name: { ar: rec.entityAr, en: rec.entityEn },
      mobile: null
      /* personal contact data is never sent to the page */
    },
    paidDate: full,
    settlementDate: settle,
    cancelDate: rec.cancelled?.date || null,
    revenueAmount: Math.max(0, rec.grossAmount - (rec.vatAmount || 0)),
    disclosure: null,
    investment: null
  };
  if (im.invoiceKind) {
    const iss = isoOf(st.issue[i]);
    const prev = Date.UTC(Number(iss.slice(0, 4)), Number(iss.slice(5, 7)) - 2, 1);
    const dd = new Date(prev);
    out.disclosure = { kind: im.invoiceKind, taxpayer: { ar: rec.entityAr, en: rec.entityEn }, facility: { key: facilityKeyOf(st.payer[i]), ar: rec.entityAr, en: rec.entityEn }, year: im.invoiceKind === "occupancy" ? dd.getUTCFullYear() : null, month: im.invoiceKind === "occupancy" ? dd.getUTCMonth() + 1 : null };
  }
  const outcome = investmentOutcome(st, i, im);
  if (outcome) out.investment = { outcome, causes: outcome === "not_linked" ? INVESTMENT_NO_CONTRACT_CAUSES : [] };
  return out;
}

// server/accessMask.js
var NE = ENTITIES.length;
var DENY_ALL = Object.freeze({ all: false, grants: [], nonMunicipal: false });
function normalizeAccess(access) {
  if (access === void 0 || access === null) return { all: true };
  if (typeof access !== "object" || Array.isArray(access)) return { ...DENY_ALL };
  if (access.all === true) return { all: true };
  try {
    const n = normalizeGeoScope(access);
    return n && typeof n === "object" ? n : { ...DENY_ALL };
  } catch {
    return { ...DENY_ALL };
  }
}
var tables = /* @__PURE__ */ new Map();
var MAX_TABLES = 64;
var accessEpoch = 0;
function bumpAccessEpoch() {
  accessEpoch += 1;
  tables.clear();
  masks.clear();
}
var ALL_TABLE = Object.freeze({ all: true, key: "ALL", tab: null, ent: null });
function accessTable(access) {
  const scope = normalizeAccess(access);
  if (scope.all === true) return ALL_TABLE;
  const key = geoScopeKey(scope);
  const hit = tables.get(key);
  if (hit) {
    tables.delete(key);
    tables.set(key, hit);
    return hit;
  }
  const tab = new Uint8Array(NE * MUNI_SLOTS);
  const ent = new Uint8Array(NE);
  for (let e = 0; e < NE; e += 1) {
    const amanah = ENTITIES[e].en;
    const nonMunicipal = e >= N_AMANAH;
    for (let c = 0; c < MUNI_SLOTS; c += 1) {
      const m = e < N_AMANAH ? municipalityOfCode(e, c) : null;
      const status = e < N_AMANAH ? statusOfCode(e, c) : c === 1 ? "direct_amanah" : "not_specified";
      const ok = geoScopeAllowsRecord(scope, { amanah, municipalityRefId: m ? m.refId : null, municipalityStatus: status, nonMunicipal }) === true;
      if (ok) {
        tab[e * MUNI_SLOTS + c] = 1;
        ent[e] = 1;
      }
    }
  }
  const t = { all: false, key, tab, ent, scope };
  tables.set(key, t);
  if (tables.size > MAX_TABLES) tables.delete(tables.keys().next().value);
  return t;
}
var slotIndex = (e, code) => e * MUNI_SLOTS + (code < MUNI_SLOTS ? code : 0);
var visibleCode = (tab, e, code) => tab.all || tab.tab[slotIndex(e, code)] === 1;
var isVisible = (st, i, tab) => tab.all || tab.tab[slotIndex(st.ent[i], st.mref[i])] === 1;
var entityReachable = (tab, e) => tab.all || tab.ent[e] === 1;
var masks = /* @__PURE__ */ new Map();
var accessKeyOf = (access) => accessTable(access).key;

// server/engine.js
var CLASSES = ["collected", "cancelled", "excluded", "objection", "enforcement", "linkage_unresolved", "ineligible_referral", "partial", "overdue", "not_due"];
var C = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
var CLASS_INDEX = C;
function objectionStatusKey(st, i) {
  const k = st.objSt[i];
  return (OBJECTION_STATUSES[k - 1] || OBJECTION_STATUSES[0]).key;
}
var objectionExcludes = (st, i) => OBJECTION_STATUS_OF[objectionStatusKey(st, i)].exclude;
var RULES = EXCLUSION_RULES.map((r, i) => ({ id: r.id, bit: 1 << i, priority: r.priority, approved: r.approval === "approved", category: r.category, locked: r.locked }));
if (RULES.some((r, i) => r.id !== RULE_IDS[i])) throw new Error("rule order mismatch between catalog and revenueMetrics");
var OBJ_BIT = RULE_BIT["OBJ-1"];
var SND_BIT = RULE_BIT["SND-1"];
var CR_BIT = RULE_BIT["CR-1"];
var DUP_BIT = RULE_BIT["DUP-1"];
var STY_BIT = RULE_BIT["STY-1"];
var BY_PRIORITY = [...RULES].sort((a, b) => a.priority - b.priority);
var NBITS = RULES.length;
var K = 23;
var M2 = { exclusionsRules: 21, count: 0, gross: 1, adjustments: 2, exclusions: 3, net: 4, collected: 5, outstanding: 6, overpayment: 7, receiptsOnExcluded: 8, excludedCount: 9, cancelled: 10, cancelledCount: 11, overlapCount: 12, overlapAmount: 13, multiReasonCount: 14, exclusionsApproved: 15, exclusionsUnapproved: 16, overdueOutstanding: 17, notDueOutstanding: 18, violationCount: 19, enforcementCount: 20, ignoredExclusions: 22 };
var Acc = class {
  constructor(groups) {
    this.a = new Float64Array(groups * K);
    this.groups = groups;
  }
  add(g, D) {
    const a = this.a;
    const o = g * K;
    a[o + M2.count] += 1;
    a[o + M2.gross] += D.gross;
    a[o + M2.adjustments] += D.adj;
    a[o + M2.exclusions] += D.exclTotal;
    a[o + M2.exclusionsRules] += D.exclusionAmount;
    a[o + M2.net] += D.net;
    a[o + M2.collected] += D.collected;
    a[o + M2.outstanding] += D.outstanding;
    a[o + M2.overpayment] += D.overpayment;
    if (D.excluded) {
      a[o + M2.excludedCount] += 1;
      if (D.nReasons > 1) a[o + M2.multiReasonCount] += 1;
      if (D.primaryApproved) a[o + M2.exclusionsApproved] += D.exclusionAmount;
      else a[o + M2.exclusionsUnapproved] += D.exclusionAmount;
    }
    if (D.ignoredExclusion) a[o + M2.ignoredExclusions] += 1;
    if (D.cancelled) {
      a[o + M2.cancelled] += D.cancelledAmount;
      a[o + M2.cancelledCount] += 1;
    }
    if (D.overlaps) {
      a[o + M2.overlapCount] += 1;
      a[o + M2.overlapAmount] += D.cancelledAmount;
      if (D.nReasons > 1) a[o + M2.multiReasonCount] += 1;
    }
    if (D.outstanding > 0) {
      if (D.daysOverdue > 0) a[o + M2.overdueOutstanding] += D.outstanding;
      else a[o + M2.notDueOutstanding] += D.outstanding;
    }
  }
  addMeta(g, viol, enf) {
    const o = g * K;
    if (viol) this.a[o + M2.violationCount] += 1;
    if (enf) this.a[o + M2.enforcementCount] += 1;
  }
  toAgg(g) {
    const a = this.a;
    const o = g * K;
    const r = {};
    for (const [k, i] of Object.entries(M2)) r[k] = a[o + i];
    r.billedAfterAdj = r.gross;
    r.grossBeforeAdjustments = r.gross - r.adjustments;
    r.collectedOverNet = ratio(r.collected, r.net);
    r.exclusionRate = ratio(r.exclusions, r.gross);
    r.collectedOverGross = ratio(r.collected, r.gross);
    r.exclusionKpiImpactPp = ppChange(r.collectedOverNet, r.collectedOverGross);
    return r;
  }
};
var TopK = class {
  constructor(k) {
    this.k = k;
    this.idx = [];
    this.val = [];
    this.min = -Infinity;
  }
  push(i, v) {
    if (this.idx.length < this.k) {
      this.idx.push(i);
      this.val.push(v);
      if (this.idx.length === this.k) this.recalc();
      return;
    }
    if (v <= this.min) return;
    const j = this.val.indexOf(this.min);
    this.idx[j] = i;
    this.val[j] = v;
    this.recalc();
  }
  recalc() {
    this.min = Math.min(...this.val);
  }
  sorted() {
    return this.idx.map((i, j) => [i, this.val[j]]).sort((a, b) => b[1] - a[1]);
  }
};
function lookupKey(st, key) {
  let lo = 0;
  let hi = st.nGen - 1;
  while (lo <= hi) {
    const mid = lo + hi >> 1;
    const v = st.idKey[mid];
    if (v === key) return mid;
    if (v < key) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
var contractsByNumber = (st, no) => {
  const k = String(no || "").trim().toUpperCase();
  return k ? (st.contracts || []).filter((c) => c && String(c.contractNo).toUpperCase() === k) : [];
};
var lookupInvoiceNo = (st, no) => lookupSadad(st, String(no || "").trim());
function lookupComposite(st, key) {
  const p = parseCompositeKey(key);
  if (!p) return -1;
  const m = lookupInvoiceNo(st, p.invoiceId).filter((i) => iimFields(st, i).compositeKey === key);
  return m.length === 1 ? m[0] : -1;
}
function lookupRef(st, ref) {
  const s = String(ref || "").trim();
  if (!s) return { status: "none", kind: "empty", indexes: [] };
  if (parseCompositeKey(s)) {
    const i = lookupComposite(st, s);
    return { status: i >= 0 ? "unique" : "none", kind: "composite", indexes: i >= 0 ? [i] : [] };
  }
  if (parseInvoiceKey(s)) {
    const i = lookupId(st, s);
    return { status: i >= 0 ? "unique" : "none", kind: "legacy_id", indexes: i >= 0 ? [i] : [] };
  }
  const c = lookupInvoiceNo(st, s);
  const r = resolveByNumber(c);
  return { status: r.status, kind: "number", indexes: c };
}
function lookupId(st, id) {
  const s = String(id || "").trim();
  if (s.startsWith("ick1|")) return lookupComposite(st, s);
  if (st.fixtureById.has(s)) return st.fixtureById.get(s);
  const p = parseInvoiceKey(s);
  if (!p) return -1;
  const key = idKeyFromSadad(p.sadad);
  if (key == null) return -1;
  const i = lookupKey(st, key);
  return i >= 0 && idOf(st, i) === `${p.billerId}-${p.sadad}` ? i : -1;
}
function lookupSadad(st, sadad) {
  const out = [];
  const key = idKeyFromSadad(sadad);
  if (key != null) {
    const i = lookupKey(st, key);
    if (i >= 0) out.push(i);
  }
  for (const [i, r] of st.fixtures) if (r.sadadNo === sadad) out.push(i);
  return out;
}
function idOf(st, i) {
  if (i >= st.nGen) return st.fixtures.get(i)?.id ?? `X-${i}`;
  return invoiceIdFor(st.ent[i], st.scope[i], st.idKey[i]);
}
function makeCtx(st, req = {}) {
  const cfg = normalizeConfig(req.cfg || {});
  const cutoffN = dayNum(cfg.cutoff);
  const ctx = { st, cfg, cutoffN, owner: Number(req.owner) || 0, acc: accessTable(req.access), graceDays: cfg.graceDays || 0, periodEndMode: cfg.collectionsAsOf === "periodEnd" };
  let enabled = 0;
  RULES.forEach((r) => {
    if (cfg.rules[r.id] && !r.locked) enabled |= r.bit;
  });
  ctx.enabled = enabled;
  ctx.objOn = !!cfg.rules["OBJ-1"];
  ctx.sndOn = !!cfg.rules["SND-1"];
  ctx.styOn = !!cfg.rules["STY-1"];
  ctx.autoApply = EXCLUSIONS_AUTO_APPLY;
  ctx.crOk = [true, true, false, false, false];
  const names = ["", "Active", "Deleted", "Suspended", "Cancelled"];
  ctx.crOk = names.map((n, k) => k === 0 ? true : (cfg.crStatuses || []).includes(n));
  ctx.mark = null;
  ctx.ov = /* @__PURE__ */ new Map();
  ctx.linkInfo = req.linkInfo || {};
  const dec2 = req.decisions || {};
  const links = req.links || {};
  const fileEx = req.fileExclusions || {};
  const need = Object.keys(dec2).length + Object.keys(links).length + Object.keys(fileEx).length;
  if (need) {
    ctx.mark = new Uint8Array(st.n);
    for (const [id, d] of Object.entries(dec2)) {
      const i = lookupId(st, id);
      if (i < 0) continue;
      const byRule = d.byRule || (d.exclusion ? { [d.ruleId || "_primary"]: d } : null);
      if (!byRule) continue;
      const o = ctx.ov.get(i) || { set: 0, clr: 0, rej: 0, link: 0 };
      for (const [ruleId, x] of Object.entries(byRule)) {
        const bit = ruleId === "_primary" ? primaryBitOfMask(st.exMask[i]) : RULE_BIT[ruleId];
        if (!bit || !x?.exclusion) continue;
        const rs = x.exclusion.reviewStatus;
        if (rs === "approved") {
          o.set |= bit;
          o.clr &= ~bit;
          o.rej &= ~bit;
        } else if (rs === "rejected") {
          o.clr |= bit;
          o.set &= ~bit;
          o.rej |= bit;
        } else {
          o.clr |= bit;
          o.set &= ~bit;
          o.rej &= ~bit;
        }
      }
      ctx.ov.set(i, o);
      ctx.mark[i] = 1;
    }
    for (const [id, f] of Object.entries(fileEx)) {
      const i = lookupId(st, id);
      const bit = RULE_BIT[f && f.ruleId];
      if (i < 0 || !bit || bit !== RULE_BIT["ENC-1"] && bit !== RULE_BIT["ATT-1"]) continue;
      const o = ctx.ov.get(i) || { set: 0, clr: 0, rej: 0, link: 0 };
      o.add = (o.add || 0) | bit;
      o.files = { ...o.files || {}, [f.ruleId]: { file: String(f.file || ""), at: f.at || null, by: f.by || null } };
      ctx.ov.set(i, o);
      ctx.mark[i] = 1;
    }
    for (const [id, status] of Object.entries(links)) {
      const i = lookupId(st, id);
      if (i < 0) continue;
      const o = ctx.ov.get(i) || { set: 0, clr: 0, rej: 0, link: 0 };
      o.link = status === "confirmed" || status === "open" ? 2 : status === "suspended" ? 3 : status === "closed" ? 4 : status === "candidate" ? 1 : status === "withdrawn" ? 5 : 0;
      ctx.ov.set(i, o);
      ctx.mark[i] = 1;
    }
  }
  ctx.D = { sourceCancelled: false, enfConflict: false, payStatus: "not_due", gross: 0, adj: 0, billed: 0, received: 0, cancelled: false, overlaps: false, cancelledAmount: 0, mask: 0, nReasons: 0, primaryBit: 0, primaryApproved: false, excluded: false, exclusionAmount: 0, net: 0, collected: 0, overpayment: 0, outstanding: 0, daysOverdue: 0, cls: 0, pendingMask: 0, link: 0, exclTotal: 0, ignoredExclusion: false };
  return ctx;
}
function primaryBitOfMask(mask) {
  for (const r of BY_PRIORITY) if (mask & r.bit) return r.bit;
  return 0;
}
var popcount = (x) => {
  let n = 0;
  while (x) {
    n += x & 1;
    x >>>= 1;
  }
  return n;
};
function recordRiskFlags(st, ctx, i) {
  const out = {};
  const f = st.flags[i];
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const invalid2 = !!(fx?.debtorInvalid || fx?.invalidDebtor);
  const crBad = st.crSt[i] === 2 || st.crSt[i] === 4;
  if (!(f & F.DUPLICATE_WF) && !invalid2 && !crBad) return out;
  const D = derive(ctx, i, ctx.cutoffN) || ctx.D;
  const applied = (bit) => (D.mask & bit) !== 0;
  if (f & F.DUPLICATE_WF) out.duplicate = applied(DUP_BIT) ? "settled" : "open";
  if (invalid2) out.struck_off_registry = applied(CR_BIT) ? "settled" : "open";
  else if (crBad && D.outstanding > 0) out.struck_off_registry = "open";
  return out;
}
function derive(ctx, i, asOfN) {
  const st = ctx.st;
  const D = ctx.D;
  const flags = st.flags[i];
  const adj = st.adjDay[i] && st.adjDay[i] <= asOfN ? st.adjAmt[i] : 0;
  const billed = st.gross[i] + adj;
  let appr = st.exAppr[i];
  let link = 0;
  let pending;
  if (ctx.mark && ctx.mark[i]) {
    const o = ctx.ov.get(i);
    appr = appr & ~o.clr | o.set;
    link = o.link;
    pending = st.exMask[i] & ~appr & ~o.rej;
  } else pending = st.exMask[i] & ~appr;
  const fileAdd = ctx.mark && ctx.mark[i] ? ctx.ov.get(i).add || 0 : 0;
  if (ctx.autoApply) {
    appr = (st.exMask[i] | fileAdd) & ~(ctx.mark && ctx.mark[i] ? ctx.ov.get(i).rej : 0);
    pending = 0;
  }
  let m = (st.exMask[i] | fileAdd) & appr & ctx.enabled;
  if (m & CR_BIT) {
    const cs = st.crSt[i];
    if (!ctx.crOk[cs]) m &= ~CR_BIT;
  }
  const objOpen = (flags & F.OBJECTION) !== 0 && objectionExcludes(st, i);
  if (flags & F.OBJECTION && !objOpen) m &= ~OBJ_BIT;
  else if (ctx.objOn && objOpen && !(m & OBJ_BIT) && !(ctx.mark && ctx.mark[i] && ctx.ov.get(i).rej & OBJ_BIT)) m |= OBJ_BIT;
  const rejBits = ctx.mark && ctx.mark[i] ? ctx.ov.get(i).rej : 0;
  if (ctx.styOn && i < st.nGen && st.payCount[i] === 0 && !(rejBits & STY_BIT) && isServiceCompanyPayer(st.payer[i])) m |= STY_BIT;
  if (ctx.sndOn && (st.exec[i] >= 0 || link >= 2 && link <= 4)) m |= SND_BIT;
  let primaryBit = 0;
  let primaryApproved = false;
  if (m) {
    for (const r of BY_PRIORITY) if (m & r.bit) {
      primaryBit = r.bit;
      primaryApproved = r.approved;
      break;
    }
  }
  let received = 0;
  const ps = st.payStart[i];
  const pc = st.payCount[i];
  for (let p = ps; p < ps + pc; p += 1) if (st.pDay[p] <= asOfN) received += st.pAmt[p];
  const cd = st.cancelDay[i];
  const sourceCancelled = cd !== 0 && cd <= asOfN;
  const referred = st.exec[i] >= 0 || link >= 2 && link <= 4;
  const stays = REFERRED_CANCELLED_STAYS_BILLED && sourceCancelled && referred;
  const conflict = sourceCancelled && (referred || link === 5);
  const cancelled = sourceCancelled && !stays;
  const fullyCollected = !cancelled && billed > 0 && received >= billed;
  const ignoredExclusion = m !== 0 && fullyCollected;
  if (ignoredExclusion) {
    m = 0;
    primaryBit = 0;
    primaryApproved = false;
  }
  const excluded = !cancelled && m !== 0;
  const overlaps = cancelled && m !== 0;
  const cancelledAmount = cancelled ? Math.max(0, billed - received) : 0;
  const base = Math.max(billed - cancelledAmount, 0);
  const collected = Math.min(received, base);
  const overpayment = Math.max(0, received - base);
  const outstanding = excluded || cancelled ? 0 : Math.max(0, billed - received);
  const exclAmt = excluded ? Math.max(0, billed - received) : 0;
  const daysOverdue = overdueDays(ctx.cutoffN, st.due[i], ctx.graceDays);
  D.gross = billed;
  D.adj = adj;
  D.billed = billed;
  D.received = received;
  D.cancelled = cancelled;
  D.sourceCancelled = sourceCancelled;
  D.referredStays = stays;
  D.enfConflict = conflict;
  D.overlaps = overlaps;
  D.cancelledAmount = cancelledAmount;
  D.mask = m;
  D.nReasons = m ? popcount(m) : 0;
  D.primaryBit = primaryBit;
  D.primaryApproved = primaryApproved;
  D.excluded = excluded;
  D.exclusionAmount = exclAmt;
  D.ignoredExclusion = ignoredExclusion;
  D.net = billed - cancelledAmount - exclAmt;
  D.exclTotal = billed - D.net;
  D.collected = collected;
  D.overpayment = overpayment;
  D.outstanding = outstanding;
  D.daysOverdue = daysOverdue;
  D.pendingMask = pending;
  D.link = link;
  let cls;
  if (cancelled) cls = C.cancelled;
  else if (excluded) cls = C.excluded;
  else if (outstanding <= 0) cls = C.collected;
  else {
    const isPartial = received > 0 && outstanding > 0;
    const isOverdue = daysOverdue > 0;
    const cs = st.cstat[i];
    if (objOpen) cls = C.objection;
    else if (flags & F.LEGACY_CANCELLED || st.src[i] === 0 && (cs === 2 || cs === 4) && isOverdue) cls = C.linkage_unresolved;
    else if (isOverdue && flags & F.MISSING_ID) cls = C.ineligible_referral;
    else if (isPartial) cls = C.partial;
    else if (isOverdue) cls = C.overdue;
    else cls = C.not_due;
  }
  D.cls = cls;
  const remaining = Math.max(0, billed - received);
  D.payStatus = cancelled ? "cancelled" : remaining <= 0 ? "collected" : received > 0 ? "partial" : daysOverdue > 0 ? "overdue" : "not_due";
  return D;
}
function resolveScope(ctx, scope = {}) {
  const st = ctx.st;
  const cfg = ctx.cfg;
  const toS = scope.to || cfg.cutoff;
  const fromS = scope.from || `${cfg.cutoff.slice(0, 4)}-01-01`;
  const out = { acc: ctx.acc, owner: ctx.owner, from: fromS, to: toS, fromN: dayNum(fromS), toN: Math.min(dayNum(toS), ctx.cutoffN), entOk: new Uint8Array(ENTITIES.length), srcOk: new Uint8Array(SOURCES.length), scopeType: scope.scopeType ?? "all", muni: scope.muni ?? "all", item: scope.item ?? "all", issuedFromN: scope.issuedFrom ? dayNum(scope.issuedFrom) : null, issuedToN: scope.issuedTo ? dayNum(scope.issuedTo) : null };
  const orgKeys = scope.org?.amanahKeys || scope.orgKeys || null;
  const am = scope.amanah ?? "all";
  const amSet = am === "all" ? null : new Set([].concat(am));
  for (let e = 0; e < ENTITIES.length; e += 1) {
    const en = ENTITIES[e].en;
    let ok = true;
    if (orgKeys && !orgKeys.includes(en)) ok = false;
    if (amSet && !amSet.has(en)) ok = false;
    if (!entityReachable(ctx.acc, e)) ok = false;
    out.entOk[e] = ok ? 1 : 0;
  }
  const srcF = scope.source ?? "all";
  const prodSet = Array.isArray(scope.product) && scope.product.length ? new Set(scope.product) : null;
  for (let s = 0; s < SOURCES.length; s += 1) out.srcOk[s] = srcF === "all" || SOURCES[s].key === srcF ? 1 : 0;
  out.prodOk = prodSet ? Uint8Array.from(PRODUCT_KEYS.map((k) => prodSet.has(k) ? 1 : 0)) : null;
  out.mainClass = scope.mainClass && scope.mainClass !== "all" ? MAIN_LIST.indexOf(scope.mainClass) : -1;
  out.includeOther = !!scope.includeOther;
  {
    const pm = parseMuniKey(out.muni);
    out.muniInvalid = !!(pm && pm.invalid);
    out.muniEnt = pm === null ? -1 : pm.invalid ? ENTITIES.length : pm.ent;
    out.muniOk = pm && !pm.invalid ? Uint8Array.from({ length: 128 }, (_, c) => pm.codes.includes(c) ? 1 : 0) : null;
  }
  out.itemIdx = out.item !== "all" ? ITEMS.findIndex((x) => x.key === out.item) : -1;
  out.scopeIdx = out.scopeType === "central" ? 0 : out.scopeType === "internal" ? 1 : -1;
  out.status = scope.status ?? "all";
  out.statusSet = null;
  if (out.status !== "all") {
    const set2 = new Uint8Array(CLASSES.length);
    if (out.status === "open") CLASSES.forEach((c, k) => {
      if (c !== "collected" && c !== "cancelled" && c !== "excluded") set2[k] = 1;
    });
    else if (C[out.status] != null) set2[C[out.status]] = 1;
    else set2.fill(1);
    out.statusSet = set2;
  }
  out.key = `${ctx.acc.key}|${out.from}|${out.to}|${am === "all" ? "all" : [].concat(am).join(",")}|${srcF}|${orgKeys ? orgKeys.join(",") : "all"}|${out.scopeType}|${out.muni}|${out.item}|${out.status}|${prodSet ? [...prodSet].sort().join(",") : "all"}|${out.mainClass}|${out.includeOther ? 1 : 0}`;
  return out;
}
var inScope = (st, sc, i) => (st.owner[i] === 0 || st.owner[i] === sc.owner) && sc.entOk[st.ent[i]] === 1 && (sc.acc.all || sc.acc.tab[slotIndex(st.ent[i], st.mref[i])] === 1) && sc.srcOk[st.src[i]] === 1 && (sc.scopeIdx < 0 || originIdxOf(st.ent[i], st.scope[i]) === sc.scopeIdx) && (sc.itemIdx < 0 || st.item[i] === sc.itemIdx) && (sc.muniEnt < 0 || st.ent[i] === sc.muniEnt && sc.muniOk !== null && sc.muniOk[st.mref[i]] === 1) && (!sc.prodOk || sc.prodOk[productIdxOf(st.src[i], st.item[i], originIdxOf(st.ent[i], st.scope[i]))] === 1) && inClass(st, sc, i);
function inClass(st, sc, i) {
  const mc = mainClassIdx(st.gfs[i], originIdxOf(st.ent[i], st.scope[i]));
  if (sc.mainClass >= 0) return mc === sc.mainClass;
  return sc.includeOther || mc !== OTHER_MAIN_IDX;
}
var EQ_TOL = 0.5;
function checkEquation(a) {
  const e1 = a.gross - a.exclusions - a.net;
  const e2 = a.net - a.collected - a.outstanding;
  const ordered = a.gross + EQ_TOL >= a.net && a.net + EQ_TOL >= a.collected;
  const nonNegative = a.gross >= -EQ_TOL && a.exclusions >= -EQ_TOL && a.net >= -EQ_TOL && a.collected >= -EQ_TOL && a.outstanding >= -EQ_TOL;
  return { grossEqExclusionsPlusNet: Math.abs(e1) <= EQ_TOL, netEqCollectedPlusUncollected: Math.abs(e2) <= EQ_TOL, ordered, nonNegative, diffGross: e1, diffNet: e2, ok: Math.abs(e1) <= EQ_TOL && Math.abs(e2) <= EQ_TOL && ordered && nonNegative };
}
var AGING = [{ key: "0", label: { ar: "\u0644\u0645 \u064A\u062D\u0646 \u0627\u0633\u062A\u062D\u0642\u0627\u0642\u0647", en: "Not yet due" } }, { key: "1-30", label: { ar: "1\u201330 \u064A\u0648\u0645\u0627\u064B", en: "1\u201330 days" } }, { key: "31-90", label: { ar: "31\u201390 \u064A\u0648\u0645\u0627\u064B", en: "31\u201390 days" } }, { key: "91-180", label: { ar: "91\u2013180 \u064A\u0648\u0645\u0627\u064B", en: "91\u2013180 days" } }, { key: "180+", label: { ar: "\u0623\u0643\u062B\u0631 \u0645\u0646 180 \u064A\u0648\u0645\u0627\u064B", en: "Over 180 days" } }];
var agingBucket = (days) => days <= 0 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : days <= 180 ? 3 : 4;
var labelOfEnt = (e) => ({ en: ENTITIES[e].en, ar: ENTITIES[e].ar });
var catOf = (bit) => RULES.find((r) => r.bit === bit);
function snapshot2(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const NE2 = ENTITIES.length;
  const NS = SOURCES.length;
  const per = { tot: new Acc(1), ent: new Acc(NE2), src: new Acc(NS), scope: new Acc(2), prod: new Acc(PRODUCT_KEYS.length) };
  const stk = { tot: new Acc(1), ent: new Acc(NE2), src: new Acc(NS) };
  const ncCount = new Float64Array(CLASSES.length);
  const ncAmt = new Float64Array(CLASSES.length);
  const ncTop = CLASSES.map(() => new TopK(60));
  const ncMaxDays = new Float64Array(CLASSES.length);
  const ncEnt = new Float64Array(CLASSES.length * NE2);
  const exCat = /* @__PURE__ */ new Map();
  const reasonCounts = new Array(NBITS).fill(0);
  const unappr = /* @__PURE__ */ new Set();
  const primCnt = new Float64Array(NBITS);
  const primAmt = new Float64Array(NBITS);
  const pendCnt = new Float64Array(NBITS);
  const entSrcGross = new Float64Array(NE2 * NS);
  const entSrcNet = new Float64Array(NE2 * NS);
  const MX = 9;
  const mxA = new Float64Array(NE2 * NS * MX);
  const aged = new Float64Array(NE2 * 2);
  const NCOL = NBITS + 1;
  const exMx = new Float64Array(NE2 * NCOL * 2);
  const aging = new Float64Array(5 * 2);
  const esm = /* @__PURE__ */ new Map();
  const accMonth = /* @__PURE__ */ new Map();
  const accMuni = new Acc(NE2 * MUNI_SLOTS);
  const accStatus = new Acc(CLASSES.length);
  const accDue = new Acc(5);
  const agingC = new Float64Array(5 * 2);
  let ageSum = 0;
  let ageN = 0;
  let objAmt = 0;
  const recv = { total: 0, fromPeriodInvoices: 0, fromPriorInvoices: 0, onExcluded: 0, count: 0, byChannel: new Float64Array(CHANNELS.length), byEnt: new Float64Array(NE2), byMuni: new Float64Array(NE2 * MUNI_SLOTS) };
  const q3 = { records: 0, conflicts: new TopK(40), conflictN: 0, conflictAtStake: 0, pendingAtStake: 0, pendingN: 0, pending: new TopK(40), missingN: 0, missing: new TopK(40), contractN: 0, contract: new TopK(40), unverifiedN: 0, uploaded: 0, checkable: 0 };
  const enfStock = { inExecution: { count: 0, outstanding: 0 }, suspended: { count: 0, outstanding: 0 }, closedOnly: { count: 0, outstanding: 0 }, sourceConflict: { count: 0, outstanding: 0 } };
  let ledgerInScope = 0;
  let issued = 0;
  const { fromN, toN } = sc;
  const periodAsOf = ctx.periodEndMode ? Math.min(toN, ctx.cutoffN) : ctx.cutoffN;
  const n = st.n;
  const D = ctx.D;
  for (let i = 0; i < n; i += 1) {
    if (st.issue[i] > ctx.cutoffN) continue;
    if (!inScope(st, sc, i)) continue;
    ledgerInScope += 1;
    const e = st.ent[i];
    const s = st.src[i];
    derive(ctx, i, ctx.cutoffN);
    const okCut = !sc.statusSet || sc.statusSet[D.cls];
    if (okCut) {
      stk.tot.add(0, D);
      stk.ent.add(e, D);
      stk.src.add(s, D);
    }
    if (okCut && D.outstanding > 0 && D.daysOverdue > 180) {
      aged[e * 2] += D.outstanding;
      aged[e * 2 + 1] += 1;
    }
    if (okCut && D.enfConflict) {
      enfStock.sourceConflict.count += 1;
      enfStock.sourceConflict.outstanding += D.outstanding;
    }
    if (okCut && D.link >= 2) {
      const b = D.link === 2 ? enfStock.inExecution : D.link === 3 ? enfStock.suspended : enfStock.closedOnly;
      b.count += 1;
      b.outstanding += D.outstanding + D.exclusionAmount;
    }
    if (okCut && D.outstanding > 0) {
      const b = agingBucket(D.daysOverdue);
      aging[b * 2] += D.outstanding;
      aging[b * 2 + 1] += 1;
      const dd2 = D.daysOverdue;
      const cb = dd2 <= 0 ? 0 : dd2 <= 30 ? 1 : dd2 <= 60 ? 2 : dd2 <= 90 ? 3 : 4;
      agingC[cb * 2] += D.outstanding;
      agingC[cb * 2 + 1] += 1;
      if (dd2 > 0) {
        ageSum += dd2;
        ageN += 1;
      }
      if (D.cls === C.objection) objAmt += D.outstanding;
    }
    const hasReason = D.mask !== 0;
    const ps = st.payStart[i];
    const pc = st.payCount[i];
    for (let p = ps; p < ps + pc; p += 1) {
      const d = st.pDay[p];
      if (!okCut) break;
      if (d < fromN || d > toN || d > ctx.cutoffN) continue;
      recv.count += 1;
      if (hasReason) {
        recv.onExcluded += st.pAmt[p];
        continue;
      }
      const a = st.pAmt[p];
      recv.total += a;
      recv.byChannel[st.pCh[p]] += a;
      recv.byEnt[e] += a;
      recv.byMuni[e * MUNI_SLOTS + slotOf(e, st.mref[i])] += a;
      if (st.issue[i] >= fromN && st.issue[i] <= toN) recv.fromPeriodInvoices += a;
      else recv.fromPriorInvoices += a;
    }
    if (st.issue[i] < fromN || st.issue[i] > toN) continue;
    const dd = periodAsOf === ctx.cutoffN ? D : derive(ctx, i, periodAsOf);
    if (sc.statusSet && !sc.statusSet[dd.cls]) continue;
    issued += 1;
    per.tot.add(0, dd);
    per.ent.add(e, dd);
    per.src.add(s, dd);
    per.scope.add(originIdxOf(st.ent[i], st.scope[i]), dd);
    per.prod.add(productIdxOf(st.src[i], st.item[i], originIdxOf(st.ent[i], st.scope[i])), dd);
    {
      const ym = isoOf(st.issue[i]).slice(0, 7);
      let am = accMonth.get(ym);
      if (!am) {
        am = new Acc(1);
        accMonth.set(ym, am);
      }
      am.add(0, dd);
    }
    accMuni.add(e * MUNI_SLOTS + slotOf(e, st.mref[i]), dd);
    accStatus.add(dd.cls, dd);
    accDue.add(dd.cancelled ? 4 : dd.excluded ? 3 : dd.outstanding <= 0 ? 0 : dd.daysOverdue > 0 ? 1 : 2, dd);
    const viol = s === 1;
    const enf = dd.link >= 2 || pc > 0 && (() => {
      for (let p = ps; p < ps + pc; p += 1) if (st.pCh[p] === 2) return true;
      return false;
    })();
    per.ent.addMeta(e, viol, enf);
    per.src.addMeta(s, viol, enf);
    entSrcGross[e * NS + s] += dd.gross;
    entSrcNet[e * NS + s] += dd.net;
    {
      const k = `${e}|${s}|${isoOf(st.issue[i]).slice(0, 7)}`;
      let v = esm.get(k);
      if (!v) {
        v = [0, 0, 0];
        esm.set(k, v);
      }
      v[0] += dd.net;
      v[1] += dd.collected;
      v[2] += dd.gross;
    }
    {
      const o = (e * NS + s) * MX;
      mxA[o] += 1;
      mxA[o + 1] += dd.gross;
      mxA[o + 2] += dd.exclTotal;
      mxA[o + 3] += dd.net;
      mxA[o + 4] += dd.collected;
      mxA[o + 5] += dd.outstanding;
      if (dd.outstanding > 0) {
        if (dd.daysOverdue > 0) {
          mxA[o + 6] += dd.outstanding;
          if (dd.daysOverdue > mxA[o + 8]) mxA[o + 8] = dd.daysOverdue;
        } else mxA[o + 7] += dd.outstanding;
      }
    }
    if (dd.cancelled) {
      const o = (e * NCOL + NBITS) * 2;
      exMx[o] += dd.cancelledAmount;
      exMx[o + 1] += 1;
    } else if (dd.excluded) {
      const o = (e * NCOL + Math.round(Math.log2(dd.primaryBit))) * 2;
      exMx[o] += dd.exclusionAmount;
      exMx[o + 1] += 1;
    }
    const cls = dd.cls;
    if (cls !== C.collected) {
      ncCount[cls] += 1;
      const amt = cls === C.excluded ? dd.exclusionAmount : cls === C.cancelled ? dd.cancelledAmount : dd.outstanding;
      ncAmt[cls] += amt;
      ncTop[cls].push(i, amt);
      ncEnt[cls * NE2 + e] += amt;
      if (dd.outstanding > 0 && dd.daysOverdue > ncMaxDays[cls]) ncMaxDays[cls] = dd.daysOverdue;
    }
    if (dd.excluded) {
      const r = catOf(dd.primaryBit);
      let c = exCat.get(r.category);
      if (!c) {
        c = { count: 0, amount: 0, top: new TopK(25) };
        exCat.set(r.category, c);
      }
      c.count += 1;
      c.amount += dd.exclusionAmount;
      c.top.push(i, dd.exclusionAmount);
      {
        const pb = Math.round(Math.log2(dd.primaryBit));
        primCnt[pb] += 1;
        primAmt[pb] += dd.exclusionAmount;
      }
      if (!dd.primaryApproved) unappr.add(r.id);
    }
    if (dd.excluded || dd.overlaps) {
      for (let b = 0; b < NBITS; b += 1) if (dd.mask & 1 << b) reasonCounts[b] += 1;
    }
    if (!dd.excluded && !dd.cancelled && dd.pendingMask) {
      for (let b = 0; b < NBITS; b += 1) if (dd.pendingMask & 1 << b) pendCnt[b] += 1;
    }
    q3.records += 1;
    if (st.flags[i] & F.AMT_CONFLICT) {
      q3.conflictN += 1;
      q3.conflictAtStake += st.gross[i];
      q3.conflicts.push(i, st.gross[i]);
    }
    if (dd.pendingMask) {
      q3.pendingN += 1;
      q3.pendingAtStake += st.gross[i];
      q3.pending.push(i, st.gross[i]);
    }
    if (st.flags[i] & F.MISSING_ID) {
      q3.missingN += 1;
      q3.missing.push(i, st.gross[i]);
    }
    {
      const cs = st.cstat[i];
      if (s === 0 && (cs === 2 || cs === 4)) {
        q3.contractN += 1;
        q3.contract.push(i, st.gross[i]);
      }
      if (cs === 5) q3.unverifiedN += 1;
    }
    if (st.flags[i] & F.UPLOADED) q3.uploaded += 1;
    if (!(st.flags[i] & F.NOT_CHECKABLE)) q3.checkable += 1;
  }
  const ids = (t) => t.sorted().map(([i]) => idOf(st, i));
  const groupOut = (acc, count, labelFn, keyFn) => {
    const out = [];
    for (let g = 0; g < count; g += 1) {
      if (acc.a[g * K + M2.count] === 0) continue;
      out.push({ key: keyFn(g), label: labelFn(g), ...acc.toAgg(g) });
    }
    return out.sort((a, b) => b.outstanding - a.outstanding || b.gross - a.gross);
  };
  const entLabel2 = (g) => labelOfEnt(g);
  const totals = per.tot.toAgg(0);
  const noncollection = {};
  for (const c of [...NONCOLLECTION_CATEGORIES, "enforcement"]) {
    const k = C[c];
    let te = -1;
    let tv = 0;
    for (let e = 0; e < NE2; e += 1) if (ncEnt[k * NE2 + e] > tv) {
      tv = ncEnt[k * NE2 + e];
      te = e;
    }
    noncollection[c] = { count: ncCount[k], amount: ncAmt[k], invoices: ids(ncTop[k]), maxDaysOverdue: ncMaxDays[k], topAmanah: te >= 0 ? { key: ENTITIES[te].en, label: labelOfEnt(te), amount: tv } : null };
  }
  const exclusionsByCategory = {};
  for (const [cat, c] of exCat) exclusionsByCategory[cat] = { count: c.count, amount: c.amount, invoices: ids(c.top) };
  const exclusionReasonCounts = {};
  reasonCounts.forEach((cnt, b) => {
    if (cnt) exclusionReasonCounts[RULES[b].id] = cnt;
  });
  const stockTot = stk.tot.toAgg(0);
  const byAmanah2 = groupOut(per.ent, NE2, entLabel2, (g) => ENTITIES[g].en);
  const byMonth = [...accMonth.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([month, acc]) => ({ month, ...acc.toAgg(0) }));
  const byMunicipality = [];
  for (let g = 0; g < NE2 * MUNI_SLOTS; g += 1) {
    if (accMuni.a[g * K + M2.count] === 0) continue;
    const e = Math.floor(g / MUNI_SLOTS);
    const slot = g % MUNI_SLOTS;
    const en = ENTITIES[e].en;
    let mu;
    if (slot >= 4) {
      const m = municipalityOfCode(e, slot);
      mu = { key: m.key, ar: m.ar, en: m.en, refId: m.refId, status: "mapped" };
    } else if (slot === 1) mu = { key: `${en}|DIRECT`, ar: MUNICIPALITY_DIRECT.ar, en: MUNICIPALITY_DIRECT.en, refId: null, status: "direct_amanah" };
    else if (slot === 2) mu = { key: `${en}|UNRESOLVED`, ar: MUNICIPALITY_UNRESOLVED.ar, en: MUNICIPALITY_UNRESOLVED.en, refId: null, status: "needs_review" };
    else mu = { key: `${en}|NOT_SPECIFIED`, ar: MUNICIPALITY_NOT_SPECIFIED.ar, en: MUNICIPALITY_NOT_SPECIFIED.en, refId: null, status: "not_specified" };
    byMunicipality.push({ key: mu.key, amanah: en, amanahLabel: labelOfEnt(e), municipality: mu, status: mu.status, ...accMuni.toAgg(g) });
  }
  byMunicipality.sort((a, b) => b.outstanding - a.outstanding);
  const byDue = ["collected", "overdue", "not_due", "excluded", "cancelled"].map((key, k) => ({ key, ...accDue.toAgg(k) }));
  const byStatus = [];
  for (let k = 0; k < CLASSES.length; k += 1) {
    if (accStatus.a[k * K + M2.count] === 0) continue;
    byStatus.push({ key: CLASSES[k], ...accStatus.toAgg(k) });
  }
  const bySource = groupOut(per.src, NS, () => null, (g) => SOURCES[g].key);
  const byProduct = groupOut(per.prod, PRODUCT_KEYS.length, () => null, (g) => PRODUCT_KEYS[g]);
  const byScope = [0, 1].map((g) => ({ key: g === 0 ? "central" : "internal", ...per.scope.toAgg(g) }));
  const matrix = { amanahSource: [], amanahReasons: [], amanahSourceMonth: [] };
  for (const [k, v] of esm) {
    const [e, sIdx, month] = k.split("|");
    matrix.amanahSourceMonth.push({ amanah: ENTITIES[Number(e)].en, source: SOURCES[Number(sIdx)].key, month, net: v[0], collected: v[1], gross: v[2] });
  }
  for (let e = 0; e < NE2; e += 1) {
    for (let s = 0; s < NS; s += 1) {
      const o = (e * NS + s) * MX;
      if (mxA[o]) matrix.amanahSource.push({ amanah: ENTITIES[e].en, source: SOURCES[s].key, count: mxA[o], gross: mxA[o + 1], exclusions: mxA[o + 2], net: mxA[o + 3], collected: mxA[o + 4], outstanding: mxA[o + 5], overdue: mxA[o + 6], notDue: mxA[o + 7], maxDaysOverdue: mxA[o + 8] });
    }
    for (let b = 0; b < NCOL; b += 1) {
      const o = (e * NCOL + b) * 2;
      if (exMx[o + 1]) matrix.amanahReasons.push({ amanah: ENTITIES[e].en, reason: b === NBITS ? "cancelled" : RULES[b].id, amount: exMx[o], count: exMx[o + 1] });
    }
  }
  const sumKeys = ["count", "gross", "exclusions", "net", "collected", "outstanding"];
  const partsSum = (rows) => Object.fromEntries(sumKeys.map((k) => [k, rows.reduce((t, r) => t + r[k], 0)]));
  const addsUp = (rows) => {
    const p = partsSum(rows);
    return sumKeys.every((k) => Math.abs(p[k] - totals[k]) <= (k === "count" ? 0 : EQ_TOL));
  };
  const equation = {
    total: checkEquation(totals),
    amanahCheck: byAmanah2.every((r) => checkEquation(r).ok),
    sourceCheck: bySource.every((r) => checkEquation(r).ok),
    scopeCheck: byScope.every((r) => checkEquation(r).ok),
    monthsSumToTotal: addsUp(byMonth),
    municipalitiesSumToTotal: addsUp(byMunicipality),
    statusSumsToTotal: addsUp(byStatus),
    amanahSumsToTotal: addsUp(byAmanah2),
    sourceSumsToTotal: addsUp(bySource),
    scopeSumsToTotal: addsUp(byScope),
    collectionRateFromSums: ratio(totals.collected, totals.net)
    // overall rate = Σ collected ÷ Σ net — never an average of Amanah rates
  };
  {
    const ms = matrix.amanahSource.reduce((t, r) => ({ gross: t.gross + r.gross, net: t.net + r.net, collected: t.collected + r.collected, count: t.count + r.count }), { gross: 0, net: 0, collected: 0, count: 0 });
    const er = matrix.amanahReasons.reduce((t, r) => t + r.amount, 0);
    equation.matrixSumsToTotal = ms.count === totals.count && Math.abs(ms.gross - totals.gross) <= EQ_TOL && Math.abs(ms.net - totals.net) <= EQ_TOL && Math.abs(ms.collected - totals.collected) <= EQ_TOL && Math.abs(er - totals.exclusions) <= EQ_TOL;
  }
  equation.ok = equation.monthsSumToTotal && equation.municipalitiesSumToTotal && equation.statusSumsToTotal && equation.matrixSumsToTotal && equation.total.ok && equation.amanahCheck && equation.sourceCheck && equation.scopeCheck && equation.amanahSumsToTotal && equation.sourceSumsToTotal && equation.scopeSumsToTotal;
  const stock = {
    netUncollected: stockTot.outstanding,
    overdue: stockTot.overdueOutstanding,
    notYetDue: stockTot.notDueOutstanding,
    invoiceCount: AGING.reduce((s, _, b) => s + aging[b * 2 + 1], 0),
    cancelled: stockTot.cancelled,
    cancelledCount: stockTot.cancelledCount,
    excluded: stockTot.exclusionsRules,
    excludedUnapproved: stockTot.exclusionsUnapproved,
    excludedApproved: stockTot.exclusionsApproved,
    excludedCount: stockTot.excludedCount,
    overlapCount: stockTot.overlapCount,
    overlapAmount: stockTot.overlapAmount,
    gross: stockTot.gross,
    exclusionsTotal: stockTot.exclusions,
    net: stockTot.net,
    collected: stockTot.collected,
    invoices: stockTot.count,
    enforcement: { ...enfStock, open: { count: enfStock.inExecution.count + enfStock.suspended.count, outstanding: enfStock.inExecution.outstanding + enfStock.suspended.outstanding }, everReferred: { count: enfStock.inExecution.count + enfStock.suspended.count + enfStock.closedOnly.count, outstanding: enfStock.inExecution.outstanding + enfStock.suspended.outstanding + enfStock.closedOnly.outstanding } },
    aging: AGING.map((a, b) => ({ ...a, amount: aging[b * 2], count: aging[b * 2 + 1] })),
    agingPlanning: ["current", "d1_30", "d31_60", "d61_90", "d90plus"].map((key, b) => ({ key, amount: agingC[b * 2], count: agingC[b * 2 + 1] })),
    avgDaysOverdue: ageN ? ageSum / ageN : 0,
    objectionOutstanding: objAmt,
    byAmanah: groupOut(stk.ent, NE2, entLabel2, (g) => ENTITIES[g].en),
    bySource: groupOut(stk.src, NS, () => null, (g) => SOURCES[g].key),
    aged180ByAmanah: Array.from({ length: NE2 }, (_, e) => ({ key: ENTITIES[e].en, amount: aged[e * 2], count: aged[e * 2 + 1] })).filter((x) => x.count > 0)
    // older than 180 days after the due date
  };
  const byAmanahSource = {};
  for (let e = 0; e < NE2; e += 1) for (let s = 0; s < NS; s += 1) {
    const v = entSrcGross[e * NS + s];
    if (v) {
      (byAmanahSource[ENTITIES[e].en] = byAmanahSource[ENTITIES[e].en] || {})[SOURCES[s].key] = v;
    }
  }
  const quality2 = {
    records: q3.records,
    kinds: { demo: q3.records - q3.uploaded, ...q3.uploaded ? { uploaded: q3.uploaded } : {} },
    amountConflicts: ids(q3.conflicts),
    amountConflictCount: q3.conflictN,
    amountCheckable: q3.checkable,
    pendingExclusions: ids(q3.pending),
    pendingExclusionCount: q3.pendingN,
    pendingExclusionAmount: q3.pendingAtStake,
    missingFieldRecords: ids(q3.missing),
    missingFieldCount: q3.missingN,
    contractIssues: ids(q3.contract),
    contractIssueCount: q3.contractN,
    contractUnverified: [],
    contractUnverifiedCount: q3.unverifiedN,
    conflictAmountAtStake: q3.conflictAtStake,
    completenessNote: { en: `${q3.checkable} of ${q3.records} records have line-item evidence for an amount check; the rest could not be checked.`, ar: `${q3.checkable} \u0645\u0646 ${q3.records} \u0633\u062C\u0644\u0627\u064B \u0644\u062F\u064A\u0647\u0627 \u0628\u0646\u0648\u062F \u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0628\u0644\u063A\u061B \u0648\u0627\u0644\u0628\u0627\u0642\u064A \u062A\u0639\u0630\u0651\u0631 \u0641\u062D\u0635\u0647.` }
  };
  const receivedByAmanah = {};
  for (let e = 0; e < NE2; e += 1) if (recv.byEnt[e]) receivedByAmanah[ENTITIES[e].en] = recv.byEnt[e];
  const receivedByMunicipality = {};
  for (let g = 0; g < NE2 * MUNI_SLOTS; g += 1) if (recv.byMuni[g]) {
    const e = Math.floor(g / MUNI_SLOTS);
    const slot = g % MUNI_SLOTS;
    const en = ENTITIES[e].en;
    receivedByMunicipality[slot >= 4 ? municipalityOfCode(e, slot).key : `${en}|${slot === 1 ? "DIRECT" : slot === 2 ? "UNRESOLVED" : "NOT_SPECIFIED"}`] = recv.byMuni[g];
  }
  const byChannel = {};
  CHANNELS.forEach((c, k) => {
    if (recv.byChannel[k]) byChannel[c] = recv.byChannel[k];
  });
  return {
    scope: { from: sc.from, to: sc.to, status: req.scope?.status ?? "all", amanah: req.scope?.amanah ?? "all", source: req.scope?.source ?? "all", scopeType: req.scope?.scopeType ?? "all", muni: req.scope?.muni ?? "all", ...sc.muniInvalid ? { muniInvalid: true } : {}, org: req.scope?.org || null, ...req.scope?.basis ? { basis: req.scope.basis } : {} },
    config: ctx.cfg,
    cutoff: ctx.cfg.cutoff,
    ruleSetVersion: EXCLUSION_RULE_SET_VERSION,
    population: { issuedInPeriod: issued, ledgerInScope },
    totals,
    exclusionsByCategory,
    exclusionReasonCounts,
    unapprovedRulesApplied: [...unappr],
    ruleStats: Object.fromEntries(RULES.map((r, b) => [r.id, { primaryCount: primCnt[b], primaryAmount: primAmt[b], pendingCandidates: pendCnt[b] }])),
    exclusionsApproval: { allApproved: unappr.size === 0, unapprovedAmount: totals.exclusionsUnapproved, approvedAmount: totals.exclusionsApproved },
    stock,
    noncollection,
    byAmanah: byAmanah2,
    bySource,
    byProduct,
    byDue,
    byScope,
    byMonth,
    byMunicipality,
    byStatus,
    equation,
    basis: { invoices: "issue_date", invoicesFrom: sc.from, invoicesTo: sc.to, collectionsAsOf: isoOf(periodAsOf), collectionsMode: periodAsOf === ctx.cutoffN ? "reference_date" : "period_end", referenceDate: ctx.cfg.cutoff, receiptsByPaymentDate: "separate_indicator", timezone: "Asia/Riyadh" },
    byAmanahSource,
    matrix,
    receivedInPeriod: { byAmanah: receivedByAmanah, byMunicipality: receivedByMunicipality, total: recv.total, fromPeriodInvoices: recv.fromPeriodInvoices, fromPriorInvoices: recv.fromPriorInvoices, onExcluded: recv.onExcluded, byChannel, count: recv.count },
    quality: quality2
  };
}
function series(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const asOf = Math.min(sc.toN, ctx.cutoffN);
  const months = [];
  const idx = /* @__PURE__ */ new Map();
  for (let y = Number(sc.from.slice(0, 4)), m = Number(sc.from.slice(5, 7)); `${y}-${String(m).padStart(2, "0")}` <= sc.to.slice(0, 7) && `${y}-${String(m).padStart(2, "0")}` <= ctx.cfg.cutoff.slice(0, 7); m += 1) {
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k > ctx.cfg.cutoff.slice(0, 7)) break;
    idx.set(k, months.length);
    months.push(k);
  }
  const values = new Float64Array(months.length);
  const billed = new Float64Array(months.length);
  const count = new Float64Array(months.length);
  const amts = [];
  const pinv = [];
  const pday = [];
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    const iss = st.issue[i];
    if (iss >= sc.fromN && iss <= sc.toN) {
      const k = idx.get(isoOf(iss).slice(0, 7));
      if (k !== void 0) {
        billed[k] += st.gross[i];
        count[k] += 1;
      }
    }
    if (sc.issuedFromN != null && (iss < sc.issuedFromN || iss > (sc.issuedToN ?? iss))) continue;
    const pc = st.payCount[i];
    if (!pc) continue;
    const ps = st.payStart[i];
    let room = Infinity;
    const order = [];
    if (req.capped) {
      for (let p = ps; p < ps + pc; p += 1) order.push(p);
      order.sort((x, y) => st.pDay[x] - st.pDay[y]);
      derive(ctx, i, asOf);
      room = Math.max(ctx.D.billed - ctx.D.cancelledAmount, 0);
    }
    for (let q3 = 0; q3 < pc; q3 += 1) {
      const p = req.capped ? order[q3] : ps + q3;
      const d = st.pDay[p];
      if (d < sc.fromN || d > asOf) continue;
      const k = idx.get(isoOf(d).slice(0, 7));
      if (k === void 0) continue;
      let amt = st.pAmt[p];
      if (req.capped) {
        amt = Math.min(amt, room);
        room -= amt;
      }
      values[k] += amt;
      amts.push(amt);
      pinv.push(i);
      pday.push(d);
    }
  }
  const sorted = Float64Array.from(amts).sort();
  const typical = sorted.length ? sorted[sorted.length >> 1] : 0;
  const large = [];
  for (let j = 0; j < amts.length; j += 1) {
    const k = idx.get(isoOf(pday[j]).slice(0, 7));
    if (amts[j] >= typical * 2.5 && values[k] > 0 && amts[j] / values[k] >= 0.2) large.push({ invoiceId: idOf(st, pinv[j]), date: isoOf(pday[j]), amount: amts[j] });
  }
  return { months, values: Array.from(values), billed: Array.from(billed), invoiceCounts: Array.from(count), typicalPayment: typical, paymentCount: amts.length, payments: large };
}
var UNMATCHED_REPORT_ROWS = [
  { invoiceNo: "000123456789", amount: 482e5, lines: 2, hint: "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644" },
  { invoiceNo: "000123456793", amount: 11275e4, lines: 1, hint: "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644" },
  { invoiceNo: "000123456800", amount: 98e5, lines: 1, hint: "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644" },
  { invoiceNo: "000123456811", amount: 1763e5, lines: 3, hint: "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644" }
];
function bridge(st, req) {
  const ctx = makeCtx(st, { ...req, scope: { ...req.scope || {}, from: "2000-01-01", to: req.cfg?.cutoff } });
  const sc = resolveScope(ctx, req.scope && { ...req.scope, from: "2000-01-01", to: ctx.cfg.cutoff });
  const reportN = req.reportDate ? dayNum(req.reportDate) : dayNum(`${ctx.cfg.cutoff.slice(0, 7)}-01`) - 1;
  const national = req.scope?.amanah === void 0 || req.scope?.amanah === "all";
  const nat = national && ctx.acc.all && (!req.scope?.source || req.scope.source === "all") && !req.scope?.org?.amanahKeys;
  let reportMatched = 0;
  let invReport = 0;
  let lineCount = 0;
  let naive = 0;
  let paidAfter = 0;
  let creditAfter = 0;
  let cancelled = 0;
  let cancelledCount = 0;
  let exclNonOverlap = 0;
  let exclCount = 0;
  let exclApproved = 0;
  let exclUnapproved = 0;
  let overlapAmt = 0;
  let overlapCount = 0;
  let netFromReport = 0;
  let newInv = 0;
  let newCount = 0;
  let internal = 0;
  let internalCount = 0;
  let missed = 0;
  const D = ctx.D;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    derive(ctx, i, ctx.cutoffN);
    if (sc.statusSet && !sc.statusSet[D.cls]) continue;
    if (st.scope[i] !== 0) {
      if (D.outstanding > 0) {
        internal += D.outstanding;
        internalCount += 1;
      }
      continue;
    }
    const iss = st.issue[i];
    let inReport = false;
    let rem0 = 0;
    if (iss <= reportN && !(st.cancelDay[i] && st.cancelDay[i] <= reportN)) {
      let paid0 = 0;
      const ps = st.payStart[i];
      const pc = st.payCount[i];
      for (let p = ps; p < ps + pc; p += 1) if (st.pDay[p] <= reportN) paid0 += st.pAmt[p];
      const adj0 = st.adjDay[i] && st.adjDay[i] <= reportN ? st.adjAmt[i] : 0;
      rem0 = Math.max(0, st.gross[i] + adj0 - paid0);
      if (rem0 > 0) inReport = true;
    }
    if (inReport) {
      invReport += 1;
      reportMatched += rem0;
      lineCount += st.lines[i];
      naive += rem0 * st.lines[i];
      const rawR1 = Math.max(0, D.billed - D.received);
      const diff = rem0 - rawR1;
      let paid0 = 0;
      {
        const ps = st.payStart[i];
        const pc = st.payCount[i];
        for (let p = ps; p < ps + pc; p += 1) if (st.pDay[p] <= reportN) paid0 += st.pAmt[p];
      }
      const payPart = Math.max(0, D.received - paid0);
      paidAfter += payPart;
      creditAfter += diff - payPart;
      if (D.cancelled) {
        cancelled += rawR1;
        cancelledCount += 1;
        if (D.overlaps) {
          overlapCount += 1;
          overlapAmt += rawR1;
        }
      } else if (D.excluded) {
        exclNonOverlap += rawR1;
        exclCount += 1;
        if (D.primaryApproved) exclApproved += rawR1;
        else exclUnapproved += rawR1;
      } else netFromReport += D.outstanding;
    } else if (D.outstanding > 0) {
      if (iss > reportN) {
        newInv += D.outstanding;
        newCount += 1;
      } else missed += D.outstanding;
    }
  }
  let unmatchedLines = 0;
  let unmatchedAmt = 0;
  let unmatchedCount = 0;
  if (nat) for (const u of UNMATCHED_REPORT_ROWS) {
    unmatchedLines += u.lines;
    unmatchedAmt += u.amount;
    unmatchedCount += 1;
    naive += u.amount * u.lines;
  }
  const net = netFromReport + newInv + internal + missed;
  const steps = [
    { key: "report", amount: reportMatched, count: invReport, kind: "start" },
    { key: "reconciliation", amount: -(paidAfter + creditAfter), kind: "minus", detail: { payments: paidAfter, creditNotes: creditAfter } },
    { key: "cancelled", amount: -cancelled, count: cancelledCount, kind: "minus", detail: { overlapNotDeductedAgain: overlapAmt, overlapCount } },
    { key: "excluded", amount: -exclNonOverlap, count: exclCount, kind: "minus", detail: { approvedRules: exclApproved, unapprovedRules: exclUnapproved } },
    { key: "newInvoices", amount: newInv, count: newCount, kind: "plus" },
    ...missed ? [{ key: "missedByReport", amount: missed, kind: "plus" }] : [],
    { key: "internal", amount: internal, count: internalCount, kind: "plus" }
  ];
  const stepsSum = steps.reduce((s, x) => s + x.amount, 0);
  const inflation = naive - (reportMatched + unmatchedAmt);
  return {
    reportDate: isoOf(reportN),
    detailsDate: ctx.cfg.cutoff,
    lineCount: lineCount + unmatchedLines,
    invoiceCountInReport: invReport + unmatchedCount,
    naiveSum: naive,
    dedupedTotal: reportMatched + unmatchedAmt,
    inflation,
    conflicts: [],
    steps,
    net,
    check: Math.round((stepsSum - net) * 100) / 100,
    unmatched: { scopedOut: !nat, nationalCount: ctx.acc.all ? UNMATCHED_REPORT_ROWS.length : 0, nationalAmount: ctx.acc.all ? UNMATCHED_REPORT_ROWS.reduce((s, u) => s + u.amount, 0) : 0, count: nat ? unmatchedCount : 0, amount: nat ? unmatchedAmt : 0, rows: nat ? UNMATCHED_REPORT_ROWS.map((u) => ({ invoiceNo: u.invoiceNo, invoiceValue: u.amount, lines: u.lines, hint: u.hint })) : [] },
    ruleSetApproval: { unapprovedAmount: exclUnapproved, approvedAmount: exclApproved }
  };
}

// server/sourceRecords.js
var BI2 = (ar, en) => ({ ar, en });
var fld = (n, ar, en, v) => ({ n, l: BI2(ar, en), v: v === void 0 ? null : v });
var view = (id, table, title, fields) => ({ id, table, title, fields });
var pad3 = (n, w) => String(n).padStart(w, "0");
var CITIES = ["\u0627\u0644\u0631\u064A\u0627\u0636", "\u062C\u062F\u0629", "\u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629", "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", "\u0627\u0644\u062F\u0645\u0627\u0645", "\u0627\u0644\u062E\u0628\u0631", "\u0623\u0628\u0647\u0627", "\u0627\u0644\u0637\u0627\u0626\u0641", "\u0628\u0631\u064A\u062F\u0629", "\u062A\u0628\u0648\u0643", "\u062D\u0627\u0626\u0644", "\u062C\u0627\u0632\u0627\u0646"];
var DISTRICTS = ["\u062D\u064A \u0627\u0644\u0646\u062E\u064A\u0644 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0631\u0628\u064A\u0639 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0648\u0627\u062D\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0641\u064A\u0635\u0644\u064A\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0645\u0631\u0648\u062C \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0635\u0641\u0627 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0633\u0644\u0627\u0645 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A", "\u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A"];
var ACTIVITIES = [["\u0628\u064A\u0639 \u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u063A\u0630\u0627\u0626\u064A\u0629 \u0628\u0627\u0644\u062A\u062C\u0632\u0626\u0629", "Retail food", 4711], ["\u0645\u0637\u0639\u0645", "Restaurant", 5610], ["\u0635\u0627\u0644\u0648\u0646 \u062D\u0644\u0627\u0642\u0629", "Barber", 9602], ["\u0645\u063A\u0633\u0644\u0629 \u0645\u0644\u0627\u0628\u0633", "Laundry", 9601], ["\u0628\u064A\u0639 \u0627\u0644\u0645\u0644\u0627\u0628\u0633", "Clothing retail", 4771], ["\u0645\u0642\u0647\u0649", "Cafe", 5630], ["\u0648\u0631\u0634\u0629 \u0635\u064A\u0627\u0646\u0629", "Workshop", 4520], ["\u0635\u064A\u062F\u0644\u064A\u0629", "Pharmacy", 4772]];
var SERVICES = {
  commercial_license: [[101, "\u0625\u0635\u062F\u0627\u0631 \u0631\u062E\u0635\u0629 \u0646\u0634\u0627\u0637 \u062A\u062C\u0627\u0631\u064A", "Issue commercial licence"], [102, "\u062A\u062C\u062F\u064A\u062F \u0631\u062E\u0635\u0629 \u0646\u0634\u0627\u0637 \u062A\u062C\u0627\u0631\u064A", "Renew commercial licence"], [103, "\u0646\u0642\u0644 \u0645\u0644\u0643\u064A\u0629 \u0631\u062E\u0635\u0629", "Transfer of licence ownership"]],
  signboard_license: [[201, "\u0625\u0635\u062F\u0627\u0631 \u0644\u0648\u062D\u0629 \u0645\u062D\u0644", "Issue shop signboard"], [202, "\u062A\u062C\u062F\u064A\u062F \u0644\u0648\u062D\u0629 \u0645\u062D\u0644", "Renew shop signboard"]],
  building_permit: [[301, "\u0625\u0635\u062F\u0627\u0631 \u0631\u062E\u0635\u0629 \u0628\u0646\u0627\u0621", "Issue building permit"], [302, "\u0631\u062E\u0635\u0629 \u0633\u0648\u0631", "Fence permit"]],
  health_certificate: [[401, "\u0634\u0647\u0627\u062F\u0629 \u0635\u062D\u064A\u0629 \u0633\u0646\u0648\u064A\u0629", "Annual health certificate"], [402, "\u0634\u0647\u0627\u062F\u0629 \u0635\u062D\u064A\u0629 \u0645\u0639 \u062A\u062B\u0642\u064A\u0641 \u0635\u062D\u064A", "Health certificate with training"]]
};
function paymentFacts(rec) {
  let wallet = 0;
  let other = 0;
  let last = null;
  let lastNonWallet = null;
  for (const p of rec.payments) {
    if (p.channel === "wallet") wallet += p.amount;
    else {
      other += p.amount;
      if (!lastNonWallet || p.date > lastNonWallet) lastNonWallet = p.date;
    }
    if (!last || p.date > last) last = p.date;
  }
  return { wallet, other, paid: wallet + other, last, lastNonWallet };
}
var addDays3 = (iso, n) => isoOf(Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5) + n);
var monthBefore = (iso) => {
  let y = +iso.slice(0, 4);
  let m = +iso.slice(5, 7) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return [y, m];
};
function disclosureInvoiceStatus(rec, pf, cutoff) {
  if (rec.cancelled) return [4, "\u0645\u0644\u063A\u0627\u0629", "Cancelled"];
  if (pf.paid >= rec.grossAmount - 0.5) return [2, "\u0645\u0633\u062F\u062F\u0629", "Paid"];
  if (pf.paid > 0) return [5, "\u0645\u0633\u062F\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B", "Partly paid"];
  if (rec.dueDate < cutoff) return [3, "\u0645\u0646\u062A\u0647\u064A\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629", "Expired"];
  return [1, "\u0635\u0627\u062F\u0631\u0629", "Issued"];
}
function sourceRecord(st, i, rec, D, cutoff) {
  const idKey = st.idKey[i];
  const year = Math.floor(idKey / 1e8);
  const src = SOURCES[st.src[i]];
  const item = ITEMS[st.item[i]];
  const ent = ENTITIES[st.ent[i]];
  const muni = municipalityOfRow(st, i);
  const payer = payerName(st.payer[i]);
  const gross = rec.grossAmount;
  const sadad = rec.sadadNo;
  const pf = paymentFacts(rec);
  const r = new Rng(mix(40, idKey % 1000003, year));
  const flags = st.flags[i];
  const amanaNo = String(1e3 + st.ent[i] * 10);
  const geoFields = [
    fld("AMANA_NO", "\u0643\u0648\u062F \u0627\u0644\u0623\u0645\u0627\u0646\u0629", "Amanah code", amanaNo),
    fld("ARABIC_AMANA_NAME", "\u0627\u0644\u0623\u0645\u0627\u0646\u0629", "Amanah", ent.ar),
    ...muni.municipalityStatus === "mapped" ? [fld("ARABIC_BALADYA_NAME", "\u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipality", muni.municipalityAr)] : muni.municipalityStatus === "direct_amanah" ? [fld("ARABIC_BALADYA_NAME", "\u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipality", muni.municipalitySourceValue || ent.ar)] : []
  ];
  const facilityKey = facilityKeyOf(st.payer[i]);
  const profile = SOURCE_PROFILE[src.key];
  const out = {
    family: src.key,
    revenueSource: src.key,
    sourceLabel: profile?.label || null,
    item: { key: item.key, ar: item.ar, en: item.en },
    providingSystem: null,
    level: profile?.level || null,
    views: [],
    related: [],
    links: [],
    revenueLines: [],
    checks: {},
    assumptions: assumptionsFor(src.key).map((a) => a.id),
    notes: []
  };
  const rawStatus = disclosureInvoiceStatus(rec, pf, cutoff);
  if (src.key === "tobacco" || src.key === "accommodation") {
    const tob = src.key === "tobacco";
    const A = tob ? PARAMS.tobacco : PARAMS.accommodation;
    const pct = A.feePercents[hash(idKey % 1e6, 1) % A.feePercents.length];
    const tax = rec.vatAmount;
    const fee = gross - tax;
    const base = Math.round(fee / (pct / 100) * 100) / 100;
    const [dy, dm] = monthBefore(rec.issueDate);
    const grp = grpOf(flags);
    const dscKey = Number(DISCLOSURE.num(idKey));
    const dscNo = DISCLOSURE.of(idKey);
    const replacedBy = grp === GRP.TB_REPLACED ? idKey + 1 : null;
    const replaces = grp === GRP.TB_REPLACEMENT ? idKey - 1 : null;
    const facName = payer.ar;
    const crNo = crNoOf(st.payer[i]);
    const reqId = `SR${pad3(hash(idKey % 1e6, 2) % 1e10, 10)}`;
    out.providingSystem = BI2(tob ? "\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u062A\u0628\u063A (TB_*)" : "\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0625\u064A\u0648\u0627\u0621", tob ? "Tobacco disclosure platform (TB_*)" : "Accommodation disclosure platform").ar;
    out.importVersion = tob ? IMPORT_VERSIONS.tobacco : IMPORT_VERSIONS.accommodation;
    const invoiceFields = [
      fld("INVOICE_KEY", "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0627\u0644\u0646\u0638\u0627\u0645", "Invoice key", String(71e6 + idKey % 1e8)),
      fld("DISCLOSURE_KEY", "\u0631\u0642\u0645 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure key", dscKey),
      fld("DISCLOSURE_YEAR", "\u0633\u0646\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure year", dy),
      fld("DISCLOSURE_MONTH", "\u0634\u0647\u0631 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure month", dm),
      ...geoFields,
      fld("FACILITY_KEY", "\u0643\u0648\u062F \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility key", facilityKey),
      fld(tob ? "FACILITY_NAME" : "ARABIC_FACILITY_NAME", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility name", facName),
      fld("STATUS_KEY", "\u0643\u0648\u062F \u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice status key", rawStatus[0]),
      fld("ARABIC_STATUS_NAME", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice status", rawStatus[1]),
      fld("TYPE_KEY", "\u0643\u0648\u062F \u0646\u0648\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice type key", grp === GRP.TB_REPLACEMENT ? 2 : 1),
      fld("ARABIC_TYPE_NAME", "\u0646\u0648\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice type", grp === GRP.TB_REPLACEMENT ? "\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0641\u0635\u0627\u062D \u0645\u0639\u062F\u0651\u0644" : "\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0641\u0635\u0627\u062D \u0634\u0647\u0631\u064A")
    ];
    if (tob) invoiceFields.push(fld("CUSTOMER_ID_NO", "\u0631\u0642\u0645 \u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0635\u062F\u0631 \u0628\u0627\u0633\u0645\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Customer ID", nationalIdOf(st.payer[i])), fld("CUSTOMER_ID_TYPE", "\u0646\u0648\u0639 \u0627\u0644\u0647\u0648\u064A\u0629", "ID type", 1));
    invoiceFields.push(
      fld("SADAD_NO", "\u0631\u0642\u0645 \u0627\u0644\u0633\u062F\u0627\u062F", "SADAD number", sadad),
      fld("AMOUNT", "\u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice amount", gross),
      ...tob ? [fld("FROM_WALLET", "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062E\u0635\u0648\u0645 \u0645\u0646 \u0627\u0644\u0645\u062D\u0641\u0638\u0629", "Deducted from wallet", pf.wallet)] : [fld("PAID_AMOUNT", "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062F\u062F", "Paid amount", pf.paid)],
      fld("SADAD_ISSUE_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u062F\u0627\u0631", "Issue date", rec.issueDate),
      fld("SADAD_EXPIRY_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629", "Expiry date", rec.dueDate),
      fld("SADAD_PAID_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F", "Paid date", pf.lastNonWallet || pf.last),
      fld("SADAD_REQUEST_ID", "\u0631\u0642\u0645 \u0637\u0644\u0628 \u0627\u0644\u0633\u062F\u0627\u062F", "SADAD request id", reqId)
    );
    out.views.push(view("INVOICES", tob ? "TB_ENT_INVOICES" : "TB_ENT_INVOICES", BI2("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0641\u064A \u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0635\u062F\u0631", "Invoice in the source platform"), invoiceFields));
    const days = tob ? null : Math.max(1, Math.min(31 * 150, Math.round(base / (150 + hash(idKey % 1e6, 3) % 450))));
    const discFields = [
      fld("DISCLOSURE_KEY", "\u0643\u0648\u062F \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure key", dscKey),
      fld("DISCLOSURE_YEAR", "\u0633\u0646\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure year", dy),
      fld("DISCLOSURE_MONTH", "\u0634\u0647\u0631 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure month", dm),
      fld("CREATED_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0628\u062F\u0627\u064A\u0629", "Period start", `${dy}-${pad3(dm, 2)}-01`),
      fld(tob ? "DISCLOSURE_DATE" : "MODIFIED_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u062F\u064A\u0645", "Submission date", addDays3(rec.issueDate, -(hash(idKey % 1e6, 4) % 3))),
      fld(tob ? "TOTAL_AMOUNT" : "TOTAL_OCCUPANCY", tob ? "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u0641\u0635\u0627\u062D (\u0623\u0633\u0627\u0633 \u0627\u0644\u0627\u062D\u062A\u0633\u0627\u0628)" : "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u0641\u0635\u0627\u062D\u0627\u062A (\u0623\u0633\u0627\u0633 \u0627\u0644\u0627\u062D\u062A\u0633\u0627\u0628)", "Disclosed base", base),
      fld("TOTAL_PERCENTAGE", "\u0646\u0633\u0628\u0629 \u0627\u0644\u0627\u062D\u062A\u0633\u0627\u0628", "Calculation percentage", pct)
    ];
    if (tob) discFields.push(fld("TAX", "\u0627\u0644\u0636\u0631\u064A\u0628\u0629", "VAT", tax), fld("DISCLOSED_BY_NAME", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0641\u0635\u062D", "Disclosed by", personName(st.payer[i] + 7).ar), fld("SALES_TYPE_KEY", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", "Sales type key", 1), fld("ARABIC_SALES_TYPE_NAME", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", "Sales type", "\u0645\u0628\u064A\u0639\u0627\u062A \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u062A\u0628\u063A"));
    else discFields.push(fld("OCCUPANCY_DAYS", "\u0639\u062F\u062F \u0623\u064A\u0627\u0645 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosed days", days), fld("PRICE_PER_DAY_PERCENTAGE", "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u064A\u0648\u0645\u064A \u0644\u0644\u0646\u0633\u0628\u0629", "Daily price of the percentage", Math.round(fee / days * 100) / 100), fld("APPROVED_OCCUPANCIES", "\u0627\u0644\u0625\u0641\u0635\u0627\u062D\u0627\u062A \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629", "Approved lines", Math.max(1, Math.round(days / 3))), fld("REJECTED_OCCUPANCIES", "\u0627\u0644\u0625\u0641\u0635\u0627\u062D\u0627\u062A \u0627\u0644\u0645\u0631\u0641\u0648\u0636\u0629", "Rejected lines", hash(idKey % 1e6, 5) % 3), fld("CREATED_BY", "\u0627\u0644\u062A\u0642\u062F\u064A\u0645 \u0628\u0648\u0627\u0633\u0637\u0629", "Created by", personName(st.payer[i] + 7).ar), fld("IS_APPROVED", "\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", "Approved", "\u0646\u0639\u0645"), fld("IS_DELETED", "\u0627\u0644\u062D\u0630\u0641", "Deleted", "\u0644\u0627"), fld("IS_ACTIVE", "\u0647\u0644 \u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0633\u0627\u0631\u064A", "Active", replacedBy ? "\u0644\u0627" : "\u0646\u0639\u0645"));
    discFields.push(
      fld("STATUS_KEY", "\u0643\u0648\u062F \u0627\u0644\u062D\u0627\u0644\u0629", "Status key", replacedBy ? 3 : 2),
      fld("ARABIC_STATUS_NAME", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure status", replacedBy ? "\u0645\u0633\u062A\u0628\u062F\u0644 \u0628\u0625\u0641\u0635\u0627\u062D \u0645\u0639\u062F\u0651\u0644" : "\u0645\u0639\u062A\u0645\u062F"),
      fld("TYPE_KEY", "\u0643\u0648\u062F \u0627\u0644\u0646\u0648\u0639", "Type key", grp === GRP.TB_REPLACEMENT ? 2 : 1),
      fld("ARABIC_TYPE_NAME", "\u0646\u0648\u0639 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure type", grp === GRP.TB_REPLACEMENT ? "\u0645\u0639\u062F\u0651\u0644" : "\u0634\u0647\u0631\u064A"),
      ...tob ? [fld("REPLACED_WITH_KEY", "\u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0627\u0644\u062C\u062F\u064A\u062F", "Replaced with", replacedBy ? Number(DISCLOSURE.num(replacedBy)) : null)] : []
    );
    out.views.push(view("DISCLOSURES", "TB_ENT_DISCLOSURES", BI2("\u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0634\u0647\u0631\u064A", "Monthly disclosure"), discFields));
    out.views.push(view("SCHEDULES", "TB_ENT_SCHEDULES", BI2("\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure schedule"), [
      fld("SCHEDULE_KEY", "\u0643\u0648\u062F \u0627\u0644\u062C\u062F\u0648\u0644\u0629", "Schedule key", SCHEDULE.of(idKey)),
      fld("SCHEDULE_YEAR", "\u0633\u0646\u0629 \u0627\u0644\u062C\u062F\u0648\u0644\u0629", "Schedule year", dy),
      fld("SCHEDULE_MONTH", "\u0634\u0647\u0631 \u0627\u0644\u062C\u062F\u0648\u0644\u0629", "Schedule month", dm),
      fld("DISCLOSURE_KEY", "\u0643\u0648\u062F \u0627\u0644\u0625\u0641\u0635\u0627\u062D", "Disclosure key", dscKey),
      fld("SCHEDULE_STATUS_KEY", "\u0643\u0648\u062F \u0627\u0644\u062D\u0627\u0644\u0629", "Status key", 2),
      fld("ARABIC_STATUS_NAME", "\u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u062F\u0648\u0644\u0629", "Schedule status", "\u062A\u0645 \u0627\u0644\u0625\u0641\u0635\u0627\u062D"),
      fld("CREATED_DATE", "\u062A\u0627\u0631\u064A\u062E \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062C\u062F\u0648\u0644\u0629", "Schedule created", `${dy}-${pad3(dm, 2)}-01`),
      fld("UPDATE_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0639\u062F\u064A\u0644", "Schedule updated", rec.issueDate)
    ]));
    const rooms = 8 + hash(st.payer[i], 11) % 150;
    const lic0 = hash(st.payer[i], 12) % 5 + 1;
    const walletBal = Math.round(hash(st.payer[i], 13) % 2e4 * 10) / 10;
    out.views.push(view("FACILITIES", "TB_DIM_FACILITIES", BI2("\u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility"), [
      fld(tob ? "FACILITY_KEY" : "FACILITY_ID", "\u0643\u0648\u062F \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility key", facilityKey),
      fld(tob ? "FACILITY_NAME" : "ARABIC_FACILITY_NAME", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility name", facName),
      ...tob ? [fld("LICENSE_NO", "\u0631\u0642\u0645 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence number", LICENCE.of(idKey - idKey % 7).slice(0, 14)), fld("LICENSE_PERIOD", "\u0645\u062F\u0629 \u0627\u0644\u0631\u062E\u0635\u0629 (\u0633\u0646\u0629)", "Licence period (years)", lic0), fld("IS_APPROVED", "\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", "Approved", "\u0646\u0639\u0645"), fld("SHOP_AREA", "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u0643\u0627\u0646", "Shop area", 20 + hash(st.payer[i], 14) % 400), fld("FACILITYBALANCE", "\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062D\u0641\u0638\u0629", "Wallet balance", walletBal), fld("OWNER_NAME", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0627\u0644\u0643", "Owner name", personName(st.payer[i]).ar), fld("OWNER_IDENTITY_NO", "\u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0627\u0644\u0643", "Owner identity", nationalIdOf(st.payer[i])), fld("ARABIC_TYPE_NAME", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility type", "\u0628\u0642\u0627\u0644\u0629 / \u0645\u0631\u0643\u0632 \u062A\u0633\u0648\u0642"), fld("CLOSE_STATUS_KEY", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0644\u063A\u0627\u0621", "Close status", "\u0646\u0634\u0637\u0629")] : [fld("REGISTRATION_NUMBER", "\u0631\u0642\u0645 \u0627\u0644\u0633\u062C\u0644", "Registration number", crNo), fld("ARABIC_TYPE_NAME", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility type", ["\u0641\u0646\u062F\u0642", "\u0634\u0642\u0642 \u0645\u062E\u062F\u0648\u0645\u0629", "\u0646\u0632\u0644", "\u0645\u062C\u0645\u0639 \u0633\u0643\u0646\u064A"][hash(st.payer[i], 15) % 4]), fld("ROOMS_COUNT", "\u0639\u062F\u062F \u0627\u0644\u063A\u0631\u0641", "Rooms", rooms), fld("COMMERCIAL_RECORD", "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", "Commercial record", crNo), fld("RESPONSIBLE_NAME", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644", "Responsible", personName(st.payer[i] + 3).ar), fld("RESPONSIBLE_MOBILE", "\u062C\u0648\u0627\u0644 \u0627\u0644\u0645\u0633\u0624\u0648\u0644", "Responsible mobile", mobileOf(st.payer[i]))],
      fld("DISTRICT", "\u0627\u0644\u062D\u064A", "District", DISTRICTS[hash(st.payer[i], 16) % DISTRICTS.length]),
      fld(tob ? "CR_NO" : "COMMERCIAL_RECORD", "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", "CR number", crNo)
    ]));
    if (replacedBy) out.related.push({ kind: "replaced_by", label: BI2("\u0627\u0633\u062A\u064F\u0628\u062F\u0644\u062A \u0628\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0641\u0635\u0627\u062D \u0645\u0639\u062F\u0651\u0644", "Replaced by an amended-disclosure invoice"), invoiceId: invoiceIdFor(st.ent[i], st.scope[i], replacedBy), note: BI2("\u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0644\u063A\u0627\u0629\u061B \u062A\u064F\u062E\u0635\u0645 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0648\u062A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0639\u062F\u0651\u0644\u0629 \u0641\u0642\u0637.", "This invoice is cancelled and deducted once; only the amended invoice is counted.") });
    if (replaces) out.related.push({ kind: "replaces", label: BI2("\u062A\u062D\u0644 \u0645\u062D\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0623\u0635\u0644\u064A", "Replaces the original-disclosure invoice"), invoiceId: invoiceIdFor(st.ent[i], st.scope[i], replaces) });
    out.checks = { disclosureBase: base, feePercent: pct, fee, vat: tax, amountEqualsFeePlusVat: Math.abs(fee + tax - gross) < 0.5, walletPaid: pf.wallet, sadadPaid: pf.other };
    out.facility = { key: facilityKey, name: facName };
  } else if (src.key === "white_lands") {
    const A = PARAMS.white_lands;
    const grp = grpOf(flags);
    const offset = grp === GRP.WL_OWN2 ? 1 : grp === GRP.WL_OWN3 ? 2 : 0;
    const headIdx = i - offset;
    const headKey = idKey - offset;
    const headGrp = grpOf(st.flags[headIdx]);
    const owners2 = headGrp === GRP.WL_HEAD2 ? 2 : headGrp === GRP.WL_HEAD3 ? 3 : 1;
    let groupGross = 0;
    const group2 = [];
    for (let k = 0; k < owners2; k += 1) {
      groupGross += st.gross[headIdx + k];
      group2.push(headIdx + k);
    }
    const share = gross / (groupGross || gross);
    const zone = hash(headKey % 1e6, 21) % 4;
    const rate = A.zoneRates[zone];
    const deedArea = Math.round(groupGross / rate * 100) / 100;
    const evalArea = Math.round(deedArea * share * 100) / 100;
    const deedNo = DEED.of(headKey);
    const deedId = Number(DEED.num(headKey));
    const landId = 5e6 + headKey % 1e7;
    const city = CITIES[hash(headKey % 1e6, 22) % CITIES.length];
    const issueD = rec.issueDate;
    const cycleYear = +issueD.slice(0, 4);
    const month = +issueD.slice(5, 7);
    const ext = extOf(flags);
    const given = ext === 1 ? Math.round(st.due[i] - st.issue[i] - A.dueDays) : 0;
    const origDue = isoOf(st.due[i] - given);
    const ownerNat = hash(st.payer[i], 23) % 100 < 80 ? "NationalId" : "CR";
    const ownerName = payer.ar;
    const idNo = ownerNat === "CR" ? crNoOf(st.payer[i]) : nationalIdOf(st.payer[i]);
    const paidStatus = rec.cancelled ? "\u0645\u0644\u063A\u0627\u0629" : pf.paid >= gross - 0.5 ? "\u0645\u062F\u0641\u0648\u0639\u0629" : pf.paid > 0 ? "\u0645\u062F\u0641\u0648\u0639\u0629 \u062C\u0632\u0626\u064A\u0627\u064B" : "\u063A\u064A\u0631 \u0645\u062F\u0641\u0648\u0639\u0629";
    const invStatus = rec.cancelled ? "\u0645\u0644\u063A\u0627\u0629" : pf.paid >= gross - 0.5 ? "\u0645\u0633\u062F\u062F\u0629" : "\u0645\u0646\u0634\u0648\u0631\u0629";
    out.providingSystem = "\u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621 (DS_035 ... DS_088)";
    out.importVersion = IMPORT_VERSIONS.white_lands;
    out.views.push(view("DS_038_IdleLandInvoices", "BIDSCIDLELANDS_ds_038_white_lands_fee_invoices_1", BI2("\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0633\u0648\u0645 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", "White-land fee invoice"), [
      fld("InvoiceId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice id", 8e6 + idKey % 1e8),
      fld("DeedOwnerRequestId", "\u0645\u0639\u0631\u0641 \u0637\u0644\u0628 \u0645\u0627\u0644\u0643 \u0627\u0644\u0635\u0643", "Deed-owner request id", 9e6 + idKey % 1e8),
      fld("LandfessDeedId", "\u0645\u0639\u0631\u0641 \u0635\u0643 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", "White-land deed id", deedId),
      fld("IdNumber", "\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629", "Id number", idNo),
      fld("FullName", "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644", "Full name", ownerName),
      fld("OwnerType", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0627\u0644\u0643", "Owner type", ownerNat),
      fld("OwnerTypeAr", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0627\u0644\u0643 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629", "Owner type (ar)", ownerNat === "CR" ? "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" : "\u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629"),
      fld("InvoicePrice", "\u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice price", gross),
      fld("InvoicePaidAmount", "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062F\u0641\u0648\u0639", "Paid amount", pf.paid),
      fld("InvoiceRestAmount", "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062A\u0628\u0642\u064A", "Rest amount", rec.cancelled ? 0 : Math.max(0, gross - pf.paid)),
      fld("EvaluatedArea", "\u0627\u0644\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u0642\u064A\u0651\u0645\u0629", "Evaluated area (m2)", evalArea),
      fld("DeedArea", "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0635\u0643", "Deed area (m2)", deedArea),
      fld("InvoiceDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice date", issueD),
      fld("PublishedDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0646\u0634\u0631", "Published date", addDays3(issueD, 1)),
      fld("LastTimeToPay", "\u0622\u062E\u0631 \u0645\u0648\u0639\u062F \u0644\u0644\u0633\u062F\u0627\u062F", "Last time to pay", rec.dueDate),
      fld("DueDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642", "Due date", origDue),
      fld("PaidDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F", "Paid date", pf.last),
      fld("InvoiceStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice status", invStatus),
      fld("PaidStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u062F\u0641\u0639", "Paid status", paidStatus),
      fld("PublishText", "\u0646\u0635 \u0627\u0644\u0646\u0634\u0631", "Publish text", `\u0646\u064F\u0634\u0631\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0645\u0646 \u062F\u0648\u0631\u0629 \u0627\u0644\u0641\u0631\u0632 ${cycleYear} (\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629)`),
      fld("StageName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u062D\u0644\u0629", "Stage", month === 1 ? "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649" : "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062A\u0643\u0645\u064A\u0644\u064A\u0629"),
      fld("PeriodName", "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0631\u0629", "Period", `\u062F\u0648\u0631\u0629 ${cycleYear}`),
      fld("CityName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u062F\u064A\u0646\u0629", "City", city),
      fld("StagePeriodStartDate", "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0631\u0629", "Period start", `${cycleYear}-01-01`),
      fld("StagePeriodEndDate", "\u062A\u0627\u0631\u064A\u062E \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0631\u0629", "Period end", `${cycleYear}-12-31`),
      fld("FarzCycleId", "\u0645\u0639\u0631\u0641 \u062F\u0648\u0631\u0629 \u0627\u0644\u0641\u0631\u0632", "Sorting-cycle id", cycleYear * 100 + 1),
      fld("DeedStagePeriodId", "\u0645\u0639\u0631\u0641 \u062F\u0648\u0631\u0629 \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0635\u0643", "Deed stage-period id", headKey % 1e7),
      fld("SadadNum", "\u0631\u0642\u0645 \u0633\u062F\u0627\u062F", "SADAD number", sadad)
    ]));
    out.views.push(view("DS_088_IdleLandDeeds", "BIDSCIDLELANDS_ds_088_deeds_1", BI2("\u0627\u0644\u0635\u0643", "Deed"), [
      fld("DeedId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0635\u0643", "Deed id", deedId),
      fld("DeedNumber", "\u0631\u0642\u0645 \u0627\u0644\u0635\u0643", "Deed number", deedNo),
      fld("DeedArea", "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0635\u0643", "Deed area (m2)", deedArea),
      fld("DeedIssueDate", "\u062A\u0627\u0631\u064A\u062E \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0635\u0643", "Deed issue date", `${2005 + hash(headKey % 1e6, 24) % 18}-0${1 + hash(headKey % 1e6, 25) % 9}-1${hash(headKey % 1e6, 26) % 9}`),
      fld("OwnersCount", "\u0639\u062F\u062F \u0627\u0644\u0645\u0644\u0627\u0643", "Owners", owners2),
      fld("DeedTypeName", "\u0646\u0648\u0639 \u0627\u0644\u0635\u0643", "Deed type", ["\u0635\u0643 \u0645\u0644\u0643\u064A\u0629", "\u0635\u0643 \u0625\u0641\u0631\u0627\u063A", "\u0635\u0643 \u0625\u0631\u062B"][hash(headKey % 1e6, 27) % 3]),
      fld("DeedExpirationStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0635\u0643", "Deed validity", "\u0633\u0627\u0631\u064A"),
      fld("LandTypeName", "\u0646\u0648\u0639 \u0627\u0644\u0623\u0631\u0636", "Land type", ["\u0633\u0643\u0646\u064A", "\u062A\u062C\u0627\u0631\u064A", "\u0633\u0643\u0646\u064A \u062A\u062C\u0627\u0631\u064A"][hash(headKey % 1e6, 28) % 3]),
      fld("CityName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u062F\u064A\u0646\u0629", "City", city),
      fld("LandId", "\u0645\u0639\u0631\u0641 \u0642\u0637\u0639\u0629 \u0627\u0644\u0623\u0631\u0636", "Land id", landId),
      fld("InvoiceCount", "\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631", "Invoices on the deed", owners2),
      fld("HasInvoice", "\u0647\u0644 \u064A\u0648\u062C\u062F \u0641\u0627\u062A\u0648\u0631\u0629", "Has invoice", 1)
    ]));
    const planNo = `${1e3 + hash(headKey % 1e6, 29) % 8e3}/\u062C`;
    const landArea = Math.round(deedArea * (1 + hash(headKey % 1e6, 30) % 20 / 100) * 100) / 100;
    out.views.push(view("DS_037_IdleLandDetails", "BIDSCIDLELANDS_ds_037_white_lands_data_1", BI2("\u0642\u0637\u0639\u0629 \u0627\u0644\u0623\u0631\u0636", "Land plot"), [
      fld("LandId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0623\u0631\u0636", "Land id", landId),
      fld("LandNo", "\u0631\u0642\u0645 \u0627\u0644\u0623\u0631\u0636", "Land number", `${100 + hash(headKey % 1e6, 31) % 900}`),
      fld("PlanNo", "\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0637\u0637", "Plan number", planNo),
      fld("LandArea", "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0623\u0631\u0636", "Land area (m2)", landArea),
      fld("DistrictName", "\u0627\u0633\u0645 \u0627\u0644\u062D\u064A", "District", DISTRICTS[hash(headKey % 1e6, 32) % DISTRICTS.length]),
      fld("LandStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0631\u0636", "Land status", "\u0623\u0631\u0636 \u0628\u064A\u0636\u0627\u0621 \u0645\u0641\u0648\u062A\u0631\u0629"),
      fld("CityName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u062F\u064A\u0646\u0629", "City", city),
      fld("ZoneName", "\u0627\u0633\u0645 \u0627\u0644\u0646\u0637\u0627\u0642", "Zone", `\u0627\u0644\u0634\u0631\u064A\u062D\u0629 ${"ABCD"[zone]}`),
      fld("DeedId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0635\u0643", "Deed id", deedId),
      fld("Latitude", "\u062E\u0637 \u0627\u0644\u0639\u0631\u0636", "Latitude", (21 + hash(headKey % 1e6, 33) % 5e3 / 1e3).toFixed(5)),
      fld("Longitude", "\u062E\u0637 \u0627\u0644\u0637\u0648\u0644", "Longitude", (39 + hash(headKey % 1e6, 34) % 7e3 / 1e3).toFixed(5))
    ]));
    out.views.push(view("Basic_IDLE_LANDS_INFO_BS", "ScannedLands", BI2("\u0633\u062C\u0644 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u062E\u0627\u0645\u0644\u0629 (\u0627\u0644\u0645\u0633\u062D)", "Idle-land registry (scan)"), [
      fld("GISLandUniqueId", "\u0631\u0642\u0645 \u062A\u0633\u0644\u0633\u0644\u064A", "GIS unique id", landId + 7e5),
      fld("MAINLANDUSEDSC", "\u0648\u0635\u0641 \u0627\u0644\u063A\u0631\u0636", "Main land use", ["\u0633\u0643\u0646\u064A", "\u062A\u062C\u0627\u0631\u064A"][hash(headKey % 1e6, 35) % 2]),
      fld("ZoneCode", "\u0643\u0648\u062F \u0627\u0644\u0634\u0631\u064A\u062D\u0629", "Zone code", zone + 1),
      fld("ZoneDsc", "\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u064A\u062D\u0629", "Zone name", `\u0627\u0644\u0634\u0631\u064A\u062D\u0629 ${"ABCD"[zone]}`),
      fld("Deed", "\u0647\u0644 \u0648\u0632\u0627\u0631\u0629 \u0639\u062F\u0644", "MoJ deed", "\u0646\u0639\u0645"),
      fld("RER", "\u0647\u0644 \u0633\u062C\u0644 \u0639\u0642\u0627\u0631\u064A", "Real-estate registry", "\u0644\u0627"),
      fld("LKAssetsAr", "\u0648\u0635\u0641 \u0645\u0644\u0643\u064A\u0629 \u0627\u0644\u062F\u0648\u0644\u0629", "State-ownership type", "\u0645\u0644\u0643\u064A\u0629 \u062E\u0627\u0635\u0629")
    ]));
    out.views.push(view("DS_035_IdleLandOwners", "BIDSCIDLELANDS_ds_035_white_lands_owners_1", BI2("\u0627\u0644\u0645\u0627\u0644\u0643 \u0639\u0644\u0649 \u0627\u0644\u0635\u0643", "Deed owner"), [
      fld("OwnerId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0627\u0644\u0643", "Owner id", 7e6 + idKey % 1e8),
      fld("DeedId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0635\u0643", "Deed id", deedId),
      fld("BeneficiaryId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0633\u062A\u0641\u064A\u062F", "Beneficiary id", 6e6 + st.payer[i]),
      fld("OwnerPercentage", "\u0646\u0633\u0628\u0629 \u0627\u0644\u0645\u0644\u0643\u064A\u0629 %", "Ownership %", Math.round(share * 1e4) / 100),
      fld("OwnershipArea", "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u0644\u0643\u064A\u0629", "Ownership area (m2)", evalArea),
      fld("Source", "\u0645\u0635\u062F\u0631 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u0643", "Owner data source", ["\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0639\u062F\u0644", "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u064A"][hash(st.payer[i], 36) % 2]),
      fld("IdNumber", "\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629", "Id number", idNo),
      fld("BeneficiaryNameAr", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0641\u064A\u062F", "Beneficiary", ownerName),
      fld("CityName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u062F\u064A\u0646\u0629", "City", city),
      fld("InvoiceId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice id", 8e6 + idKey % 1e8),
      fld("InvoiceStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice status", invStatus),
      fld("PaidStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u062F\u0641\u0639", "Paid status", paidStatus)
    ]));
    if (ext) {
      const recv = addDays3(issueD, 5 + hash(idKey % 1e6, 37) % 25);
      out.views.push(view("DS_041_TimeLimitRequest", "BIDSCIDLELANDS_ds_041_development_period_extension_1", BI2("\u0637\u0644\u0628 \u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0645\u0647\u0644\u0629", "Time-limit extension request"), [
        fld("Id", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0637\u0644\u0628", "Request id", 4e6 + idKey % 1e8),
        fld("InvoiceId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice id", 8e6 + idKey % 1e8),
        fld("RequestStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "Request status", ext === 1 ? "\u0645\u0642\u0628\u0648\u0644" : ext === 2 ? "\u0645\u0631\u0641\u0648\u0636" : "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629"),
        fld("Reason", "\u0633\u0628\u0628 \u0627\u0644\u0637\u0644\u0628", "Reason", "\u0637\u0644\u0628 \u0645\u0647\u0644\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u0637\u0648\u064A\u0631 (\u0646\u0635 \u062A\u062C\u0631\u064A\u0628\u064A)"),
        fld("ReceivedDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645", "Received", recv),
        fld("TimeLimitApprovalStatus", "\u062D\u0627\u0644\u0629 \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u062A\u0645\u062F\u064A\u062F", "Approval status", ext),
        fld("GivenPeriod", "\u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u0645\u0646\u0648\u062D\u0629 (\u064A\u0648\u0645)", "Given period (days)", ext === 1 ? given : null),
        fld("RefuseDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0631\u0641\u0636", "Refuse date", ext === 2 ? addDays3(recv, 10) : null),
        fld("RefusalReasonName", "\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636", "Refusal reason", ext === 2 ? "\u0644\u0645 \u064A\u0633\u062A\u0648\u0641\u0650 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0637\u0627\u062A" : null),
        fld("LastTimeToPay", "\u0622\u062E\u0631 \u0645\u0648\u0639\u062F \u0644\u0644\u0633\u062F\u0627\u062F \u0628\u0639\u062F \u0627\u0644\u062A\u0645\u062F\u064A\u062F", "Last time to pay after extension", rec.dueDate),
        fld("InvoiceLastTimeToPay", "\u0622\u062E\u0631 \u0645\u0648\u0639\u062F \u0644\u0644\u0633\u062F\u0627\u062F (\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629)", "Original last time to pay", origDue)
      ]));
      out.related.push({ kind: "extension", label: BI2(ext === 1 ? `\u062A\u0645\u062F\u064A\u062F \u0645\u0639\u062A\u0645\u062F ${given} \u064A\u0648\u0645\u0627\u064B` : ext === 2 ? "\u0637\u0644\u0628 \u062A\u0645\u062F\u064A\u062F \u0645\u0631\u0641\u0648\u0636" : "\u0637\u0644\u0628 \u062A\u0645\u062F\u064A\u062F \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629", ext === 1 ? `Extension approved: ${given} days` : ext === 2 ? "Extension refused" : "Extension pending") });
    }
    if (flags & F.OBJECTION) {
      out.views.push(view("DS_040_IdleLandObjections", "BIDSCIDLELANDS_ds_040_objections_1", BI2("\u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Objection"), [
        fld("Id", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Objection id", 3e6 + idKey % 1e8),
        fld("InvoiceId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice id", 8e6 + idKey % 1e8),
        fld("CreatedDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Created", addDays3(issueD, 8 + hash(idKey % 1e6, 38) % 30)),
        fld("ObjectionReasonName", "\u0633\u0628\u0628 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Reason", ["\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0633\u0627\u062D\u0629", "\u0627\u0644\u0623\u0631\u0636 \u0645\u0637\u0648\u0631\u0629", "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0644\u0643\u064A\u0629"][hash(idKey % 1e6, 39) % 3]),
        fld("ObjectionStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Status", "\u0642\u064A\u062F \u0627\u0644\u062F\u0631\u0627\u0633\u0629"),
        fld("ObjectionTypeName", "\u0646\u0648\u0639 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Type", "\u0627\u0639\u062A\u0631\u0627\u0636 \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629"),
        fld("Demand", "\u0645\u0637\u0644\u0628 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Demand", "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644\u0647\u0627 (\u0646\u0635 \u062A\u062C\u0631\u064A\u0628\u064A)")
      ]));
    }
    if (!rec.cancelled && pf.paid < gross - 0.5 && hash(idKey % 1e6, 40) % 100 < 8) {
      out.views.push(view("DS_039_IdleLand_Violations", "BIDSCIDLELANDS_ds_039_white_lands_violations_1", BI2("\u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0644\u0623\u0631\u0636 (\u0645\u0639\u0644\u0648\u0645\u0629 \u0645\u0631\u062A\u0628\u0637\u0629)", "Land violation (linked information)"), [
        fld("ViolationId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Violation id", 2e6 + idKey % 1e8),
        fld("DeedNumber", "\u0631\u0642\u0645 \u0627\u0644\u0635\u0643", "Deed number", deedNo),
        fld("InvoiceId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice id", 8e6 + idKey % 1e8),
        fld("ViolationStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Status", "\u0646\u0627\u0641\u0630\u0629"),
        fld("InitialFineAmount", "\u0642\u064A\u0645\u0629 \u0627\u0644\u063A\u0631\u0627\u0645\u0629 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A\u0629 (\u063A\u064A\u0631 \u0645\u0636\u0627\u0641\u0629 \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629)", "Initial fine (NOT added to the invoice)", Math.round(gross * 0.1)),
        fld("ViolationPercentage", "\u0646\u0633\u0628\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 %", "Violation %", 10),
        fld("ViolationPaidStatusName", "\u062D\u0627\u0644\u0629 \u0633\u062F\u0627\u062F \u0627\u0644\u063A\u0631\u0627\u0645\u0629", "Fine paid status", "\u063A\u064A\u0631 \u0645\u062F\u0641\u0648\u0639\u0629")
      ]));
      out.related.push({ kind: "violation_info", label: BI2("\u0645\u062E\u0627\u0644\u0641\u0629 \u0645\u0631\u062A\u0628\u0637\u0629: \u063A\u0631\u0627\u0645\u062A\u0647\u0627 \u0645\u0639\u0644\u0648\u0645\u0629 \u0648\u0644\u0627 \u062A\u064F\u0636\u0627\u0641 \u0625\u0644\u0649 \u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Linked violation: its fine is information and is not added to the invoice amount") });
    }
    out.related.push({
      kind: "deed",
      label: BI2(owners2 > 1 ? `\u0635\u0643 \u0645\u0634\u062A\u0631\u0643 \u0628\u064A\u0646 ${owners2} \u0645\u0644\u0627\u0643 \u2014 \u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0643\u0644 \u0645\u0627\u0644\u0643` : "\u0635\u0643 \u0628\u0645\u0627\u0644\u0643 \u0648\u0627\u062D\u062F", owners2 > 1 ? `Deed shared by ${owners2} owners - one invoice per owner` : "Single-owner deed"),
      deedNo,
      invoices: group2.map((g) => ({ id: invoiceIdFor(st.ent[g], st.scope[g], st.idKey[g]), amount: st.gross[g], share: Math.round(st.gross[g] / groupGross * 1e4) / 100, current: g === i }))
    });
    if (st.exec[i] >= 0 && st.requests[st.exec[i]]?.system === "white_lands") {
      const q3 = st.requests[st.exec[i]];
      out.links.push({ system: "\u0645\u0644\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", dataset: "white_lands_enforcement", importVersion: IMPORT_VERSIONS.white_lands_enforcement, keyField: "\u0631\u0642\u0645 \u0623\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", key: q3.enforceNum, role: "enforcement", note: BI2("\u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0644\u0627 \u064A\u064F\u062D\u062A\u0633\u0628 \u062A\u062D\u0635\u064A\u0644\u0627\u064B\u060C \u0648\u0645\u0628\u0644\u063A \u0627\u0644\u0623\u0645\u0631 \u0644\u0627 \u064A\u064F\u0636\u0627\u0641 \u0625\u0644\u0649 \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629.", "Execution is not collection and the order amount is not added to the debt.") });
    }
    out.checks = { owners: owners2, ownershipSharePct: Math.round(share * 1e4) / 100, groupGross, zoneRate: rate, evaluatedAreaTimesRate: Math.round(evalArea * rate), extension: ext, extensionDays: given, objection: !!(flags & F.OBJECTION) };
    out.land = { landId, deedNo, city };
  } else if (src.key === "licenses" || src.key === "municipal_fees") {
    const fam = item.key;
    const svcList = SERVICES[fam];
    const svc = svcList ? svcList[hash(idKey % 1e6, 51) % svcList.length] : [900, "\u062E\u062F\u0645\u0629 \u0628\u0644\u062F\u064A\u0629", "Municipal service"];
    const billStatus = rec.cancelled ? hash(idKey % 1e6, 52) % 2 ? 2 : 3 : pf.paid >= gross - 0.5 ? 1 : 0;
    const licId = LICENCE.num(idKey);
    const reqId = Number(REQUEST.num(idKey).slice(0, 9));
    const nat = hash(st.payer[i], 53) % 100 < 70 ? "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" : "\u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629";
    out.providingSystem = src.key === "licenses" ? "\u0645\u0646\u0635\u0629 \u0628\u0644\u062F\u064A (BALADY_BILLS) \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629" : "\u0637\u0628\u0642\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0648\u062D\u062F\u0629 (ENT_REVENUES)";
    out.importVersion = IMPORT_VERSIONS.balady;
    out.views.push(view("BALADY_BILLS", "TB_ENT_BALADY_BILLS", BI2("\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0644\u062F\u064A", "Balady bill"), [
      fld("DATA_KEY", "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill key", rec.id),
      fld("REQUEST_ID", "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628", "Request id", reqId),
      fld("LICENSE_ID", "\u0631\u0642\u0645 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence id", licId),
      fld("BILL_NUMBER", "\u0631\u0642\u0645 \u0627\u0644\u0633\u062F\u0627\u062F", "SADAD number", sadad),
      fld("CREATE_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill date", rec.issueDate),
      fld("SERVICE_KEY", "\u0643\u0648\u062F \u0627\u0644\u062E\u062F\u0645\u0629", "Service key", svc[0]),
      fld("SERVICE_NAME", "\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629", "Service", svc[1]),
      fld("OWNER_ID", "\u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0627\u0644\u0643", "Owner id", nat === "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" ? crNoOf(st.payer[i]) : nationalIdOf(st.payer[i])),
      fld("OWNER_TYPE_ID", "\u0646\u0648\u0639 \u0627\u0644\u0647\u0648\u064A\u0629", "Owner type", nat === "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" ? 2 : 1),
      fld("NATIONAL_NUMBER", "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u062D\u062F", "Unified number", nat === "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" ? `700${pad3(hash(st.payer[i], 54) % 1e7, 7)}` : null),
      fld("BILL_UPDATE_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u062D\u062F\u064A\u062B", "Updated", pf.last || rec.issueDate),
      fld("PAID_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F", "Paid date", pf.last),
      fld("BILL_AMOUNT", "\u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill amount", gross),
      fld("BILL_STATUS_KEY", "\u0643\u0648\u062F \u0627\u0644\u062D\u0627\u0644\u0629", "Status key", billStatus),
      fld("BILL_STATUS_NAME", "\u0648\u0635\u0641 \u0627\u0644\u062D\u0627\u0644\u0629", "Status", PARAMS.licenses.billStatusCodes[billStatus]),
      fld("AMANA_NO", "\u0643\u0648\u062F \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A", "Amanah accounting code", amanaNo),
      fld("ARABIC_BALADYA_NAME", "\u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipality", muni.municipalityStatus === "mapped" ? muni.municipalityAr : null)
      /* no municipality code is shown: the reference workbook has none and none is invented */
    ]));
    if (fam === "commercial_license" || fam === "signboard_license") {
      const act = ACTIVITIES[hash(st.payer[i], 55) % ACTIVITIES.length];
      const rate = 12 + hash(st.payer[i], 56) % 30;
      const area = Math.max(10, Math.round(gross / rate));
      const issue = rec.issueDate;
      const isRenew = svc[0] === 102 || svc[0] === 202;
      out.views.push(view("DS_001_Issued_Commercial_Licenses", "Commerial_License_atbl", BI2("\u0627\u0644\u0631\u062E\u0635\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 (\u0633\u062C\u0644 \u0627\u0644\u0631\u062E\u0635\u0629)", "Commercial licence record"), [
        fld("LIC_ID", "\u0631\u0642\u0645 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence id", licId),
        fld("REQ_ID", "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628", "Request id", reqId),
        fld("IS_CURRENT_LICENSE", "\u0622\u062E\u0631 \u0637\u0644\u0628 \u0639\u0644\u0649 \u0627\u0644\u0631\u062E\u0635\u0629\u061F", "Latest request on the licence", 1),
        fld("ISSUE_DATE_G", "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence start", issue),
        fld("SADAD_END_DATE", "\u062A\u0627\u0631\u064A\u062E \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence end", addDays3(issue, 365)),
        fld("NAME_REQ_TYPE", "\u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628", "Request type", svc[1]),
        fld("NAME_REQ_STATES", "\u0648\u0635\u0641 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "Request status", "\u0645\u0643\u062A\u0645\u0644"),
        fld("STATUS_DESC_MAP", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0631\u062E\u0635\u0629 (\u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629)", "Approved licence status", billStatus === 1 ? "\u0633\u0627\u0631\u064A\u0629" : billStatus >= 2 ? "\u0645\u0644\u063A\u064A\u0629" : "\u0633\u0627\u0631\u064A\u0629"),
        fld("SHOP_AREA", "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u062D\u0644 (\u0645\u0634\u062A\u0642\u0629 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0627\u064B)", "Shop area (derived by assumption)", area),
        fld("D_ACTIVITIES_NAME", "\u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u0641\u0635\u064A\u0644\u064A", "Detailed activity", act[0]),
        fld("ISIC_NUMBER", "\u0643\u0648\u062F \u0646\u0634\u0627\u0637 \u0623\u064A\u0632\u0643", "ISIC code", act[2]),
        fld("WORKER_TYPE_ID", "\u0643\u0648\u062F \u0646\u0648\u0639 \u0627\u0644\u0639\u0627\u0645\u0644\u064A\u0646", "Worker type", 1 + hash(st.payer[i], 57) % 3),
        fld("NAME_BOARD_TYPE", "\u0646\u0648\u0639 \u0627\u0644\u0644\u0648\u062D\u0629", "Board type", ["\u0644\u0648\u062D\u0629 \u0639\u0627\u062F\u064A\u0629", "\u0644\u0648\u062D\u0629 \u0645\u0636\u064A\u0626\u0629"][hash(st.payer[i], 58) % 2]),
        fld("ENTRY_MODE", "\u0643\u0648\u062F \u0645\u0635\u062F\u0631 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u062E\u0635\u0629", "Entry mode", 1),
        fld("STATUS_ID_BILLS", "\u0643\u0648\u062F \u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill status", billStatus),
        fld("BILL_NUMBER", "\u0631\u0642\u0645 \u0622\u062E\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0631\u062E\u0635\u0629", "Last bill linked to the licence", sadad),
        fld("CREATE_DATE_BILLS", "\u062A\u0627\u0631\u064A\u062E \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill created", rec.issueDate),
        fld("PAID_DATE", "\u062A\u0627\u0631\u064A\u062E \u062F\u0641\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill paid", pf.last),
        fld("FULL_NAME_OWNER", "\u0627\u0633\u0645 \u0645\u0627\u0644\u0643 \u0627\u0644\u0631\u062E\u0635\u0629", "Owner", payer.ar),
        fld("IS_RENEWAL", "\u062A\u062C\u062F\u064A\u062F\u061F", "Renewal", isRenew ? "\u0646\u0639\u0645" : "\u0644\u0627")
      ]));
      out.related.push({ kind: "licence", label: BI2("\u0633\u062C\u0644 \u0627\u0644\u0631\u062E\u0635\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u064A\u062D\u0645\u0644 \u0622\u062E\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u0641\u0642\u0637\u061B \u0628\u0642\u064A\u0629 \u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0631\u062E\u0635\u0629 \u062A\u0623\u062A\u064A \u0645\u0646 BALADY_BILLS", "The commercial-licence row carries only the last bill; earlier bills come from BALADY_BILLS"), licenceId: LICENCE.of(idKey) });
    } else if (fam === "building_permit") {
      out.views.push(view("Building_license_vw", "LICENCES / BILLS", BI2("\u0631\u062E\u0635\u0629 \u0627\u0644\u0628\u0646\u0627\u0621", "Building licence"), [
        fld("LIC_ID", "\u0631\u0642\u0645 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence id", licId),
        fld("NAME_AR_licencse_type", "\u0646\u0648\u0639 \u0627\u0644\u0645\u0628\u0646\u0649", "Building type", ["\u0633\u0643\u0646\u064A", "\u062A\u062C\u0627\u0631\u064A", "\u0633\u0648\u0631"][hash(idKey % 1e6, 59) % 3]),
        fld("CREATE_DATE_BILL", "\u062A\u0627\u0631\u064A\u062E \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill created", rec.issueDate),
        fld("BILL_NUMBER", "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0631\u062E\u0635\u0629", "Bill number", sadad),
        fld("PAID_DATE_G", "\u062A\u0627\u0631\u064A\u062E \u0633\u062F\u0627\u062F \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill paid", pf.last),
        fld("AREA", "\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0645\u0628\u0646\u0649", "Building area (m2)", 120 + hash(idKey % 1e6, 60) % 900),
        fld("FLOORS_COUNT", "\u0625\u062C\u0645\u0627\u0644\u064A \u0639\u062F\u062F \u0627\u0644\u0623\u062F\u0648\u0627\u0631", "Floors", 1 + hash(idKey % 1e6, 61) % 5),
        fld("STATES_REQUESTS_NAME", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "Request status", "\u0645\u0643\u062A\u0645\u0644"),
        fld("ENG_OFF_DESIGNER_NAME_AR", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0645\u0635\u0645\u0645", "Designer office", "\u0645\u0643\u062A\u0628 \u0647\u0646\u062F\u0633\u064A \u062A\u062C\u0631\u064A\u0628\u064A"),
        fld("OWNER_TYPE_ID", "\u0643\u0648\u062F \u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0627\u0644\u0643", "Owner id type", nat === "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" ? 2 : 1)
      ]));
    } else if (fam === "health_certificate") {
      out.views.push(view("medical_license_bs", "BILLS / MED_REQUESTS", BI2("\u0627\u0644\u0634\u0647\u0627\u062F\u0629 \u0627\u0644\u0635\u062D\u064A\u0629", "Health certificate"), [
        fld("REQUEST_ID", "\u0631\u0642\u0645 \u0637\u0644\u0628 \u0627\u0644\u0634\u0647\u0627\u062F\u0629 \u0627\u0644\u0635\u062D\u064A\u0629", "Certificate request", reqId),
        fld("LIC_ID", "\u0631\u0642\u0645 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence id", licId),
        fld("cer_type", "\u0646\u0648\u0639 \u0627\u0644\u0634\u0647\u0627\u062F\u0629", "Certificate type", svc[0] === 401 ? "\u0634\u0647\u0627\u062F\u0629 \u0633\u0646\u0648\u064A\u0629" : "\u0634\u0647\u0627\u062F\u0629 \u0645\u0639 \u062A\u062B\u0642\u064A\u0641 \u0635\u062D\u064A"),
        fld("CREATE_DATE", "\u062A\u0627\u0631\u064A\u062E \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill created", rec.issueDate),
        fld("BILL_NUMBER", "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0634\u0647\u0627\u062F\u0629", "Bill number", sadad),
        fld("AMOUNT", "\u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill amount", gross),
        fld("NAME_BILL_STATUES", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill status", PARAMS.licenses.billStatusCodes[billStatus]),
        fld("NAME_CER", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0634\u0647\u0627\u062F\u0629", "Certificate status", billStatus === 1 ? "\u0633\u0627\u0631\u064A\u0629" : "\u063A\u064A\u0631 \u0633\u0627\u0631\u064A\u0629")
      ]));
    }
    out.checks = { billStatusKey: billStatus, billStatusName: PARAMS.licenses.billStatusCodes[billStatus], service: svc[1] };
  } else if (src.key === "fines") {
    const A = PARAMS.fines;
    const diff = hash(idKey % 1e6, 71) % 100 < A.differentValueShare * 100;
    const violationValue = diff ? Math.round(gross * (0.5 + hash(idKey % 1e6, 72) % 80 / 100) / 10) * 10 : gross;
    const act = ACTIVITIES[hash(st.payer[i], 73) % ACTIVITIES.length];
    const size = [["S", "\u0635\u063A\u064A\u0631\u0629"], ["M", "\u0645\u062A\u0648\u0633\u0637\u0629"], ["L", "\u0643\u0628\u064A\u0631\u0629"]][hash(st.payer[i], 74) % 3];
    const paidRaw = rec.cancelled ? "\u0645\u0644\u063A\u0627\u0629" : pf.paid >= gross - 0.5 ? "\u0645\u0633\u062F\u062F\u0629" : pf.paid > 0 ? "\u0645\u0633\u062F\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B" : "\u063A\u064A\u0631 \u0645\u0633\u062F\u062F\u0629";
    const desc = { building_violations: "\u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0634\u062A\u0631\u0627\u0637\u0627\u062A \u0627\u0644\u0628\u0646\u0627\u0621", signage_violations: "\u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0644\u0644\u0648\u062D\u0627\u062A \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629", health_violations: "\u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0637\u0627\u062A \u0627\u0644\u0635\u062D\u064A\u0629" }[item.key] || "\u0645\u062E\u0627\u0644\u0641\u0629 \u0628\u0644\u062F\u064A\u0629";
    out.providingSystem = "\u0625\u064A\u0641\u0627\u0621 / \u0645\u0645\u062A\u062B\u0644 (\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A)";
    out.importVersion = IMPORT_VERSIONS.violations;
    const visitStart = addDays3(rec.issueDate, -(hash(idKey % 1e6, 75) % 4));
    out.views.push(view("Violations_report_BV", "Violations_report", BI2("\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A", "Violations report"), [
      fld("\u0631\u0642\u0645_\u0627\u0644\u0632\u064A\u0627\u0631\u0629", "\u0631\u0642\u0645 \u0627\u0644\u0632\u064A\u0627\u0631\u0629", "Visit number", VISIT.of(idKey)),
      fld("\u0646\u0648\u0639_\u0627\u0644\u0631\u0642\u0627\u0628\u0629", "\u0646\u0648\u0639 \u0627\u0644\u0631\u0642\u0627\u0628\u0629", "Inspection type", ["\u0631\u0642\u0627\u0628\u0629 \u0645\u064A\u062F\u0627\u0646\u064A\u0629", "\u0628\u0644\u0627\u063A", "\u0631\u0642\u0627\u0628\u0629 \u062F\u0648\u0631\u064A\u0629"][hash(idKey % 1e6, 76) % 3]),
      fld("\u0627\u0644\u0627\u0645\u0627\u0646\u0629", "\u0627\u0644\u0623\u0645\u0627\u0646\u0629", "Amanah", ent.ar),
      fld("\u0627\u0633\u0645_\u0627\u0644\u0628\u0644\u062F\u064A\u0629", "\u0627\u0633\u0645 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipality", muni?.ar || null),
      fld("\u0627\u0633\u0645_\u0627\u0644\u0645\u0631\u0627\u0642\u0628", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u0627\u0642\u0628", "Inspector", personName(hash(idKey % 1e6, 77) % 5e3).ar),
      fld("\u0631\u0642\u0645_\u0647\u0648\u064A\u0629_\u0627\u0644\u0645\u0631\u0627\u0642\u0628", "\u0631\u0642\u0645 \u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0631\u0627\u0642\u0628", "Inspector id", nationalIdOf(hash(idKey % 1e6, 77) % 5e3)),
      fld("\u0627\u0633\u0645_\u0627\u0644\u0645\u0646\u0634\u0623\u0629", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility", payer.ar),
      fld("\u0631\u0642\u0645_\u0627\u0644\u0631\u062E\u0635\u0629", "\u0631\u0642\u0645 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence number", LICENCE.of(idKey - idKey % 11).slice(0, 14)),
      fld("\u0631\u0642\u0645_\u0647\u0648\u064A\u0629_\u0627\u0644\u0645\u062E\u0627\u0644\u0641", "\u0631\u0642\u0645 \u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641", "Offender id", nationalIdOf(st.payer[i])),
      fld("\u062A\u0627\u0631\u064A\u062E_\u0628\u062F\u0621_\u0627\u0644\u0632\u064A\u0627\u0631\u0629", "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0621 \u0627\u0644\u0632\u064A\u0627\u0631\u0629", "Visit start", visitStart),
      fld("\u062A\u0627\u0631\u064A\u062E_\u0627\u0646\u0647\u0627\u0621_\u0627\u0644\u0632\u064A\u0627\u0631\u0629", "\u062A\u0627\u0631\u064A\u062E \u0627\u0646\u0647\u0627\u0621 \u0627\u0644\u0632\u064A\u0627\u0631\u0629", "Visit end", visitStart),
      fld("\u0648\u0635\u0641_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "\u0648\u0635\u0641 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Violation description", desc),
      fld("\u0631\u0642\u0645_\u0628\u0646\u062F_\u0627\u0644\u0644\u0627\u0626\u062D\u0629", "\u0631\u0642\u0645 \u0628\u0646\u062F \u0627\u0644\u0644\u0627\u0626\u062D\u0629", "Regulation item", `${1 + hash(idKey % 1e6, 78) % 40}/${1 + hash(idKey % 1e6, 79) % 9}`),
      fld("\u0627\u0633\u0645_\u0627\u0644\u0644\u0627\u0626\u062D\u0629", "\u0627\u0633\u0645 \u0627\u0644\u0644\u0627\u0626\u062D\u0629", "Regulation", "\u0644\u0627\u0626\u062D\u0629 \u0627\u0644\u063A\u0631\u0627\u0645\u0627\u062A \u0648\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A \u0627\u0644\u0628\u0644\u062F\u064A\u0629 (\u062A\u062C\u0631\u064A\u0628\u064A\u0629)"),
      fld("\u0631\u0642\u0645_\u0627\u0644\u0633\u062F\u0627\u062F", "\u0631\u0642\u0645 \u0627\u0644\u0633\u062F\u0627\u062F", "SADAD number", sadad),
      fld("\u0642\u064A\u0645\u0629_\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "\u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice value", gross),
      fld("\u0642\u064A\u0645\u0629_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Violation value", violationValue),
      fld("\u0627\u0633\u0645_\u0627\u0644\u0646\u0634\u0627\u0637", "\u0627\u0633\u0645 \u0627\u0644\u0646\u0634\u0627\u0637", "Activity", act[0]),
      fld("\u0631\u0642\u0645_\u0646\u0634\u0627\u0637_\u0627\u0644\u0623\u064A\u0632\u064A\u0643", "\u0631\u0642\u0645 \u0646\u0634\u0627\u0637 \u0627\u0644\u0623\u064A\u0632\u064A\u0643", "ISIC code", act[2]),
      fld("\u0631\u0642\u0645_\u0627\u0644\u0633\u062C\u0644_\u0627\u0644\u062A\u062C\u0627\u0631\u064A", "\u0631\u0642\u0645 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", "CR number", crNoOf(st.payer[i])),
      fld("\u062D\u0627\u0644\u0629_\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", "Approval status", "\u0645\u0639\u062A\u0645\u062F\u0629"),
      fld("\u062A\u0627\u0631\u064A\u062E_\u0627\u0639\u062A\u0645\u0627\u062F_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "\u062A\u0627\u0631\u064A\u062E \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Approval date", rec.issueDate),
      fld("\u0627\u0633\u0645_\u0627\u0644\u0645\u0639\u062A\u0645\u062F", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0639\u062A\u0645\u062F", "Approver", personName(hash(idKey % 1e6, 80) % 300).ar),
      fld("\u0631\u0642\u0645_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629_\u0641\u064A_\u0627\u064A\u0641\u0627\u0621", "\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0641\u064A \u0625\u064A\u0641\u0627\u0621", "Efaa violation number", rec.violationNumber),
      fld("\u0645\u0639\u0631\u0641_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Violation id", `V${pad3(idKey % 1e8, 9)}`),
      fld("\u064A\u062A\u0637\u0644\u0628_\u0627\u0644\u062A\u0646\u0628\u064A\u0647_\u0644\u0623\u0648\u0644_\u0645\u0631\u0629", "\u064A\u062A\u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u0644\u0623\u0648\u0644 \u0645\u0631\u0629", "First-time warning required", "\u0644\u0627"),
      fld("\u062D\u0627\u0644\u0629_\u0627\u0644\u0633\u062F\u0627\u062F", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062F\u0627\u062F", "Payment status", paidRaw),
      fld("\u0631\u0645\u0632_\u062D\u062C\u0645_\u0627\u0644\u0645\u0646\u0634\u0623\u0629", "\u0631\u0645\u0632 \u062D\u062C\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility size code", size[0]),
      fld("\u062D\u062C\u0645_\u0627\u0644\u0645\u0646\u0634\u0623\u0629", "\u062D\u062C\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Facility size", size[1]),
      fld("\u0647\u0644_\u062A\u0645_\u0627\u0644\u062A\u0635\u062D\u064A\u062D", "\u0647\u0644 \u062A\u0645 \u0627\u0644\u062A\u0635\u062D\u064A\u062D", "Corrected", hash(idKey % 1e6, 81) % 100 < 35 ? "\u0646\u0639\u0645" : "\u0644\u0627"),
      fld("\u0645\u062F\u064A\u0631_\u0627\u0644\u0631\u0642\u0627\u0628\u0629", "\u0645\u062F\u064A\u0631 \u0627\u0644\u0631\u0642\u0627\u0628\u0629", "Supervision manager", personName(hash(idKey % 1e6, 82) % 80).ar)
    ]));
    if (diff) out.related.push({ kind: "value_gap", label: BI2(`\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 (${Math.round(violationValue).toLocaleString("en-US")}) \u062A\u062E\u062A\u0644\u0641 \u0639\u0646 \u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 (${Math.round(gross).toLocaleString("en-US")}) \u2014 \u062A\u064F\u062D\u062A\u0633\u0628 \u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629`, `Violation value differs from the invoice value - the invoice value is counted`) });
    out.checks = { invoiceValue: gross, violationValue, valuesDiffer: diff };
  } else if (src.key === "housing_sales") {
    out.providingSystem = "\u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646 (\u0644\u0627 \u0645\u062E\u0637\u0637 \u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0631\u0641\u0642)";
    out.importVersion = IMPORT_VERSIONS.tahseel_central;
    out.views.push(view("HOUSING_SALE", "\u2014", BI2("\u0628\u064A\u0639 \u0633\u0643\u0646\u064A (\u0628\u0646\u064A\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u062D\u062F\u0629 \u0641\u0642\u0637)", "Residential sale (unified-invoice structure only)"), [
      fld("BUYER_REF", "\u0645\u0631\u062C\u0639 \u0627\u0644\u0645\u0634\u062A\u0631\u064A", "Buyer reference", payer.ar),
      fld("UNIT_REF", "\u0645\u0631\u062C\u0639 \u0627\u0644\u0648\u062D\u062F\u0629", "Unit reference", `UNIT-${pad3(hash(idKey % 1e6, 91) % 1e6, 6)}`),
      fld("SADAD", "\u0631\u0642\u0645 \u0633\u062F\u0627\u062F", "SADAD number", sadad),
      fld("SALE_AMOUNT", "\u0642\u064A\u0645\u0629 \u0627\u0644\u0628\u064A\u0639", "Sale amount", gross)
    ]));
    out.notes.push(BI2("\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u062E\u0637\u0637 \u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0631\u0641\u0642\u0629\u061B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062A\u0628\u0639 \u0628\u0646\u064A\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u062D\u062F\u0629 \u0641\u0642\u0637.", "There is no sales-invoice schema in the supplied files; the data follows the unified-invoice structure only."));
  } else if (src.key === "investment") {
    out.providingSystem = "\u0641\u0631\u0635 (\u0639\u0642\u0648\u062F) \u062B\u0645 \u062A\u062D\u0635\u064A\u0644";
    out.importVersion = IMPORT_VERSIONS.furas;
    out.views.push(view("FURAS_CONTRACT_PAYMENT", "Furas", BI2("\u062F\u0641\u0639\u0629 \u0639\u0642\u062F \u0641\u0631\u0635", "Furas contract payment"), [
      fld("contract_no", "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F", "Contract number", rec.co || rec.contract?.ref || null),
      fld("installment_no", "\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629 (\u062C\u062F\u0648\u0644 \u0645\u064F\u0648\u0644\u064E\u0651\u062F)", "Installment (generated schedule)", rec.contractPaymentNo),
      fld("installments_total", "\u0639\u062F\u062F \u0627\u0644\u062F\u0641\u0639\u0627\u062A (\u062C\u062F\u0648\u0644 \u0645\u064F\u0648\u0644\u064E\u0651\u062F)", "Installments (generated schedule)", rec.contractPaymentTotal),
      fld("contract_status", "\u062D\u0627\u0644\u0629 \u0631\u0628\u0637 \u0627\u0644\u0639\u0642\u062F", "Contract link state", rec.contract?.status)
    ]));
  }
  const tot = rec.lineItems.reduce((s, l) => s + l.amount, 0);
  const settleDay = pf.last ? addDays3(pf.last, 1 + hash(idKey % 1e6, 95) % 3) : null;
  out.revenueLines = rec.lineItems.map((l) => ({
    REVENUE_KEY: `RV-${pad3(idKey % 1e8, 9)}-${l.no}`,
    DETAIL_ID: l.no,
    ACCOUNT_NO: sadad,
    SADAD_TRANSACTION_ID: pf.last ? `TX${pad3(hash(idKey % 1e6, 96) % 1e10, 10)}` : null,
    APPLICATION_NAME: SOURCES[st.src[i]].platform,
    TOTAL_AMOUNT: gross,
    DETAIL_AMOUNT: l.amount,
    GFS_MAIN_CODE: GFS_BY_SOURCE[src.key] || null,
    GFS_NAME: l.name,
    PARENT_NAME: profile?.label?.ar || src.key,
    REVENUE_VALID: "Y",
    FULL_COLLECTION: "Y",
    ISSUE_DATE_KEY: rec.issueDate,
    EXPIRATION_DATE_KEY: rec.dueDate,
    PAYMENT_DATE_KEY: pf.last,
    RECONCILITION_DATE_KEY: settleDay,
    CANCELATION_DATE_KEY: rec.cancelled ? rec.cancelled.date : null,
    PAYMENT_STATUS: rec.cancelled ? "\u0645\u0644\u063A\u0627\u0629" : pf.paid >= gross - 0.5 ? "\u0645\u0633\u062F\u062F\u0629" : pf.paid > 0 ? "\u0645\u0633\u062F\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B" : "\u063A\u064A\u0631 \u0645\u0633\u062F\u062F\u0629",
    CHANNEL: pf.last ? rec.payments[rec.payments.length - 1]?.channel || null : null
  }));
  out.checks.revenueLines = { lines: out.revenueLines.length, sumOfDetailAmount: tot, invoiceTotal: gross, totalRepeatedOnEveryLine: out.revenueLines.length > 1, sumEqualsInvoice: Math.abs(tot - gross) < 0.5, knownAmountConflict: rec.amountCheck?.status === "conflict" };
  const central = st.scope[i] === 0;
  out.links.unshift({ system: central ? "\u062A\u062D\u0635\u064A\u0644" : "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629", dataset: central ? "invoice_details" : "internal_reports", importVersion: central ? IMPORT_VERSIONS.tahseel_central : IMPORT_VERSIONS.tahseel_internal, keyField: "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", key: rec.id, role: "primary", note: BI2("\u0627\u0644\u0645\u0631\u062C\u0639 \u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644", "Reference for invoice status and collection") });
  out.links.push({ system: "\u0628\u0646\u0643 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", dataset: "ENT_REVENUES", importVersion: IMPORT_VERSIONS.tahseel_central, keyField: "ACCOUNT_NO", key: sadad, role: "items", note: BI2(`${out.revenueLines.length} \u0628\u0646\u062F\u061B \u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0643\u0631\u0631 \u0639\u0644\u0649 \u0643\u0644 \u0628\u0646\u062F \u0648\u064A\u064F\u062D\u062A\u0633\u0628 \u0645\u0631\u0629`, `${out.revenueLines.length} line(s); the total repeats on every line and is counted once`) });
  if (src.key === "fines") out.links.push({ system: "\u0625\u064A\u0641\u0627\u0621", dataset: "violations_v2", importVersion: IMPORT_VERSIONS.efaa_v2, keyField: "\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", key: rec.violationNumber, role: "violation", note: BI2("\u0627\u0644\u062D\u0627\u0644\u0629 \u0643\u0645\u0627 \u0641\u064A \u0625\u064A\u0641\u0627\u0621 \u062A\u064F\u062D\u0641\u0638 \u0645\u0646\u0641\u0635\u0644\u0629 \u0639\u0646 \u062D\u0627\u0644\u0629 \u062A\u062D\u0635\u064A\u0644", "The Efaa status is kept apart from the Tahseel status") });
  if (src.key === "tobacco" || src.key === "accommodation") out.links.push({ system: src.key === "tobacco" ? "\u0645\u0646\u0635\u0629 \u0627\u0644\u062A\u0628\u063A" : "\u0645\u0646\u0635\u0629 \u0627\u0644\u0625\u064A\u0648\u0627\u0621", dataset: "TB_ENT_INVOICES", importVersion: out.importVersion, keyField: "INVOICE_KEY / SADAD_NO", key: sadad, role: "activity-source", note: BI2("\u0627\u0644\u0625\u0641\u0635\u0627\u062D \u2190 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u2190 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "Disclosure -> schedule -> facility") });
  if (src.key === "white_lands") out.links.push({ system: "\u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", dataset: "DS_038_IdleLandInvoices", importVersion: IMPORT_VERSIONS.white_lands, keyField: "SadadNum / InvoiceId", key: sadad, role: "activity-source", note: BI2("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u2190 \u0627\u0644\u0635\u0643 \u2190 \u0627\u0644\u0642\u0637\u0639\u0629 \u2190 \u0627\u0644\u0645\u0627\u0644\u0643", "Invoice -> deed -> land plot -> owner") });
  if (src.key === "licenses" || src.key === "municipal_fees") out.links.push({ system: "\u0628\u0644\u062F\u064A", dataset: "BALADY_BILLS", importVersion: IMPORT_VERSIONS.balady, keyField: "BILL_NUMBER", key: sadad, role: "activity-source", note: BI2("\u064A\u0631\u0628\u0637 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0627\u0644\u0631\u062E\u0635\u0629 \u0648\u0627\u0644\u0637\u0644\u0628 \u0648\u0627\u0644\u0645\u0627\u0644\u0643", "Links the bill to the licence, request and owner") });
  if (src.key === "investment" && rec.co) out.links.push({ system: "\u0641\u0631\u0635", dataset: "contracts_payments", importVersion: IMPORT_VERSIONS.furas, keyField: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F + \u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629", key: `${rec.co} / ${rec.contractPaymentNo}`, role: "contract" });
  if (rec.executionNo && src.key === "investment") out.links.push({ system: "\u0633\u0646\u062F", dataset: "execution_requests", importVersion: IMPORT_VERSIONS.sanad, keyField: "\u0631\u0642\u0645 \u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", key: rec.executionNo, role: "enforcement", note: BI2("\u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0644\u0627 \u064A\u064F\u062D\u062A\u0633\u0628 \u062A\u062D\u0635\u064A\u0644\u0627\u064B \u0648\u0644\u0627 \u064A\u064F\u0636\u0627\u0641 \u0644\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629", "Execution is not collection and is not added to the debt") });
  if (pf.last) out.links.push({ system: "\u0633\u062F\u0627\u062F", dataset: "settlement", importVersion: IMPORT_VERSIONS.sadad, keyField: "SADAD_TRANSACTION_ID", key: out.revenueLines[0]?.SADAD_TRANSACTION_ID, role: "settlement", note: BI2("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u064A\u0644\u064A \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F \u0648\u0644\u0627 \u064A\u062D\u0644 \u0645\u062D\u0644\u0647", "The settlement date follows, and never replaces, the payment date") });
  out.countedOnce = true;
  out.linkSummary = BI2(`\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u062D\u062F\u0629 \u0648\u0627\u062D\u062F\u0629 \u062A\u062D\u0645\u0644 ${out.links.length} \u0633\u062C\u0644\u0627\u062A \u0645\u0635\u062F\u0631\u064A\u0629\u061B \u0627\u0644\u0645\u0628\u0644\u063A ${Math.round(gross).toLocaleString("en-US")} \u064A\u064F\u062D\u062A\u0633\u0628 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629.`, `One unified invoice carries ${out.links.length} source records; the amount ${Math.round(gross).toLocaleString("en-US")} is counted once.`);
  return out;
}

// server/materialize.js
var RULE_BY_ID = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r]));
var REVIEWER2 = { en: "Revenue data steward (demo reviewer)", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0645\u0631\u0627\u062C\u0639 \u062A\u062C\u0631\u064A\u0628\u064A)" };
var TEMPLATES = {
  "DUP-1": { evidence: { en: "Same customer, amount, product, revenue account and issue date as an earlier-numbered invoice (AI duplicate detection).", ar: "\u0646\u0641\u0633 \u0627\u0644\u0639\u0645\u064A\u0644 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u0645\u0646\u062A\u062C \u0648\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u064A\u0631\u0627\u062F \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u062F\u0627\u0631 \u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0623\u0642\u062F\u0645 \u0631\u0642\u0645\u064B\u0627 (\u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A)." }, sources: [{ system: "\u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", field: "\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", value: "\u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0623\u0642\u062F\u0645 \u0631\u0642\u0645\u064B\u0627 \u0641\u064A \u0627\u0644\u064A\u0648\u0645 \u0646\u0641\u0633\u0647" }] },
  "CR-1": { evidence: { en: "CR status (raw) from the commercial-registration view.", ar: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A (\u062E\u0627\u0645) \u0645\u0646 \u0639\u0631\u0636 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A." }, sources: [] },
  "STY-1": { evidence: { en: "The customer is on the list of companies under a stay of execution pending a committee.", ar: "\u0627\u0644\u0639\u0645\u064A\u0644 \u0636\u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u0648\u0627\u0642\u0639\u0629 \u062A\u062D\u062A \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u062C\u0646\u0629." }, sources: [{ system: "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0648\u0632\u0627\u0631\u0629", field: "\u0627\u0644\u0639\u0645\u064A\u0644", value: "\u0636\u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629" }] },
  "NOC-1": { evidence: { en: "Furas has no contract for this invoice (investment revenue account).", ar: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0639\u0642\u062F \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0641\u064A \u0641\u0631\u0635 (\u062D\u0633\u0627\u0628 \u0625\u064A\u0631\u0627\u062F \u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A)." }, sources: [{ system: "\u0641\u0631\u0635 \u2014 \u0627\u0644\u0639\u0642\u0648\u062F", field: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F", value: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0639\u0642\u062F" }] },
  "INC-1": { evidence: { en: "Status \xABincomplete\xBB in the payment-claim notice report; the violation number is linked to the invoice.", ar: "\u0627\u0644\u062D\u0627\u0644\u0629 \xAB\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\xBB \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u0623\u062F\u0627\u0621\u061B \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0645\u0631\u0628\u0648\u0637 \u0628\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629." }, sources: [{ system: "\u0625\u064A\u0641\u0627\u0621 \u2014 \u062A\u0642\u0631\u064A\u0631 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u0623\u062F\u0627\u0621", field: "\u0627\u0644\u062D\u0627\u0644\u0629", value: "\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644" }] },
  "EXE-1": { evidence: { en: "The violation appears in the executed-against report and is linked to the invoice.", ar: "\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u0648\u0627\u0631\u062F\u0629 \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 \u0648\u0645\u0631\u0628\u0648\u0637\u0629 \u0628\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629." }, sources: [{ system: "\u0625\u064A\u0641\u0627\u0621 \u2014 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647", field: "\u0631\u0642\u0645 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", value: "\u0648\u0627\u0631\u062F" }] },
  "EFA-1": { evidence: { en: "A penalty in the uncollected debt that does not appear in the Efaa list.", ar: "\u062C\u0632\u0627\u0621 \u0636\u0645\u0646 \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0644\u0627 \u064A\u0638\u0647\u0631 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0625\u064A\u0641\u0627\u0621." }, sources: [{ system: "\u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A \u0645\u0642\u0627\u0628\u0644 \u0642\u0627\u0626\u0645\u0629 \u0625\u064A\u0641\u0627\u0621", field: "\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", value: "\u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0625\u064A\u0641\u0627\u0621" }] },
  "OBJ-1": { evidence: { en: "Open objection (appeal status in Efaa today; Mumtathil also in future).", ar: "\u0627\u0639\u062A\u0631\u0627\u0636 \u0642\u0627\u0626\u0645 (\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0641\u064A \u0625\u064A\u0641\u0627\u0621 \u062D\u0627\u0644\u064A\u064B\u0627\u060C \u0648\u0641\u064A \u0645\u0645\u062A\u062B\u0644 \u0623\u064A\u0636\u064B\u0627 \u0645\u0633\u062A\u0642\u0628\u0644\u064B\u0627)." }, sources: [{ system: "\u0625\u064A\u0641\u0627\u0621 + \u0645\u0645\u062A\u062B\u0644", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641", value: "\u0642\u0627\u0626\u0645" }] },
  "ATT-1": { evidence: { en: "A written statement of the Amanah that this invoice is not collectible (uploaded file).", ar: "\u0625\u0641\u0627\u062F\u0629 \u0645\u0643\u062A\u0648\u0628\u0629 \u0645\u0646 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0628\u0623\u0646 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062A\u062D\u0635\u064A\u0644 (\u0645\u0644\u0641 \u0645\u0631\u0641\u0648\u0639)." }, sources: [{ system: "\u0645\u0644\u0641 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 (\u0631\u0641\u0639 \u064A\u062F\u0648\u064A)", field: "\u0627\u0644\u0625\u0641\u0627\u062F\u0629", value: "\u0645\u0631\u0641\u0642\u0629" }] },
  "ENC-1": { evidence: { en: "Raised for exploiting a site without a contract (encroachment report of the Amanah).", ar: "\u0635\u062F\u0631\u062A \u0639\u0646 \u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u0645\u0648\u0642\u0639 \u062F\u0648\u0646 \u0639\u0642\u062F (\u0645\u062D\u0636\u0631 \u0627\u0644\u062A\u0639\u062F\u064A \u0645\u0646 \u0627\u0644\u0623\u0645\u0627\u0646\u0629)." }, sources: [{ system: "\u0645\u0644\u0641 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 (\u0631\u0641\u0639 \u064A\u062F\u0648\u064A)", field: "\u0645\u062D\u0636\u0631 \u0627\u0644\u062A\u0639\u062F\u064A", value: "\u0645\u0631\u0641\u0642" }] },
  "ENF-1": { evidence: { en: "Referred to enforcement.", ar: "\u0645\u062D\u0627\u0644 \u0625\u0644\u0649 \u0627\u0644\u062A\u0646\u0641\u064A\u0630." }, sources: [] }
};
function materialize(st, i, ctx = null) {
  if (i >= st.nGen) {
    const f = st.fixtures.get(i);
    return f ? Object.assign(structuredCloneSafe(f), municipalityOfRow(st, i)) : null;
  }
  const c = ctx || makeCtx(st, {});
  const idKey = st.idKey[i];
  const id = invoiceIdFor(st.ent[i], st.scope[i], idKey);
  const e = st.ent[i];
  const ent = ENTITIES[e];
  const src = SOURCES[st.src[i]];
  const item = ITEMS[st.item[i]];
  const issueDate = isoOf(st.issue[i]);
  const dueDate = isoOf(st.due[i]);
  const mu = municipalityOfRow(st, i);
  const payer = payerName(st.payer[i]);
  const gross = st.gross[i];
  const flags = st.flags[i];
  const vatRate = src.key === "fines" ? 0 : 0.15;
  const r = new Rng(mix(9, idKey % 1000003, Math.floor(idKey / 1e8)));
  const nl = st.lines[i];
  const lines = [];
  let rest = gross;
  for (let k = 1; k <= nl; k += 1) {
    const a = k === nl ? rest : Math.round(gross / nl * (0.6 + r.next() * 0.6));
    const v = Math.min(a, rest - (nl - k));
    lines.push({ no: k, name: nl > 1 ? `${item.ar} \u2014 \u0628\u0646\u062F ${k}` : item.ar, amount: v });
    rest -= v;
  }
  let amountCheck = { status: "consistent", basis: "ex_vat", headerAmount: gross, lineTotal: gross, difference: 0 };
  if (flags & F.AMT_CONFLICT) {
    const diff = Math.max(1, Math.round(gross * (0.04 + r.next() * 0.1)));
    lines[0] = { ...lines[0], amount: lines[0].amount - diff };
    const lt = lines.reduce((s, x) => s + x.amount, 0);
    const vat = Math.round(gross * vatRate / (1 + vatRate));
    amountCheck = { status: "conflict", basis: "ex_vat", headerAmount: gross, lineTotal: lt, vatDeclared: vat, impliedTotalWithVat: lt + vat, difference: gross - lt, differenceVsLineTotal: gross - lt, differenceVsWithVat: gross - lt - vat };
  }
  const payments = [];
  for (let p = st.payStart[i]; p < st.payStart[i] + st.payCount[i]; p += 1) payments.push({ date: isoOf(st.pDay[p]), amount: st.pAmt[p], channel: CHANNELS[st.pCh[p]] });
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const cancelled = st.cancelDay[i] ? { date: isoOf(st.cancelDay[i]), source: "\u062A\u062D\u0635\u064A\u0644" } : null;
  const ct = st.contract[i] >= 0 ? st.contracts[st.contract[i]] : null;
  const req = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
  const ctReq = ct ? st.requests.find((q3) => q3.contractIdx === ct.idx) : null;
  const exclusions = [];
  for (let b = 0; b < RULE_IDS.length; b += 1) {
    const bit = 1 << b;
    if (!(st.exMask[i] & bit)) continue;
    const ruleId = RULE_IDS[b];
    const tpl = TEMPLATES[ruleId];
    let status = st.exAppr[i] & bit ? "approved" : "pending";
    if (c.ov.get(i)) {
      const o = c.ov.get(i);
      if (o.set & bit) status = "approved";
      else if (o.rej & bit) status = "rejected";
      else if (o.clr & bit) status = "pending";
    }
    const crRaw = ruleId === "CR-1" ? CR_STATUS[st.crSt[i]] : null;
    const sources = ruleId === "CR-1" ? [{ system: "\u0628\u0644\u062F\u064A + \u0639\u0631\u0636 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", field: "Crstatus", value: crRaw }] : ruleId === "OBJ-1" ? [{ system: "\u0625\u064A\u0641\u0627\u0621 + \u0645\u0645\u062A\u062B\u0644", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641", value: OBJECTION_STATUS_OF[objectionStatusKey(st, i)].ar }] : tpl.sources;
    exclusions.push({
      category: RULE_BY_ID[ruleId].category,
      ruleId,
      ruleVersion: 1,
      evidence: ruleId === "CR-1" ? { en: `CR status "${crRaw}" (raw), from the commercial-registration view.`, ar: `\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A "${crRaw}" (\u062E\u0627\u0645) \u0645\u0646 \u0639\u0631\u0636 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A.` } : tpl.evidence,
      sources,
      rawValue: crRaw,
      reviewStatus: status,
      reviewer: status === "approved" ? REVIEWER2 : null,
      reviewDate: status === "approved" ? isoOf(st.issue[i] + st.exRev[i]) : null,
      effectiveFrom: status === "approved" ? isoOf(st.issue[i] + st.exRev[i]) : issueDate,
      effectiveTo: null,
      reassessment: status === "approved" ? "scheduled_annual" : "not_started"
    });
  }
  const tahseel = cancelled ? "\u0645\u0644\u063A\u0627\u0629" : paid >= gross ? "\u0645\u062D\u0635\u0644\u0629" : paid > 0 ? "\u0645\u0633\u062F\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B" : "\u063A\u064A\u0631 \u0645\u062D\u0635\u0644\u0629";
  const rec = {
    id,
    idKey,
    index: i,
    entity: payer.ar,
    entityEn: payer.en,
    entityAr: payer.ar,
    amanah: ent.en,
    amanahEn: ent.en,
    amanahAr: ent.ar,
    ...mu,
    beneficiaryId: flags & F.MISSING_ID ? null : beneficiaryIdOf(st.payer[i]),
    co: ct && st.cstat[i] === 1 ? ct.contractNo : null,
    sourcePlatform: src.platform,
    scopeType: st.scope[i] === 1 ? "internal" : "central",
    revenueSource: src.key,
    revenueItem: { key: item.key, ar: item.ar, en: item.en },
    issueDate,
    dueDate,
    grossAmount: gross,
    vatAmount: Math.round(gross * vatRate / (1 + vatRate)),
    vatKnown: true,
    currency: "SAR",
    lineItems: lines,
    payments,
    adjustments: [],
    adjustmentTotal: 0,
    sourceStatus: cancelled ? "cancelled" : paid >= gross ? "collected" : "uncollected",
    statusRawTahseel: tahseel,
    statusRawEfaa: EFAA_STATUS[st.efaa[i]] || null,
    workflowStatus: "normal",
    objection: flags & F.OBJECTION ? { open: true, ref: `OBJ-${String(idKey % 1e7).padStart(7, "0")}`, system: "momtathil", status: objectionStatusKey(st, i), statusAr: OBJECTION_STATUS_OF[objectionStatusKey(st, i)].ar, statusEn: OBJECTION_STATUS_OF[objectionStatusKey(st, i)].en } : null,
    enforcementLinks: [],
    contract: { required: src.key === "investment", status: CSTAT[st.cstat[i]], ref: ct && st.cstat[i] === 1 ? ct.contractNo : null },
    contractPaymentNo: st.inst[i] || null,
    contractPaymentTotal: ct ? ct.sched.length : null,
    exclusion: exclusions[0] || null,
    exclusions,
    cancelled,
    violationNumber: src.key === "fines" ? violationOf(idKey) : null,
    subscriptionNo: subscriptionOf(idKey),
    sadadNo: sadadOf(idKey),
    crNo: ct && st.crSt[i] ? ct.crNo : null,
    crStatusRaw: CR_STATUS[st.crSt[i]] || null,
    crEvidence: ctReq && st.crSt[i] ? { method: ctReq.method === 1 ? "ocr" : "structured", source: `\u0633\u0646\u062F ${ctReq.enforceNum} \u2014 \u0628\u0646\u062F \u0661`, confidence: ctReq.confidence } : null,
    executionNo: req ? req.enforceNum : null,
    contractRequestNo: ctReq ? ctReq.enforceNum : null,
    missingFields: flags & F.MISSING_ID ? ["debtor_id_number"] : [],
    amountCheck,
    aiRisk: { score: 0, tag: "normal" },
    exceptional: !!(flags & F.EXCEPTIONAL),
    provenance: { kind: "demo", system: "demo-world", ref: id }
  };
  return rec;
}
var structuredCloneSafe = (o) => typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o));
function detail(st, i, ctx) {
  const rec = materialize(st, i, ctx);
  const D = derive(ctx, i, ctx.cutoffN);
  const derived = { gross: D.gross, adjustments: D.adj, billedAfterAdj: D.billed, exclusionsTotal: D.exclTotal, received: D.received, collected: D.collected, overpayment: D.overpayment, outstanding: D.outstanding, payStatus: D.payStatus, sourceCancelled: D.sourceCancelled, enfConflict: D.enfConflict, cancelled: D.cancelled, cancelledAmount: D.cancelledAmount, overlapsCancelled: D.overlaps, excluded: D.excluded, exclusionAmount: D.exclusionAmount, net: D.net, daysOverdue: D.daysOverdue, reasonMask: D.mask, nReasons: D.nReasons, primaryRuleId: D.primaryBit ? RULE_IDS[Math.log2(D.primaryBit)] : null };
  const sourceRec = i < st.nGen ? sourceRecord(st, i, rec, D, ctx.cfg.cutoff) : null;
  const riskFlags = recordRiskFlags(st, ctx, i);
  rec.iim = iimDetail(st, i, rec, D);
  if (st.dupOf?.has(i)) rec.iim.duplicateOf = idOf(st, st.dupOf.get(i));
  if (D.mask & 1 << RULE_IDS.indexOf("SND-1") && !rec.exclusions.some((e) => e.ruleId === "SND-1")) {
    const q3 = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
    const info = ctx.linkInfo && ctx.linkInfo[idOf(st, i)] || [];
    const orders = [.../* @__PURE__ */ new Set([...q3 ? [q3.enforceNum] : [], ...info.map((x) => x.enforceNum)])];
    const first = info.find((x) => x.reviewedBy) || null;
    const docsUsed = [...new Set(info.flatMap((x) => x.documents || []))];
    const ev = { en: "Linked to a confirmed enforcement order.", ar: "\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0623\u0645\u0631 \u062A\u0646\u0641\u064A\u0630 \u0645\u0624\u0643\u062F." };
    const sources = [{ system: "\u0633\u0646\u062F \u2014 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", field: "\u0631\u0642\u0645 \u0623\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", value: orders.join(" \xB7 ") || "\u0631\u0627\u0628\u0637 \u0645\u0624\u0643\u062F" }];
    if (info.length) sources.push({ system: "\u0633\u0646\u062F \u2014 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0645\u0631", value: info.map((x) => `${x.enforceNum}: ${x.orderStatus}${x.closeReason ? ` (${x.closeReason})` : ""}`).join(" \xB7 ") });
    if (first) sources.push({ system: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0631\u0628\u0637", field: "\u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0648\u0648\u0642\u062A \u0627\u0644\u062A\u0623\u0643\u064A\u062F", value: `${first.reviewedBy} \xB7 ${String(first.reviewedAt || "").slice(0, 16).replace("T", " ")}` });
    if (docsUsed.length) sources.push({ system: "\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u062F\u0627\u0639\u0645", field: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0646\u062F", value: docsUsed.join(" \xB7 ") });
    const e = { category: "executed_against_sanad", ruleId: "SND-1", ruleVersion: 1, evidence: ev, sources, rawValue: null, reviewStatus: "approved", reviewer: first ? { en: first.reviewedBy, ar: first.reviewedBy } : null, reviewDate: first && first.reviewedAt ? String(first.reviewedAt).slice(0, 10) : null, effectiveFrom: first && first.reviewedAt ? String(first.reviewedAt).slice(0, 10) : isoOf(st.issue[i]), effectiveTo: null, reassessment: "not_started", orders, amountBasis: "uncollected_remainder" };
    rec.exclusions = [...rec.exclusions, e];
    rec.exclusion = rec.exclusion || e;
  }
  {
    const have = new Set(rec.exclusions.map((e) => e.ruleId));
    const fo = ctx.ov.get(i)?.files || {};
    RULE_IDS.forEach((ruleId, b) => {
      if (!(D.mask & 1 << b) || have.has(ruleId) || ruleId === "SND-1" || !TEMPLATES[ruleId]) return;
      const tpl = TEMPLATES[ruleId];
      const f = fo[ruleId] || null;
      const sources = f ? [{ system: "\u0645\u0644\u0641 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 (\u0631\u0641\u0639 \u064A\u062F\u0648\u064A)", field: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641", value: f.file }] : ruleId === "OBJ-1" ? [{ system: "\u0625\u064A\u0641\u0627\u0621 + \u0645\u0645\u062A\u062B\u0644", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641", value: OBJECTION_STATUS_OF[objectionStatusKey(st, i)].ar }] : tpl.sources;
      const e = { category: RULE_BY_ID[ruleId].category, ruleId, ruleVersion: 1, evidence: tpl.evidence, sources, rawValue: null, reviewStatus: "approved", reviewer: f ? { en: f.by, ar: f.by } : null, reviewDate: f ? String(f.at).slice(0, 10) : null, effectiveFrom: f ? String(f.at).slice(0, 10) : isoOf(st.issue[i]), effectiveTo: null, reassessment: "not_started", file: f ? { name: f.file, at: f.at, by: f.by } : null };
      rec.exclusions = [...rec.exclusions, e];
      rec.exclusion = rec.exclusion || e;
    });
  }
  return { rec, derived, cls: CLASSES[D.cls], idStr: idOf(st, i), sourceRecord: sourceRec, riskFlags };
}

// server/noncollection.js
var EPS = 0.5;
var AGE_KEYS = ["not_due", "1-30", "31-90", "91-180", "180+", "unavailable"];
var AGE_ALIAS = { 0: "not_due", "0": "not_due" };
var AGE_LABEL = [
  { ar: "\u0644\u0645 \u064A\u062D\u0646 \u0627\u0633\u062A\u062D\u0642\u0627\u0642\u0647", en: "Not yet due" },
  { ar: "1\u201330 \u064A\u0648\u0645\u0627\u064B", en: "1\u201330 days" },
  { ar: "31\u201390 \u064A\u0648\u0645\u0627\u064B", en: "31\u201390 days" },
  { ar: "91\u2013180 \u064A\u0648\u0645\u0627\u064B", en: "91\u2013180 days" },
  { ar: "\u0623\u0643\u062B\u0631 \u0645\u0646 180 \u064A\u0648\u0645\u0627\u064B", en: "Over 180 days" },
  { ar: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D", en: "Due date unavailable" }
];
var DOCUMENTED_AR = "\u0627\u0639\u062A\u0631\u0627\u0636 \u0645\u0633\u062C\u064E\u0651\u0644 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631";
var DOCUMENTED_EN = "Objection recorded in the source";
var GROUPS = [
  {
    key: "review_amount_conflict",
    titleAr: "\u0645\u0631\u0627\u062C\u0639\u0629 \u062A\u0639\u0627\u0631\u0636 \u0627\u0644\u0645\u0628\u0644\u063A \u0623\u0648 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0635\u062F\u0631",
    titleEn: "Review a conflicting amount or an unresolved source status",
    evidence: { status: "calculated", textAr: "\u0627\u0644\u0641\u0631\u0642 \u0628\u064A\u0646 \u0645\u0628\u0644\u063A \u0631\u0623\u0633 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0628\u0646\u0648\u062F\u0647\u0627 \u0645\u062D\u0633\u0648\u0628\u060C \u0648\u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0645\u0646 \u0627\u0644\u0645\u0635\u062F\u0631", textEn: "The gap between the header amount and the line items is calculated, not confirmed by the source" },
    missingAr: "\u0627\u0644\u0645\u0628\u0644\u063A \u0623\u0648 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629 \u0645\u0646 \u0633\u062C\u0644 \u0627\u0644\u0645\u0635\u062F\u0631",
    missingEn: "The amount or status confirmed by the source record",
    nextStepAr: "\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0639 \u0633\u062C\u0644 \u0627\u0644\u0645\u0635\u062F\u0631 \u0648\u0637\u0644\u0628 \u0627\u0644\u062A\u0635\u062D\u064A\u062D \u0645\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
    nextStepEn: "Match the amount and status with the source record and ask the data owner to correct it",
    rationaleAr: "\u0644\u0627 \u064A\u0635\u062D\u0651 \u0627\u0644\u0628\u0646\u0627\u0621 \u0639\u0644\u0649 \u0645\u0628\u0644\u063A \u0623\u0648 \u062D\u0627\u0644\u0629 \u0645\u062A\u0639\u0627\u0631\u0636\u0629 \u0642\u0628\u0644 \u062D\u0633\u0645\u0647\u0627",
    rationaleEn: "A conflicting amount or status must be settled before anything is built on it"
  },
  {
    key: "request_missing_info",
    titleAr: "\u0637\u0644\u0628 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062F\u064A\u0646 \u0623\u0648 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0646\u0627\u0642\u0635\u0629",
    titleEn: "Request the missing payer or invoice information",
    evidence: { status: "missing", textAr: "\u062D\u0642\u0644 \u0623\u0633\u0627\u0633\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 \u0641\u064A \u0627\u0644\u0633\u062C\u0644 (\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062F\u064A\u0646 \u0623\u0648 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642)", textEn: "A key field is absent from the record (payer identifier or due date)" },
    missingAr: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062F\u064A\u0646 \u0623\u0648 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642",
    missingEn: "Payer identifier or due date",
    nextStepAr: "\u0637\u0644\u0628 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0646\u0627\u0642\u0635\u0629 \u0645\u0646 \u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0645\u0635\u062F\u0650\u0651\u0631\u0629 \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629",
    nextStepEn: "Request the missing fields from the issuing body",
    rationaleAr: "\u062F\u0648\u0646 \u0647\u0630\u0647 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u062D\u062F\u064A\u062F \u0645\u0648\u0642\u0641 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0623\u0648 \u0627\u0644\u0625\u062D\u0627\u0644\u0629",
    rationaleEn: "Without these fields the due position and any referral cannot be established"
  },
  {
    key: "verify_proposed_link",
    titleAr: "\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0631\u0628\u0637 \u0625\u0646\u0641\u0627\u0630 \u0645\u0642\u062A\u0631\u062D",
    titleEn: "Verify a proposed enforcement link",
    evidence: { status: "unverified", textAr: "\u0627\u0644\u0631\u0628\u0637 \u0628\u0623\u0645\u0631 \u0625\u0646\u0641\u0627\u0630 \u0645\u0642\u062A\u0631\u062D \u0648\u0644\u0645 \u064A\u0624\u0643\u062F\u0647 \u0645\u0631\u0627\u062C\u0639", textEn: "The link to an enforcement order is proposed and not confirmed by a reviewer" },
    missingAr: "\u062A\u0623\u0643\u064A\u062F \u0645\u0631\u0627\u062C\u0639 \u0644\u0644\u0631\u0628\u0637 \u0628\u0623\u0645\u0631 \u0627\u0644\u0625\u0646\u0641\u0627\u0630",
    missingEn: "A reviewer\u2019s confirmation of the link to the order",
    nextStepAr: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0648\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0631\u0628\u0637 \u0623\u0648 \u0631\u0641\u0636\u0647",
    nextStepEn: "Review the match and confirm or reject the link",
    rationaleAr: "\u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0645\u0642\u062A\u0631\u062D \u0644\u0627 \u064A\u063A\u064A\u0651\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0644\u0627 \u064A\u062F\u0644 \u0639\u0644\u0649 \u0633\u062F\u0627\u062F",
    rationaleEn: "A proposed link changes nothing about the invoice and implies no payment"
  },
  {
    key: "review_contract",
    titleAr: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0645\u0642\u0627\u0628\u0644 \u0639\u0642\u062F\u0647\u0627 \u0641\u064A \u0641\u0631\u0635",
    titleEn: "Review an investment invoice against its Furas contract",
    evidence: { status: "calculated", textAr: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0642\u062F (\u063A\u064A\u0631 \u0645\u0637\u0627\u0628\u0642 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0631\u0628\u0648\u0637) \u0645\u062D\u0633\u0648\u0628\u0629 \u0645\u0646 \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0639 \u0633\u062C\u0644 \u0627\u0644\u0639\u0642\u0648\u062F", textEn: "The contract status (unmatched or unlinked) is calculated from matching the invoice with the contract register" },
    missingAr: "\u0639\u0642\u062F \u0645\u0637\u0627\u0628\u0642 \u0648\u0645\u0631\u0628\u0648\u0637 \u0628\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629",
    missingEn: "A contract matched and linked to the invoice",
    nextStepAr: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629 \u0644\u0631\u0628\u0637\u0647\u0627 \u0628\u0639\u0642\u062F\u0647\u0627",
    nextStepEn: "Review the invoice with investment contracts to link it to its contract",
    rationaleAr: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0645\u0631\u0643\u0632\u064A\u0629 \u0644\u0627 \u064A\u0639\u0631\u0641\u0647\u0627 \u0633\u062C\u0644 \u0627\u0644\u0639\u0642\u0648\u062F",
    rationaleEn: "A centrally billed investment invoice that the contract register does not know"
  },
  {
    key: "review_objection",
    titleAr: "\u0645\u0631\u0627\u062C\u0639\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636 \u0627\u0644\u0645\u0633\u062C\u064E\u0651\u0644",
    titleEn: "Review the recorded objection status",
    evidence: { status: "source_record", textAr: "\u0627\u0639\u062A\u0631\u0627\u0636 \u0645\u0633\u062C\u064E\u0651\u0644 \u0641\u064A \u0645\u0645\u062A\u062B\u0644 \u0628\u062D\u0627\u0644\u062A\u0647", textEn: "An objection is recorded in Mumtathil with its status" },
    missingAr: "\u0642\u0631\u0627\u0631 \u0646\u0647\u0627\u0626\u064A \u0639\u0644\u0649 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636",
    missingEn: "A final decision on the objection",
    nextStepAr: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636 \u0645\u0639 \u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0645\u062E\u062A\u0635\u0629",
    nextStepEn: "Follow up the objection status with the responsible body",
    rationaleAr: "\u0627\u0644\u0633\u0628\u0628 \u0627\u0644\u0648\u062D\u064A\u062F \u0627\u0644\u0645\u0648\u062B\u064E\u0651\u0642 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u0647\u0648 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636",
    rationaleEn: "The objection is the only reason the source documents"
  },
  {
    key: "monitor_enforcement",
    titleAr: "\u0623\u0645\u0631 \u0625\u0646\u0641\u0627\u0630 \u0645\u0624\u0643\u064E\u0651\u062F \u2014 \u0645\u062A\u0627\u0628\u0639\u0629 \u062F\u0648\u0646 \u0625\u062D\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629",
    titleEn: "Confirmed enforcement order \u2014 monitor, no new referral",
    evidence: { status: "source_record", textAr: "\u0623\u0645\u0631 \u0625\u0646\u0641\u0627\u0630 \u0645\u0624\u0643\u064E\u0651\u062F \u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", textEn: "A confirmed enforcement order is linked to the invoice" },
    missingAr: "\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0623\u0645\u0631 (\u0633\u062F\u0627\u062F \u0623\u0648 \u062D\u0641\u0638)",
    missingEn: "The outcome of the order (payment or closure)",
    nextStepAr: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0642\u0627\u0626\u0645 \u062F\u0648\u0646 \u0625\u062D\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629",
    nextStepEn: "Monitor the existing order without a new referral",
    rationaleAr: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u062D\u0627\u0644\u0629 \u0641\u0639\u0644\u0627\u064B\u061B \u0627\u0644\u0623\u0645\u0631 \u0644\u0627 \u064A\u0639\u0646\u064A \u062D\u062F\u0648\u062B \u0633\u062F\u0627\u062F",
    rationaleEn: "The invoice is already referred; an order does not mean any payment"
  },
  {
    key: "follow_up_overdue",
    titleAr: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u062A\u0623\u062E\u0631\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0643\u062A\u0645\u0644\u0629",
    titleEn: "Follow up an overdue invoice with complete data",
    evidence: { status: "calculated", textAr: "\u0623\u064A\u0627\u0645 \u0627\u0644\u062A\u0623\u062E\u0631 \u0645\u062D\u0633\u0648\u0628\u0629 \u0645\u0646 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u062C\u0639", textEn: "Days overdue are calculated from the due date and the reference date" },
    missingAr: "\u0633\u0628\u0628 \u0639\u062F\u0645 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062B\u0642 \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631",
    missingEn: "The reason for non-collection is not documented in the source",
    nextStepAr: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0639 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0644\u062A\u0648\u062B\u064A\u0642 \u0633\u0628\u0628 \u0639\u062F\u0645 \u0627\u0644\u0633\u062F\u0627\u062F \u0642\u0628\u0644 \u0623\u064A \u0625\u062C\u0631\u0627\u0621",
    nextStepEn: "Review the invoice with the Amanah to document why it is unpaid before any action",
    rationaleAr: "\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0643\u062A\u0645\u0644\u0629 \u0648\u0644\u0627 \u064A\u0648\u062C\u062F \u0623\u0645\u0631 \u0625\u0646\u0641\u0627\u0630 \u0648\u0644\u0627 \u0627\u0639\u062A\u0631\u0627\u0636",
    rationaleEn: "Data is complete and there is no enforcement order or objection"
  },
  {
    key: "not_yet_due",
    titleAr: "\u0644\u0645 \u064A\u062D\u0646 \u0627\u0633\u062A\u062D\u0642\u0627\u0642\u0647\u0627 \u2014 \u0644\u0627 \u0625\u062C\u0631\u0627\u0621",
    titleEn: "Not yet due \u2014 no action",
    evidence: { status: "calculated", textAr: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0644\u0627\u062D\u0642 \u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u062C\u0639", textEn: "The due date is after the reference date" },
    missingAr: "\u0644\u0627 \u0634\u064A\u0621 \u0645\u0637\u0644\u0648\u0628",
    missingEn: "Nothing required",
    nextStepAr: "\u0644\u0627 \u0625\u062C\u0631\u0627\u0621 \u062D\u0627\u0644\u064A\u0627\u064B",
    nextStepEn: "No action at present",
    rationaleAr: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0645 \u064A\u062D\u0644 \u0645\u0648\u0639\u062F \u0633\u062F\u0627\u062F\u0647\u0627 \u0628\u0639\u062F",
    rationaleEn: "The invoice is not yet due for payment"
  }
];
var G_INDEX = Object.fromEntries(GROUPS.map((g, k) => [g.key, k]));
var QUALITY = [
  { key: "missing_fields", labelAr: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062F\u064A\u0646 \u0646\u0627\u0642\u0635", labelEn: "Payer identifier missing" },
  { key: "amount_conflict", labelAr: "\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0627\u0644\u0645\u0628\u0644\u063A", labelEn: "Amount conflict" },
  { key: "link_unresolved", labelAr: "\u062D\u0627\u0644\u0629 \u0623\u0648 \u0631\u0628\u0637 \u063A\u064A\u0631 \u0645\u062D\u0633\u0648\u0645", labelEn: "Status or link unresolved" },
  { key: "contract_unmatched", labelAr: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u063A\u064A\u0631 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0639\u0642\u062F \u0641\u064A \u0641\u0631\u0635", labelEn: "Investment invoice not matched to a Furas contract" },
  { key: "due_unavailable", labelAr: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D", labelEn: "Due date unavailable" }
];
var PROCESS = [
  { key: "confirmed", labelAr: "\u0623\u0645\u0631 \u0625\u0646\u0641\u0627\u0630 \u0645\u0624\u0643\u064E\u0651\u062F", labelEn: "Confirmed enforcement order" },
  { key: "proposed", labelAr: "\u0631\u0628\u0637 \u0625\u0646\u0641\u0627\u0630 \u0645\u0642\u062A\u0631\u062D (\u063A\u064A\u0631 \u0645\u0624\u0643\u064E\u0651\u062F)", labelEn: "Proposed enforcement link (unverified)" },
  { key: "objection", labelAr: "\u0627\u0639\u062A\u0631\u0627\u0636 \u0645\u0633\u062C\u064E\u0651\u0644", labelEn: "Objection recorded" },
  { key: "none", labelAr: "\u0644\u0627 \u0625\u062C\u0631\u0627\u0621 \u0645\u0633\u062C\u064E\u0651\u0644", labelEn: "No process recorded" }
];
var CONFIRMED_SUB = [
  { key: "confirmed_open", labelAr: "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630", labelEn: "In execution" },
  { key: "confirmed_suspended", labelAr: "\u0645\u0639\u0644\u064E\u0651\u0642", labelEn: "Suspended" },
  { key: "confirmed_closed", labelAr: "\u0645\u063A\u0644\u0642", labelEn: "Closed" }
];
var newNc = () => ({ rem: 0, cancelled: false, excluded: false, payment: "unpaid", dueMissing: false, overdue: false, due: "not_due", age: 0, days: 0, objection: false, objKey: null, link: 0, conf: false, confState: null, proposed: false, qMissing: false, qConflict: false, qLink: false, qContract: false, nIssues: 0, tags: 0, group: -1 });
function ncClassify(st, i, D, o) {
  const f = st.flags[i];
  const cs = st.cstat[i];
  const rem = D.cancelled ? 0 : Math.max(0, D.billed - D.received);
  o.rem = rem;
  o.cancelled = D.cancelled;
  o.excluded = D.excluded && D.exclusionAmount > 0;
  o.payment = D.cancelled ? "cancelled" : rem <= 0 ? "paid" : D.received > 0 ? "partial" : "unpaid";
  o.dueMissing = !(st.due[i] > 0);
  o.overdue = !o.dueMissing && D.daysOverdue > 0;
  o.due = o.dueMissing ? "unknown" : o.overdue ? "overdue" : "not_due";
  o.age = o.dueMissing ? 5 : agingBucket(D.daysOverdue);
  o.days = o.overdue ? D.daysOverdue : 0;
  o.objection = (f & F.OBJECTION) !== 0;
  o.objKey = o.objection ? objectionStatusKey(st, i) : null;
  o.link = D.link;
  o.conf = D.link >= 2 && D.link <= 4;
  o.confState = D.link === 2 ? "open" : D.link === 3 ? "suspended" : D.link === 4 ? "closed" : null;
  o.proposed = D.link === 1;
  o.qMissing = (f & F.MISSING_ID) !== 0;
  o.qConflict = (f & F.AMT_CONFLICT) !== 0;
  o.qLink = (f & F.LEGACY_CANCELLED) !== 0;
  o.qContract = st.src[i] === 0 && (cs === 2 || cs === 4);
  o.nIssues = (o.qMissing ? 1 : 0) + (o.qConflict ? 1 : 0) + (o.qLink ? 1 : 0) + (o.qContract ? 1 : 0) + (o.dueMissing ? 1 : 0);
  let t = 0;
  if (o.qConflict || o.qLink) t |= 1;
  if (o.qMissing || o.dueMissing) t |= 2;
  if (o.proposed) t |= 4;
  if (o.qContract) t |= 8;
  if (o.objection) t |= 16;
  if (o.conf) t |= 32;
  if (!(t & 63)) t |= o.overdue ? 64 : 128;
  o.tags = t;
  o.group = D.outstanding > 0 ? Math.round(Math.log2(t & -t)) : -1;
  return o;
}
var tagKeys = (tags) => GROUPS.filter((_, k) => tags & 1 << k).map((g) => g.key);
var reasonKeyOf = (o) => o.objection ? `objection:${o.objKey}` : "undocumented";
var ncAsOf = (ctx, sc) => ctx.periodEndMode ? Math.min(sc.toN, ctx.cutoffN) : ctx.cutoffN;
function ncMatches(st, i, D, nc, o) {
  ncClassify(st, i, D, o);
  const pop = nc.population || "net";
  if (pop === "net") {
    if (!(D.outstanding > 0)) return false;
  } else if (pop === "excluded") {
    if (!o.excluded) return false;
  } else if (pop === "unpaidGross") {
    if (!(D.outstanding > 0 || o.excluded)) return false;
  } else return false;
  if (nc.group && nc.group !== "all") {
    if (G_INDEX[nc.group] == null || o.group !== G_INDEX[nc.group]) return false;
  }
  if (nc.tag && nc.tag !== "all") {
    if (G_INDEX[nc.tag] == null || !(o.tags & 1 << G_INDEX[nc.tag])) return false;
  }
  if (nc.due && nc.due !== "all" && o.due !== nc.due) return false;
  if (nc.reason && nc.reason !== "all") {
    const r = nc.reason;
    if (r === "documented" || r === "objection") {
      if (!o.objection) return false;
    } else if (r === "undocumented") {
      if (o.objection) return false;
    } else if (r.startsWith("objection:")) {
      if (!o.objection || o.objKey !== r.slice(10)) return false;
    } else return false;
  }
  if (nc.payment && nc.payment !== "all" && o.payment !== nc.payment) return false;
  if (nc.process && nc.process !== "all") {
    const p = nc.process;
    const none = !o.conf && !o.proposed && !o.objection;
    const ok = p === "confirmed" ? o.conf : p === "proposed" ? o.proposed : p === "objection" ? o.objection : p === "none" ? none : p.startsWith("confirmed_") ? o.confState === p.slice(10) : false;
    if (!ok) return false;
  }
  if (nc.quality && nc.quality !== "all") {
    const q3 = nc.quality;
    const ok = q3 === "missing_fields" ? o.qMissing : q3 === "amount_conflict" ? o.qConflict : q3 === "link_unresolved" ? o.qLink : q3 === "contract_unmatched" ? o.qContract : q3 === "due_unavailable" ? o.dueMissing : false;
    if (!ok) return false;
  }
  if (nc.age != null && nc.age !== "all") {
    const k = AGE_ALIAS[nc.age] || nc.age;
    if (AGE_KEYS[o.age] !== k) return false;
  }
  if (nc.source && nc.source !== "all" && SOURCES[st.src[i]].key !== nc.source) return false;
  return true;
}
function ncRow(st, ctx, i, D) {
  const o = ncClassify(st, i, D, newNc());
  const net = D.outstanding > 0;
  const g = net ? GROUPS[o.group] : null;
  const process2 = [];
  if (o.conf) process2.push("confirmed");
  if (o.proposed) process2.push("proposed");
  if (o.objection) process2.push("objection");
  if (!process2.length) process2.push("none");
  const quality2 = [];
  if (o.qMissing) quality2.push("missing_fields");
  if (o.qConflict) quality2.push("amount_conflict");
  if (o.qLink) quality2.push("link_unresolved");
  if (o.qContract) quality2.push("contract_unmatched");
  if (o.dueMissing) quality2.push("due_unavailable");
  const x = o.objection ? OBJECTION_STATUS_OF[o.objKey] : null;
  return {
    population: net ? "netUnpaid" : o.excluded ? "excludedUnpaid" : null,
    payment: o.payment,
    due: o.due,
    excluded: o.excluded,
    age: AGE_KEYS[o.age],
    process: process2,
    enforcementState: o.confState,
    objectionStatus: x ? { key: x.key, ar: x.ar, en: x.en } : null,
    quality: quality2,
    reason: net ? { key: reasonKeyOf(o), documented: o.objection, evidenceStatus: o.objection ? "source_record" : "none", source: o.objection ? "Mumtathil" : null, labelAr: o.objection ? `${DOCUMENTED_AR}: ${x.ar}` : "\u0633\u0628\u0628 \u0639\u062F\u0645 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062B\u0642", labelEn: o.objection ? `${DOCUMENTED_EN}: ${x.en}` : "Non-collection reason not documented" } : null,
    group: g ? g.key : null,
    tags: net ? tagKeys(o.tags) : [],
    nextStepAr: g ? g.nextStepAr : null,
    nextStepEn: g ? g.nextStepEn : null
  };
}
var z = () => ({ count: 0, amount: 0 });
var bump = (b, a) => {
  b.count += 1;
  b.amount += a;
};
var chk = (key, lhs, rhs, labelAr, labelEn, tol = EPS) => ({ key, ok: Math.abs(lhs - rhs) <= tol, lhs, rhs, labelAr, labelEn });
var newGroupAcc = () => ({ unpaid: 0, overdue: 0, notYetDue: 0, dueUnknown: 0, undocumented: 0, documented: 0, count: 0 });
var addGroupAcc = (a, o, amt) => {
  a.count += 1;
  a.unpaid += amt;
  if (o.due === "overdue") a.overdue += amt;
  else if (o.due === "not_due") a.notYetDue += amt;
  else a.dueUnknown += amt;
  if (o.objection) a.documented += amt;
  else a.undocumented += amt;
};
function nonCollectionAnalysis(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const NE2 = ENTITIES.length;
  const NS = SOURCES.length;
  const D = ctx.D;
  const o = newNc();
  const asOf = ncAsOf(ctx, sc);
  const pop = { issued: { count: 0, gross: 0 }, unpaidGross: z(), excludedUnpaid: z(), netUnpaid: z(), fullyUnpaid: z(), partlyPaid: { count: 0, amount: 0, collected: 0 }, overdue: z(), notYetDue: z(), dueUnknown: z(), undocumented: z(), documented: z() };
  const reasonAcc = /* @__PURE__ */ new Map();
  const undoc = z();
  const proc = { confirmed: z(), proposed: z(), objection: z(), none: z(), confirmed_open: z(), confirmed_suspended: z(), confirmed_closed: z() };
  const qual = { missing_fields: z(), amount_conflict: z(), link_unresolved: z(), contract_unmatched: z(), due_unavailable: z() };
  const aging = AGE_KEYS.map(() => z());
  const ent = Array.from({ length: NE2 }, newGroupAcc);
  const src = Array.from({ length: NS }, newGroupAcc);
  const muni = /* @__PURE__ */ new Map();
  const heat = new Float64Array(NE2 * 6);
  const heatN = new Float64Array(NE2 * 6);
  const gAcc = GROUPS.map(() => ({ count: 0, amount: 0, maxDays: 0, issues: 0, process: { confirmed: 0, proposed: 0, objection: 0, none: 0 }, tagged: z() }));
  let standingDueUnknown = 0;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    if (!(st.due[i] > 0)) {
      derive(ctx, i, ctx.cutoffN);
      if ((!sc.statusSet || sc.statusSet[D.cls]) && D.outstanding > 0) standingDueUnknown += D.outstanding;
    }
    if (st.issue[i] < sc.fromN || st.issue[i] > sc.toN) continue;
    derive(ctx, i, asOf);
    if (sc.statusSet && !sc.statusSet[D.cls]) continue;
    pop.issued.count += 1;
    pop.issued.gross += D.gross;
    ncClassify(st, i, D, o);
    if (o.excluded) {
      bump(pop.excludedUnpaid, D.exclusionAmount);
      bump(pop.unpaidGross, D.exclusionAmount);
    }
    if (!(D.outstanding > 0)) continue;
    const a = D.outstanding;
    const e = st.ent[i];
    const s = st.src[i];
    bump(pop.netUnpaid, a);
    bump(pop.unpaidGross, a);
    if (o.payment === "partial") {
      bump(pop.partlyPaid, a);
      pop.partlyPaid.collected += D.collected;
    } else bump(pop.fullyUnpaid, a);
    if (o.due === "overdue") bump(pop.overdue, a);
    else if (o.due === "not_due") bump(pop.notYetDue, a);
    else bump(pop.dueUnknown, a);
    if (o.objection) {
      bump(pop.documented, a);
      const k = `objection:${o.objKey}`;
      let r = reasonAcc.get(k);
      if (!r) {
        r = z();
        reasonAcc.set(k, r);
      }
      bump(r, a);
    } else {
      bump(pop.undocumented, a);
      bump(undoc, a);
    }
    if (o.conf) {
      bump(proc.confirmed, a);
      bump(proc[`confirmed_${o.confState}`], a);
    }
    if (o.proposed) bump(proc.proposed, a);
    if (o.objection) bump(proc.objection, a);
    if (!o.conf && !o.proposed && !o.objection) bump(proc.none, a);
    if (o.qMissing) bump(qual.missing_fields, a);
    if (o.qConflict) bump(qual.amount_conflict, a);
    if (o.qLink) bump(qual.link_unresolved, a);
    if (o.qContract) bump(qual.contract_unmatched, a);
    if (o.dueMissing) bump(qual.due_unavailable, a);
    bump(aging[o.age], a);
    addGroupAcc(ent[e], o, a);
    addGroupAcc(src[s], o, a);
    {
      const slot = slotOf(e, st.mref[i]);
      const en = ENTITIES[e].en;
      const m0 = slot >= 4 ? municipalityOfCode(e, slot) : null;
      const key = m0 ? m0.key : `${en}|${slot === 1 ? "DIRECT" : slot === 2 ? "UNRESOLVED" : "NOT_SPECIFIED"}`;
      let m = muni.get(key);
      if (!m) {
        const L = slot === 1 ? MUNICIPALITY_DIRECT : slot === 2 ? MUNICIPALITY_UNRESOLVED : MUNICIPALITY_OPTION_NONE;
        m = { acc: newGroupAcc(), key, amanah: en, labelAr: `${m0 ? m0.ar : L.ar} \u2014 ${ENTITIES[e].ar}`, labelEn: `${m0 ? m0.en : L.en} \u2014 ${en}`, muniLabelAr: m0 ? m0.ar : L.ar, muniLabelEn: m0 ? m0.en : L.en, status: m0 ? "mapped" : slot === 1 ? "direct_amanah" : slot === 2 ? "needs_review" : "not_specified" };
        muni.set(key, m);
      }
      addGroupAcc(m.acc, o, a);
    }
    heat[e * 6 + o.age] += a;
    heatN[e * 6 + o.age] += 1;
    const g = gAcc[o.group];
    g.count += 1;
    g.amount += a;
    if (o.days > g.maxDays) g.maxDays = o.days;
    g.issues += o.nIssues;
    g.process[o.conf ? "confirmed" : o.proposed ? "proposed" : o.objection ? "objection" : "none"] += 1;
    for (let k = 0; k < GROUPS.length; k += 1) if (o.tags & 1 << k) bump(gAcc[k].tagged, a);
  }
  const snap = snapshot2(st, req);
  const br = bridge(st, req);
  const stock = snap.stock;
  const standing = {
    amount: stock.netUncollected,
    overdue: stock.overdue - standingDueUnknown,
    notYetDue: stock.notYetDue,
    dueUnknown: standingDueUnknown,
    count: stock.invoiceCount,
    bridge: { reportDate: br.reportDate, detailsDate: br.detailsDate, steps: br.steps, net: br.net, check: br.check },
    note: "different population: every invoice issued up to the cutoff, not the period cohort"
  };
  const reasons = [];
  for (const x of OBJECTION_STATUSES) {
    const r = reasonAcc.get(`objection:${x.key}`);
    if (r) reasons.push({ key: `objection:${x.key}`, labelAr: `${DOCUMENTED_AR}: ${x.ar}`, labelEn: `${DOCUMENTED_EN}: ${x.en}`, count: r.count, amount: r.amount, evidence: "source_record", factKind: "source_reported", documented: true, filter: { nc: { reason: `objection:${x.key}` } } });
  }
  reasons.push({ key: "undocumented", labelAr: "\u0633\u0628\u0628 \u0639\u062F\u0645 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062B\u0642", labelEn: "Non-collection reason not documented", count: undoc.count, amount: undoc.amount, evidence: "none", factKind: "not_documented", documented: false, filter: { nc: { reason: "undocumented" } } });
  const processOut = [...PROCESS.map((p) => ({ ...p, ...proc[p.key], nonAdditive: true, filter: { nc: { process: p.key } }, ...p.key === "confirmed" ? { sub: CONFIRMED_SUB.map((c) => ({ ...c, ...proc[c.key], nonAdditive: true, filter: { nc: { process: c.key } } })) } : {} }))];
  const qualityOut = QUALITY.map((q3) => ({ ...q3, ...qual[q3.key], nonAdditive: true, filter: { nc: { quality: q3.key } } }));
  const agingOut = AGE_KEYS.map((key, k) => ({ key, labelAr: AGE_LABEL[k].ar, labelEn: AGE_LABEL[k].en, ...aging[k], filter: { nc: { age: key } } }));
  const rankDue = (x, y) => y.overdue - x.overdue || y.unpaid - x.unpaid;
  const byAmanah2 = ent.map((a, e) => ({ key: ENTITIES[e].en, labelAr: ENTITIES[e].ar, labelEn: ENTITIES[e].en, ...a, scopePatch: { amanah: ENTITIES[e].en } })).filter((x) => x.count > 0).sort(rankDue);
  const byMunicipality = [...muni.values()].map((m) => ({ key: m.key, labelAr: m.labelAr, labelEn: m.labelEn, muniLabelAr: m.muniLabelAr, muniLabelEn: m.muniLabelEn, amanah: m.amanah, status: m.status, ...m.acc, scopePatch: { amanah: m.amanah, muni: m.key } })).sort(rankDue);
  const bySource = src.map((a, s) => ({ key: SOURCES[s].key, labelAr: REVENUE_SOURCES[SOURCES[s].key]?.ar || SOURCES[s].key, labelEn: REVENUE_SOURCES[SOURCES[s].key]?.en || SOURCES[s].key, ...a, filter: { nc: { source: SOURCES[s].key } } })).filter((x) => x.count > 0).sort(rankDue);
  const top2 = byAmanah2.slice().sort((x, y) => y.unpaid - x.unpaid).slice(0, 12);
  const heatOut = {
    rows: top2.map((x) => ({ key: x.key, labelAr: x.labelAr, labelEn: x.labelEn })),
    cols: AGE_KEYS.slice(),
    colLabels: AGE_LABEL.map((l) => ({ ar: l.ar, en: l.en })),
    values: top2.map((x) => {
      const e = ENTITIES.findIndex((v) => v.en === x.key);
      return AGE_KEYS.map((_, c) => heatN[e * 6 + c] > 0 ? heat[e * 6 + c] : null);
    })
  };
  const groups = GROUPS.map((g, k) => {
    const a = gAcc[k];
    return {
      key: g.key,
      precedence: k + 1,
      rank: 0,
      titleAr: g.titleAr,
      titleEn: g.titleEn,
      count: a.count,
      amount: a.amount,
      maxOverdueDays: a.maxDays,
      process: a.process,
      dataIssues: a.issues,
      evidence: { status: g.evidence.status, textAr: g.evidence.textAr, textEn: g.evidence.textEn },
      missingAr: g.missingAr,
      missingEn: g.missingEn,
      nextStepAr: g.nextStepAr,
      nextStepEn: g.nextStepEn,
      rationaleAr: g.rationaleAr,
      rationaleEn: g.rationaleEn,
      filter: { nc: { group: g.key } },
      nonAdditiveTags: { count: a.tagged.count, amount: a.tagged.amount, filter: { nc: { tag: g.key } } },
      suggestedOwner: { ar: "\u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0639\u0646\u064A\u0629 (\u0645\u0642\u062A\u0631\u062D)", en: "The Amanah concerned (suggested)", suggested: true },
      noAction: g.key === "not_yet_due"
    };
  });
  [...groups].sort((x, y) => x.noAction - y.noAction || y.amount - x.amount || y.maxOverdueDays - x.maxOverdueDays).forEach((g, r) => {
    g.rank = r + 1;
  });
  groups.sort((x, y) => x.rank - y.rank);
  const sum2 = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const N = pop.netUnpaid;
  const reconciliation = [
    chk("issued_count", pop.issued.count, snap.totals.count, "\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0635\u0627\u062F\u0631\u0629 = \u0639\u062F\u062F \u0627\u0644\u0644\u0642\u0637\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629", "Issued invoices = the financial snapshot count", 0),
    chk("unpaidGross_eq_excluded_plus_net", pop.unpaidGross.amount, pop.excludedUnpaid.amount + N.amount, "\u0625\u062C\u0645\u0627\u0644\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u0627\u0644\u0645\u0633\u062A\u0628\u0639\u062F \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F + \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "Gross unpaid = excluded unpaid + net unpaid"),
    chk("unpaidGross_count", pop.unpaidGross.count, pop.excludedUnpaid.count + N.count, "\u0639\u062F\u062F \u0625\u062C\u0645\u0627\u0644\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u0627\u0644\u0645\u0633\u062A\u0628\u0639\u062F + \u0627\u0644\u0635\u0627\u0641\u064A", "Gross-unpaid count = excluded + net", 0),
    chk("net_eq_due_partition", N.amount, pop.overdue.amount + pop.notYetDue.amount + pop.dueUnknown.amount, "\u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u0645\u062A\u0623\u062E\u0631 + \u0644\u0645 \u064A\u062D\u0646 + \u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0645\u062A\u0627\u062D", "Net unpaid = overdue + not yet due + due date unavailable"),
    chk("net_eq_payment_partition", N.amount, pop.fullyUnpaid.amount + pop.partlyPaid.amount, "\u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u063A\u064A\u0631 \u0645\u0633\u062F\u062F \u0643\u0644\u064A\u0627\u064B + \u0645\u0633\u062F\u062F \u062C\u0632\u0626\u064A\u0627\u064B (\u0627\u0644\u0645\u062A\u0628\u0642\u064A)", "Net unpaid = fully unpaid + partly paid (remainder)"),
    chk("net_eq_reason_partition", N.amount, pop.documented.amount + pop.undocumented.amount, "\u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u0645\u0648\u062B\u0642 \u0627\u0644\u0633\u0628\u0628 + \u063A\u064A\u0631 \u0645\u0648\u062B\u0642", "Net unpaid = documented + not documented"),
    chk("reasons_sum_eq_net", sum2(reasons, (r) => r.amount), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0623\u0633\u0628\u0627\u0628 (\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0623\u0633\u0627\u0633\u064A) = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "Reasons (primary allocation) sum to net unpaid"),
    chk("net_eq_snapshot_outstanding", N.amount, snap.totals.outstanding, "\u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644 \u0641\u064A \u0627\u0644\u0644\u0642\u0637\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0644\u0646\u0641\u0633 \u0627\u0644\u0646\u0637\u0627\u0642", "Net unpaid = uncollected in the financial snapshot of the same scope"),
    chk("excluded_eq_snapshot_exclusions", pop.excludedUnpaid.amount, snap.totals.exclusionsRules, "\u0627\u0644\u0645\u0633\u062A\u0628\u0639\u062F \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F = \u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0641\u064A \u0627\u0644\u0644\u0642\u0637\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629", "Excluded unpaid = rule exclusions in the financial snapshot"),
    chk("amanah_sum_eq_net", sum2(byAmanah2, (r) => r.unpaid), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "\u03A3 Amanahs = net unpaid"),
    chk("municipality_sum_eq_net", sum2(byMunicipality, (r) => r.unpaid), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0628\u0644\u062F\u064A\u0627\u062A = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "\u03A3 municipalities = net unpaid"),
    chk("source_sum_eq_net", sum2(bySource, (r) => r.unpaid), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "\u03A3 revenue sources = net unpaid"),
    chk("aging_sum_eq_net", sum2(agingOut, (r) => r.amount), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0641\u0626\u0627\u062A \u0627\u0644\u062A\u0642\u0627\u062F\u0645 = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "\u03A3 aging buckets = net unpaid"),
    chk("aging_count_eq_net", sum2(agingOut, (r) => r.count), N.count, "\u0639\u062F\u062F \u0641\u0626\u0627\u062A \u0627\u0644\u062A\u0642\u0627\u062F\u0645 = \u0639\u062F\u062F \u0627\u0644\u0635\u0627\u0641\u064A", "Aging counts = net count", 0),
    chk("groups_sum_eq_net", sum2(groups, (g) => g.amount), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0645\u062C\u0645\u0648\u0639\u0627\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 (\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0623\u0633\u0627\u0633\u064A) = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "Action groups (primary allocation) sum to net unpaid"),
    chk("groups_count_eq_net", sum2(groups, (g) => g.count), N.count, "\u0639\u062F\u062F \u0645\u062C\u0645\u0648\u0639\u0627\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 = \u0639\u062F\u062F \u0627\u0644\u0635\u0627\u0641\u064A", "Action-group counts = net count", 0),
    chk("heat_sum_eq_net", heat.reduce((t, v) => t + v, 0), N.amount, "\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u062E\u0631\u064A\u0637\u0629 \u0627\u0644\u062D\u0631\u0627\u0631\u064A\u0629 (\u0643\u0644 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A) = \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F", "Heat map (all Amanahs) = net unpaid"),
    chk("standing_eq_snapshot_stock", standing.amount, stock.netUncollected, "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0642\u0627\u0626\u0645 = \u0631\u0635\u064A\u062F \u0627\u0644\u0644\u0642\u0637\u0629", "Standing balance = snapshot stock"),
    chk("standing_parts", standing.amount, standing.overdue + standing.notYetDue + standing.dueUnknown, "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0642\u0627\u0626\u0645 = \u0645\u062A\u0623\u062E\u0631 + \u0644\u0645 \u064A\u062D\u0646 + \u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0645\u062A\u0627\u062D", "Standing balance = overdue + not yet due + due unavailable"),
    chk("standing_eq_bridge", standing.amount, br.net, "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0642\u0627\u0626\u0645 = \u0635\u0627\u0641\u064A \u062C\u0633\u0631 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629", "Standing balance = reconciliation-bridge net")
  ];
  const notes = [
    { ar: "\u0633\u0628\u0628 \u0639\u062F\u0645 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0645\u0648\u062B\u0642 \u0641\u0642\u0637 \u062D\u064A\u0646 \u064A\u0633\u062C\u0651\u0644\u0647 \u0627\u0644\u0645\u0635\u062F\u0631 (\u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636 \u0648\u062D\u0627\u0644\u062A\u0647)\u061B \u0645\u0627 \u0639\u062F\u0627\u0647 \xAB\u063A\u064A\u0631 \u0645\u0648\u062B\u0642\xBB \u0648\u0644\u0627 \u064A\u064F\u0633\u062A\u0646\u062A\u062C \u0645\u0646 \u0627\u0644\u062A\u0623\u062E\u0631 \u0623\u0648 \u0627\u0644\u0633\u062F\u0627\u062F \u0627\u0644\u062C\u0632\u0626\u064A \u0623\u0648 \u0627\u0644\u0625\u0646\u0641\u0627\u0630 \u0623\u0648 \u0646\u0642\u0635 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.", en: "A reason is documented only where the source records it (an objection and its status); everything else is \xABnot documented\xBB and is never inferred from lateness, part payment, enforcement or missing data." },
    { ar: "\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0645\u062A\u0648\u0641\u0631\u0629 \u0644\u0643\u0644 \u0633\u062C\u0644 \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629\u061B \u0648\u0623\u064A \u0633\u062C\u0644 \u0628\u0644\u0627 \u062A\u0627\u0631\u064A\u062E \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u064A\u064F\u0639\u062F\u0651 \u0645\u0646\u0641\u0635\u0644\u0627\u064B \u0648\u0644\u0627 \u064A\u064F\u0635\u0646\u064E\u0651\u0641 \u0645\u062A\u0623\u062E\u0631\u0627\u064B.", en: "A due date is available for every record in the synthetic data; a record without one is counted apart and is never classed as overdue." },
    { ar: "\u0627\u0644\u0633\u062C\u0644\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 (\u062A\u0642\u0631\u064A\u0631 \u0641\u0642\u0637) \u062E\u0627\u0631\u062C \u0643\u0644 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A\u0627\u062A \u0648\u062A\u064F\u0639\u0631\u0636 \u0645\u0646\u0641\u0635\u0644\u0629.", en: "Unmatched (report-only) records are outside every total and shown apart." },
    { ar: "\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0642\u0627\u0626\u0645 \u0639\u0646\u062F \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u062C\u0639 \u0645\u062C\u062A\u0645\u0639 \u0645\u062E\u062A\u0644\u0641 \u0639\u0646 \u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0641\u062A\u0631\u0629 \u0648\u0644\u0627 \u064A\u064F\u062C\u0645\u0639 \u0645\u0639\u0647\u0627.", en: "The standing balance at the reference date is a different population from the period cohort and is never added to it." },
    { ar: "\u0627\u0644\u0639\u0631\u0648\u0636 (\u0627\u0644\u0625\u062C\u0631\u0627\u0621\u060C \u062C\u0648\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A) \u0645\u062A\u062F\u0627\u062E\u0644\u0629 \u0648\u063A\u064A\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062C\u0645\u0639\u061B \u0623\u0645\u0627 \u0627\u0644\u0623\u0633\u0628\u0627\u0628 \u0648\u0645\u062C\u0645\u0648\u0639\u0627\u062A \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0641\u062A\u0648\u0632\u064A\u0639 \u0623\u0633\u0627\u0633\u064A \u064A\u062C\u0645\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u0627\u0641\u064A.", en: "The process and data-quality views overlap and are not additive; reasons and action groups are a primary allocation that sums to the net." },
    { ar: "\u0644\u0627 \u064A\u064F\u0642\u064A\u064E\u0651\u0645 \u0627\u0644\u0642\u0627\u0628\u0644 \u0644\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0648\u0644\u0627 \u064A\u064F\u0642\u062F\u064E\u0651\u0631 \u062A\u062D\u0635\u064A\u0644 \u0645\u062A\u0648\u0642\u0639\u061B \u0648\u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0645\u0642\u062A\u0631\u062D \u0623\u0648 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0645\u0624\u0643\u064E\u0651\u062F \u0644\u0627 \u064A\u062F\u0644 \u0639\u0644\u0649 \u0633\u062F\u0627\u062F. \u0627\u0644\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0627\u0644\u0645\u0628\u0644\u063A \u064A\u0628\u0642\u0649 \u0628\u0645\u0628\u0644\u063A \u0631\u0623\u0633 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0639 \u0648\u0633\u0645\u0647.", en: "Recoverability is not assessed and no expected recovery is estimated; a proposed link or a confirmed order implies no payment. Conflicting amounts stay at their header amount and are flagged." },
    { ar: "\u0627\u0644\u0645\u0627\u0644\u0643 \u0648\u0627\u0644\u0645\u0648\u0639\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0627\u0644\u0645\u0642\u062A\u0631\u062D\u0627\u0646 \u0644\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A \u0645\u0642\u062A\u0631\u062D\u0627\u062A \u0641\u0642\u0637\u061B \u0644\u0627 \u0634\u064A\u0621 \u0647\u0646\u0627 \u064A\u0628\u062F\u0623 \u0625\u0646\u0641\u0627\u0630\u0627\u064B \u0623\u0648 \u064A\u0639\u062A\u0645\u062F \u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u064B \u0623\u0648 \u064A\u063A\u064A\u0651\u0631 \u0633\u062C\u0644\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631.", en: "Suggested owners are suggestions only; nothing here starts enforcement, approves an exclusion or changes a source record." }
  ];
  const sCl = req.scope || {};
  return {
    version: 1,
    kind: "noncollection",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    cutoff: ctx.cfg.cutoff,
    asOf: isoOf(asOf),
    scope: { from: sc.from, to: sc.to, amanah: sCl.amanah ?? "all", source: sCl.source ?? "all", scopeType: sCl.scopeType ?? "all", muni: sCl.muni ?? "all", status: sCl.status ?? "all", org: sCl.org || null },
    populations: pop,
    standingBalance: standing,
    unmatched: { count: br.unmatched.count, amount: br.unmatched.amount, includedInTotals: false, scopedOut: br.unmatched.scopedOut, rows: br.unmatched.rows },
    reconciliation,
    reasons,
    process: processOut,
    quality: qualityOut,
    aging: agingOut,
    byAmanah: byAmanah2,
    byMunicipality,
    bySource,
    heat: heatOut,
    groups,
    notes
  };
}

// src/data/contractRules.js
var NOT_AVAILABLE = { ar: "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629", en: "Not available in the current data" };
var PROPOSED_RULE = { ar: "\u0642\u0627\u0639\u062F\u0629 \u0645\u0642\u062A\u0631\u062D\u0629 \u2014 \u062A\u062A\u0637\u0644\u0628 \u062A\u0623\u0643\u064A\u062F\u0627\u064B", en: "Proposed rule \u2014 requires confirmation" };
var demoOrigin = () => ({ basis: "generated_demo_ledger", sourceRecord: null, sourceBacked: [] });
var UNLINKED_RULE = {
  key: "due_no_invoice_linked",
  status: "proposed",
  scope: "generated_demo_ledger",
  label: { ar: "\u0645\u0633\u062A\u062D\u0642\u0629 \u2014 \u0644\u0627 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062A\u0628\u0637\u0629", en: "Due \u2014 no invoice linked" },
  short: PROPOSED_RULE,
  statement: {
    ar: `${PROPOSED_RULE.ar}: \u0642\u0633\u0637 \u0645\u0646 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u064F\u0648\u0644\u064E\u0651\u062F \u062D\u0644\u0651 \u0645\u0648\u0639\u062F\u0647 \u0648\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u064A \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u064F\u0648\u0644\u064E\u0651\u062F \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0639\u0642\u062F\u0647. \u062A\u064F\u0637\u0628\u064E\u0651\u0642 \u0639\u0644\u0649 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u0648\u0636\u064A\u062D\u064A \u0627\u0644\u0645\u064F\u0648\u0644\u064E\u0651\u062F \u0641\u0642\u0637\u061B \u0648\u0644\u064A\u0633\u062A \u0646\u062A\u064A\u062C\u0629 \u0645\u0646 \u0645\u0633\u062A\u062E\u0631\u062C \u0641\u0631\u0635 (\u0627\u0644\u0645\u0633\u062A\u062E\u0631\u062C \u0645\u062D\u062F\u0648\u062F \u0648\u0644\u0627 \u064A\u062A\u064A\u062D \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u062F\u0627\u0648\u0644)\u060C \u0648\u063A\u064A\u0631 \u0645\u0639\u062A\u0645\u062F\u0629.`,
    en: `${PROPOSED_RULE.en}: an installment of the generated schedule is due and no invoice is linked to its contract in the generated ledger. It is applied to the GENERATED demo ledger only; it is not a finding from the Furas extract (a capped extract cannot validate schedules) and it is not approved.`
  },
  prerequisites: [
    { key: "complete_schedule", ar: "\u062C\u062F\u0648\u0644 \u062F\u0641\u0639\u0627\u062A \u0643\u0627\u0645\u0644 \u0648\u0645\u062A\u062D\u0642\u064E\u0651\u0642 \u0645\u0646\u0647 \u0644\u0644\u0639\u0642\u062F", en: "a complete, validated payment schedule for the contract" },
    { key: "contract_identity", ar: "\u0647\u0648\u064A\u0629 \u0639\u0642\u062F \u0645\u0648\u062B\u0648\u0642\u0629 (\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F \u0648\u062D\u062F\u0647 \u0644\u0627 \u064A\u062D\u062F\u062F \u0633\u062C\u0644\u0627\u064B \u0648\u0627\u062D\u062F\u0627\u064B)", en: "a reliable contract identity (a contract number alone does not identify one record)" },
    { key: "invoice_linkage", ar: "\u0631\u0628\u0637 \u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u0642\u0633\u0637 \u0645\u062A\u062D\u0642\u064E\u0651\u0642 \u0645\u0646\u0647", en: "validated linkage between an invoice and an installment" },
    { key: "due_grace_rule", ar: "\u0642\u0627\u0639\u062F\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0648\u0641\u062A\u0631\u0629 \u0627\u0644\u0633\u0645\u0627\u062D", en: "an agreed due-date and grace-period rule" }
  ]
};
var PROPOSED_RULES = {
  due_no_invoice_linked: { label: UNLINKED_RULE.label, statement: UNLINKED_RULE.statement },
  term_ended: {
    label: { ar: "\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u0645\u062F\u0629", en: "Term ended" },
    statement: { ar: "\u062A\u064F\u0639\u062F\u0651 \u0627\u0644\u0645\u062F\u0629 \u0645\u0646\u062A\u0647\u064A\u0629 \u0625\u0630\u0627 \u0643\u0627\u0646 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0623\u0633\u0628\u0642 \u0645\u0646 \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u062C\u0639\u064A. \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0646\u0641\u0633\u0647 \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 \u0644\u0643\u062B\u064A\u0631 \u0645\u0646 \u0627\u0644\u0639\u0642\u0648\u062F \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629\u060C \u0648\u0644\u0627 \u062A\u064F\u0633\u062A\u0646\u062A\u062C \u0645\u0646\u0647 \u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0642\u062F.", en: "The term counts as ended when the end date is earlier than the reference date. The end date itself is missing for many contracts in the current data, and no contract status is inferred from it." }
  },
  overdue_no_grace: {
    label: { ar: "\u0645\u062A\u0623\u062E\u0631\u0629", en: "Overdue" },
    statement: { ar: "\u064A\u064F\u062D\u0633\u0628 \u0627\u0644\u062A\u0623\u062E\u0631 \u0645\u0646 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u062F\u0648\u0646 \u0641\u062A\u0631\u0629 \u0633\u0645\u0627\u062D. \u0641\u062A\u0631\u0629 \u0627\u0644\u0633\u0645\u0627\u062D \u0642\u0631\u0627\u0631 \u0623\u0639\u0645\u0627\u0644 \u0644\u0645 \u064A\u064F\u062A\u062E\u0630\u061B \u0648\u0627\u0644\u062A\u0623\u062E\u0631 \u0627\u0644\u0645\u0644\u062D\u0648\u0638 \u0641\u064A \u0627\u0644\u0633\u062F\u0627\u062F \u0644\u0627 \u064A\u062D\u062F\u0651\u062F\u0647\u0627.", en: "Overdue is counted from the due date with no grace period. The grace period is a business decision not yet taken; observed payment lateness does not set it." }
  }
};
var proposedRules = () => Object.fromEntries(Object.keys(PROPOSED_RULES).map((k) => [k, { status: "proposed", scope: "generated_demo_ledger", ...k === UNLINKED_RULE.key ? { prerequisites: UNLINKED_RULE.prerequisites.map((p) => p.key) } : {} }]));
var LIMIT_KIND = {
  not_available: { ar: NOT_AVAILABLE.ar, en: NOT_AVAILABLE.en },
  proposed: PROPOSED_RULE,
  limited_sample: { ar: "\u0639\u064A\u0651\u0646\u0629 \u0645\u062D\u062F\u0648\u062F\u0629 \u2014 \u0644\u0627 \u062A\u064F\u0639\u0645\u064E\u0651\u0645", en: "Limited sample \u2014 not generalised" },
  demo: { ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629", en: "Illustrative demo data" }
};

// server/contracts.js
var METHOD = ["structured", "ocr"];
function stateOf(D) {
  if (D.cancelled) return "cancelled";
  if (D.excluded) return "excluded";
  if (D.outstanding <= 0) return "paid";
  if (D.received > 0 && D.daysOverdue > 0) return "partial";
  if (D.daysOverdue > 0) return "overdue";
  return "not_due";
}
function paymentEvents(st, inv2, dueN, asOfN, grace) {
  const out = [];
  let cum = 0;
  for (let p = st.payStart[inv2]; p < st.payStart[inv2] + st.payCount[inv2]; p += 1) {
    if (st.pDay[p] > asOfN) continue;
    cum += st.pAmt[p];
    const late = paymentLateness(st.pDay[p], dueN, grace);
    out.push({ date: isoOf(st.pDay[p]), amount: st.pAmt[p], channel: CHANNELS[st.pCh[p]], cumulative: cum, daysAfterDue: late.offset, lateBy: late.lateBy });
  }
  return out;
}
var contractMunicipality = (ct) => {
  const f = municipalityFields({ ent: ct.ent, code: demoMunicipalityCode(ct.ent, 1073741824 + ct.idx, "investment"), sourceKey: "investment" });
  return { municipalityKey: f.municipalityKey, municipalityAr: f.municipalityAr, municipalityEn: f.municipalityEn, municipalityRefId: f.municipalityRefId, municipalityStatus: f.municipalityStatus };
};
function cardOf(st, ctx, ct) {
  const D = ctx.D;
  const today = ctx.cutoffN;
  const dataStart = st.dataStartN || 0;
  const schedule = ct.sched.map((d) => {
    const yearOf = Number(isoOf(d.due).slice(0, 4));
    const base = { no: d.no, year: yearOf, dueDate: isoOf(d.due), amount: d.amount };
    if (d.inv >= 0) {
      derive(ctx, d.inv, today);
      const events = paymentEvents(st, d.inv, st.due[d.inv], today, ctx.graceDays);
      const net2 = D.net;
      const full = D.outstanding <= 0 && !D.excluded && !D.cancelled && D.billed > 0 && D.received >= D.billed;
      const paidInFull = full ? events.find((e) => e.cumulative >= D.billed - 0.5) : null;
      return {
        ...base,
        dueDate: isoOf(st.due[d.inv]),
        issueDate: isoOf(st.issue[d.inv]),
        invoiced: true,
        invoiceNo: idOf(st, d.inv),
        sadadNo: sadadOf(st.idKey[d.inv]),
        state: stateOf(D),
        dataState: "known",
        gross: D.billed,
        exclusion: D.exclTotal,
        net: net2,
        collected: D.collected,
        outstanding: D.outstanding,
        daysOverdue: openOverdueDays(D),
        // overdue UNPAID days: only while an amount is owed and the invoice is neither excluded nor cancelled
        payments: events,
        firstPaymentOn: events.length ? events[0].date : null,
        lastPaymentOn: events.length ? events[events.length - 1].date : null,
        paidInFullOn: paidInFull ? paidInFull.date : null
      };
    }
    const hist = d.hist || d.due < dataStart;
    const state3 = hist ? "history" : d.due > today ? "future" : "unlinked";
    return {
      ...base,
      issueDate: null,
      invoiced: false,
      invoiceNo: null,
      sadadNo: null,
      state: state3,
      dataState: state3 === "future" ? "not_applicable" : "unknown",
      gross: null,
      exclusion: null,
      net: null,
      collected: null,
      outstanding: null,
      daysOverdue: null,
      payments: [],
      firstPaymentOn: null,
      lastPaymentOn: null,
      paidInFullOn: null
    };
  });
  const sum2 = (f) => schedule.reduce((s, x) => s + (f(x) || 0), 0);
  const count = (f) => schedule.filter(f).length;
  const reqs = st.requests.filter((q3) => q3.contractIdx === ct.idx && requestVisible(st, q3, ctx.acc)).map((q3) => {
    const ids = q3.identified.map((i) => idOf(st, i));
    return { enforceNum: q3.enforceNum, system: "sanad", amount: q3.amount, openedDate: isoOf(q3.openedDay), closedDate: null, closedDateStatus: "not_recorded", status: q3.status, contractNo: ct.contractNo, identifiedInvoices: ids, identified: ids.length > 0, crViewStatusRaw: CR_STATUS[ct.crSt], addedToNetUncollected: false, documents: [{ type: "\u0641\u0627\u062A\u0648\u0631\u0629", item: `\u0628\u0646\u062F \u0661 \u2014 ${payerName(ct.payer).ar}`, crNo: q3.crNo, method: METHOD[q3.method], confidence: q3.confidence }] };
  });
  const linkedDebt = reqs.reduce((s, q3) => s + q3.identifiedInvoices.reduce((t, id) => t + (schedule.find((x) => x.invoiceNo === id)?.outstanding || 0), 0), 0);
  const arrears = sum2((x) => x.state === "overdue" || x.state === "partial" ? x.outstanding : 0);
  const notDue = sum2((x) => x.state === "not_due" ? x.outstanding : 0);
  const gross = sum2((x) => x.gross);
  const exclusions = sum2((x) => x.exclusion);
  const net = sum2((x) => x.net);
  const collected = sum2((x) => x.collected);
  const uncollected = sum2((x) => x.outstanding);
  const dueRows = (x) => x.invoiced && x.dueDate <= ctx.cfg.cutoff;
  const netDueToDate = sum2((x) => dueRows(x) ? x.net : 0);
  const collectedOfDue = sum2((x) => dueRows(x) ? x.collected : 0);
  const termEnded = ct.end < today;
  return {
    contractNo: ct.contractNo,
    idx: ct.idx,
    amanahEn: ENTITIES[ct.ent].en,
    amanahAr: ENTITIES[ct.ent].ar,
    ...contractMunicipality(ct),
    tenantAr: payerName(ct.payer).ar,
    tenantEn: payerName(ct.payer).en,
    itemKey: ITEMS[ct.item].key,
    itemAr: ITEMS[ct.item].ar,
    itemEn: ITEMS[ct.item].en,
    start: isoOf(ct.start),
    end: isoOf(ct.end),
    intervalMonths: ct.intervalMonths,
    status: ct.status,
    termEnded,
    crNo: ct.crNo,
    crStatusRaw: CR_STATUS[ct.crSt] || null,
    annualValue: ct.annualValue,
    totalValue: ct.totalValue,
    origin: demoOrigin(),
    proposedRules: proposedRules(),
    schedule,
    invoiceIds: schedule.filter((x) => x.invoiced).map((x) => x.invoiceNo),
    // which invoices belong to the contract (never inferred — taken from the contract's own schedule)
    totals: {
      contractValue: ct.totalValue,
      installments: schedule.length,
      invoicedInstallments: count((x) => x.invoiced),
      invoiced: gross,
      gross,
      exclusions,
      net,
      collected,
      uncollected,
      collectionRateOnNet: ratio(collected, net),
      // net invoiced = gross − exclusions; uncollected = net − collected; rate = collected ÷ net (zero or unknown denominator → not calculable)
      arrears,
      notDue,
      futureNotInvoiced: sum2((x) => x.state === "future" ? x.amount : 0),
      netUncollected: arrears + notDue,
      netDueToDate,
      collectedOfDue,
      collectedOfDueToDate: ratio(collectedOfDue, netDueToDate),
      remainingOfDue: sum2((x) => dueRows(x) ? x.outstanding : 0),
      overdueInstallments: count((x) => x.state === "overdue" || x.state === "partial"),
      futureInstallments: count((x) => x.state === "future"),
      unlinkedInstallments: count((x) => x.state === "unlinked"),
      unlinkedAmount: sum2((x) => x.state === "unlinked" ? x.amount : 0),
      historyInstallments: count((x) => x.state === "history"),
      coverage: { installments: schedule.length, known: count((x) => x.dataState === "known"), notApplicable: count((x) => x.dataState === "not_applicable"), unknown: count((x) => x.dataState === "unknown") }
    },
    requests: reqs,
    execution: {
      amount: reqs.reduce((s, q3) => s + q3.amount, 0),
      linkedDebt,
      unidentifiedAmount: reqs.filter((q3) => !q3.identified).reduce((s, q3) => s + q3.amount, 0),
      invoicesIdentified: reqs.some((q3) => q3.identified),
      addedToNetUncollected: false,
      note: reqs.length && !reqs.some((q3) => q3.identified) ? { ar: "\u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u0639\u0642\u062F \u062F\u0648\u0646 \u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u2014 \u064A\u064F\u0639\u0631\u0636 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0642\u062F \u0648\u0644\u0627 \u064A\u064F\u0636\u0627\u0641 \u0625\u0644\u0649 \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0644 \u0645\u0631\u0629 \u062B\u0627\u0646\u064A\u0629.", en: "Execution request is linked to the contract with no invoices identified \u2014 shown at contract level and not added to net uncollected again." } : reqs.length ? { ar: "\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0641\u064A \u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u062A\u064F\u0639\u0631\u0636 \u0628\u062D\u0627\u0644\u062A\u0647\u0627 \u0627\u0644\u0641\u0639\u0644\u064A\u0629 (\u0642\u062F \u062A\u0643\u0648\u0646 \u0645\u0633\u062A\u0628\u0639\u062F\u0629 \u0628\u0642\u0627\u0639\u062F\u0629 \u0633\u0646\u062F)\u061B \u0648\u0627\u0644\u0637\u0644\u0628 \u0646\u0641\u0633\u0647 \u0644\u0627 \u064A\u063A\u064A\u0651\u0631 \u0623\u064A \u0645\u0628\u0644\u063A \u0648\u0644\u0627 \u064A\u0639\u0646\u064A \u062A\u062D\u0635\u064A\u0644\u0627\u064B.", en: "Invoices named in the execution request show their own status (they may be excluded under the Sanad rule); the request itself changes no amount and does not mean collection." } : null
    },
    crChain: reqs.map((q3) => ({ sanadRequest: q3.enforceNum, document: `${q3.documents[0].type} \u2014 ${q3.documents[0].item}`, crNo: q3.crNo || ct.crNo, method: q3.documents[0].method, confidence: q3.documents[0].confidence, crViewStatusRaw: CR_STATUS[ct.crSt] || null }))
  };
}
var contractCode = (ct) => demoMunicipalityCode(ct.ent, 1073741824 + ct.idx, "investment");
function contractVisible(st, ct, tab = ALL_TABLE) {
  if (!ct) return false;
  if (tab.all) return true;
  if (!visibleCode(tab, ct.ent, contractCode(ct))) return false;
  for (const d of ct.sched || []) if (d.inv >= 0 && !isVisible(st, d.inv, tab)) return false;
  for (const i of ct.invs || []) if (!isVisible(st, i, tab)) return false;
  return true;
}
function requestVisible(st, q3, tab = ALL_TABLE) {
  if (!q3) return false;
  if (tab.all) return true;
  if (!entityReachable(tab, q3.ent)) return false;
  const ct = q3.contractIdx >= 0 ? st.contracts[q3.contractIdx] : null;
  if (ct && !contractVisible(st, ct, tab)) return false;
  const inv2 = [...q3.identified || [], ...q3.covers || []];
  for (const i of inv2) if (!isVisible(st, i, tab)) return false;
  if (!ct && !inv2.length) return visibleCode(tab, q3.ent, 0);
  return true;
}
var inScope2 = (st, req, ct, tab) => {
  const allowed = req.scope?.org?.amanahKeys || req.scope?.orgKeys || null;
  const am = req.scope?.amanah;
  const picked = am && am !== "all" ? new Set([].concat(am)) : null;
  const en = ENTITIES[ct.ent].en;
  return !(allowed && !allowed.includes(en)) && !(picked && !picked.has(en)) && contractVisible(st, ct, tab);
};
function contractCards(st, req, { summary: summary3 = true } = {}) {
  const ctx = makeCtx(st, req);
  const out = [];
  for (const ct of st.contracts) {
    if (!ct || !inScope2(st, req, ct, ctx.acc)) continue;
    const c = cardOf(st, ctx, ct);
    if (summary3) {
      c.schedule = void 0;
    }
    out.push(c);
  }
  return out;
}
function contractCard(st, req, no) {
  const ctx = makeCtx(st, req);
  const found = contractsByNumber(st, no).filter((ct) => inScope2(st, req, ct, ctx.acc));
  if (!found.length) return null;
  if (found.length > 1) return { ambiguous: true, matches: found.length };
  return cardOf(st, ctx, found[0]);
}
function contractRollup(cards) {
  const add = (f) => cards.reduce((s, c) => s + f(c.totals), 0);
  const gross = add((t) => t.gross);
  const exclusions = add((t) => t.exclusions);
  const net = add((t) => t.net);
  const collected = add((t) => t.collected);
  return {
    contracts: cards.length,
    multiPayment: cards.filter((c) => c.totals.installments > 1).length,
    arrears: add((t) => t.arrears),
    notDue: add((t) => t.notDue),
    futureNotInvoiced: add((t) => t.futureNotInvoiced),
    gross,
    exclusions,
    net,
    collected,
    uncollected: add((t) => t.uncollected),
    collectionRateOnNet: ratio(collected, net),
    unlinkedInstallments: add((t) => t.unlinkedInstallments),
    unlinkedAmount: add((t) => t.unlinkedAmount),
    historyInstallments: add((t) => t.historyInstallments),
    coverage: { installments: add((t) => t.coverage.installments), known: add((t) => t.coverage.known), notApplicable: add((t) => t.coverage.notApplicable), unknown: add((t) => t.coverage.unknown) },
    executionAtContractLevel: cards.reduce((s, c) => s + (c.execution.invoicesIdentified ? 0 : c.execution.amount), 0),
    origin: demoOrigin(),
    proposedRules: proposedRules()
  };
}
function sanadCases(st, req = {}) {
  const tab = makeCtx(st, req).acc;
  return st.requests.filter((q3) => requestVisible(st, q3, tab)).map((q3) => {
    const wl = q3.system === "white_lands";
    return {
      enforceNum: q3.enforceNum,
      system: q3.system || "sanad",
      amanahEn: ENTITIES[q3.ent].en,
      amount: q3.amount,
      openedDate: isoOf(q3.openedDay),
      contractNo: q3.contractNo || null,
      requestStatus: q3.status,
      // what the feed supplies for the order: the invoice references it carries (possibly none / incomplete / wrong), the debtor, and whether the order document can be fetched
      refs: q3.refs ? q3.refs.map((r) => ({ ...r })) : q3.identified.map((i) => ({ kind: "invoice_no", value: idOf(st, i) })),
      debtorIdx: q3.debtor ?? null,
      debtorName: q3.debtor != null ? payerName(q3.debtor) : null,
      debtorId: q3.debtor != null ? beneficiaryIdOf(q3.debtor) : null,
      description: q3.description || "",
      notes: q3.notes || "",
      attachments: (q3.attachments || []).map((x) => ({ ...x, retrieved: false })),
      closeReason: q3.status === "\u0645\u063A\u0644\u0642" ? q3.closeReason || null : null,
      orderDocument: { retrievable: false, reason: "sanad_document_integration_not_connected" },
      feed: "synthetic_demo",
      documents: wl ? [] : [{ type: "\u0641\u0627\u062A\u0648\u0631\u0629", item: "\u0628\u0646\u062F \u0661", crNo: q3.crNo, method: METHOD[q3.method], confidence: q3.confidence }],
      links: q3.identified.map((i) => ({ invoiceId: idOf(st, i), allocated: 0, gross: st.gross[i], origin: "sanad_structured", status: "confirmed", evidence: wl ? ["reference_match"] : ["contract_match", "reference_match"], reviewedBy: wl ? "White-lands enforcement file (demo feed)" : "Sanad structured reference (demo feed)", reviewedAt: isoOf(q3.openedDay) })),
      history: []
    };
  });
}

// server/planningActions.js
var PLAN_AGED_DAYS = 180;
var PLAN_CLASSES = ["A", "B", "C", "D", "E", "U"];
var PLAN_BLOCKERS = ["enforcement", "objection", "linkage_unresolved", "ineligible_referral"];
var CI = Object.fromEntries(PLAN_CLASSES.map((c, i) => [c, i]));
var ACTIONABLE = /* @__PURE__ */ new Set(["B", "C"]);
var CLASS_INFO = {
  A: { ar: "\u0639\u0627\u0626\u0642 \u0642\u0627\u0626\u0645 \u2014 \u062D\u0633\u0645 \u0627\u0644\u0639\u0627\u0626\u0642", en: "Blocked \u2014 resolve the blocker", actionable: false, order: 3 },
  B: { ar: "\u0645\u062A\u0623\u062E\u0631 \u2264 180 \u064A\u0648\u0645\u0627\u064B \u2014 \u0642\u0627\u0628\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0622\u0646", en: "Overdue \u2264 180 days \u2014 actionable now", actionable: true, order: 1 },
  C: { ar: "\u064A\u0633\u062A\u062D\u0642 \u0642\u0628\u0644 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0633\u0646\u0629", en: "Due by year-end", actionable: true, order: 2 },
  D: { ar: "\u0631\u0635\u064A\u062F \u0642\u062F\u064A\u0645 > 180 \u064A\u0648\u0645\u0627\u064B \u2014 \u064A\u062D\u062A\u0627\u062C \u0642\u0631\u0627\u0631\u0627\u064B", en: "Older than 180 days \u2014 needs a decision", actionable: false, order: 4 },
  E: { ar: "\u064A\u0633\u062A\u062D\u0642 \u0628\u0639\u062F \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0633\u0646\u0629", en: "Due after year-end", actionable: false, order: 5 },
  U: { ar: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D", en: "Due date unavailable", actionable: false, order: 6 }
};
var BLOCKER_INFO = {
  enforcement: { ar: "\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0623\u0645\u0631 \u062A\u0646\u0641\u064A\u0630 \u0645\u0624\u0643\u062F", en: "Linked to a confirmed enforcement order" },
  objection: { ar: "\u0639\u0644\u064A\u0647\u0627 \u0627\u0639\u062A\u0631\u0627\u0636 \u0645\u0641\u062A\u0648\u062D", en: "Open objection" },
  linkage_unresolved: { ar: "\u0631\u0628\u0637 \u063A\u064A\u0631 \u0645\u062D\u0633\u0648\u0645 (\u0639\u0642\u062F \u0623\u0648 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0635\u062F\u0631)", en: "Unresolved linkage (contract or source status)" },
  ineligible_referral: { ar: "\u063A\u064A\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0625\u062D\u0627\u0644\u0629 (\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062F\u064A\u0646 \u0646\u0627\u0642\u0635\u0629)", en: "Not eligible for referral (payer data missing)" }
};
var ACTIONS = {
  follow_existing_action: { ar: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0642\u0627\u0626\u0645 \u2014 \u0644\u0627 \u0625\u062D\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629", en: "Follow the existing action \u2014 no new referral" },
  resolve_data_blocker: { ar: "\u062D\u0633\u0645 \u0631\u0628\u0637 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0642\u0628\u0644 \u0623\u064A \u0625\u062C\u0631\u0627\u0621 \u2014 \u0644\u0627 \u0625\u062D\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629", en: "Settle the data linkage before any action \u2014 no new referral" },
  follow_up_overdue: { ar: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0629 (\u064A\u0648\u062C\u062F \u0645\u062F\u064A\u0646 \u0648\u0623\u0645\u0631 \u064A\u0645\u0643\u0646 \u0627\u0644\u0628\u062F\u0621 \u0628\u0647)", en: "Follow up the overdue invoices (a debtor and an order that can be started)" },
  pre_due_reminder: { ar: "\u062A\u0630\u0643\u064A\u0631 \u0642\u0628\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642", en: "Reminder before the due date" },
  escalate_for_decision: { ar: "\u0631\u0641\u0639 \u0644\u0644\u0642\u0631\u0627\u0631", en: "Escalate for a decision" },
  no_action_this_year: { ar: "\u0644\u0627 \u0625\u062C\u0631\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0639\u0627\u0645 (\u064A\u0633\u062A\u062D\u0642 \u0628\u0639\u062F \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0633\u0646\u0629)", en: "No action this year (due after year-end)" },
  complete_due_date: { ar: "\u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0642\u0628\u0644 \u0623\u064A \u0625\u062C\u0631\u0627\u0621", en: "Complete the due date before any action" }
};
var EXPECTED_IMPACT_REASON = { ar: "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D", en: "Not available" };
var UNSPECIFIED = { ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", en: "Unspecified" };
var yearEndOf = (cfg) => dayNum(`${String(cfg.cutoff).slice(0, 4)}-12-31`);
function blockerOf(st, i, D) {
  if (st.exec[i] >= 0 || D.link >= 2 && D.link <= 4) return "enforcement";
  if (D.cls === CLASS_INDEX.objection) return "objection";
  if (D.cls === CLASS_INDEX.linkage_unresolved) return "linkage_unresolved";
  if (D.cls === CLASS_INDEX.ineligible_referral) return "ineligible_referral";
  return null;
}
function planClassOf(st, i, D, yearEndN) {
  if (!(D.outstanding > 0)) return null;
  if (blockerOf(st, i, D)) return "A";
  if (!(st.due[i] > 0)) return "U";
  if (D.daysOverdue > PLAN_AGED_DAYS) return "D";
  if (D.daysOverdue > 0) return "B";
  return st.due[i] <= yearEndN ? "C" : "E";
}
function planLineMatches(st, ctx, i, D, spec) {
  const c = planClassOf(st, i, D, yearEndOf(ctx.cfg));
  if (!c) return false;
  const want = [].concat(spec?.cls ?? []);
  if (want.length && !want.includes(c)) return false;
  if (spec?.blocker && blockerOf(st, i, D) !== spec.blocker) return false;
  return true;
}
var z2 = () => ({ count: 0, amount: 0 });
var newAcc = () => ({ count: 0, remaining: 0, dueByYearEnd: 0, overdue: z2(), notYetDue: z2(), dueUnavailable: z2(), partial: z2(), aged180: z2(), enforcementLinked: z2(), objected: z2(), objectionRecorded: z2(), unresolvedLinkage: z2(), ineligibleReferral: z2(), proposedLink: z2(), oldest: 0, blockers: { enforcement: z2(), objection: z2(), linkage_unresolved: z2(), ineligible_referral: z2() } });
var bump2 = (b, a) => {
  b.count += 1;
  b.amount += a;
};
var fin2 = (n) => Number.isFinite(n) ? n : 0;
var sourceInfo = (s) => {
  const k = SOURCES[s]?.key;
  const l = k && REVENUE_SOURCES[k];
  return k ? { key: k, ar: l?.ar || k, en: l?.en || k } : { key: "unspecified", ar: UNSPECIFIED.ar, en: UNSPECIFIED.en };
};
function muniGroup(e, code) {
  const slot = slotOf(e, code);
  const en = ENTITIES[e].en;
  if (slot >= 4) {
    const m = municipalityOfCode(e, slot);
    return { key: m.key, ar: m.ar, en: m.en, status: "mapped" };
  }
  if (slot === 1) return { key: `${en}|DIRECT`, ar: MUNICIPALITY_DIRECT.ar, en: MUNICIPALITY_DIRECT.en, status: "direct_amanah" };
  if (slot === 2) return { key: `${en}|UNRESOLVED`, ar: MUNICIPALITY_UNRESOLVED.ar, en: MUNICIPALITY_UNRESOLVED.en, status: "needs_review" };
  return { key: `${en}|NOT_SPECIFIED`, ar: MUNICIPALITY_NOT_SPECIFIED.ar, en: MUNICIPALITY_NOT_SPECIFIED.en, status: "not_specified" };
}
var DRILL_DROP = /* @__PURE__ */ new Set(["org", "orgKeys", "amanah", "source", "muni", "from", "to"]);
function drillOf(base, cutoff, entityKey, sourceKey, muniKey, planLine) {
  const scope = { ...base, from: "2000-01-01", to: cutoff, amanah: entityKey, source: sourceKey ?? "all", ...muniKey ? { muni: muniKey } : {} };
  return { route: "/collection", scope, filters: { state: "open", allPeriods: true, planLine } };
}
function actionOf(cls, acc) {
  if (cls === "A") {
    const top2 = PLAN_BLOCKERS.reduce((b, k) => acc.blockers[k].amount > acc.blockers[b].amount ? k : b, PLAN_BLOCKERS[0]);
    const key2 = top2 === "enforcement" || top2 === "objection" ? "follow_existing_action" : "resolve_data_blocker";
    return { key: key2, ...ACTIONS[key2] };
  }
  const key = { B: "follow_up_overdue", C: "pre_due_reminder", D: "escalate_for_decision", E: "no_action_this_year", U: "complete_due_date" }[cls];
  return { key, ...ACTIONS[key] };
}
function actionLines(st, req = {}) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const cutoffN = ctx.cutoffN;
  const yearEndN = yearEndOf(ctx.cfg);
  const cutoff = ctx.cfg.cutoff;
  const byMuni = req.groupBy === "municipality" || req.scope && req.scope.muni != null && req.scope.muni !== "all" && req.scope.muni !== "";
  const NS = SOURCES.length;
  const NSLOT = byMuni ? MUNI_SLOTS : 1;
  const NC = PLAN_CLASSES.length;
  const D = ctx.D;
  const lines = /* @__PURE__ */ new Map();
  const sep = { excluded: z2(), cancelled: z2() };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > cutoffN || !inScope(st, sc, i)) continue;
    derive(ctx, i, cutoffN);
    if (sc.statusSet && !sc.statusSet[D.cls]) continue;
    if (D.cancelled) {
      bump2(sep.cancelled, D.cancelledAmount);
      continue;
    }
    if (D.excluded) {
      if (D.exclusionAmount > 0) bump2(sep.excluded, D.exclusionAmount);
      continue;
    }
    const cls = planClassOf(st, i, D, yearEndN);
    if (!cls) continue;
    const e = st.ent[i];
    const s = st.src[i];
    const slot = byMuni ? slotOf(e, st.mref[i]) : 0;
    const key = ((e * NSLOT + slot) * NS + s) * NC + CI[cls];
    let a = lines.get(key);
    if (!a) {
      a = newAcc();
      a.e = e;
      a.s = s;
      a.slot = slot;
      a.code = st.mref[i];
      a.cls = cls;
      lines.set(key, a);
    }
    const amt = D.outstanding;
    const f = st.flags[i];
    a.count += 1;
    a.remaining += amt;
    const dueKnown = st.due[i] > 0;
    if (dueKnown && st.due[i] <= yearEndN) a.dueByYearEnd += amt;
    if (!dueKnown) bump2(a.dueUnavailable, amt);
    else if (D.daysOverdue > 0) {
      bump2(a.overdue, amt);
      if (D.daysOverdue > a.oldest) a.oldest = D.daysOverdue;
      if (D.daysOverdue > PLAN_AGED_DAYS) bump2(a.aged180, amt);
    } else bump2(a.notYetDue, amt);
    if (D.received > 0) bump2(a.partial, amt);
    if (f & F.OBJECTION) bump2(a.objectionRecorded, amt);
    if (D.link === 1) bump2(a.proposedLink, amt);
    const bl = blockerOf(st, i, D);
    if (bl) {
      bump2(a.blockers[bl], amt);
      if (bl === "enforcement") bump2(a.enforcementLinked, amt);
      else if (bl === "objection") bump2(a.objected, amt);
      else if (bl === "linkage_unresolved") bump2(a.unresolvedLinkage, amt);
      else bump2(a.ineligibleReferral, amt);
    }
  }
  const gapsIn = req.entityGaps && typeof req.entityGaps === "object" && !Array.isArray(req.entityGaps) ? req.entityGaps : null;
  const gapOf = (key) => gapsIn && Number.isFinite(Number(gapsIn[key])) && gapsIn[key] !== null && gapsIn[key] !== "" ? Number(gapsIn[key]) : null;
  const gapTotal = gapsIn ? Object.keys(gapsIn).reduce((t, k) => t + (gapOf(k) ?? 0), 0) : null;
  const shareOf = (g) => g === null || !(gapTotal > 0) ? null : g / gapTotal;
  const baseScope = {};
  for (const [k, v] of Object.entries(req.scope || {})) if (!DRILL_DROP.has(k)) baseScope[k] = v;
  const out = [];
  const cells = /* @__PURE__ */ new Map();
  const ents = /* @__PURE__ */ new Map();
  const byClass = Object.fromEntries(PLAN_CLASSES.map((c) => [c, { count: 0, remaining: 0, dueByYearEnd: 0, lines: 0 }]));
  for (const a of lines.values()) {
    const ek = ENTITIES[a.e].en;
    const src = sourceInfo(a.s);
    const mg = byMuni ? muniGroup(a.e, a.code) : null;
    const cls = a.cls;
    const gap = gapOf(ek);
    const isAct = ACTIONABLE.has(cls);
    const drill = drillOf(baseScope, cutoff, ek, src.key === "unspecified" ? "all" : src.key, mg && mg.key, { cls });
    const breakdown = cls === "A" ? PLAN_BLOCKERS.filter((k) => a.blockers[k].count > 0).map((k) => ({ key: k, ar: BLOCKER_INFO[k].ar, en: BLOCKER_INFO[k].en, count: a.blockers[k].count, amount: a.blockers[k].amount, drill: drillOf(baseScope, cutoff, ek, src.key === "unspecified" ? "all" : src.key, mg && mg.key, { cls: "A", blocker: k }) })) : [];
    const line = {
      id: `${ek}|${mg ? `${mg.key}|` : ""}${src.key}|${cls}`,
      entity: { key: ek, ar: ENTITIES[a.e].ar, en: ENTITIES[a.e].en },
      ...mg ? { municipality: mg } : {},
      source: src,
      class: cls,
      classLabel: { ar: CLASS_INFO[cls].ar, en: CLASS_INFO[cls].en },
      actionable: isAct,
      count: a.count,
      remaining: a.remaining,
      dueByYearEnd: a.dueByYearEnd,
      oldestDaysOverdue: a.oldest,
      overdue: a.overdue,
      notYetDue: a.notYetDue,
      dueUnavailable: a.dueUnavailable,
      partial: a.partial,
      evidence: { enforcementLinked: a.enforcementLinked, objected: a.objected, objectionRecorded: a.objectionRecorded, unresolvedLinkage: a.unresolvedLinkage, ineligibleReferral: a.ineligibleReferral, proposedLink: a.proposedLink, aged180: a.aged180, partial: a.partial, dueUnavailable: a.dueUnavailable, oldestDaysOverdue: a.oldest },
      ...cls === "A" ? { blockers: breakdown } : {},
      recommendedAction: actionOf(cls, a),
      expectedImpact: null,
      expectedImpactReason: { ...EXPECTED_IMPACT_REASON },
      contributionToGap: { level: "entity", entityGap: gap, share: shareOf(gap) },
      drill,
      rankInputs: { actionable: isAct ? a.remaining : 0, cellActionable: 0, entityGap: gap, remaining: a.remaining, oldestDaysOverdue: a.oldest }
    };
    out.push(line);
    const bc = byClass[cls];
    bc.count += a.count;
    bc.remaining += a.remaining;
    bc.dueByYearEnd += a.dueByYearEnd;
    bc.lines += 1;
    const ck = `${ek}|${mg ? mg.key : ""}|${src.key}`;
    let cell = cells.get(ck);
    if (!cell) {
      cell = { id: ck, entity: line.entity, ...mg ? { municipality: mg } : {}, source: src, remaining: 0, actionable: 0, aged: 0, blocked: 0, oldestDaysOverdue: 0, byClass: Object.fromEntries(PLAN_CLASSES.map((c) => [c, 0])), contributionToGap: line.contributionToGap };
      cells.set(ck, cell);
    }
    cell.remaining += a.remaining;
    cell.byClass[cls] += a.remaining;
    if (isAct) cell.actionable += a.remaining;
    if (cls === "D") cell.aged += a.remaining;
    if (cls === "A") cell.blocked += a.remaining;
    if (a.oldest > cell.oldestDaysOverdue) cell.oldestDaysOverdue = a.oldest;
    let en = ents.get(ek);
    if (!en) {
      en = { key: ek, ar: line.entity.ar, en: line.entity.en, remaining: 0, actionable: 0, aged: 0, blocked: 0, byClass: Object.fromEntries(PLAN_CLASSES.map((c) => [c, 0])), contributionToGap: line.contributionToGap };
      ents.set(ek, en);
    }
    en.remaining += a.remaining;
    en.byClass[cls] += a.remaining;
    if (isAct) en.actionable += a.remaining;
    if (cls === "D") en.aged += a.remaining;
    if (cls === "A") en.blocked += a.remaining;
  }
  for (const cell of cells.values()) {
    cell.drillActionable = drillOf(baseScope, cutoff, cell.entity.key, cell.source.key === "unspecified" ? "all" : cell.source.key, cell.municipality && cell.municipality.key, { cls: ["B", "C"] });
  }
  for (const l of out) l.rankInputs.cellActionable = cells.get(`${l.entity.key}|${l.municipality ? l.municipality.key : ""}|${l.source.key}`).actionable;
  out.sort((x, y) => y.rankInputs.cellActionable - x.rankInputs.cellActionable || ((y.rankInputs.entityGap ?? -Infinity) - (x.rankInputs.entityGap ?? -Infinity) || 0) || CLASS_INFO[x.class].order - CLASS_INFO[y.class].order || y.remaining - x.remaining || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  out.forEach((l, k) => {
    l.rank = k + 1;
  });
  const cellsOut = [...cells.values()].sort((x, y) => y.actionable - x.actionable || ((y.contributionToGap.entityGap ?? -Infinity) - (x.contributionToGap.entityGap ?? -Infinity) || 0) || y.remaining - x.remaining || (x.id < y.id ? -1 : 1));
  cellsOut.forEach((c, k) => {
    c.rank = k + 1;
  });
  const entsOut = [...ents.values()].sort((x, y) => y.actionable - x.actionable || y.remaining - x.remaining || (x.key < y.key ? -1 : 1));
  const sum2 = (k) => PLAN_CLASSES.reduce((t, c) => t + byClass[c][k], 0);
  const actionableAmt = byClass.B.remaining + byClass.C.remaining;
  return {
    version: 1,
    kind: "planning_action_lines",
    cutoff,
    asOf: cutoff,
    yearEnd: `${cutoff.slice(0, 4)}-12-31`,
    agedDays: PLAN_AGED_DAYS,
    level: byMuni ? "municipality" : "entity",
    scope: { amanah: req.scope?.amanah ?? "all", source: req.scope?.source ?? "all", muni: req.scope?.muni ?? "all", org: req.scope?.org || null },
    classes: PLAN_CLASSES.map((c) => ({ key: c, ar: CLASS_INFO[c].ar, en: CLASS_INFO[c].en, actionable: CLASS_INFO[c].actionable, ...byClass[c] })),
    lines: out,
    cells: cellsOut,
    entities: entsOut,
    totals: { count: sum2("count"), remaining: sum2("remaining"), dueByYearEnd: sum2("dueByYearEnd"), byClass, actionable: { count: byClass.B.count + byClass.C.count, remaining: actionableAmt }, needsDecision: { count: byClass.D.count, remaining: byClass.D.remaining }, blocked: { count: byClass.A.count, remaining: byClass.A.remaining }, lines: out.length },
    separate: { excluded: sep.excluded, cancelled: sep.cancelled, note: { ar: "\u0627\u0644\u0645\u0633\u062A\u0628\u0639\u062F \u0648\u0627\u0644\u0645\u0644\u063A\u0649 \u062E\u0627\u0631\u062C \u0627\u0644\u0623\u0633\u0637\u0631 \u0648\u062E\u0627\u0631\u062C \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A.", en: "Excluded and cancelled invoices are outside the lines and the totals." } },
    gaps: { supplied: !!gapsIn, total: gapTotal === null ? null : fin2(gapTotal), level: "entity", note: { ar: "\u0627\u0644\u0645\u0633\u0627\u0647\u0645\u0629 \u0641\u064A \u0627\u0644\u0641\u062C\u0648\u0629 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062C\u0647\u0629 \u0641\u0642\u0637\u061B \u0644\u0627 \u0645\u0633\u062A\u0647\u062F\u0641 \u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0625\u064A\u0631\u0627\u062F.", en: "Gap contribution exists at entity level only; there is no revenue-source target." } },
    expectedImpact: { available: false, reason: { ...EXPECTED_IMPACT_REASON } },
    notes: [
      { ar: "\u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0623\u0631\u0635\u062F\u0629 \u0642\u0627\u0626\u0645\u0629 \u0648\u0644\u064A\u0633\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0625\u0644\u0649 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u061B \u0644\u0627 \u064A\u064F\u0642\u062F\u064E\u0651\u0631 \u0645\u0628\u0644\u063A \u0642\u0627\u0628\u0644 \u0644\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062A\u062D\u0642\u0642 \u0645\u0646\u0647.", en: "Amounts are standing balances, not additions to the forecast; no recoverable amount is estimated because no data can validate one." },
      { ar: "\u0643\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062D\u0635\u0651\u0644\u0629 \u0641\u064A \u0633\u0637\u0631 \u0648\u0627\u062D\u062F \u0641\u0642\u0637 (\u0639\u0627\u0626\u0642 \u062B\u0645 \u062A\u0627\u0631\u064A\u062E \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062B\u0645 \u0623\u0642\u062F\u0645 \u0645\u0646 180 \u064A\u0648\u0645\u0627\u064B \u062B\u0645 \u0645\u062A\u0623\u062E\u0631 \u062B\u0645 \u064A\u0633\u062A\u062D\u0642 \u0642\u0628\u0644 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0633\u0646\u0629 \u062B\u0645 \u0628\u0639\u062F\u0647\u0627)\u061B \u0641\u0644\u0627 \u0627\u0632\u062F\u0648\u0627\u062C \u0628\u064A\u0646 \u0627\u0644\u0623\u0633\u0637\u0631.", en: "Every uncollected invoice sits in exactly one line (blocker, then due date unavailable, then older than 180 days, then overdue, then due by year-end, then after) \u2014 no double counting between lines." },
      { ar: "\u062D\u062F \u0627\u0644\u0640180 \u064A\u0648\u0645\u0627\u064B \u0645\u0646 \u0641\u0626\u0627\u062A \u0627\u0644\u062A\u0642\u0627\u062F\u0645 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0648\u0647\u0648 \u0642\u0627\u0639\u062F\u0629 \u0639\u0645\u0644 \u0642\u064A\u062F \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0645\u0639 \u0645\u0644\u0627\u0643 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 (D-10).", en: "The 180-day line comes from the existing ageing tiers and is a business rule pending confirmation by the collection owners (D-10)." }
    ]
  };
}

// server/lists.js
var low0 = (x) => x.toLowerCase();
var RULE_PRIORITY = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.priority]));
function resolveSearch(st, q3, tab = ALL_TABLE) {
  const s = String(q3 || "").trim();
  if (!s) return null;
  const exact = lookupId(st, s);
  if (exact >= 0) return { list: Int32Array.of(exact) };
  const upper = s.toUpperCase();
  {
    const ms = contractsByNumber(st, s).filter((c) => contractVisible(st, c, tab));
    if (ms.length > 1) return { list: new Int32Array(0), ambiguousContract: ms.length };
  }
  {
    const ms = contractsByNumber(st, s).filter((c) => contractVisible(st, c, tab));
    const ct = ms.length === 1 ? ms[0] : null;
    if (ct) return { list: Int32Array.from(ct.invs) };
  }
  if (/^\d{10}$/.test(s)) {
    const ct = st.contracts.find((c) => c && c.crNo === s && contractVisible(st, c, tab));
    if (ct) return { list: Int32Array.from(ct.invs) };
  }
  if (/^\d{12}$/.test(s)) {
    const l = lookupSadad(st, s);
    if (l.length) return { list: Int32Array.from(l) };
  }
  if (/^\d{10}$/.test(s)) {
    const k = idKeyFromSubscription(s);
    if (k != null) {
      const i = lookupKey(st, k);
      if (i >= 0) return { list: Int32Array.of(i) };
    }
  }
  if (/^\d{14}$/.test(s)) {
    const k = idKeyFromViolation(s);
    if (k != null) {
      const i = lookupKey(st, k);
      if (i >= 0) return { list: Int32Array.of(i) };
    }
  }
  for (const codec2 of [DISCLOSURE, SCHEDULE, VISIT, LICENCE, REQUEST]) {
    const k = codec2.decode(upper);
    if (k != null) {
      const i = lookupKey(st, k);
      return { list: i >= 0 ? Int32Array.of(i) : new Int32Array(0) };
    }
  }
  {
    const k = DEED.decode(upper);
    if (k != null) {
      const i = lookupKey(st, k);
      if (i < 0) return { list: new Int32Array(0) };
      const g = grpOf(st.flags[i]);
      const n = g === GRP.WL_HEAD2 ? 2 : g === GRP.WL_HEAD3 ? 3 : 1;
      return { list: Int32Array.from({ length: n }, (_, j) => i + j) };
    }
  }
  {
    const fk = parseFacilityKey(upper);
    if (fk != null) {
      const bm2 = new Uint8Array(65536);
      bm2[fk] = 1;
      return { payer: bm2, fixtures: [] };
    }
  }
  {
    const q4 = st.requests.find((x) => x.enforceNum === upper && requestVisible(st, x, tab));
    if (q4) return { list: Int32Array.from(q4.identified.length ? q4.identified : st.contracts[q4.contractIdx]?.invs || []) };
  }
  {
    const m2 = /^(?:مالك أرض|LAND OWNER)\s*(\d{5})$/.exec(upper.replace(/\s+/g, " "));
    if (m2) {
      const bm2 = new Uint8Array(65536);
      const idx = WL_PAYER_BASE + Number(m2[1]) - 1e3;
      if (idx >= WL_PAYER_BASE && idx < 65536) bm2[idx] = 1;
      return { payer: bm2, fixtures: [] };
    }
  }
  {
    const m3 = /^(?:مشتري سكني|RESIDENTIAL BUYER)\s*(\d{5})$/.exec(upper.replace(/\s+/g, " "));
    if (m3) {
      const bm2 = new Uint8Array(65536);
      const idx = HOUSING_PAYER_BASE + Number(m3[1]) - 1e3;
      if (idx >= HOUSING_PAYER_BASE && idx < WL_PAYER_BASE) bm2[idx] = 1;
      return { payer: bm2, fixtures: [] };
    }
  }
  if (s.length >= 3) {
    const ow = "\u0645\u0627\u0644\u0643 \u0623\u0631\u0636".startsWith(s) || "land owner".startsWith(low0(s));
    const by = "\u0645\u0634\u062A\u0631\u064A \u0633\u0643\u0646\u064A".startsWith(s) || "residential buyer".startsWith(low0(s));
    if (ow || by) {
      const bm2 = new Uint8Array(65536);
      const [a, b] = ow ? [WL_PAYER_BASE, 65536] : [HOUSING_PAYER_BASE, WL_PAYER_BASE];
      for (let k = a; k < b; k += 1) bm2[k] = 1;
      return { payer: bm2, fixtures: [] };
    }
  }
  const fx = [];
  const low = s.toLowerCase();
  for (const [i, r] of st.fixtures) if (r.id.toLowerCase().includes(low) || (r.co || "").toLowerCase().includes(low) || (r.entityEn || "").toLowerCase().includes(low) || (r.entityAr || "").includes(s)) fx.push(i);
  const pool = payerPool();
  const bm = new Uint8Array(65536);
  let any = false;
  for (let p = 0; p < pool.length; p += 1) if (pool[p].ar.includes(s) || pool[p].en.toLowerCase().includes(low)) {
    bm[p] = 1;
    any = true;
  }
  return { payer: any ? bm : null, fixtures: fx };
}
function tahseelOf(st, i, D) {
  return D.cancelled ? "\u0645\u0644\u063A\u0627\u0629" : D.received >= D.billed && D.billed > 0 ? "\u0645\u062D\u0635\u0644\u0629" : D.received > 0 ? "\u0645\u0633\u062F\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B" : "\u063A\u064A\u0631 \u0645\u062D\u0635\u0644\u0629";
}
function tagsOf(st, i, D) {
  const t = [];
  const f = st.flags[i];
  if (D.received > 0 && D.outstanding > 0) t.push("partial");
  if (D.outstanding > 0 && D.daysOverdue > 0) t.push("overdue");
  if (f & F.AMT_CONFLICT) t.push("amount_conflict");
  const cs = st.cstat[i];
  if (st.src[i] === 0 && cs === 2) t.push("contract_unmatched");
  if (st.src[i] === 0 && cs === 4) t.push("contract_unlinked");
  if (f & F.MISSING_ID) t.push("missing_fields");
  if (D.overlaps) t.push("also_excluded_reason");
  else if (D.excluded && D.nReasons > 1) t.push("multi_reason");
  if (D.pendingMask) t.push("exclusion_pending");
  if (st.efaa[i] && st.efaa[i] !== 1 && st.efaa[i] !== 2) t.push("efaa_status");
  if (D.link === 1) t.push("enforcement_candidate");
  return t;
}
function invoiceCandidates(st, body, idx) {
  const ctx = makeCtx(st, body);
  return idx.filter((i) => isVisible(st, i, ctx.acc)).map((i) => {
    const r = rowOut(st, ctx, i, derive(ctx, i, ctx.cutoffN));
    return { id: r.id, compositeKey: r.compositeKey, invoiceNo: r.invoiceNo, gfsCode: r.gfsCode, amanahId: r.amanahId, amanahAr: r.amanahAr, amanahEn: r.amanahEn, municipalityId: r.municipalityId, municipalityRefId: r.municipalityRefId, municipalityAr: r.municipalityAr, municipalityEn: r.municipalityEn, municipalityStatus: r.municipalityStatus, source: r.source, platform: r.platform, amount: r.gross, status: r.cls };
  });
}
function rowOut(st, ctx, i, D) {
  const e = st.ent[i];
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ct = st.contract[i] >= 0 ? st.contracts[st.contract[i]] : null;
  const rules = [];
  for (let b = 0; b < RULE_IDS.length; b += 1) if (st.exMask[i] & 1 << b) rules.push(RULE_IDS[b]);
  const im = iimFields(st, i);
  return {
    id: idOf(st, i),
    index: i,
    entityKey: ENTITIES[e].en,
    amanahAr: ENTITIES[e].ar,
    amanahEn: ENTITIES[e].en,
    payerAr: fx ? fx.entityAr || fx.entity : payerName(st.payer[i]).ar,
    payerEn: fx ? fx.entityEn : payerName(st.payer[i]).en,
    scopeType: st.scope[i] === 1 ? "internal" : "central",
    source: SOURCES[st.src[i]].key,
    platform: SOURCES[st.src[i]].platform,
    item: ITEMS[st.item[i]].key,
    itemAr: ITEMS[st.item[i]].ar,
    itemEn: ITEMS[st.item[i]].en,
    issueDate: isoOf(st.issue[i]),
    dueDate: isoOf(st.due[i]),
    gross: D.gross,
    billed: D.billed,
    collected: D.collected,
    received: D.received,
    outstanding: D.outstanding,
    cancelledAmount: D.cancelledAmount,
    exclusionAmount: D.exclusionAmount,
    exclusions: D.exclTotal,
    net: D.net,
    daysOverdue: D.outstanding > 0 ? D.daysOverdue : 0,
    cls: CLASSES[D.cls],
    lines: st.lines[i],
    statusRawTahseel: tahseelOf(st, i, D),
    statusRawEfaa: EFAA_STATUS[st.efaa[i]] || null,
    crStatusRaw: CR_STATUS[st.crSt[i]] || null,
    contractNo: ct && st.cstat[i] === 1 ? ct.contractNo : fx?.co || null,
    contractStatus: CSTAT[st.cstat[i]],
    executionIdx: st.exec[i],
    enforcement: ctx.mark ? ctx.ov.get(i)?.link || 0 : 0,
    payStatus: D.payStatus,
    sourceCancelled: D.sourceCancelled,
    enfConflict: D.enfConflict,
    rules,
    nReasons: D.nReasons,
    primaryRule: D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : null,
    tags: tagsOf(st, i, D),
    uploaded: !!(st.flags[i] & F.UPLOADED),
    ...im,
    invoiceKindAr: im.invoiceKind ? INVOICE_KIND_SHORT_AR[im.invoiceKind] : null,
    exclusionReason: exclusionOf(D),
    exclusionReasons: exclusionReasonsOf(D),
    // R7: the Mumtathil appeal status; R11: the invoice it repeats; R8 / R9: the file the exclusion came from
    objectionStatus: st.flags[i] & F.OBJECTION ? (() => {
      const x = OBJECTION_STATUS_OF[objectionStatusKey(st, i)];
      return { key: x.key, ar: x.ar, en: x.en, excludes: x.exclude };
    })() : null,
    duplicateOf: st.dupOf?.has(i) ? idOf(st, st.dupOf.get(i)) : null,
    exclusionFile: ctx.ov?.get(i)?.files?.[D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : ""] || null,
    // every exclusion reason the invoice meets (kept side by side, never replaced) and the enforcement orders behind «مرتبطة بأمر تنفيذ مؤكد» — so a list can show the badge and link the order
    exclusionRules: D.mask ? RULE_IDS.filter((_, b) => D.mask & 1 << b) : [],
    enfOrders: D.mask & 1 << RULE_IDS.indexOf("SND-1") ? [...st.exec[i] >= 0 ? [{ enforceNum: st.requests[st.exec[i]].enforceNum, status: st.requests[st.exec[i]].status }] : [], ...((ctx.linkInfo || {})[idOf(st, i)] || []).map((x) => ({ enforceNum: x.enforceNum, status: x.orderStatus }))] : []
  };
}
var SORT_KEYS = { issue: "issue", gross: "gross", outstanding: "outstanding", daysOverdue: "daysOverdue", collected: "collected", exclusionAmount: "exclusionAmount", uncollected: "uncollected", priority: "priority", id: "id" };
var cache = /* @__PURE__ */ new Map();
var hashOf2 = (str3) => {
  let h = 5381;
  for (let i = 0; i < str3.length; i += 1) h = (h * 33 ^ str3.charCodeAt(i)) >>> 0;
  return `${str3.length}.${h.toString(36)}`;
};
function lruGet(k) {
  if (!cache.has(k)) return null;
  const v = cache.get(k);
  cache.delete(k);
  cache.set(k, v);
  return v;
}
function lruSet(k, v) {
  cache.set(k, v);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
}
var epoch = 0;
var bumpEpoch = () => {
  epoch += 1;
  cache.clear();
};
function execMatches(st, ctx, i, exec) {
  const lk = ctx.mark ? ctx.ov.get(i)?.link || 0 : 0;
  const srcCancelled = st.cancelDay[i] !== 0 && st.cancelDay[i] <= ctx.cutoffN;
  return exec === "conflict" ? srcCancelled && (st.exec[i] >= 0 || lk >= 2 || lk === 5) : exec === "inexec" ? lk === 2 : exec === "suspended" ? lk === 3 : exec === "closed" ? lk === 4 : exec === "ever" ? lk >= 2 : exec === "none" ? lk < 2 : exec === "yes" ? st.exec[i] >= 0 || lk >= 2 : exec === "no" ? st.exec[i] < 0 && lk < 2 : true;
}
var PROBLEM_TAGS = /* @__PURE__ */ new Set(["amount_conflict", "contract_unmatched", "contract_unlinked", "missing_fields", "exclusion_pending", "enforcement_candidate"]);
var FACET_KEYS = ["product", "origin", "source", "due"];
var DIM = { product: 1, origin: 2, source: 4, due: 8 };
var NF = 5;
var ALL_SRC = new Uint8Array(SOURCES.length).fill(1);
var DUE_KEYS = ["overdue", "notYetDue", "unknown"];
var DUE_FILTER = { overdue: 0, not_due: 1, unknown: 2 };
var balanceOf = (D) => D.outstanding > 0 ? D.outstanding : D.excluded && D.exclusionAmount > 0 ? D.exclusionAmount : 0;
var dueClassOf = (st, i, D) => balanceOf(D) <= 0 ? -1 : !(st.due[i] > 0) ? 2 : D.daysOverdue > 0 ? 0 : 1;
function candidates(st, req) {
  const ctx = makeCtx(st, req);
  const scFull = resolveScope(ctx, req.scope);
  const f = req.filters || {};
  const srch = resolveSearch(st, f.search, ctx.acc);
  const ageB = f.age && f.age !== "all" ? ["0", "1-30", "31-90", "91-180", "180+"].indexOf(f.age) : -1;
  const stateIdx = f.state && f.state !== "all" && f.state !== "open" && f.state !== "noncollected" && f.state !== "paid" && f.state !== "uncollected" ? CLASS_INDEX[f.state] : -1;
  const catIdx = f.category && f.category !== "all" ? CLASS_INDEX[f.category] : -1;
  const ruleBit = f.rule && f.rule !== "all" && f.rule !== "none" && f.rule !== "any" ? 1 << RULE_IDS.indexOf(f.rule) : 0;
  const cs = f.contract && f.contract !== "all" ? f.contract === "issue" ? -2 : CSTAT.indexOf(f.contract) : -1;
  const periodFilter = !f.allPeriods;
  const nc = f.nc || null;
  const ncO = nc ? newNc() : null;
  const ncN = nc ? ncAsOf(ctx, scFull) : ctx.cutoffN;
  const out = [];
  const sums = { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0, exclusionAmount: 0 };
  const lo = srch?.range ? srch.range[0] : 0;
  const hi = srch?.range ? srch.range[1] : st.n;
  const D = ctx.D;
  const wantF = Array.isArray(req.facets) && req.facets.length ? new Set(req.facets.filter((k) => FACET_KEYS.includes(k))) : null;
  const fProd = f.product && f.product !== "all" && !(Array.isArray(f.product) && !f.product.length) ? new Set([].concat(f.product)) : null;
  const fOrg = f.origin === "central" ? 0 : f.origin === "internal" ? 1 : -1;
  const fSrc = f.source && f.source !== "all" ? f.source : null;
  const dueSel = f.dueState && f.dueState !== "all" ? DUE_FILTER[f.dueState] ?? -2 : -1;
  const dimMode = !!(wantF && wantF.size) || !!fProd || fOrg >= 0 || !!fSrc;
  const sc = dimMode ? { ...scFull, srcOk: ALL_SRC, prodOk: null, scopeIdx: -1 } : scFull;
  const NP = PRODUCT_KEYS.length;
  const NS = SOURCES.length;
  const facet = wantF ? { product: wantF.has("product") ? new Float64Array(NP * NF) : null, origin: wantF.has("origin") ? new Float64Array(2 * NF) : null, source: wantF.has("source") ? new Float64Array(NS * NF) : null, due: wantF.has("due") ? new Float64Array(3 * 4 + 2) : null } : null;
  const byPay = { collected: 0, partial: 0, overdue: 0, not_due: 0, cancelled: 0 };
  let excludedN = 0;
  const addF = (arr, k) => {
    const o = k * NF;
    arr[o] += 1;
    arr[o + 1] += D.collected;
    arr[o + 2] += D.outstanding;
    arr[o + 3] += D.gross;
    arr[o + 4] += D.exclusionAmount;
  };
  const consider = (i) => {
    if (st.issue[i] > ctx.cutoffN) return;
    if (!inScope(st, sc, i)) return;
    if (periodFilter && (st.issue[i] < sc.fromN || st.issue[i] > sc.toN)) return;
    if (cs >= 0 && st.cstat[i] !== cs) return;
    if (cs === -2 && st.cstat[i] !== 2 && st.cstat[i] !== 4) return;
    if (f.exec && f.exec !== "all" && !execMatches(st, ctx, i, f.exec)) return;
    if (f.rule === "none" && st.exMask[i]) return;
    if (f.rule === "any" && !st.exMask[i]) return;
    if (ruleBit && !(st.exMask[i] & ruleBit)) return;
    let bad = 0;
    let oi = 0;
    let pi = 0;
    if (dimMode) {
      oi = originIdxOf(st.ent[i], st.scope[i]);
      pi = productIdxOf(st.src[i], st.item[i], oi);
      if (!(scFull.srcOk[st.src[i]] === 1 && (!fSrc || SOURCES[st.src[i]].key === fSrc))) bad |= DIM.source;
      if (!((!scFull.prodOk || scFull.prodOk[pi] === 1) && (!fProd || fProd.has(PRODUCT_KEYS[pi])))) bad |= DIM.product;
      if (!((scFull.scopeIdx < 0 || oi === scFull.scopeIdx) && (fOrg < 0 || oi === fOrg))) bad |= DIM.origin;
      if (bad && (!wantF || bad & bad - 1)) return;
    }
    derive(ctx, i, ncN);
    if (sc.statusSet && !sc.statusSet[D.cls]) return;
    if (stateIdx >= 0 && D.cls !== stateIdx) return;
    if (catIdx >= 0 && D.cls !== catIdx) return;
    if (f.state === "open" && !(D.outstanding > 0)) return;
    if (f.state === "noncollected" && D.cls === CLASS_INDEX.collected) return;
    if (f.state === "paid" && D.cls !== CLASS_INDEX.collected && D.cls !== CLASS_INDEX.partial) return;
    if (f.state === "uncollected" && !(D.outstanding > 0 || D.excluded && D.exclusionAmount > 0)) return;
    if (ageB >= 0 && !(D.outstanding > 0 && agingBucket(D.daysOverdue) === ageB)) return;
    if (f.ageMin != null && !(D.outstanding > 0 && !D.excluded && D.daysOverdue >= f.ageMin && D.daysOverdue <= f.ageMax)) return;
    if (f.eligible && !(D.outstanding > 0 && D.daysOverdue > 0 && !D.excluded && !D.cancelled && D.link < 2 && st.exec[i] < 0 && !(st.flags[i] & (F.MISSING_ID | F.OBJECTION)) && D.cls !== CLASS_INDEX.linkage_unresolved)) return;
    if (f.primary && f.primary !== "all" && !(D.excluded && D.primaryBit && (f.primary === "any" || RULE_IDS[Math.round(Math.log2(D.primaryBit))] === f.primary))) return;
    if (f.reason && f.reason !== "all") {
      const xr = exclusionOf(D);
      if (f.reason === "none" ? D.excluded : f.reason === "any" ? !D.excluded : !xr || xr.ruleId !== f.reason) return;
    }
    if (f.payStatus && f.payStatus !== "all" && D.payStatus !== f.payStatus) return;
    if (f.kind && f.kind !== "all" && iimFields(st, i).invoiceKind !== f.kind) return;
    if (nc && !ncMatches(st, i, D, nc, ncO)) return;
    if (f.planLine && !planLineMatches(st, ctx, i, D, f.planLine)) return;
    if (f.tag) {
      const tg = tagsOf(st, i, D);
      if (f.tag === "problem" ? !tg.some((x) => PROBLEM_TAGS.has(x)) : !tg.includes(f.tag)) return;
    }
    const dc = dueClassOf(st, i, D);
    if (dueSel !== -1 && dc !== dueSel) bad |= DIM.due;
    if (bad & bad - 1) return;
    if (bad && !wantF) return;
    if (!bad) {
      out.push(i);
      sums.count += 1;
      sums.gross += D.gross;
      sums.exclusions += D.exclTotal;
      sums.net += D.net;
      sums.collected += D.collected;
      sums.outstanding += D.outstanding;
      sums.exclusionAmount += D.exclusionAmount;
      byPay[D.payStatus] += 1;
      if (D.excluded && D.exclusionAmount > 0) excludedN += 1;
    }
    if (facet) {
      if (facet.product && (!bad || bad === DIM.product)) addF(facet.product, pi);
      if (facet.origin && (!bad || bad === DIM.origin)) addF(facet.origin, oi);
      if (facet.source && (!bad || bad === DIM.source)) addF(facet.source, st.src[i]);
      if (facet.due && dc >= 0 && (!bad || bad === DIM.due)) {
        const o = dc * 4;
        if (D.excluded) {
          facet.due[o + 2] += 1;
          facet.due[o + 3] += D.exclusionAmount;
          facet.due[12] += 1;
          facet.due[13] += D.exclusionAmount;
        } else {
          facet.due[o] += 1;
          facet.due[o + 1] += D.outstanding;
        }
      }
    }
  };
  if (srch?.list) {
    for (const i of srch.list) consider(i);
  } else if (srch?.range) {
    for (let i = lo; i < hi; i += 1) consider(i);
  } else {
    const fxSet = srch?.fixtures ? new Set(srch.fixtures) : null;
    for (let i = 0; i < st.n; i += 1) {
      if (srch) {
        if (i < st.nGen) {
          if (!(srch.payer && srch.payer[st.payer[i]])) continue;
        } else if (!fxSet.has(i)) continue;
      }
      consider(i);
    }
  }
  return { ctx, sc: scFull, cand: Int32Array.from(out), sums, facets: facet ? facetOut(facet) : null, population: populationOf(f, sums, byPay, excludedN) };
}
var bucketOut = (arr, k, key, lab) => {
  const o = k * NF;
  return { key, labelAr: lab.ar, labelEn: lab.en, count: arr[o], collected: arr[o + 1], outstanding: arr[o + 2], gross: arr[o + 3], exclusionAmount: arr[o + 4] };
};
function facetOut(fc) {
  const r = {};
  const keep = (x) => x.count > 0;
  if (fc.product) r.product = PRODUCT_KEYS.map((k, n) => bucketOut(fc.product, n, k, PRODUCTS[k])).filter(keep);
  if (fc.origin) r.origin = ["central", "internal"].map((k, n) => bucketOut(fc.origin, n, k, { ar: ORIGIN_AR[k], en: ORIGIN_EN[k] })).filter(keep);
  if (fc.source) r.source = SOURCES.map((s, n) => bucketOut(fc.source, n, s.key, REVENUE_SOURCES[s.key] || { ar: s.key, en: s.key })).filter(keep);
  if (fc.due) {
    const d = fc.due;
    r.due = {};
    DUE_KEYS.forEach((k, n) => {
      r.due[k] = { count: d[n * 4], amount: d[n * 4 + 1], excludedCount: d[n * 4 + 2], excludedAmount: d[n * 4 + 3] };
    });
    r.due.excluded = { count: d[12], amount: d[13] };
  }
  return r;
}
var POPULATIONS = {
  all: { ar: "\u0643\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0641\u064A \u0627\u0644\u0646\u0637\u0627\u0642", en: "Every invoice in scope", includes: ["collected", "partial", "open", "excluded", "cancelled"] },
  paid: { ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u062D\u064F\u0635\u0651\u0644 \u0645\u0646\u0647\u0627 \u0645\u0628\u0644\u063A (\u0643\u0644\u064A\u0627\u064B \u0623\u0648 \u062C\u0632\u0626\u064A\u0627\u064B)", en: "Invoices with money collected (in full or in part)", includes: ["collected", "partial"] },
  collected: { ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0633\u062F\u0651\u062F\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644", en: "Fully paid invoices", includes: ["collected"] },
  partial: { ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0633\u062F\u0651\u062F\u0629 \u062C\u0632\u0626\u064A\u0627\u064B", en: "Partly paid invoices", includes: ["partial"] },
  uncollected: { ar: "\u0643\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 (\u064A\u0634\u0645\u0644 \u0627\u0644\u0645\u0633\u062A\u0628\u0639\u062F)", en: "Every uncollected invoice (excluded included)", includes: ["open", "partial", "excluded"] },
  open: { ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0639\u0644\u064A\u0647\u0627 \u0631\u0635\u064A\u062F \u063A\u064A\u0631 \u0645\u0633\u062F\u064E\u0651\u062F (\u062F\u0648\u0646 \u0627\u0644\u0645\u0633\u062A\u0628\u0639\u062F)", en: "Invoices with an unpaid balance (excluded not included)", includes: ["open", "partial"] },
  noncollected: { ar: "\u0643\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644", en: "Every invoice not fully collected", includes: ["open", "partial", "excluded", "cancelled"] }
};
function populationOf(f, sums, byPay, excludedN) {
  const key = POPULATIONS[f.state] ? f.state : "all";
  const p = POPULATIONS[key];
  return { key, labelAr: p.ar, labelEn: p.en, includes: p.includes, count: sums.count, fullyPaid: byPay.collected, partlyPaid: byPay.partial, unpaid: byPay.overdue + byPay.not_due, excluded: excludedN, cancelled: byPay.cancelled };
}
function list(st, req) {
  const page = Math.max(0, Number(req.page) || 0);
  const size = Math.min(500, Math.max(1, Number(req.pageSize) || 50));
  const sortKey = SORT_KEYS[req.sort?.key] || "issue";
  const dir = req.sort?.dir === "asc" ? 1 : -1;
  const facetReq = Array.isArray(req.facets) ? FACET_KEYS.filter((k) => req.facets.includes(k)).join(",") : "";
  const ck = JSON.stringify([epoch, accessKeyOf(req.access), req.scope, req.cfg, req.filters, facetReq, req.decisions && hashOf2(JSON.stringify(req.decisions)), req.links && hashOf2(JSON.stringify(req.links)), req.fileExclusions && hashOf2(JSON.stringify(req.fileExclusions)), req.owner, sortKey, dir]);
  let hit = lruGet(ck);
  if (!hit) {
    const { ctx: ctx2, cand, sums, facets, population } = candidates(st, { ...req, facets: facetReq ? facetReq.split(",") : null });
    let order;
    if (sortKey === "id") {
      order = Int32Array.from(cand);
      if (dir < 0) order.reverse();
    } else {
      const keys = new Float64Array(cand.length);
      let thr2 = null;
      let maxAmt = 1;
      let maxAge = 1;
      if (sortKey === "priority") {
        thr2 = amountThresholds(st, req);
        for (let j = 0; j < cand.length; j += 1) {
          derive(ctx2, cand[j], ctx2.cutoffN);
          const bal = balanceOf(ctx2.D);
          if (bal > maxAmt) maxAmt = bal;
          if (ctx2.D.daysOverdue > maxAge && st.due[cand[j]] > 0) maxAge = ctx2.D.daysOverdue;
        }
      }
      for (let j = 0; j < cand.length; j += 1) {
        const i = cand[j];
        if (sortKey === "issue") keys[j] = st.issue[i];
        else if (sortKey === "gross") keys[j] = st.gross[i];
        else {
          derive(ctx2, i, ctx2.cutoffN);
          const D = ctx2.D;
          keys[j] = sortKey === "outstanding" ? D.outstanding : sortKey === "collected" ? D.collected : sortKey === "exclusionAmount" ? D.exclusionAmount : sortKey === "uncollected" ? D.outstanding + D.exclusionAmount : sortKey === "priority" ? priorityKey(st, i, D, thr2, maxAmt, maxAge) : D.outstanding > 0 ? D.daysOverdue : 0;
        }
      }
      const perm = new Uint32Array(cand.length);
      for (let j = 0; j < perm.length; j += 1) perm[j] = j;
      perm.sort((a, b) => (keys[a] - keys[b]) * dir || a - b);
      order = new Int32Array(cand.length);
      for (let j = 0; j < perm.length; j += 1) order[j] = cand[perm[j]];
    }
    hit = { order, sums, total: cand.length, facets, population };
    lruSet(ck, hit);
  }
  const ctx = makeCtx(st, req);
  const ncN = req.withNc ? ncAsOf(ctx, resolveScope(ctx, req.scope)) : ctx.cutoffN;
  const thr = req.withPriority ? amountThresholds(st, req) : null;
  const nco = req.withPriority ? newNc() : null;
  const rows = [];
  for (let j = page * size; j < Math.min(hit.total, (page + 1) * size); j += 1) {
    const i = hit.order[j];
    derive(ctx, i, ncN);
    const row = rowOut(st, ctx, i, ctx.D);
    row.uncollected = row.outstanding + row.exclusionAmount;
    if (req.withNc) row.nc = ncRow(st, ctx, i, ctx.D);
    if (req.withPriority) {
      Object.assign(row, priorityRow(st, i, ctx.D, thr, nco));
    }
    if (req.withExclusions) {
      const D = ctx.D;
      row.exclusions = materialize(st, i, ctx).exclusions;
      row.cancelled = D.cancelled;
      row.excluded = D.excluded;
      row.billedAfterAdj = D.billed;
      row.reasonRules = RULE_IDS.filter((_, b) => D.mask & 1 << b);
      row.primaryRuleId = D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : null;
    }
    rows.push(row);
  }
  const res = { total: hit.total, page, pageSize: size, sums: hit.sums, population: hit.population, rows };
  if (hit.facets) res.facets = hit.facets;
  return res;
}
var thrCache = /* @__PURE__ */ new WeakMap();
var PRIORITY_RULES = { amountPercentiles: { medium: 0.75, large: 0.9 }, severeDays: 180, lateDays: 90, youngDays: 30, evidenceMin: 0.8 };
function amountThresholds(st, req) {
  const ctx = makeCtx(st, { cfg: req.cfg, owner: 0 });
  const key = `${epoch}|${ctx.cutoffN}|${ctx.graceDays}|${st.n}`;
  const c = thrCache.get(st);
  if (c && c.key === key) return c.thr;
  const step = Math.max(1, Math.floor(st.n / 1e5));
  const vals = [];
  const D = ctx.D;
  for (let i = 0; i < st.n; i += step) {
    if (st.owner[i] !== 0 || st.issue[i] > ctx.cutoffN) continue;
    derive(ctx, i, ctx.cutoffN);
    if (D.outstanding > 0 && !D.excluded && !D.cancelled) vals.push(D.outstanding);
  }
  vals.sort((a, b) => a - b);
  const at = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))] : Infinity;
  const thr = { medium: at(PRIORITY_RULES.amountPercentiles.medium), large: at(PRIORITY_RULES.amountPercentiles.large), n: vals.length };
  thrCache.set(st, { key, thr });
  return thr;
}
var LEVEL_RANK = { low: 0, medium: 1, high: 2 };
function priorityCore(st, i, D, thr) {
  const bal = balanceOf(D);
  if (bal <= 0) return null;
  const amt = bal >= thr.large ? 2 : bal >= thr.medium ? 1 : 0;
  const unknown = !(st.due[i] > 0);
  const days = unknown ? 0 : D.daysOverdue;
  const age = days > 180 ? 4 : days > 90 ? 3 : days > 30 ? 2 : days > 0 ? 1 : 0;
  if (D.excluded) return { level: "low", amt, age, days, code: "excluded", bal };
  if (unknown) return { level: amt === 2 ? "medium" : "low", amt, age: 0, days: 0, code: "unknown", bal };
  if (age === 0) return { level: "low", amt, age, days, code: "not_due", bal };
  let level = age === 4 && amt >= 1 || amt === 2 && age >= 2 ? "high" : age >= 3 || amt >= 1 ? "medium" : "low";
  let code = level;
  if (level === "high") {
    if (evidenceQuality(st, i, D) < PRIORITY_RULES.evidenceMin) {
      level = "medium";
      code = "cap_evidence";
    } else if (D.cls === CLASS_INDEX.objection) {
      level = "medium";
      code = "cap_objection";
    }
  }
  return { level, amt, age, days, code, bal };
}
function priorityKey(st, i, D, thr, maxAmt, maxAge) {
  const p = priorityCore(st, i, D, thr);
  if (!p) return -1;
  const ev = evidenceQuality(st, i, D);
  const act = ACT[CLASSES[D.cls]] ?? 0.3;
  return LEVEL_RANK[p.level] * 10 + (W_.amount * (p.bal / maxAmt) + W_.aging * (p.days / maxAge) + W_.actionability * act + W_.evidence * ev);
}
var AMT_WORD = [{ ar: "\u0645\u0628\u0644\u063A \u0635\u063A\u064A\u0631", en: "a small amount" }, { ar: "\u0645\u0628\u0644\u063A \u0645\u062A\u0648\u0633\u0637", en: "a medium amount" }, { ar: "\u0645\u0628\u0644\u063A \u0643\u0628\u064A\u0631", en: "a large amount" }];
var AMT_RULE = [{ ar: "\u0623\u0642\u0644 \u0645\u0646 \u0623\u0639\u0644\u0649 25\u066A \u0645\u0646 \u0627\u0644\u0623\u0631\u0635\u062F\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F\u0629", en: "below the top 25% of unpaid balances" }, { ar: "\u0636\u0645\u0646 \u0623\u0639\u0644\u0649 25\u066A \u0645\u0646 \u0627\u0644\u0623\u0631\u0635\u062F\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F\u0629", en: "in the top 25% of unpaid balances" }, { ar: "\u0636\u0645\u0646 \u0623\u0639\u0644\u0649 10\u066A \u0645\u0646 \u0627\u0644\u0623\u0631\u0635\u062F\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u062F\u0629", en: "in the top 10% of unpaid balances" }];
var AGE_WORD = [null, { ar: "\u0645\u062A\u0623\u062E\u0631 1\u201330 \u064A\u0648\u0645\u0627\u064B", en: "overdue 1\u201330 days" }, { ar: "\u0645\u062A\u0623\u062E\u0631 31\u201390 \u064A\u0648\u0645\u0627\u064B", en: "overdue 31\u201390 days" }, { ar: "\u0645\u062A\u0623\u062E\u0631 91\u2013180 \u064A\u0648\u0645\u0627\u064B", en: "overdue 91\u2013180 days" }, { ar: "\u0645\u062A\u0623\u062E\u0631 \u0623\u0643\u062B\u0631 \u0645\u0646 180 \u064A\u0648\u0645\u0627\u064B", en: "overdue more than 180 days" }];
var EXCLUDED_NEXT = { ar: "\u0645\u0633\u062A\u0628\u0639\u062F\u0629 \u0645\u0646 \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644 \u2014 \u0644\u0627 \u0625\u062C\u0631\u0627\u0621 \u062A\u062D\u0635\u064A\u0644\u061B \u0631\u0627\u062C\u0639 \u0633\u0628\u0628 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F", en: "Excluded from net uncollected \u2014 no collection action; see the exclusion reason" };
function whyOf(p) {
  const A = AMT_WORD[p.amt];
  const G = AGE_WORD[p.age];
  switch (p.code) {
    case "excluded":
      return { ar: "\u0645\u0633\u062A\u0628\u0639\u062F\u0629 \u2014 \u0644\u0627 \u0625\u062C\u0631\u0627\u0621 \u062A\u062D\u0635\u064A\u0644 \u0639\u0644\u064A\u0647\u0627", en: "Excluded \u2014 no collection action" };
    case "unknown":
      return { ar: `${A.ar}\u060C \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0641\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0642\u062F\u064A\u0631 \u0627\u0644\u062A\u0623\u062E\u0631`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)}; the due date is unavailable, so lateness cannot be assessed` };
    case "not_due":
      return { ar: "\u0644\u0645 \u064A\u062D\u0646 \u0645\u0648\u0639\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0628\u0639\u062F", en: "Not yet due" };
    case "cap_evidence":
      return { ar: `${A.ar} \u0648${G.ar}\u060C \u0644\u0643\u0646 \u0627\u0644\u062F\u0644\u064A\u0644 \u0646\u0627\u0642\u0635 \u2014 \u062A\u064F\u062D\u0633\u0645 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0648\u0644\u0627\u064B`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)} and ${G.en}, but the evidence is incomplete \u2014 settle the data first` };
    case "cap_objection":
      return { ar: `${A.ar} \u0648${G.ar}\u060C \u0644\u0643\u0646 \u0639\u0644\u064A\u0647\u0627 \u0627\u0639\u062A\u0631\u0627\u0636 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)} and ${G.en}, but an objection is under review` };
    default:
      return { ar: `${A.ar} \u0648${G.ar}`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)}, ${G.en}` };
  }
}
function priorityRow(st, i, D, thr, nco) {
  const p = priorityCore(st, i, D, thr);
  if (!p) return { priority: null, nextStep: null };
  const ev = evidenceQuality(st, i, D);
  const factors = [
    { label: { ar: "\u0627\u0644\u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062F\u0651\u062F", en: "Unpaid amount" }, value: { ar: `${AMT_WORD[p.amt].ar.replace("\u0645\u0628\u0644\u063A ", "")} (${AMT_RULE[p.amt].ar})`, en: `${["Small", "Medium", "Large"][p.amt]} (${AMT_RULE[p.amt].en})` } },
    { label: { ar: "\u0645\u0648\u0642\u0641 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642", en: "Due position" }, value: p.code === "unknown" ? { ar: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D", en: "Due date unavailable" } : p.age ? AGE_WORD[p.age] : { ar: "\u0644\u0645 \u064A\u062D\u0646 \u0628\u0639\u062F", en: "Not yet due" } },
    { label: { ar: "\u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u062F\u0644\u064A\u0644", en: "Evidence" }, value: ev >= PRIORITY_RULES.evidenceMin ? { ar: "\u0645\u0643\u062A\u0645\u0644", en: "Complete" } : { ar: "\u0646\u0627\u0642\u0635", en: "Incomplete" } }
  ];
  if (D.excluded) factors.push({ label: { ar: "\u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F", en: "Exclusion" }, value: { ar: "\u0645\u0633\u062A\u0628\u0639\u062F\u0629", en: "Excluded" } });
  let nextStep = EXCLUDED_NEXT;
  if (!D.excluded) {
    ncClassify(st, i, D, nco);
    const g = GROUPS[nco.group];
    nextStep = g ? { ar: g.nextStepAr, en: g.nextStepEn } : null;
  }
  return { priority: { level: p.level, why: whyOf(p), factors }, nextStep };
}
var EXPORT_COLUMNS = ["invoice_id", "sadad_no", "issue_date", "due_date", "amanah_en", "amanah_ar", "municipality_ar", "scope", "revenue_source", "supplying_system", "revenue_item", "amount_sar", "collected_sar", "outstanding_sar", "cancelled_sar", "excluded_sar", "exclusions_sar", "net_billed_sar", "uncollected_sar", "collection_class", "status_tahseel_raw", "status_efaa_raw", "days_overdue", "contract_no", "exclusion_rules", "line_items", "demo_data", "invoice_number", "gfs_code", "amanah_id", "municipality_id", "invoice_composite_key", "exclusion_reason_ar", "exclusion_reason_en", "payment_status", "priority", "exclusion_flag", "municipality_ref_id", "municipality_status", "municipality_source_value"];
var q = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function* exportChunks(st, req, chunk = 4e3) {
  const { ctx, cand } = candidates(st, { ...req, facets: null });
  const thr = amountThresholds(st, req);
  yield `\uFEFF# \u064A\u0634\u0645\u0644 \u0643\u0644 \u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0645\u0635\u0641\u0651\u0627\u0629 (${cand.length}) \u2014 includes all ${cand.length} filtered results \xB7 demo data: synthetic, inspired by the monthly reports \u2014 not the Ministry's actual data. Amounts are exact values in SAR
${EXPORT_COLUMNS.join(",")}
`;
  let buf = [];
  for (let j = 0; j < cand.length; j += 1) {
    const i = cand[j];
    derive(ctx, i, ctx.cutoffN);
    const r = rowOut(st, ctx, i, ctx.D);
    const sadad = i < st.nGen ? sadadOf(st.idKey[i]) : st.fixtures.get(i)?.sadadNo || "";
    const pr = priorityCore(st, i, ctx.D, thr);
    buf.push([r.id, sadad, r.issueDate, r.dueDate, r.amanahEn, r.amanahAr, r.municipalityAr || "", r.scopeType, r.source, r.platform, r.itemEn, r.gross, r.collected, r.outstanding, r.cancelledAmount, r.exclusionAmount, r.exclusions, r.net, r.outstanding, r.cls, r.statusRawTahseel, r.statusRawEfaa || "", r.daysOverdue, r.contractNo || "", r.rules.join("|"), r.lines, "\u062A\u062C\u0631\u064A\u0628\u064A\u0629", r.invoiceNo, r.gfsCode || "", r.amanahId || "", r.municipalityId || "", r.compositeKey || "", r.exclusionReason?.reasonAr || "", r.exclusionReason?.reasonEn || "", r.payStatus, pr ? pr.level : "", r.exclusionAmount > 0 ? "excluded" : "", r.municipalityRefId || "", r.municipalityStatus || "", r.municipalitySourceValue || ""].map(q).join(","));
    if (buf.length >= chunk) {
      yield `${buf.join("\n")}
`;
      buf = [];
    }
  }
  if (buf.length) yield `${buf.join("\n")}
`;
}
var ACT = { excluded: 0.05, overdue: 1, partial: 0.85, linkage_unresolved: 0.5, ineligible_referral: 0.35, enforcement: 0.45, objection: 0.2, not_due: 0.1 };
var W_ = { amount: 0.4, aging: 0.25, actionability: 0.25, evidence: 0.1 };
function evidenceQuality(st, i, D) {
  let qv = 1;
  const f = st.flags[i];
  const cs = st.cstat[i];
  if (f & F.AMT_CONFLICT) qv -= 0.4;
  if (f & F.MISSING_ID) qv -= 0.25;
  if (st.src[i] === 0 && (cs === 4 || cs === 2)) qv -= 0.2;
  if (cs === 5) qv -= 0.05;
  if (D.pendingMask) qv -= 0.1;
  return Math.max(0.1, qv);
}
function worklist(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const D = ctx.D;
  const limit = Math.min(500, req.limit || 100);
  let maxAmt = 1;
  let maxAge = 1;
  let total = 0;
  let totalOut = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    var top2 = pass === 1 ? new TopK(limit) : null;
    for (let i = 0; i < st.n; i += 1) {
      if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
      derive(ctx, i, ctx.cutoffN);
      const exIn = D.excluded && req.includeExcluded;
      const bal = exIn ? D.exclusionAmount : D.outstanding;
      if (!exIn && (!(D.outstanding > 0) || D.excluded || D.cls === CLASS_INDEX.collected)) continue;
      if (!(bal > 0)) continue;
      if (sc.statusSet && !sc.statusSet[D.cls]) continue;
      if (req.category && req.category !== "all" && CLASSES[D.cls] !== req.category) continue;
      if (req.payStatus && req.payStatus !== "all" && D.payStatus !== req.payStatus) continue;
      if (req.exec && req.exec !== "all" && !execMatches(st, ctx, i, req.exec)) continue;
      if (req.kind && req.kind !== "all" && iimFields(st, i).invoiceKind !== req.kind) continue;
      if (req.reason && req.reason !== "all") {
        const xr = exclusionOf(D);
        if (req.reason === "none" ? D.excluded : req.reason === "any" ? !D.excluded : !xr || xr.ruleId !== req.reason) continue;
      }
      if (pass === 0) {
        total += 1;
        totalOut += bal;
        if (bal > maxAmt) maxAmt = bal;
        if (D.daysOverdue > maxAge) maxAge = D.daysOverdue;
        continue;
      }
      const ev = evidenceQuality(st, i, D);
      const act = ACT[CLASSES[D.cls]] ?? 0.3;
      top2.push(i, W_.amount * (bal / maxAmt) + W_.aging * (D.daysOverdue / maxAge) + W_.actionability * act + W_.evidence * ev);
    }
    if (pass === 1) {
      const rows = top2.sorted().map(([i, score]) => {
        derive(ctx, i, ctx.cutoffN);
        const r = rowOut(st, ctx, i, D);
        return { ...r, category: r.cls, uncollected: r.outstanding + r.exclusionAmount, actionability: ACT[r.cls] ?? 0.3, evidenceQuality: Math.round(evidenceQuality(st, i, D) * 100) / 100, score: Math.round(score * 1e3) / 1e3 };
      });
      return { total, totalOutstanding: totalOut, rows };
    }
  }
  return null;
}
function anomalies(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const D = ctx.D;
  const limit = Math.min(300, req.limit || 100);
  const top2 = new TopK(limit);
  const counts = {};
  let total = 0;
  const bump3 = (k) => {
    counts[k] = (counts[k] || 0) + 1;
  };
  const group2 = Array.isArray(req.codes) && req.codes.length ? new Set(req.codes) : null;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
    derive(ctx, i, ctx.cutoffN);
    const f = st.flags[i];
    const found = [];
    if (f & F.AMT_CONFLICT) found.push(["amount_conflict", 3]);
    if (D.pendingMask) found.push(["exclusion_pending", 2]);
    if (f & F.MISSING_ID) found.push(["missing_fields", 2]);
    if (st.src[i] === 0 && st.cstat[i] === 4) found.push(["contract_unlinked", 2]);
    if (st.src[i] === 0 && st.cstat[i] === 2) found.push(["contract_unmatched", 2]);
    if (D.link === 1) found.push(["enforcement_candidate", 2]);
    if (D.excluded && D.received > 0) found.push(["receipts_on_excluded", 3]);
    if (st.src[i] === 0) {
      const oc = investmentOutcome(st, i, iimFields(st, i));
      if (oc === "not_linked") found.push(["investment_no_contract", 2]);
    }
    const inGroup = group2 ? found.filter(([c]) => group2.has(c)) : found;
    let sev = 0;
    const codes = [];
    for (const [c, v] of inGroup) {
      codes.push(c);
      sev = Math.max(sev, v);
    }
    for (const c of codes) bump3(c);
    if (sev && (!req.code || req.code === "all" || codes.includes(req.code))) {
      total += 1;
      top2.push(i, sev * 1e12 + st.gross[i]);
    }
  }
  const rows = top2.sorted().map(([i]) => {
    derive(ctx, i, ctx.cutoffN);
    return rowOut(st, ctx, i, D);
  });
  return { total, counts, rows };
}

// server/misc.js
function meta(st, today, access) {
  const tab = accessTable(access);
  const y = today.slice(0, 4);
  const yN = dayNum(`${y}-01-01`);
  const pyN = dayNum(`${Number(y) - 1}-01-01`);
  const pyEnd = dayNum(`${Number(y) - 1}${today.slice(4)}`);
  let ytd = 0;
  let prior = 0;
  let priorSamePeriod = 0;
  let lines = 0;
  let ytdLines = 0;
  let all = 0;
  const todayN = dayNum(today);
  for (let i = 0; i < st.n; i += 1) {
    if (st.owner[i] !== 0 || !isVisible(st, i, tab)) continue;
    all += 1;
    lines += st.lines[i];
    const d = st.issue[i];
    if (d >= yN && d <= todayN) {
      ytd += 1;
      ytdLines += st.lines[i];
    }
    if (d >= pyN && d < yN) prior += 1;
    if (d >= pyN && d <= pyEnd) priorSamePeriod += 1;
  }
  let pays = 0;
  let paysAll = st.pn;
  if (tab.all) {
    for (let p = 0; p < st.pn; p += 1) if (st.pDay[p] >= yN && st.pDay[p] <= todayN) pays += 1;
  } else {
    paysAll = 0;
    for (let i = 0; i < st.n; i += 1) {
      if (st.owner[i] !== 0 || !isVisible(st, i, tab)) continue;
      for (let p = st.payStart[i]; p < st.payStart[i] + st.payCount[i]; p += 1) {
        paysAll += 1;
        if (st.pDay[p] >= yN && st.pDay[p] <= todayN) pays += 1;
      }
    }
  }
  const cts = tab.all ? st.contracts.filter(Boolean).length : st.contracts.filter((c) => c && contractVisible(st, c, tab)).length;
  const reqs = tab.all ? st.requests : st.requests.filter((q3) => requestVisible(st, q3, tab));
  let fixtures = st.nGen < st.n ? st.n - st.nGen : 0;
  if (!tab.all) {
    fixtures = 0;
    for (let i = st.nGen; i < st.n; i += 1) if (isVisible(st, i, tab)) fixtures += 1;
  }
  return {
    today,
    timezone: "Asia/Riyadh",
    demo: true,
    label: { ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629", en: "Demo data" },
    labelDetail: { ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0645\u0633\u062A\u0648\u062D\u0627\u0629 \u0645\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629\u060C \u0648\u0644\u064A\u0633\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0639\u0644\u064A\u0629 \u0644\u0644\u0648\u0632\u0627\u0631\u0629.", en: "Synthetic data inspired by the monthly reports \u2014 not the Ministry's actual data." },
    counts: { invoicesTotal: all, invoicesYtd: ytd, invoicesPriorYear: prior, invoicesPriorSamePeriod: priorSamePeriod, lineItemsTotal: lines, lineItemsYtd: ytdLines, paymentsYtd: pays, paymentsTotal: paysAll, contracts: cts, sanadRequests: reqs.filter((r) => (r.system || "sanad") === "sanad").length, whiteLandsOrders: reqs.filter((r) => r.system === "white_lands").length, fixtures },
    period: { from: isoOf(dayNum(`${y}-01-01`)), to: today, priorFrom: isoOf(pyN), priorTo: isoOf(pyEnd), dataFrom: isoOf(Math.min(...[st.issue[0] || yN])) },
    size: st.meta.size || "full",
    sizeNote: st.meta.size === "compact" ? { ar: `\u0639\u064A\u0646\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0645\u0635\u063A\u0651\u0631\u0629: ${all.toLocaleString("en-US")} \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0628\u0645\u0628\u0627\u0644\u063A \u0643\u0628\u064A\u0631\u0629 \u062A\u062D\u0641\u0638 \u0625\u062C\u0645\u0627\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629\u061B \u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0627 \u064A\u0645\u062B\u0644 \u0627\u0644\u062D\u062C\u0645 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0627\u0644\u0641\u0639\u0644\u064A.`, en: `Compact synthetic sample: ${all.toLocaleString("en-US")} synthetic invoices with large values that keep the monthly-report totals; the invoice count does not represent actual operational volume.` } : null,
    generation: tab.all ? st.meta : { ...st.meta, contracts: cts, requests: reqs.length }
  };
}
function quality(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const D = ctx.D;
  const q3 = { records: 0, conflicts: 0, pending: 0, missing: 0, contractUnmatched: 0, contractConfirmedNone: 0, efaaDifferent: 0, efaaTotal: 0, centralInvoices: 0, internalInvoices: 0, lines: 0, investmentInvoices: 0, installmentsInvoiced: 0 };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    q3.records += 1;
    q3.lines += st.lines[i];
    if (st.scope[i] === 0) q3.centralInvoices += 1;
    else q3.internalInvoices += 1;
    if (st.flags[i] & F.AMT_CONFLICT) q3.conflicts += 1;
    if (st.flags[i] & F.MISSING_ID) q3.missing += 1;
    if (st.exMask[i] & ~st.exAppr[i]) q3.pending += 1;
    if (st.src[i] === 0) {
      q3.investmentInvoices += 1;
      if (st.cstat[i] === 2) q3.contractUnmatched += 1;
      if (st.cstat[i] === 3) q3.contractConfirmedNone += 1;
      if (st.contract[i] >= 0) q3.installmentsInvoiced += 1;
    }
    if (st.efaa[i]) {
      q3.efaaTotal += 1;
      if (st.efaa[i] >= 3) q3.efaaDifferent += 1;
    }
  }
  const tab = ctx.acc;
  const visReq = tab.all ? st.requests : st.requests.filter((r) => requestVisible(st, r, tab));
  const visCt = tab.all ? st.contracts : st.contracts.map((c) => c && contractVisible(st, c, tab) ? c : null);
  const sanad = visReq.filter((r) => (r.system || "sanad") === "sanad");
  const ocrLow = sanad.filter((r) => r.method === 1 && r.confidence < 0.8).length;
  const future = visCt.reduce((s, c) => s + (c ? c.dues.filter((d) => d.inv < 0 && d.due - 10 > ctx.cutoffN).length : 0), 0);
  let crKnown = st.crView.size;
  if (!tab.all) {
    const crs = /* @__PURE__ */ new Set();
    for (const c of visCt) if (c && c.crNo) crs.add(c.crNo);
    for (const r of sanad) if (r.crNo) crs.add(r.crNo);
    crKnown = [...crs].filter((x) => st.crView.has(x)).length;
  }
  return { ...q3, requests: sanad.length, requestsIdentified: sanad.filter((r) => r.identified.length).length, whiteLandsOrders: visReq.length - sanad.length, ocrCrChains: sanad.filter((r) => r.method === 1).length, crChains: sanad.length, crChainsMatched: sanad.filter((r) => st.crView.has(r.crNo)).length, ocrLowConfidence: ocrLow, futureInstallments: future, crViewKnown: crKnown, void: D.gross };
}

// server/sourcesReport.js
var shiftYear = (iso, d) => `${Number(iso.slice(0, 4)) + d}${iso.slice(4)}`;
function sourcesReport(st, req = {}) {
  const ctx = makeCtx(st, req);
  const D = ctx.D;
  const tab = ctx.acc;
  const today = ctx.cfg.cutoff;
  const y = today.slice(0, 4);
  const range = { ytd: [dayNum(`${y}-01-01`), ctx.cutoffN], prior: [dayNum(`${Number(y) - 1}-01-01`), dayNum(shiftYear(today, -1))] };
  const NS = SOURCES.length;
  const mk = () => ({ invoices: 0, lines: 0, payments: 0, gross: 0, grossCancelled: 0, wallet: 0, replacedPairs: 0, ownersMulti: 0, ext: [0, 0, 0, 0], objections: 0, billStatus: [0, 0, 0, 0], valuesDiffer: 0, paidOverGross: 0, amtConflict: 0, enforcement: 0, internal: 0, central: 0, items: {} });
  const acc = { ytd: Array.from({ length: NS }, mk), prior: Array.from({ length: NS }, mk), all: Array.from({ length: NS }, mk) };
  const checks = { idsStrictlyIncreasing: true, duplicateIds: 0, tobaccoPairsBroken: 0, whiteLandGroupsBroken: 0, groupShareNot100: 0, cancelledAndExcludedOverlap: 0 };
  let prevKey = -1;
  let otherYtd = 0;
  for (let i = 0; i < st.nGen; i += 1) {
    const k = st.idKey[i];
    if (k <= prevKey) {
      checks.idsStrictlyIncreasing = false;
      if (k === prevKey) checks.duplicateIds += 1;
    }
    prevKey = k;
    if (!isVisible(st, i, tab)) continue;
    const s = st.src[i];
    const a = [acc.all[s]];
    const iss = st.issue[i];
    if (iss >= range.ytd[0] && iss <= range.ytd[1]) a.push(acc.ytd[s]);
    if (iss >= range.prior[0] && iss <= range.prior[1]) a.push(acc.prior[s]);
    derive(ctx, i, ctx.cutoffN);
    if (iss >= range.ytd[0] && iss <= range.ytd[1] && mainClassIdx(st.gfs[i], originIdxOf(st.ent[i], st.scope[i])) === OTHER_MAIN_IDX) otherYtd += 1;
    const g = grpOf(st.flags[i]);
    const e = extOf(st.flags[i]);
    for (const x of a) {
      x.invoices += 1;
      x.lines += st.lines[i];
      x.payments += st.payCount[i];
      x.gross += st.gross[i];
      if (D.cancelled) x.grossCancelled += st.gross[i];
      if (D.received > st.gross[i] + 0.5) x.paidOverGross += 1;
      if (st.flags[i] & F.AMT_CONFLICT) x.amtConflict += 1;
      if (st.scope[i] === 1) x.internal += 1;
      else x.central += 1;
      x.items[ITEMS[st.item[i]].key] = (x.items[ITEMS[st.item[i]].key] || 0) + 1;
      if (st.exec[i] >= 0) x.enforcement += 1;
      if (s === SOURCE_INDEX.tobacco || s === SOURCE_INDEX.accommodation) {
        for (let p = st.payStart[i]; p < st.payStart[i] + st.payCount[i]; p += 1) if (st.pCh[p] === 5) x.wallet += st.pAmt[p];
        if (g === GRP.TB_REPLACED && s === SOURCE_INDEX.tobacco) x.replacedPairs += 1;
      }
      if (s === SOURCE_INDEX.white_lands) {
        if (g !== 0) x.ownersMulti += 1;
        x.ext[e] += 1;
        if (st.flags[i] & F.OBJECTION) x.objections += 1;
      }
    }
    if (iss >= range.ytd[0] && iss <= range.ytd[1] && s === SOURCE_INDEX.licenses) {
      const paid = D.received;
      const code = D.cancelled ? 2 : paid >= st.gross[i] - 0.5 ? 1 : 0;
      acc.ytd[s].billStatus[code] += 1;
    }
    if (D.cancelled && D.excluded) checks.cancelledAndExcludedOverlap += 1;
    if (g === GRP.TB_REPLACED && s === SOURCE_INDEX.tobacco && st.cancelDay[i]) {
      const n = i + 1;
      if (!(n < st.nGen && grpOf(st.flags[n]) === GRP.TB_REPLACEMENT && st.payer[n] === st.payer[i] && st.cancelDay[i] === st.issue[n])) checks.tobaccoPairsBroken += 1;
    }
    if (s === SOURCE_INDEX.white_lands && (g === GRP.WL_HEAD2 || g === GRP.WL_HEAD3)) {
      const n = g === GRP.WL_HEAD2 ? 2 : 3;
      let sum2 = 0;
      let ok = true;
      for (let j = 1; j < n; j += 1) {
        const q3 = i + j;
        if (q3 >= st.nGen || grpOf(st.flags[q3]) !== (j === 1 ? GRP.WL_OWN2 : GRP.WL_OWN3) || st.issue[q3] !== st.issue[i]) ok = false;
        sum2 += q3 < st.nGen ? st.gross[q3] : 0;
      }
      if (!ok) checks.whiteLandGroupsBroken += 1;
      sum2 += st.gross[i];
      if (!(sum2 > 0)) checks.groupShareNot100 += 1;
    }
  }
  let fixturesYtd = 0;
  for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === 0 && isVisible(st, i, tab) && st.issue[i] >= range.ytd[0] && st.issue[i] <= range.ytd[1]) fixturesYtd += 1;
  const sc = { from: `${y}-01-01`, to: today, amanah: "all", source: "all" };
  const scp = { from: `${Number(y) - 1}-01-01`, to: shiftYear(today, -1), amanah: "all", source: "all" };
  const sn = snapshot2(st, { ...req, scope: sc, cfg: ctx.cfg });
  const sp = snapshot2(st, { ...req, scope: scp, cfg: ctx.cfg });
  const fin3 = (snap) => Object.fromEntries(snap.bySource.map((g) => [g.key, { count: g.count, gross: g.gross, net: g.net, collected: g.collected, outstanding: g.outstanding, cancelled: g.cancelled, exclusions: g.exclusions, rate: g.collectedOverNet }]));
  const finY = fin3(sn);
  const finP = fin3(sp);
  const sumBy = (f, k) => Object.values(f).reduce((t, v) => t + v[k], 0);
  const totals = { ytd: sn.totals, prior: sp.totals };
  const reconcile = {
    ytdCountMatches: sumBy(finY, "count") === sn.totals.count,
    ytdGrossMatches: Math.abs(sumBy(finY, "gross") - sn.totals.gross) < 1,
    ytdCollectedMatches: Math.abs(sumBy(finY, "collected") - sn.totals.collected) < 1,
    ytdOutstandingMatches: Math.abs(sumBy(finY, "outstanding") - sn.totals.outstanding) < 1,
    priorCountMatches: sumBy(finP, "count") === sp.totals.count,
    priorGrossMatches: Math.abs(sumBy(finP, "gross") - sp.totals.gross) < 1,
    countByLoopMatchesSnapshot: acc.ytd.reduce((t, x) => t + x.invoices, 0) + fixturesYtd - otherYtd === sn.population.issuedInPeriod
  };
  const sources = SOURCES.map((s, k) => ({
    key: s.key,
    platform: s.platform,
    profile: SOURCE_PROFILE[s.key] || null,
    ytd: { ...acc.ytd[k], financial: finY[s.key] || null },
    prior: { ...acc.prior[k], financial: finP[s.key] || null },
    allTime: { invoices: acc.all[k].invoices, lines: acc.all[k].lines, payments: acc.all[k].payments },
    assumptions: ASSUMPTIONS.filter((a) => a.sources.includes("all") || a.sources.includes(s.key)).map((a) => a.id)
  }));
  const visReq = st.requests.filter((q3) => requestVisible(st, q3, tab));
  const enforcement = { whiteLandsOrders: visReq.filter((q3) => q3.system === "white_lands").length, sanadRequests: visReq.filter((q3) => (q3.system || "sanad") === "sanad").length };
  return { fixturesYtd, today, period: { from: sc.from, to: sc.to, priorFrom: scp.from, priorTo: scp.to }, sources, totals, reconcile, checks, enforcement, params: PARAMS, generatedAt: isoOf(ctx.cutoffN) };
}

// server/orderMatch.js
function serialIndex(st) {
  if (st._serialIdx) return st._serialIdx;
  const m = /* @__PURE__ */ new Map();
  for (let i = 0; i < st.nGen; i += 1) {
    const k = st.idKey[i] % 1e8;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  st._serialIdx = m;
  return m;
}
var identityOf = (st, i) => {
  const im = iimFields(st, i);
  return { compositeKey: im.compositeKey, invoiceNo: im.invoiceNo, gfsCode: im.gfsCode, amanahId: im.amanahId, municipalityId: im.municipalityId };
};
function invoiceFacts(st, i) {
  const im = iimFields(st, i);
  return {
    sadadNo: im.sadadNo || null,
    billerId: im.billerId,
    billerAr: im.billerAr,
    billerEn: im.billerEn,
    platform: SOURCES[st.src[i]]?.platform || null,
    itemAr: ITEMS[st.item[i]]?.ar || null,
    itemEn: ITEMS[st.item[i]]?.en || null,
    productAr: im.productAr,
    productEn: im.productEn,
    scopeType: st.scope[i] === 1 ? "internal" : "central",
    invoiceKind: im.invoiceKind || null,
    gfsCode: im.gfsCode,
    gfsSub: im.gfsSub,
    mainClass: im.mainClass,
    municipalityAr: im.municipalityAr,
    municipalityEn: im.municipalityEn,
    municipalityRefId: im.municipalityRefId,
    municipalityStatus: im.municipalityStatus
  };
}
function summary2(st, ctx, i) {
  const D = derive(ctx, i, ctx.cutoffN);
  const exec = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
  const generated = i < st.nGen;
  return {
    invoiceId: idOf(st, i),
    ...identityOf(st, i),
    source: SOURCES[st.src[i]]?.key || null,
    amanahEn: ENTITIES[st.ent[i]]?.en || null,
    payerName: generated ? payerName(st.payer[i]) : null,
    payerId: generated ? beneficiaryIdOf(st.payer[i]) : null,
    payerIdx: generated ? st.payer[i] : null,
    issueDate: isoOf(st.issue[i]),
    dueDate: isoOf(st.due[i]),
    grossAmount: D.billed,
    netAmount: D.net,
    outstanding: D.outstanding,
    collected: D.collected,
    paymentStatus: D.payStatus,
    daysOverdue: D.daysOverdue,
    excluded: D.excluded,
    cancelled: D.cancelled,
    sourceCancelled: D.sourceCancelled,
    enfConflict: D.enfConflict,
    contractNo: st.contract[i] >= 0 && st.contracts[st.contract[i]] ? st.contracts[st.contract[i]].contractNo : null,
    // only the contract the invoice itself carries — never inferred
    serverIdentifiedOrder: exec ? exec.enforceNum : null,
    ...invoiceFacts(st, i)
  };
}
function resolveReferences(st, req) {
  const ctx = makeCtx(st, req);
  const out = [];
  for (const ref of req.refs || []) {
    const value = String(ref.value ?? "").trim();
    const kind = ref.kind;
    let idx = [];
    let weak = false;
    let normalized = null;
    if (kind === "invoice_corrupted") {
      out.push({ ref, status: "corrupted", weak: false, normalized: null, candidates: [] });
      continue;
    }
    if (kind === "composite_key") {
      const i = lookupComposite(st, value);
      if (i >= 0) idx = [i];
    } else if (kind === "invoice_id_exact") {
      const i = lookupId(st, value);
      if (i >= 0) idx = [i];
    } else if (kind === "invoice_no") {
      const p = parseInvoiceKey(value.replace(/[\s_\u2013\u2014/]+/g, "-"));
      const i = p ? lookupId(st, `${p.billerId}-${p.sadad}`) : -1;
      if (i >= 0) idx = [i];
    } else if (kind === "invoice_serial") {
      const digits = value.replace(/\D/g, "");
      weak = true;
      if (digits) idx = serialIndex(st).get(Number(digits)) || [];
    } else if (kind === "sadad_no") {
      idx = lookupSadad(st, value.replace(/\D/g, ""));
    } else if (kind === "violation_no") {
      const key = idKeyFromViolation(value.replace(/\D/g, ""));
      const i = key == null ? -1 : lookupKey(st, key);
      if (i >= 0) idx = [i];
    } else if (kind === "contract_no") {
      const found = contractsByNumber(st, value).filter((c) => contractVisible(st, c, ctx.acc));
      const ct = found.length === 1 ? found[0] : null;
      out.push({ ref, status: found.length > 1 ? "contract_ambiguous" : ct ? "contract_found" : "contract_not_found", matches: found.length, weak: false, normalized: null, candidates: [], contract: ct ? { contractNo: ct.contractNo, amanahEn: ENTITIES[ct.ent]?.en || null } : null });
      continue;
    } else {
      out.push({ ref, status: "not_invoice_reference", weak: false, normalized: null, candidates: [] });
      continue;
    }
    idx = idx.filter((i) => i >= 0 && st.issue[i] <= ctx.cutoffN && isVisible(st, i, ctx.acc) && (st.owner[i] === 0 || st.owner[i] === ctx.owner));
    out.push({ ref, status: idx.length === 0 ? "unmatched" : idx.length === 1 ? "matched" : "ambiguous", weak, normalized, candidates: idx.map((i) => summary2(st, ctx, i)) });
  }
  return { results: out, cutoff: ctx.cfg.cutoff };
}
function sameDebtorInvoices(st, req) {
  const ctx = makeCtx(st, req);
  const debtor = Number(req.debtor);
  const exclude = new Set((req.excludeIds || []).map((x) => String(x)));
  if (!Number.isFinite(debtor)) return { invoices: [] };
  const out = [];
  for (let i = 0; i < st.nGen; i += 1) {
    if (st.payer[i] !== debtor || st.issue[i] > ctx.cutoffN || !isVisible(st, i, ctx.acc)) continue;
    const s = summary2(st, ctx, i);
    if (exclude.has(s.invoiceId) || !(s.outstanding > 0)) continue;
    out.push(s);
    if (out.length >= 30) break;
  }
  return { invoices: out };
}

// server/enforcementCollections.js
var SCENARIO_FIXED = [
  ["171-407930123150", [["2026-09-14", 3e6], ["2026-10-02", 25e5]]],
  // partial, two payments
  ["171-407950123141", [["2026-09-20", 9524400]]],
  // paid in full
  ["171-408030123105", [["2026-10-05", 12e6]]],
  ["171-407850123186", [["2026-09-28", 2e7], ["2026-10-10", 15e6]]],
  ["171-407890123168", [["2026-10-08", 4e6]]]
  // already partly paid in the ledger: this is an additional enforcement-channel receipt
];
function syntheticTahseelPayments(st, cutoffN) {
  const out = [];
  let n = 0;
  const add = (invoiceId, date, amount, tag) => {
    n += 1;
    out.push({ id: `SYN-TAH-${String(n).padStart(4, "0")}`, invoiceId, date, amount, channel: "enforcement", source: "synthetic", tag });
  };
  for (const [id, pays] of SCENARIO_FIXED) if (lookupId(st, id) >= 0) for (const [d, a] of pays) add(id, d, a, "scenario");
  const seen = /* @__PURE__ */ new Set();
  let k = 0;
  for (const q3 of st.requests) {
    for (const i of q3.identified.slice(0, 1)) {
      const id = idOf(st, i);
      if (seen.has(id) || k >= 4) continue;
      seen.add(id);
      k += 1;
      const g = Math.round(st.gross[i]);
      add(id, isoOf(Math.min(q3.openedDay + 20 + k * 3, cutoffN)), Math.max(1e3, Math.round(g * 0.3)), "feed");
      add(id, isoOf(Math.min(q3.openedDay + 45 + k * 3, cutoffN)), Math.max(1e3, Math.round(g * 0.2)), "feed");
    }
  }
  return out;
}
function enforcementCollections(st, req) {
  const ctx = makeCtx(st, req);
  const rs = resolveScope(ctx, { ...req.scope || {}, from: "2000-01-01", to: ctx.cfg.cutoff });
  const ids = [...new Set((req.ids || []).map(String))];
  const from = req.from || "0000-01-01";
  const to = req.to || "9999-12-31";
  const cutoff = ctx.cfg.cutoff;
  const idx = /* @__PURE__ */ new Map();
  for (const id of ids) {
    const i = lookupId(st, id);
    if (i >= 0 && inScope(st, rs, i)) idx.set(id, i);
  }
  const synth = req.synthetic === false ? [] : syntheticTahseelPayments(st, ctx.cutoffN).filter((p) => idx.has(p.invoiceId));
  const seen = /* @__PURE__ */ new Set();
  const rows = [];
  const apart = [];
  let unattributed = 0;
  let anyEvidence = false;
  let anyPayment = false;
  const take = (p) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    if (p.date > cutoff || p.date < from || p.date > to) return;
    anyPayment = true;
    const row = { paymentId: p.id, invoiceId: p.invoiceId, index: idx.get(p.invoiceId), date: p.date, amount: p.amount, channel: p.channel, source: p.source };
    const i = row.index;
    row.amanahEn = ENTITIES[st.ent[i]].en;
    row.amanahAr = ENTITIES[st.ent[i]].ar;
    if (!p.channel) {
      unattributed += 1;
      apart.push({ ...row, why: "no_channel_evidence" });
      return;
    }
    anyEvidence = true;
    if (p.channel === "enforcement") rows.push(row);
    else apart.push({ ...row, why: "other_channel" });
  };
  for (const [id, i] of idx) {
    let k = 0;
    for (let q3 = st.payStart[i]; q3 < st.payStart[i] + st.payCount[i]; q3 += 1) {
      k += 1;
      take({ id: `TAH-${i}-${q3}`, invoiceId: id, date: isoOf(st.pDay[q3]), amount: st.pAmt[q3], channel: CHANNELS[st.pCh[q3]] || null, source: "ledger" });
    }
  }
  for (const p of synth) take(p);
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.invoiceId.localeCompare(b.invoiceId));
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const unavailable2 = anyPayment && !anyEvidence;
  return {
    available: !unavailable2,
    reason: unavailable2 ? "no_attribution_evidence" : null,
    total: unavailable2 ? null : total,
    count: rows.length,
    invoices: new Set(rows.map((r) => r.invoiceId)).size,
    rows: rows.map(({ index: index2, ...r }) => r),
    notCounted: { count: apart.length, amount: apart.reduce((t, r) => t + r.amount, 0), items: apart.map(({ index: index2, ...r }) => r) },
    linkedInvoices: idx.size,
    from: req.from || null,
    to: req.to || null,
    cutoff,
    evidence: { field: "channel", value: "enforcement", synthetic: synth.length },
    definition: "payments with channel \xABenforcement\xBB on invoices with a confirmed order link; period = payment date; each payment once"
  };
}

// src/data/exclusionUpload.js
var UPLOAD_RULES = ["ENC-1", "ATT-1"];
var AR_DIGITS2 = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
var FA_DIGITS2 = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
var westernDigits = (v) => String(v ?? "").replace(/[٠-٩]/g, (d) => String(AR_DIGITS2.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS2.indexOf(d)));
var clean = (v) => westernDigits(v).replace(/[‎‏‪-‮ ]/g, " ").trim();
var normText2 = (v) => clean(v).replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/\s+/g, " ").toLowerCase();
function reasonRuleOf(text) {
  const t = normText2(text);
  if (!t) return null;
  for (const id of UPLOAD_RULES) {
    const r = EXCLUSION_REASON_OF_RULE[id];
    if ([r.ar, r.en, r.code, `r${r.n}`].some((x) => normText2(x) === t)) return id;
  }
  return null;
}
function entityIndexOf(text) {
  const t = normText2(text);
  if (!t) return -1;
  return ENTITIES.findIndex((e) => [e.ar, e.en].some((x) => normText2(x) === t));
}

// server/exclusionUpload.js
var AMOUNT_TOLERANCE2 = 1;
function pickUploadInvoice(mine, acct, gfsOf, keyOf2) {
  const byGfs = acct ? mine.filter((x) => gfsOf(x) === acct) : mine;
  if (byGfs.length > 1) return { code: "invoice_ambiguous", candidates: byGfs.map(keyOf2) };
  const index2 = byGfs.length === 1 ? byGfs[0] : mine.length === 1 ? mine[0] : -1;
  if (index2 < 0) return acct ? { code: "account_mismatch" } : { code: "invoice_ambiguous", candidates: mine.map(keyOf2) };
  return { index: index2 };
}
function checkExclusionRows(st, req) {
  const ctx = makeCtx(st, req);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const r of req.rows || []) {
    const res = { row: r.row, ok: false, code: null, invoiceId: null, ruleId: null, amount: null, outstanding: null };
    const fail = (code) => {
      res.code = code;
      out.push(res);
    };
    res.ruleId = reasonRuleOf(r.reason);
    if (!res.ruleId) {
      fail("reason_invalid");
      continue;
    }
    const no = String(r.invoiceNo || "").trim();
    if (!no) {
      fail("invoice_no_missing");
      continue;
    }
    if (!String(r.amanah || "").trim()) {
      fail("amanah_missing");
      continue;
    }
    const ent = entityIndexOf(r.amanah);
    if (ent < 0) {
      fail("amanah_unknown");
      continue;
    }
    let cands = [];
    if (parseInvoiceKey(no)) {
      const i2 = lookupId(st, no);
      if (i2 >= 0) cands = [i2];
    } else if (/^\d{6,14}$/.test(no)) cands = lookupSadad(st, no);
    const visible = cands.filter((i2) => (st.owner[i2] === 0 || st.owner[i2] === (req.owner || 0)) && isVisible(st, i2, ctx.acc));
    if (!visible.length) {
      fail("invoice_not_found");
      continue;
    }
    const mine = visible.filter((i2) => st.ent[i2] === ent);
    if (!mine.length) {
      fail("other_amanah");
      continue;
    }
    const pick = pickUploadInvoice(mine, String(r.account || "").trim(), (x) => String(iimFields(st, x).gfsCode || ""), (x) => iimFields(st, x).compositeKey);
    if (pick.code) {
      if (pick.candidates) res.candidates = pick.candidates;
      fail(pick.code);
      continue;
    }
    const i = pick.index;
    res.invoiceId = idOf(st, i);
    res.compositeKey = iimFields(st, i).compositeKey;
    if (seen.has(res.invoiceId)) {
      fail("duplicate_in_file");
      continue;
    }
    seen.add(res.invoiceId);
    const D = derive(ctx, i, ctx.cutoffN);
    res.amount = D.billed;
    res.outstanding = D.outstanding;
    if (D.cancelled) {
      fail("cancelled");
      continue;
    }
    if (D.billed > 0 && D.received >= D.billed) {
      fail("already_collected");
      continue;
    }
    if (!Number.isFinite(r.amount) || Math.abs(r.amount - D.gross) > AMOUNT_TOLERANCE2) {
      fail("amount_mismatch");
      continue;
    }
    if (!r.date || r.date !== isoOf(st.issue[i])) {
      fail("date_mismatch");
      continue;
    }
    const im = iimFields(st, i);
    if (String(r.account || "").trim() !== String(im.gfsCode || "")) {
      fail("account_mismatch");
      continue;
    }
    if (res.ruleId === "ENC-1" && im.mainClass !== MAIN.investment) {
      fail("not_investment");
      continue;
    }
    res.ok = true;
    res.code = null;
    out.push(res);
  }
  return { rows: out, accepted: out.filter((x) => x.ok).length, rejected: out.filter((x) => !x.ok).length };
}

// server/distributions.js
var MIN_BOX = 5;
var MAX_OUTLIERS = 5;
var r2 = (x) => Math.round(x * 100) / 100;
var MAX_DAY_BINS = 16;
var DAY_WIDTHS = [30, 60, 90, 180, 365, 730, 1460];
function quantile(sorted, p) {
  const n = sorted.length;
  if (!n) return null;
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function fiveNumber(values) {
  const v = Float64Array.from(values).sort();
  const n = v.length;
  if (!n) return null;
  const q1 = quantile(v, 0.25);
  const median = quantile(v, 0.5);
  const q3 = quantile(v, 0.75);
  const iqr = q3 - q1;
  const loF = q1 - 1.5 * iqr;
  const hiF = q3 + 1.5 * iqr;
  let lo = v[0];
  let hi = v[n - 1];
  const out = [];
  for (let k = 0; k < n; k += 1) if (v[k] >= loF) {
    lo = v[k];
    break;
  }
  for (let k = n - 1; k >= 0; k -= 1) if (v[k] <= hiF) {
    hi = v[k];
    break;
  }
  for (let k = 0; k < n; k += 1) if (v[k] < loF || v[k] > hiF) out.push(v[k]);
  out.sort((a, b) => Math.abs(b - median) - Math.abs(a - median));
  return { n, min: r2(Math.min(lo, q1)), q1: r2(q1), median: r2(median), q3: r2(q3), max: r2(Math.max(hi, q3)), outliers: out.slice(0, MAX_OUTLIERS).map(r2), outlierCount: out.length, trueMin: r2(v[0]), trueMax: r2(v[n - 1]) };
}
var AMOUNT_EDGES = (() => {
  const e = [0];
  for (let p = 3; p <= 13; p += 1) for (const m of [1, 2, 5]) e.push(m * 10 ** p);
  return e;
})();
var amountBin = (v) => {
  if (!(v >= AMOUNT_EDGES[1])) return 0;
  let lo = 1;
  let hi = AMOUNT_EDGES.length - 1;
  while (lo < hi) {
    const mid = lo + hi + 1 >> 1;
    if (AMOUNT_EDGES[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};
var trim2 = (counts, amounts, edgeLo, edgeHi) => {
  let a = 0;
  while (a < counts.length && counts[a] === 0) a += 1;
  let b = counts.length - 1;
  while (b >= 0 && counts[b] === 0) b -= 1;
  const bins = [];
  for (let k = a; k <= b; k += 1) bins.push({ lo: edgeLo(k), hi: edgeHi(k), count: counts[k], amount: r2(amounts[k]) });
  return bins;
};
var groupsOf = (arrs, keyOf2) => {
  const groups = [];
  const skipped = [];
  for (const [k, v] of arrs) {
    if (!v.length) continue;
    if (v.length < MIN_BOX) {
      skipped.push({ key: keyOf2(k), n: v.length });
      continue;
    }
    groups.push({ key: keyOf2(k), ...fiveNumber(v) });
  }
  groups.sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
  skipped.sort((a, b) => a.key < b.key ? -1 : 1);
  return { groups, skipped };
};
var push = (m, k, v) => {
  let a = m.get(k);
  if (!a) {
    a = [];
    m.set(k, a);
  }
  a.push(v);
};
function chartDistributions(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const D = ctx.D;
  const NS = SOURCES.length;
  const asOf = ncAsOf(ctx, sc);
  const { fromN, toN } = sc;
  const aCounts = new Array(AMOUNT_EDGES.length - 1).fill(0);
  const aAmounts = new Array(AMOUNT_EDGES.length - 1).fill(0);
  const aAll = [];
  let aSum = 0;
  const aByEnt = /* @__PURE__ */ new Map();
  const aBySrc = /* @__PURE__ */ new Map();
  const standing = [];
  const standingByEnt = /* @__PURE__ */ new Map();
  let sNotDue = { count: 0, amount: 0 };
  let sUnknown = { count: 0, amount: 0 };
  let sAmountByVal = [];
  const period = [];
  const periodByEnt = /* @__PURE__ */ new Map();
  let pAmountByVal = [];
  const cells = /* @__PURE__ */ new Map();
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    const e = st.ent[i];
    const s = st.src[i];
    derive(ctx, i, ctx.cutoffN);
    if ((!sc.statusSet || sc.statusSet[D.cls]) && D.outstanding > 0) {
      if (!(st.due[i] > 0)) {
        sUnknown.count += 1;
        sUnknown.amount += D.outstanding;
      } else if (D.daysOverdue > 0) {
        standing.push(D.daysOverdue);
        sAmountByVal.push(D.outstanding);
        push(standingByEnt, e, D.daysOverdue);
      } else {
        sNotDue.count += 1;
        sNotDue.amount += D.outstanding;
      }
    }
    if (st.issue[i] < fromN || st.issue[i] > toN) continue;
    const dd = asOf === ctx.cutoffN ? D : derive(ctx, i, asOf);
    if (sc.statusSet && !sc.statusSet[dd.cls]) continue;
    const g = dd.gross;
    const b = amountBin(g);
    aCounts[b] += 1;
    aAmounts[b] += g;
    aSum += g;
    aAll.push(g);
    push(aByEnt, e, g);
    push(aBySrc, s, g);
    {
      const slot = slotOf(e, st.mref[i]);
      const k = (e * MUNI_SLOTS + slot) * NS + s;
      let c = cells.get(k);
      if (!c) {
        c = [0, 0, 0, 0];
        cells.set(k, c);
      }
      c[0] += dd.net;
      c[1] += dd.collected;
      c[2] += dd.outstanding;
      c[3] += 1;
    }
    if (dd.outstanding > 0 && st.due[i] > 0 && dd.daysOverdue > 0) {
      period.push(dd.daysOverdue);
      pAmountByVal.push(dd.outstanding);
      push(periodByEnt, e, dd.daysOverdue);
    }
  }
  const dayHist = (vals, amts) => {
    if (!vals.length) return { n: 0, binWidth: null, bins: [] };
    let mx = 0;
    for (const v of vals) if (v > mx) mx = v;
    const w = DAY_WIDTHS.find((x) => Math.ceil(mx / x) <= MAX_DAY_BINS) || DAY_WIDTHS[DAY_WIDTHS.length - 1];
    const nb = Math.ceil(mx / w);
    const counts = new Array(nb).fill(0);
    const amounts = new Array(nb).fill(0);
    vals.forEach((v, k) => {
      const bi3 = Math.min(nb - 1, Math.floor((v - 1) / w));
      counts[bi3] += 1;
      amounts[bi3] += amts[k];
    });
    return { n: vals.length, binWidth: w, bins: counts.map((count, k) => ({ lo: k * w + 1, hi: (k + 1) * w, count, amount: r2(amounts[k]) })) };
  };
  const stat = (v) => {
    const f = fiveNumber(v);
    return f ? { n: f.n, min: f.trueMin, q1: f.q1, median: f.median, q3: f.q3, max: f.trueMax } : null;
  };
  const entKey = (e) => ENTITIES[e].en;
  const srcKey = (s) => SOURCES[s].key;
  const aH = trim2(aCounts, aAmounts, (k) => AMOUNT_EDGES[k], (k) => AMOUNT_EDGES[k + 1]);
  const tree = [];
  for (const [k, c] of cells) {
    const s = k % NS;
    const g = Math.floor(k / NS);
    const e = Math.floor(g / MUNI_SLOTS);
    const slot = g % MUNI_SLOTS;
    const en = ENTITIES[e].en;
    const m0 = slot >= 4 ? municipalityOfCode(e, slot) : null;
    tree.push({ amanah: en, muni: m0 ? m0.key : `${en}|${slot === 1 ? "DIRECT" : slot === 2 ? "UNRESOLVED" : "NOT_SPECIFIED"}`, source: srcKey(s), net: c[0], collected: c[1], outstanding: c[2], count: c[3] });
  }
  tree.sort((x, y) => x.amanah < y.amanah ? -1 : x.amanah > y.amanah ? 1 : x.muni < y.muni ? -1 : x.muni > y.muni ? 1 : x.source < y.source ? -1 : 1);
  return {
    version: 1,
    kind: "distributions",
    cutoff: ctx.cfg.cutoff,
    asOf: isoOf(asOf),
    scope: { from: sc.from, to: sc.to, amanah: req.scope?.amanah ?? "all", source: req.scope?.source ?? "all", muni: req.scope?.muni ?? "all", status: req.scope?.status ?? "all" },
    method: { quantile: "linear interpolation between order statistics (type 7: position (n \u2212 1)\xB7p)", whisker: "1.5 \xD7 IQR", minBox: MIN_BOX, amountBins: "1-2-5 steps on a log scale, half-open [lo, hi)", dayBins: "equal width, inclusive [lo, hi] in days" },
    amount: { n: aAll.length, sum: aSum, summary: stat(aAll), bins: aH, box: { byAmanah: groupsOf(aByEnt, entKey), bySource: groupsOf(aBySrc, srcKey) } },
    overdueStanding: { ...dayHist(standing, sAmountByVal), notDue: sNotDue, dueUnknown: sUnknown, summary: stat(standing), box: { byAmanah: groupsOf(standingByEnt, entKey) } },
    overduePeriod: { ...dayHist(period, pAmountByVal), summary: stat(period), box: { byAmanah: groupsOf(periodByEnt, entKey) } },
    tree
  };
}

// server/furasData.js
import fs from "node:fs";
import path from "node:path";

// server/furasCsv.js
function parseCsv(text, wanted) {
  const len = text.length;
  let i = text.charCodeAt(0) === 65279 ? 1 : 0;
  const header = [];
  const keep = [];
  const cols = {};
  let n = 0;
  let col = 0;
  let inHeader = true;
  const want = new Set(wanted);
  const push2 = (s) => {
    if (inHeader) {
      const h = s.trim().toLowerCase();
      header.push(h);
      keep.push(want.has(h));
      if (want.has(h)) cols[h] = [];
      return;
    }
    if (keep[col]) cols[header[col]].push(s === "" ? null : s);
  };
  while (i < len) {
    let s;
    const c = text.charCodeAt(i);
    if (c === 34) {
      i += 1;
      let out = "";
      let from = i;
      for (; ; ) {
        const q3 = text.indexOf('"', i);
        if (q3 < 0) {
          out += text.slice(from);
          i = len;
          break;
        }
        if (text.charCodeAt(q3 + 1) === 34) {
          out += text.slice(from, q3 + 1);
          i = q3 + 2;
          from = i;
          continue;
        }
        out += text.slice(from, q3);
        i = q3 + 1;
        break;
      }
      s = out;
    } else {
      const from = i;
      while (i < len) {
        const d2 = text.charCodeAt(i);
        if (d2 === 44 || d2 === 10 || d2 === 13) break;
        i += 1;
      }
      s = text.slice(from, i);
    }
    const d = text.charCodeAt(i);
    if (inHeader || keep[col]) push2(s);
    if (d === 44) {
      col += 1;
      i += 1;
      continue;
    }
    if (d === 13 && text.charCodeAt(i + 1) === 10) i += 2;
    else i += 1;
    if (inHeader) inHeader = false;
    else {
      n += 1;
      for (let k = col + 1; k < header.length; k += 1) if (keep[k]) cols[header[k]].push(null);
    }
    col = 0;
  }
  return { header, n, cols };
}

// server/furasData.js
var KEEP = {
  contract: [
    "pzinskey",
    "contractnumber",
    "opportunitynumber",
    "investorid",
    "contracttype",
    "opportunitystatus",
    "rentalstatus",
    "renewalstatus",
    "renewedcontractid",
    "awardingdate",
    "signingdate",
    "startdate",
    "enddate",
    "dateofsitehandover",
    "dateofsitehandoveractual",
    "contractvalue",
    "calculatedcontractvalue",
    "annualcontractvalue",
    "totalcontractvaluewithvat",
    "contractterm",
    "contractdurationmonths",
    "municipalityid",
    "municipality",
    "submunicipalityid",
    "submunicipality",
    "opportunityname",
    "primarycontractid",
    "source_pt",
    "etl_time"
  ],
  payment: [
    "pyguid",
    "contractid",
    "opportunitynumber",
    "investorid",
    "batchnumber",
    "batchyear",
    "batchstatus",
    "paymenttype",
    "methodofcollectingpayments",
    "batchmonths",
    "paymentduedate",
    "batchenddate",
    "invoicedate",
    "paymentdate",
    "paymentamount",
    "balanceamount",
    "contractvalue",
    "ps_contractvalue_annual",
    "vatamount",
    "batchamountpaid",
    "batchamountbalance",
    "municipalityid",
    "submunicipalityid",
    "pxcreatedatetime",
    "source_pt",
    "etl_time"
  ],
  contractmanagement: ["pyid", "pylabel", "pystatuswork", "contractnumber", "opportunitynumber", "investorid", "municipalityid", "sadadbillnumber", "source_pt", "etl_time"],
  entitymanagement: ["pyid", "pylabel", "contractnumber", "opportunitynumber", "sadadbillnumber", "source_pt", "etl_time"],
  imsfw_work: ["pzinskey", "pycasename", "contractnumber", "opportunitynumber", "sadadbillnumber", "source_pt", "etl_time"],
  investor: ["investorid", "source_pt"]
};
var VIEW_NAME = { contract: "Contract", payment: "Payment", contractmanagement: "ContractManagement", entitymanagement: "EntityManagement", imsfw_work: "IMSFW_Work", investor: "Investor" };
var SCHEMA_COLS = { contract: 38, payment: 31, contractmanagement: 28, entitymanagement: 32, imsfw_work: 54, investor: 8 };
var OUTSIDE_SUBSET = "OUTSIDE-SUBSET";
var APPROVED_STATUS = "Contract-Approved";
var scopeStatus = () => {
  const v = process.env.FURAS_STATUS_SCOPE;
  return v === void 0 ? APPROVED_STATUS : v === "" || v.toLowerCase() === "all" ? null : v;
};
var BILL_PLACEHOLDER = "00-00-000000";
var CAP = 1e4;
var FLAGGED_MUNICIPALITIES = /* @__PURE__ */ new Set(["002"]);
function furasDir() {
  if (process.env.VERCEL) return null;
  let d = process.env.FURAS_EXPORT_DIR || null;
  if (!d) {
    try {
      d = fs.readFileSync(path.join(process.cwd(), "furas-exports.local"), "utf8").trim() || null;
    } catch {
      d = null;
    }
  }
  try {
    return d && fs.statSync(d).isDirectory() ? d : null;
  } catch {
    return null;
  }
}
function findFiles(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) {
    const m = /^ads_furas_schema_(contract|payment|contractmanagement|entitymanagement|imsfw_work|investor)_df_(\d+)\.csv$/.exec(f);
    if (m) out[m[1]] = path.join(dir, f);
  }
  return out;
}
function furasAvailable() {
  const dir = furasDir();
  if (!dir) return { available: false, reason: process.env.VERCEL ? "deployment" : "not_configured" };
  const files = findFiles(dir);
  const missing = Object.keys(KEEP).filter((k) => !files[k]);
  return missing.length ? { available: false, reason: "incomplete" } : { available: true, reason: null };
}
var furasAccessAllowed = (access) => normalizeAccess(access).all === true;
var furasAvailableFor = (access) => furasAccessAllowed(access) ? furasAvailable() : { available: false, reason: "geo_scope_unmapped" };
var num = (s) => {
  if (s == null) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
var dateOnly = (s) => {
  if (s == null) return null;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};
function dateFlag(s, extractIso, { noFuture = false } = {}) {
  const d = dateOnly(s);
  if (d == null) return null;
  const y = Number(d.slice(0, 4));
  if (!Number.isFinite(y)) return "unreadable";
  if (y >= 1300 && y <= 1500) return "hijri_like";
  if (y < 1900) return "out_of_range";
  if (y === 1970) return "epoch";
  if (y > 2100) return "out_of_range";
  if (noFuture && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > extractIso) return "after_extract";
  return null;
}
var maskId = (s) => s == null ? null : String(s).length <= 4 ? "\u2022\u2022\u2022\u2022" : "\u2022".repeat(Math.min(8, String(s).length - 4)) + String(s).slice(-4);
var tail = (s, n = 12) => s == null ? null : s.length > n ? `\u2026${s.slice(-n)}` : s;
var countBy = (arr, f = (x) => x) => {
  const m = /* @__PURE__ */ new Map();
  for (const x of arr) {
    const k = f(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};
var top = (m, limit = 60) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
var loading = null;
function loadFuras() {
  if (loading) return loading;
  loading = (async () => {
    const dir = furasDir();
    if (!dir) throw new Error("furas_unavailable");
    const files = findFiles(dir);
    const D = { loadedAt: (/* @__PURE__ */ new Date()).toISOString(), views: {}, subset: null };
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, "subset.json"), "utf8"));
      if (m && m.kind === "subset") D.subset = { contracts: m.contracts, scenarios: m.scenarios || null };
    } catch {
    }
    for (const k of Object.keys(KEEP)) {
      const text = await fs.promises.readFile(files[k], "utf8");
      const p = parseCsv(text, KEEP[k]);
      D.views[k] = { name: VIEW_NAME[k], rows: p.n, columns: p.header.length, schemaColumns: SCHEMA_COLS[k], capped: p.n === CAP, cols: p.cols };
    }
    applyScope(D, scopeStatus());
    index(D);
    console.log("[furas] local exports loaded");
    return D;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}
function applyScope(D, status) {
  D.scope = null;
  D.hiddenByNo = /* @__PURE__ */ new Map();
  if (!status) return;
  const take = (v, keep) => {
    const V = D.views[v];
    const out = {};
    for (const k of Object.keys(V.cols)) out[k] = keep.map((i) => V.cols[k][i]);
    V.fileRows = V.rows;
    V.cols = out;
    V.rows = keep.length;
  };
  const C2 = D.views.contract.cols;
  const nC = D.views.contract.rows;
  const allNo = /* @__PURE__ */ new Set();
  const allOpp = /* @__PURE__ */ new Set();
  const apNo = /* @__PURE__ */ new Set();
  const apOpp = /* @__PURE__ */ new Set();
  const keepC = [];
  for (let i = 0; i < nC; i += 1) {
    const no = C2.contractnumber[i];
    const o = C2.opportunitynumber[i];
    if (no != null) allNo.add(no);
    if (o != null) allOpp.add(o);
    if (C2.opportunitystatus[i] === status) {
      keepC.push(i);
      if (no != null) apNo.add(no);
      if (o != null) apOpp.add(o);
    }
  }
  const hidden = /* @__PURE__ */ new Map();
  for (let i = 0; i < nC; i += 1) {
    if (C2.opportunitystatus[i] === status) continue;
    const no = C2.contractnumber[i];
    if (no != null) hidden.set(no, (hidden.get(no) || 0) + 1);
  }
  for (const [no, n] of hidden) if (apNo.has(no)) D.hiddenByNo.set(no, n);
  const numbersOut = [...allNo].filter((n) => !apNo.has(n)).length;
  const P2 = D.views.payment.cols;
  const keepP = [];
  for (let i = 0; i < D.views.payment.rows; i += 1) {
    const no = P2.contractid[i];
    if (no != null && allNo.has(no) && !apNo.has(no)) continue;
    keepP.push(i);
  }
  const keepCase = (v) => {
    const X = D.views[v].cols;
    const keep = [];
    for (let i = 0; i < D.views[v].rows; i += 1) {
      const no = X.contractnumber[i];
      const o = X.opportunitynumber[i];
      const matchesAp = no != null && apNo.has(no) || o != null && apOpp.has(o);
      const matchesOther = !matchesAp && (no != null && allNo.has(no) || o != null && allOpp.has(o));
      if (!matchesOther) keep.push(i);
    }
    return keep;
  };
  const before = Object.fromEntries(Object.keys(D.views).map((k) => [k, D.views[k].rows]));
  const wasCapped = D.views.payment.capped;
  take("contract", keepC);
  take("payment", keepP);
  for (const v of ["contractmanagement", "entitymanagement", "imsfw_work"]) take(v, keepCase(v));
  D.views.payment.capped = wasCapped;
  D.scope = { status, numbersOutside: numbersOut, recordsOutside: before.contract - D.views.contract.rows, excluded: Object.fromEntries(["contract", "payment", "contractmanagement", "entitymanagement", "imsfw_work"].map((k) => [k, before[k] - D.views[k].rows])) };
}
function index(D) {
  const C2 = D.views.contract.cols;
  const P2 = D.views.payment.cols;
  const nC = D.views.contract.rows;
  const nP = D.views.payment.rows;
  const first = (v, c) => (D.views[v].cols[c] || []).find((x) => x != null) || null;
  const pt = first("contract", "source_pt");
  D.partition = pt && /^\d{8}$/.test(pt) ? dateOnly(pt) : pt;
  D.etl = first("contract", "etl_time");
  D.byNo = /* @__PURE__ */ new Map();
  D.byPz = /* @__PURE__ */ new Map();
  D.noNumber = 0;
  for (let i = 0; i < nC; i += 1) {
    const no = C2.contractnumber[i];
    if (no == null) D.noNumber += 1;
    else {
      const a = D.byNo.get(no);
      if (a) a.push(i);
      else D.byNo.set(no, [i]);
    }
    if (C2.pzinskey[i] != null) D.byPz.set(C2.pzinskey[i], i);
  }
  D.byOpp = /* @__PURE__ */ new Map();
  for (let i = 0; i < nC; i += 1) {
    const o = C2.opportunitynumber[i];
    if (o != null) {
      const a = D.byOpp.get(o);
      if (a) a.push(i);
      else D.byOpp.set(o, [i]);
    }
  }
  D.payByNo = /* @__PURE__ */ new Map();
  for (let i = 0; i < nP; i += 1) {
    const no = P2.contractid[i];
    if (no == null) continue;
    const a = D.payByNo.get(no);
    if (a) a.push(i);
    else D.payByNo.set(no, [i]);
  }
  const M4 = D.views.contractmanagement.cols;
  D.cmByNo = /* @__PURE__ */ new Map();
  D.cmByOpp = /* @__PURE__ */ new Map();
  for (let i = 0; i < D.views.contractmanagement.rows; i += 1) {
    const n = M4.contractnumber[i];
    if (n != null) {
      const a = D.cmByNo.get(n);
      if (a) a.push(i);
      else D.cmByNo.set(n, [i]);
    }
    const o = M4.opportunitynumber[i];
    if (o != null) {
      const a = D.cmByOpp.get(o);
      if (a) a.push(i);
      else D.cmByOpp.set(o, [i]);
    }
  }
  D.investors = new Set(D.views.investor.cols.investorid.filter((x) => x != null));
  D.municipalities = municipalityTable(C2, nC);
}
function municipalityTable(C2, n) {
  const names = /* @__PURE__ */ new Map();
  for (let i = 0; i < n; i += 1) {
    const c = C2.municipalityid[i];
    if (c == null) continue;
    if (!names.has(c)) names.set(c, /* @__PURE__ */ new Map());
    const m = names.get(c);
    const nm2 = C2.municipality[i] || null;
    m.set(nm2, (m.get(nm2) || 0) + 1);
  }
  const out = /* @__PURE__ */ new Map();
  for (const [code, m] of names) {
    const s = top(m);
    out.set(code, { code, sourceName: s[0][0], variants: s.slice(1).map(([name, records]) => ({ name, records })), flag: FLAGGED_MUNICIPALITIES.has(code) ? "confirm_entity_scope" : null });
  }
  return out;
}
var SHAPES = ["single", "versions", "multi"];
var shapeOf = (n, groups) => n <= 1 ? "single" : groups <= 1 ? "versions" : "multi";
function numberRows(D) {
  if (D.numRows) return D.numRows;
  const C2 = D.views.contract.cols;
  const out = [];
  for (const [no, idx] of D.byNo) {
    const dist = (col) => countBy(idx.map((i) => C2[col][i]).filter((x) => x != null));
    const types = dist("contracttype");
    const statuses = dist("opportunitystatus");
    const codes = dist("municipalityid");
    const vals = new Set(idx.map((i) => num(C2.contractvalue[i])).filter((v) => v != null).map((v) => v.toFixed(2)));
    const ann = new Set(idx.map((i) => num(C2.annualcontractvalue[i])).filter((v) => v != null).map((v) => v.toFixed(2)));
    const ends = new Set(idx.map((i) => C2.enddate[i]).filter((x) => x != null));
    const starts = new Set(idx.map((i) => C2.startdate[i]).filter((x) => x != null));
    const rental = dist("rentalstatus");
    const names = dist("opportunityname");
    const withVat = new Set(idx.map((i) => num(C2.totalcontractvaluewithvat[i])).filter((v) => v != null).map((v) => v.toFixed(2)));
    const investors = [...new Set(idx.map((i) => C2.investorid[i]).filter((x) => x != null))];
    const oppNos = [...new Set(idx.map((i) => C2.opportunitynumber[i]).filter((x) => x != null))];
    const oppGroups = new Set(idx.map((i) => C2.opportunitynumber[i]));
    const opps = [...oppGroups].filter((x) => x != null).length;
    out.push({
      no,
      n: idx.length,
      opps,
      groups: oppGroups.size,
      oppNos,
      names: top(names),
      rental: top(rental),
      investors,
      investorsFound: investors.filter((x) => D.investors.has(x)).length,
      startState: starts.size === 0 ? "none" : starts.size === 1 ? "single" : "differs",
      start: starts.size === 1 ? dateOnly([...starts][0]) : null,
      startFlag: starts.size === 1 ? dateFlag([...starts][0], D.partition) : null,
      endState: ends.size === 0 ? "none" : ends.size === 1 ? "single" : "differs",
      end: ends.size === 1 ? dateOnly([...ends][0]) : null,
      endFlag: ends.size === 1 ? dateFlag([...ends][0], D.partition) : null,
      vatState: withVat.size === 0 ? "none" : withVat.size === 1 ? "single" : "conflict",
      valueWithVat: withVat.size === 1 ? Number([...withVat][0]) : null,
      shape: shapeOf(idx.length, oppGroups.size),
      types: top(types),
      statuses: top(statuses),
      codes: [...codes.keys()],
      payRows: (D.payByNo.get(no) || []).length,
      invRows: (D.payByNo.get(no) || []).filter((i) => D.views.payment.cols.invoicedate[i] != null).length,
      hidden: D.hiddenByNo.get(no) || 0,
      valueState: vals.size === 0 ? "none" : vals.size === 1 ? "single" : "conflict",
      value: vals.size === 1 ? Number([...vals][0]) : null,
      valueCount: vals.size,
      annualState: ann.size === 0 ? "none" : ann.size === 1 ? "single" : "conflict",
      annual: ann.size === 1 ? Number([...ann][0]) : null,
      conflicts: { status: statuses.size > 1, type: types.size > 1, value: vals.size > 1, annual: ann.size > 1, endDate: ends.size > 1, municipality: codes.size > 1 }
    });
  }
  out.sort((a, b) => a.no < b.no ? -1 : a.no > b.no ? 1 : 0);
  D.numRows = out;
  return out;
}
async function furasSummary() {
  const D = await loadFuras();
  if (D.summary) return D.summary;
  const C2 = D.views.contract.cols;
  const P2 = D.views.payment.cols;
  const nC = D.views.contract.rows;
  const nP = D.views.payment.rows;
  const rows = numberRows(D);
  const extract = D.partition;
  const files = Object.keys(KEEP).map((k) => {
    const v = D.views[k];
    return { key: k, view: v.name, rows: v.rows, fileRows: v.fileRows ?? v.rows, columns: v.columns, schemaColumns: v.schemaColumns, scope: D.subset ? "subset" : v.capped ? "capped_sample" : "not_capped" };
  });
  const repeated = rows.filter((r) => r.n > 1);
  const conflicts = (k) => repeated.filter((r) => r.conflicts[k]).length;
  const consistent = rows.filter((r) => r.valueState === "single");
  const countRecords = (col) => countBy(C2[col].filter((x) => x != null));
  const countNumbers = (field) => {
    const m = /* @__PURE__ */ new Map();
    for (const r of rows) for (const [v] of r[field]) m.set(v, (m.get(v) || 0) + 1);
    return m;
  };
  const nTypes = countNumbers("types");
  const nStatuses = countNumbers("statuses");
  const byType = top(countRecords("contracttype")).map(([value, records]) => ({ value, records, numbers: nTypes.get(value) || 0 }));
  const byStatus = top(countRecords("opportunitystatus")).map(([value, records]) => ({ value, records, numbers: nStatuses.get(value) || 0 }));
  const muniRecords = countBy(C2.municipalityid.filter((x) => x != null));
  const muniNumbers = /* @__PURE__ */ new Map();
  for (const r of rows) for (const c of r.codes) muniNumbers.set(c, (muniNumbers.get(c) || 0) + 1);
  const byMunicipality = [...D.municipalities.values()].sort((a, b) => a.code < b.code ? -1 : 1).map((m) => ({ ...m, records: muniRecords.get(m.code) || 0, numbers: muniNumbers.get(m.code) || 0 }));
  const filled = (col) => C2[col].filter((x) => x != null).length;
  let links = 0;
  let resolved = 0;
  let outside = 0;
  let selfRef = 0;
  let sameNo = 0;
  for (let i = 0; i < nC; i += 1) {
    const r = C2.renewedcontractid[i];
    if (r == null) continue;
    links += 1;
    const j = D.byPz.get(r);
    if (j == null) {
      if (D.subset && r === OUTSIDE_SUBSET) outside += 1;
      continue;
    }
    resolved += 1;
    if (j === i) selfRef += 1;
    if (C2.contractnumber[j] === C2.contractnumber[i]) sameNo += 1;
  }
  const investorsFound = C2.investorid.filter((x) => x != null && D.investors.has(x)).length;
  const payNos = [...D.payByNo.keys()];
  const matched = payNos.filter((no) => D.byNo.has(no));
  let rowsAfter = 0;
  let rows2 = 0;
  let rowsUnmatched = 0;
  let maxMatch = 0;
  for (let i = 0; i < nP; i += 1) {
    const m = (D.byNo.get(P2.contractid[i]) || []).length;
    rowsAfter += m;
    if (m === 0) rowsUnmatched += 1;
    if (m > 1) rows2 += 1;
    if (m > maxMatch) maxMatch = m;
  }
  const keyCount = countBy(Array.from({ length: nP }, (_, i) => `${P2.contractid[i]}|${P2.batchyear[i]}|${P2.batchnumber[i]}`));
  const duplicateRows = [...keyCount.values()].reduce((t, v) => t + (v > 1 ? v - 1 : 0), 0);
  const byPayStatus = top(countBy(P2.batchstatus.filter((x) => x != null))).map(([value, count]) => ({ value, rows: count, scheduledAmount: 0 }));
  const ps = new Map(byPayStatus.map((x) => [x.value, x]));
  let amountTotal = 0;
  let amountRows = 0;
  let zero = 0;
  for (let i = 0; i < nP; i += 1) {
    const a = num(P2.paymentamount[i]);
    if (a == null) continue;
    amountTotal += a;
    amountRows += 1;
    if (a === 0) zero += 1;
    const s = ps.get(P2.batchstatus[i]);
    if (s) s.scheduledAmount += a;
  }
  const flagCount = (col, opts) => {
    const m = /* @__PURE__ */ new Map();
    for (let i = 0; i < nP; i += 1) {
      const f = dateFlag(P2[col][i], extract, opts);
      if (f) m.set(f, (m.get(f) || 0) + 1);
    }
    return Object.fromEntries(m);
  };
  const per = countBy(Array.from({ length: nP }, (_, i) => P2.contractid[i]).filter((x) => x != null));
  let c3 = 0;
  let contiguous = 0;
  for (const [no, c] of per) {
    if (c < 3) continue;
    c3 += 1;
    const bn = (D.payByNo.get(no) || []).map((i) => num(P2.batchnumber[i])).filter((x) => x != null).sort((a, b) => a - b);
    if (bn.length === c && new Set(bn).size === c && bn[bn.length - 1] - bn[0] + 1 === c) contiguous += 1;
  }
  const paidDates = [];
  for (let i = 0; i < nP; i += 1) {
    if (P2.batchstatus[i] === "Paid" && P2.paymentdate[i] && !dateFlag(P2.paymentdate[i], extract, { noFuture: true })) paidDates.push(dateOnly(P2.paymentdate[i]));
  }
  const createMax = P2.pxcreatedatetime.filter((x) => x != null).reduce((m, x) => x > m ? x : m, "");
  const M4 = D.views.contractmanagement.cols;
  const cmFound = M4.contractnumber.filter((x) => x != null && D.byNo.has(x)).length;
  const cmNo = M4.contractnumber.filter((x) => x != null).length;
  const cmOpp = M4.opportunitynumber.filter((x) => x != null);
  const cmOppFound = cmOpp.filter((x) => D.byOpp.has(x)).length;
  const sadadFilled = (v) => D.views[v].cols.sadadbillnumber.filter((x) => x != null).length;
  const pFound = P2.investorid.filter((x) => x != null && D.investors.has(x)).length;
  const pInv = P2.investorid.filter((x) => x != null).length;
  D.summary = {
    dataset: { title: "Furas Databank exports", schema: "Furas business schema", extract, etl: D.etl, files, subset: D.subset, scope: D.scope, note: "Read locally at runtime; not in Git, not in any build, not in any log." },
    contracts: {
      shapes: Object.fromEntries(SHAPES.map((k) => [k, rows.filter((r) => r.shape === k).length])),
      records: nC,
      distinctNumbers: D.byNo.size,
      recordsWithoutNumber: D.noNumber,
      numbersWithSeveralRecords: repeated.length,
      recordsInRepeatedNumbers: repeated.reduce((t, r) => t + r.n, 0),
      maxRecordsPerNumber: rows.reduce((m, r) => Math.max(m, r.n), 0),
      recordKeyUnique: D.byPz.size === nC,
      conflictsAmongRepeated: { status: conflicts("status"), type: conflicts("type"), value: conflicts("value"), annual: conflicts("annual"), endDate: conflicts("endDate"), municipality: conflicts("municipality") },
      byType,
      byStatus,
      byRental: top(countRecords("rentalstatus")).map(([value, records]) => ({ value, records })),
      byMunicipality,
      numbersWithSeveralTypes: rows.filter((r) => r.conflicts.type).length,
      dates: { startFilled: filled("startdate"), endFilled: filled("enddate"), signingFilled: filled("signingdate"), awardingFilled: filled("awardingdate") },
      values: { numbersWithSingleValue: consistent.length, sumOfSingleValues: consistent.reduce((t, r) => t + r.value, 0), numbersWithConflictingValues: rows.filter((r) => r.valueState === "conflict").length, numbersWithoutValue: rows.filter((r) => r.valueState === "none").length },
      renewal: { links, resolved, outsideSubset: outside, unresolved: links - resolved - outside, selfReference: selfRef, sameContractNumber: sameNo },
      investorIdFound: investorsFound,
      investorIdFilled: filled("investorid")
    },
    payments: {
      rows: nP,
      capped: D.views.payment.capped,
      distinctNumbers: payNos.length,
      numbersFoundInContract: matched.length,
      numbersNotFound: payNos.length - matched.length,
      rowsNotFound: rowsUnmatched,
      rowsMatchingSeveralRecords: rows2,
      maxRecordsMatched: maxMatch,
      rowsAfterNumberJoin: rowsAfter,
      duplicateRows,
      contractsWithThreePlusRows: c3,
      contractsWithContiguousBatches: contiguous,
      scheduledAmount: { total: amountTotal, rows: amountRows, zeroRows: zero },
      byStatus: byPayStatus,
      byMethod: top(countBy(P2.methodofcollectingpayments.filter((x) => x != null))).map(([value, rows2_]) => ({ value, rows: rows2_ })),
      byType: top(countBy(P2.paymenttype.filter((x) => x != null))).map(([value, rows2_]) => ({ value, rows: rows2_ })),
      dueDateFlags: flagCount("paymentduedate"),
      invoiceDateFlags: flagCount("invoicedate", { noFuture: true }),
      paymentDateFlags: flagCount("paymentdate", { noFuture: true }),
      invoiceDateFilled: P2.invoicedate.filter((x) => x != null).length,
      numbersWithInvoiceDate: rows.filter((r) => r.invRows > 0).length,
      paymentDateFilled: P2.paymentdate.filter((x) => x != null).length,
      collectedFieldFilled: P2.batchamountpaid.filter((x) => x != null).length,
      latest: { createdField: "PXCREATEDATETIME", created: createMax || null, paymentDateField: "PAYMENTDATE (rows with status Paid, values after the extract date excluded)", paymentDate: paidDates.sort().pop() || null },
      investorIdFound: pFound,
      investorIdFilled: pInv
    },
    cases: { contractManagementRows: D.views.contractmanagement.rows, withContractNumber: cmNo, contractNumberFound: cmFound, withOpportunityNumber: cmOpp.length, opportunityNumberFound: cmOppFound, sadadBillNumberFilled: { contractManagement: sadadFilled("contractmanagement"), entityManagement: sadadFilled("entitymanagement"), imsfwWork: sadadFilled("imsfw_work") } },
    investors: { rows: D.views.investor.rows }
  };
  return D.summary;
}
async function furasContracts(body = {}) {
  const D = await loadFuras();
  let rows = numberRows(D);
  const f = body.filter || {};
  const q3 = String(body.q || "").trim().toUpperCase();
  if (q3) rows = rows.filter((r) => r.no.toUpperCase().includes(q3) || r.oppNos.some((o) => o.toUpperCase().includes(q3)) || r.names.some(([v]) => v.toUpperCase().includes(q3)));
  if (f.rental) rows = rows.filter((r) => r.rental.some(([v]) => v === f.rental));
  if (f.type) rows = rows.filter((r) => r.types.some(([v]) => v === f.type));
  if (f.status) rows = rows.filter((r) => r.statuses.some(([v]) => v === f.status));
  if (f.municipality) rows = rows.filter((r) => r.codes.includes(f.municipality));
  if (f.startFrom || f.startTo) rows = rows.filter((r) => r.start && (!f.startFrom || r.start >= f.startFrom) && (!f.startTo || r.start <= f.startTo));
  if (f.shape && SHAPES.includes(f.shape)) rows = rows.filter((r) => r.shape === f.shape);
  if (f.severalRecords) rows = rows.filter((r) => r.n > 1);
  if (f.conflicting) rows = rows.filter((r) => Object.values(r.conflicts).some(Boolean));
  if (f.inPaymentExtract) rows = rows.filter((r) => r.payRows > 0);
  if (f.withInvoiceDate) rows = rows.filter((r) => r.invRows > 0);
  const size = body.all ? Math.max(1, rows.length) : Math.min(100, Math.max(1, Number(body.pageSize) || 25));
  const page = body.all ? 0 : Math.max(0, Number(body.page) || 0);
  const names = D.municipalities;
  return {
    total: rows.length,
    page,
    pageSize: size,
    rows: rows.slice(page * size, (page + 1) * size).map((r) => ({
      no: r.no,
      records: r.n,
      opportunities: r.opps,
      shape: r.shape,
      name: { state: r.names.length === 0 ? "none" : r.names.length === 1 ? "single" : "several", value: r.names.length ? r.names[0][0] : null, distinct: r.names.length },
      investors: r.investors.map((id) => ({ masked: maskId(id), found: D.investors.has(id) })),
      executionStatuses: r.rental.map(([value, n]) => ({ value, records: n })),
      start: { state: r.startState, value: r.start, flag: r.startFlag },
      end: { state: r.endState, value: r.end, flag: r.endFlag },
      valueWithVat: { state: r.vatState, value: r.valueWithVat },
      types: r.types.map(([value, n]) => ({ value, records: n })),
      statuses: r.statuses.map(([value, n]) => ({ value, records: n })),
      municipalities: r.codes.map((c) => ({ code: c, sourceName: names.get(c)?.sourceName || null })),
      paymentRowsInExtract: r.payRows,
      invoiceDateRows: r.invRows,
      hiddenRecords: r.hidden,
      contractValue: { state: r.valueState, value: r.value, distinct: r.valueCount },
      annualValue: { state: r.annualState, value: r.annual },
      conflicts: r.conflicts
    }))
  };
}
async function furasContract(no) {
  const D = await loadFuras();
  const key = String(no || "").trim();
  const idx = D.byNo.get(key);
  if (!idx) {
    const hit = [...D.byNo.keys()].find((k) => k.toUpperCase() === key.toUpperCase());
    if (!hit) return null;
    return furasContract(hit);
  }
  const C2 = D.views.contract.cols;
  const P2 = D.views.payment.cols;
  const extract = D.partition;
  const names = D.municipalities;
  const rec = (i) => {
    const link = C2.renewedcontractid[i] != null ? D.byPz.get(C2.renewedcontractid[i]) : void 0;
    return {
      recordKey: tail(C2.pzinskey[i]),
      opportunityNumber: C2.opportunitynumber[i],
      opportunityName: C2.opportunityname[i],
      investorId: maskId(C2.investorid[i]),
      contractType: C2.contracttype[i],
      status: C2.opportunitystatus[i],
      rentalStatus: C2.rentalstatus[i],
      renewalStatus: C2.renewalstatus[i],
      awardingDate: dateOnly(C2.awardingdate[i]),
      signingDate: dateOnly(C2.signingdate[i]),
      startDate: dateOnly(C2.startdate[i]),
      endDate: dateOnly(C2.enddate[i]),
      handoverPlanned: dateOnly(C2.dateofsitehandover[i]),
      handoverActual: dateOnly(C2.dateofsitehandoveractual[i]),
      contractValue: num(C2.contractvalue[i]),
      calculatedValue: num(C2.calculatedcontractvalue[i]),
      annualValue: num(C2.annualcontractvalue[i]),
      valueWithVat: num(C2.totalcontractvaluewithvat[i]),
      term: C2.contractterm[i],
      durationMonths: C2.contractdurationmonths[i],
      municipality: C2.municipalityid[i] == null ? null : { code: C2.municipalityid[i], sourceName: names.get(C2.municipalityid[i])?.sourceName || null, nameOnRecord: C2.municipality[i], flag: names.get(C2.municipalityid[i])?.flag || null },
      subMunicipality: C2.submunicipality[i],
      primaryLink: C2.primarycontractid[i] == null ? null : D.subset && C2.primarycontractid[i] === OUTSIDE_SUBSET ? { resolved: false, outsideSubset: true } : D.byPz.has(C2.primarycontractid[i]) ? { resolved: true, contractNumber: C2.contractnumber[D.byPz.get(C2.primarycontractid[i])] } : { resolved: false },
      renewalLink: C2.renewedcontractid[i] == null ? null : link == null ? D.subset && C2.renewedcontractid[i] === OUTSIDE_SUBSET ? { resolved: false, outsideSubset: true } : { resolved: false } : { resolved: true, contractNumber: C2.contractnumber[link], selfReference: link === i, sameContractNumber: C2.contractnumber[link] === C2.contractnumber[i] },
      dateFlags: Object.fromEntries(["startdate", "enddate", "signingdate", "awardingdate"].map((c) => [c, dateFlag(C2[c][i], extract)]).filter(([, v]) => v))
    };
  };
  const records = idx.map(rec);
  const groupMap = /* @__PURE__ */ new Map();
  records.forEach((r, i) => {
    const k = r.opportunityNumber ?? null;
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(i);
  });
  const groups = [...groupMap.entries()].map(([opportunityNumber, recordIndexes]) => ({ opportunityNumber, recordIndexes }));
  const fields = ["contractType", "status", "contractValue", "calculatedValue", "annualValue", "endDate", "startDate", "opportunityNumber", "investorId"];
  const differing = fields.filter((f) => new Set(records.map((r) => JSON.stringify(r[f]))).size > 1);
  const oppSet = new Set(idx.map((i) => C2.opportunitynumber[i]));
  const payIdx = D.payByNo.get(key) || [];
  const payments = payIdx.map((i) => ({
    batchNumber: num(P2.batchnumber[i]),
    batchYear: P2.batchyear[i],
    status: P2.batchstatus[i],
    paymentType: P2.paymenttype[i],
    method: P2.methodofcollectingpayments[i],
    batchMonths: P2.batchmonths[i],
    dueDate: dateOnly(P2.paymentduedate[i]),
    batchEndDate: dateOnly(P2.batchenddate[i]),
    invoiceDate: dateOnly(P2.invoicedate[i]),
    paymentDate: dateOnly(P2.paymentdate[i]),
    payable: num(P2.paymentamount[i]),
    vatAmount: num(P2.vatamount[i]),
    paid: num(P2.batchamountpaid[i]),
    outstanding: num(P2.batchamountbalance[i]),
    opportunityNumber: P2.opportunitynumber[i],
    investorId: maskId(P2.investorid[i]),
    recordsWithSameOpportunity: idx.filter((j) => C2.opportunitynumber[j] === P2.opportunitynumber[i]).length,
    dateFlags: Object.fromEntries([["dueDate", dateFlag(P2.paymentduedate[i], extract)], ["batchEndDate", dateFlag(P2.batchenddate[i], extract)], ["invoiceDate", dateFlag(P2.invoicedate[i], extract, { noFuture: true })], ["paymentDate", dateFlag(P2.paymentdate[i], extract, { noFuture: true })]].filter(([, v]) => v))
  })).sort((a, b) => String(a.opportunityNumber).localeCompare(String(b.opportunityNumber)) || (a.batchNumber ?? 1e9) - (b.batchNumber ?? 1e9) || String(a.dueDate).localeCompare(String(b.dueDate)));
  const M4 = D.views.contractmanagement.cols;
  const cm = new Set(D.cmByNo.get(key) || []);
  for (const o of oppSet) for (const i of D.cmByOpp.get(o) || []) cm.add(i);
  const oppNos = new Set(idx.map((i) => C2.opportunitynumber[i]).filter((x) => x != null));
  const billMap = /* @__PURE__ */ new Map();
  let placeholderRows = 0;
  let caseRowsWithBill = 0;
  for (const [view2, label] of [["contractmanagement", "ContractManagement"], ["entitymanagement", "EntityManagement"], ["imsfw_work", "IMSFW_Work"]]) {
    const X = D.views[view2].cols;
    const n = D.views[view2].rows;
    for (let i = 0; i < n; i += 1) {
      const b = X.sadadbillnumber[i];
      if (b == null) continue;
      const o = X.opportunitynumber[i];
      const cn = X.contractnumber[i];
      const mine = cn === key || cn == null && o != null && oppNos.has(o);
      if (!mine) continue;
      caseRowsWithBill += 1;
      if (b === BILL_PLACEHOLDER) {
        placeholderRows += 1;
        continue;
      }
      const e = billMap.get(b) || { number: b, views: [] };
      if (!e.views.includes(label)) e.views.push(label);
      billMap.set(b, e);
    }
  }
  const bills = { refs: [...billMap.values()].sort((a, b) => a.number < b.number ? -1 : 1), caseRowsWithBill, numbersNotRetained: placeholderRows, installmentLink: "unavailable" };
  const investorIds = [...new Set(idx.map((i) => C2.investorid[i]).filter((x) => x != null))];
  return {
    investor: { ids: investorIds.map((id) => ({ masked: maskId(id), found: D.investors.has(id) })), nameAvailable: false },
    bills,
    scope: D.scope ? { status: D.scope.status, hiddenRecords: D.hiddenByNo.get(key) || 0 } : null,
    contractNumber: key,
    records,
    recordCount: records.length,
    shape: shapeOf(records.length, groups.length),
    opportunityCount: groups.filter((g) => g.opportunityNumber != null).length,
    groups,
    differingFields: differing,
    currentRecordDetermined: false,
    payments: { rows: payments, rowsInExtract: payments.length, extractIsCapped: D.views.payment.capped },
    caseRows: { count: cm.size, byLabel: top(countBy([...cm].map((i) => M4.pylabel[i] || null))).map(([value, n]) => ({ value, rows: n })) },
    dataset: { extract, etl: D.etl }
  };
}
async function furasDecisionInput() {
  const S2 = await furasSummary();
  const c = S2.contracts;
  const p = S2.payments;
  const dateIssues = (o) => Object.values(o).reduce((t, v) => t + v, 0);
  return {
    dataset: S2.dataset,
    repeated: { numbers: c.numbersWithSeveralRecords, records: c.recordsInRepeatedNumbers, conflicts: c.conflictsAmongRepeated },
    conflictingValues: c.values.numbersWithConflictingValues,
    payments: { rows: p.rows, capped: p.capped, distinctNumbers: p.distinctNumbers, rowsMatchingSeveralRecords: p.rowsMatchingSeveralRecords, rowsNotFound: p.rowsNotFound, contractsWithThreePlusRows: p.contractsWithThreePlusRows, contiguous: p.contractsWithContiguousBatches },
    dateIssues: { due: dateIssues(p.dueDateFlags), invoice: dateIssues(p.invoiceDateFlags), payment: dateIssues(p.paymentDateFlags), flags: { due: p.dueDateFlags, invoice: p.invoiceDateFlags, payment: p.paymentDateFlags } },
    startDateFilled: c.dates.startFilled,
    records: c.records,
    statusValues: c.byStatus.length,
    renewal: c.renewal
  };
}

// src/data/permissions.js
var M3 = (id, group2, nameAr, nameEn, routes, descriptionAr, descriptionEn, scoped = true) => ({ id, group: group2, nameAr, nameEn, ar: nameAr, en: nameEn, routes, descriptionAr, descriptionEn, scoped });
var MODULES = [
  M3(
    "dashboard",
    "revenue",
    "\u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0648\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631",
    "Dashboard",
    ["/insights"],
    "\u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0648\u0627\u0644\u0631\u0633\u0648\u0645 \u0648\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A\u0629 \u0648\u062A\u0635\u062F\u064A\u0631 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0644\u0648\u062D\u0629.",
    "The indicators, charts and totals, and the dashboard report export."
  ),
  M3(
    "invoices_collected",
    "revenue",
    "\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629",
    "Collected Invoices",
    ["/invoices", "/invoices/:id"],
    "\u0633\u062C\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0648\u0635\u0641\u062D\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0648\u0645\u0633\u062A\u0646\u062F\u0627\u062A\u0647\u0627 \u0648\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0642\u0648\u0627\u0626\u0645.",
    "The collected-invoice register, the invoice page and its documents, and the list export."
  ),
  M3(
    "invoices_uncollected",
    "revenue",
    "\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629",
    "Uncollected Invoices",
    ["/collection", "/analysis/:taskId"],
    "\u0642\u0627\u0626\u0645\u0629 \u0639\u0645\u0644 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0627\u062A \u0648\u062A\u062D\u0644\u064A\u0644 \u0623\u0633\u0628\u0627\u0628 \u0639\u062F\u0645 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0648\u062A\u0635\u062F\u064A\u0631\u0647\u0645\u0627.",
    "The uncollected worklist and the non-collection analysis, and their export."
  ),
  M3(
    "enforcement",
    "revenue",
    "\u0625\u062F\u0627\u0631\u0629 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630",
    "Enforcement Management",
    ["/enforcement", "/enforcement-orders/*"],
    "\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0648\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629\u060C \u0648\u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0648\u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0648\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u0628\u0637.",
    "Enforcement orders, violations and linked collections, with file and document upload and link review."
  ),
  M3(
    "exclusions",
    "revenue",
    "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A",
    "Exclusions Management",
    ["/exclusions"],
    "\u0633\u062C\u0644 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A \u0648\u0623\u0633\u0628\u0627\u0628\u0647\u0627\u060C \u0648\u0631\u0641\u0639 \u0642\u0627\u0644\u0628 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A \u0648\u062A\u0637\u0628\u064A\u0642\u0647\u0627 \u0648\u0625\u0632\u0627\u0644\u062A\u0647\u0627.",
    "The exclusions register and its reasons, with the exclusions upload, apply and removal."
  ),
  M3(
    "contracts",
    "revenue",
    "\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629",
    "Investment Contracts",
    ["/contracts", "/contracts/:no"],
    "\u0628\u0637\u0627\u0642\u0627\u062A \u0627\u0644\u0639\u0642\u0648\u062F \u0648\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062B\u0645\u0631 \u0648\u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u0648\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629.",
    "Contract cards, investor details, instalments and the linked invoices."
  ),
  M3(
    "planning",
    "revenue",
    "\u062A\u062E\u0637\u064A\u0637 \u0627\u0644\u062A\u062D\u0635\u064A\u0644",
    "Collection Planning",
    ["/planning"],
    "\u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641\u0627\u062A \u0627\u0644\u0633\u0646\u0648\u064A\u0629 \u0648\u0627\u0644\u062A\u0648\u0642\u0639\u0627\u062A \u0648\u062A\u0639\u062F\u064A\u0644\u0647\u0627.",
    "The annual targets and the forecasts, and editing them."
  ),
  M3(
    "smart_reports",
    "revenue",
    "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0630\u0643\u064A\u0629",
    "Smart Reports",
    ["/smart-reports"],
    "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0648\u0633\u062C\u0644\u0647\u0627 \u0648\u0646\u0633\u062E\u0647\u0627 \u0627\u0644\u0645\u062D\u0641\u0648\u0638\u0629 \u0648\u062A\u0635\u062F\u064A\u0631\u0647\u0627.",
    "Create reports, their history and saved versions, and export them."
  ),
  M3(
    "decisions",
    "revenue",
    "\u063A\u0631\u0641\u0629 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A",
    "Decision Room",
    ["/decisions"],
    "\u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u0638\u0631\u0629 \u0648\u0628\u0646\u0648\u062F\u0647\u0627\u060C \u0645\u0639 \u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A (\u0628\u0644\u0627 \u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0627\u0645).",
    "The decisions awaiting action and their items, with follow-up flags and notes (no task assignment)."
  ),
  M3(
    "data_sources",
    "reference",
    "\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
    "Data Sources",
    ["/products*"],
    "\u0628\u0637\u0627\u0642\u0627\u062A \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0648\u062A\u0642\u0631\u064A\u0631\u0647\u0627\u060C \u0648\u0631\u0641\u0639 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631.",
    "The source cards and their report, and the invoice-records upload."
  ),
  M3(
    "metrics",
    "reference",
    "\u0642\u0627\u0645\u0648\u0633 \u0627\u0644\u0645\u0642\u0627\u064A\u064A\u0633",
    "Metrics Dictionary",
    ["/settings/metrics*"],
    "\u062A\u0639\u0631\u064A\u0641\u0627\u062A \u0627\u0644\u0645\u0642\u0627\u064A\u064A\u0633 \u0648\u0627\u0644\u0645\u0635\u0637\u0644\u062D\u0627\u062A (\u0628\u0644\u0627 \u0623\u0631\u0642\u0627\u0645).",
    "The metric and term definitions (no figures).",
    false
  ),
  M3(
    "users",
    "administration",
    "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646",
    "User Management",
    ["/settings/users"],
    "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0648\u062A\u0639\u062F\u064A\u0644\u0647\u0645 \u0648\u062A\u0639\u0637\u064A\u0644\u0647\u0645 \u0648\u0625\u0633\u0646\u0627\u062F \u0627\u0644\u062F\u0648\u0631 \u0648\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A \u0648\u0625\u0635\u062F\u0627\u0631 \u0631\u0645\u0648\u0632 \u0627\u0644\u062A\u0641\u0639\u064A\u0644.",
    "Create, edit and deactivate users, set the role and geographic scope and issue activation codes.",
    false
  ),
  M3(
    "roles",
    "administration",
    "\u0627\u0644\u0623\u062F\u0648\u0627\u0631 \u0648\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A",
    "Roles and Permissions",
    ["/settings/roles"],
    "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0623\u062F\u0648\u0627\u0631 \u0648\u062A\u0639\u062F\u064A\u0644\u0647\u0627 \u0648\u062D\u0630\u0641\u0647\u0627 \u0648\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642.",
    "Create, edit and delete roles, and the audit trail.",
    false
  )
];
var MODULE_IDS = MODULES.map((m) => m.id);
var BY_ID = new Map(MODULES.map((m) => [m.id, m]));
var RANK = new Map(MODULE_IDS.map((id, i) => [id, i]));
var unknownModules = (ids) => (ids || []).filter((i) => !BY_ID.has(i));
var isScopedModule = (id) => BY_ID.get(id)?.scoped === true;
var normalizeModules = (ids) => {
  const have = new Set(ids || []);
  return MODULE_IDS.filter((id) => have.has(id));
};
var ADMIN_ROLE_ID = "role-system-admin";
var AUDITOR_ROLE_ID = "role-auditor";
var ADMIN_KEEP_MODULES = ["users", "roles"];
var BUSINESS = ["dashboard", "invoices_collected", "invoices_uncollected", "enforcement", "exclusions", "contracts", "planning", "smart_reports", "decisions", "data_sources", "metrics"];
var STARTER_ROLES = [
  { id: ADMIN_ROLE_ID, nameAr: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645", nameEn: "Administrator", descriptionAr: "\u0643\u0644 \u0627\u0644\u0648\u062D\u062F\u0627\u062A\u060C \u0648\u064A\u062D\u062A\u0641\u0638 \u062F\u0627\u0626\u0645\u064B\u0627 \u0628\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u0631. \u062F\u0648\u0631 \u0645\u062D\u0645\u064A \u0644\u0627 \u064A\u064F\u062D\u0630\u0641.", descriptionEn: "Every module, and always keeps user and role management. A protected role that cannot be deleted.", modules: [...MODULE_IDS], readOnly: false, starter: true, protected: true },
  { id: "role-financial", nameAr: "\u0645\u062F\u064A\u0631 \u0645\u0627\u0644\u064A / \u0645\u062D\u0644\u0644", nameEn: "Financial Manager / Analyst", descriptionAr: "\u0643\u0644 \u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0648\u0627\u0644\u0645\u0631\u062C\u0639: \u064A\u0637\u0651\u0644\u0639 \u0648\u064A\u0635\u062F\u0651\u0631 \u0648\u064A\u0631\u0641\u0639 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A \u0648\u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0648\u064A\u062D\u062F\u0651\u062B \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641\u0627\u062A\u060C \u062F\u0648\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u0631.", descriptionEn: "Every revenue and reference module: sees, exports, uploads exclusions and records and updates targets, without user and role management.", modules: BUSINESS, readOnly: false, starter: true, protected: false },
  { id: "role-collection", nameAr: "\u0645\u0648\u0638\u0641 \u062A\u062D\u0635\u064A\u0644", nameEn: "Collection Officer", descriptionAr: "\u064A\u062A\u0627\u0628\u0639 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0648\u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0651\u0644\u0629 \u0648\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0639\u0645\u0644 \u0648\u064A\u0636\u0639 \u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A\u060C \u062F\u0648\u0646 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u062A \u0623\u0648 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0623\u0648 \u0627\u0644\u062A\u062E\u0637\u064A\u0637 \u0623\u0648 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A.", descriptionEn: "Works the collected and uncollected invoices and worklists and records follow-up flags and notes, without exclusions, enforcement, planning or file uploads.", modules: ["dashboard", "invoices_collected", "invoices_uncollected", "contracts", "decisions", "smart_reports", "metrics"], readOnly: false, starter: true, protected: false },
  { id: "role-enforcement", nameAr: "\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", nameEn: "Enforcement Reviewer", descriptionAr: "\u064A\u062F\u064A\u0631 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630: \u064A\u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0648\u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0648\u064A\u0631\u0627\u062C\u0639 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0628\u064A\u0646 \u0627\u0644\u0623\u0645\u0631 \u0648\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u064A\u0624\u0643\u062F\u0647\u0627 \u0623\u0648 \u064A\u0631\u0641\u0636\u0647\u0627.", descriptionEn: "Manages enforcement orders: uploads files and documents and reviews, confirms or rejects the links between an order and invoices.", modules: ["invoices_collected", "invoices_uncollected", "enforcement", "contracts", "decisions", "smart_reports", "metrics"], readOnly: false, starter: true, protected: false },
  { id: AUDITOR_ROLE_ID, nameAr: "\u0645\u062F\u0642\u0642", nameEn: "Auditor", descriptionAr: "\u064A\u0637\u0651\u0644\u0639 \u0639\u0644\u0649 \u0643\u0644 \u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0648\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0648\u064A\u0635\u062F\u0651\u0631\u060C \u062F\u0648\u0646 \u0623\u064A \u062A\u063A\u064A\u064A\u0631 \u0623\u0648 \u0631\u0641\u0639 \u0623\u0648 \u0645\u0631\u0627\u062C\u0639\u0629 (\u062F\u0648\u0631 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637).", descriptionEn: "Sees every module and the audit trail and may export, but changes nothing: no uploads, confirmations or edits (a read-only role).", modules: [...MODULE_IDS], readOnly: true, starter: true, protected: false }
].map((r) => ({ ...r, modules: normalizeModules(r.modules) }));
function permissionsOf(role) {
  const ids = Array.isArray(role) ? role : role && Array.isArray(role.modules) ? role.modules : [];
  return new Set(normalizeModules(ids));
}
var AMANAH_NAME = new Map(ENTITIES.map((e) => [e.en, e]));
function describeUserSummary(user, role, lang = "ar") {
  const ar = lang !== "en";
  const scope = normalizeGeoScope(user && user.scope);
  let geo = describeGeoScope(scope, lang);
  if (!scope.all && scope.grants.length === 1) {
    const e = AMANAH_NAME.get(scope.grants[0].amanah);
    const lead = ar ? "\u0623\u0645\u0627\u0646\u0629 \u0648\u0627\u062D\u062F\u0629" : "1 Amanah";
    if (e && geo.startsWith(lead)) geo = (ar ? e.ar : e.en) + geo.slice(lead.length);
  }
  const roleName = role ? (ar ? role.nameAr : role.nameEn) || role.nameAr || role.nameEn || "" : "";
  return roleName ? `${roleName} \xB7 ${geo}` : geo;
}
var PERMISSIONS = MODULES.map((m) => ({ id: m.id, module: m.id, action: "access", ar: m.nameAr, en: m.nameEn, descAr: m.descriptionAr, descEn: m.descriptionEn, dependsOn: [], scoped: m.scoped }));
var PERMISSIONS_BY_MODULE = Object.fromEntries(PERMISSIONS.map((p) => [p.id, [p]]));

// src/utils/identity.js
var clean2 = (v) => typeof v === "string" ? v.trim() : "";
function displayName(user, lang = "ar") {
  if (!user || typeof user !== "object") return "";
  const ar = clean2(user.nameAr);
  const en = clean2(user.nameEn);
  const plain = clean2(user.name);
  const first = lang === "en" ? en || ar : ar || en;
  return first || plain || clean2(user.username) || clean2(user.user) || clean2(user.email) || clean2(user.id);
}
var ARABIC = /[؀-ۿ]/;
var DIACRITICS = /[ؐ-ًؚ-ٰٟـ]/g;
var letterOf = (w) => Array.from(w)[0] || "";
var stripArticle = (w) => w.length > 3 && w.startsWith("\u0627\u0644") ? w.slice(2) : w;
function initialsOf(name) {
  const s = clean2(name).replace(DIACRITICS, "");
  if (!s) return "";
  const arabic = ARABIC.test(s);
  let words = s.split(/[\s\-·._,]+/).filter(Boolean);
  if (arabic) words = words.map(stripArticle);
  const out = words.length > 1 ? letterOf(words[0]) + letterOf(words[words.length - 1]) : Array.from(words[0] || "").slice(0, 2).join("");
  return arabic ? out : out.toUpperCase();
}
var initialsFor = (user, lang = "ar") => initialsOf(displayName(user, lang));

// server/identity/store.js
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";

// server/identity/crypto.js
import { scryptSync, randomBytes, createHmac, createHash, timingSafeEqual } from "node:crypto";
var COST = { N: 16384, r: 8, p: 1, keylen: 64 };
var ALGO = `scrypt:N${COST.N}r${COST.r}p${COST.p}`;
var costOverride = null;
var parseAlgo = (algo) => {
  const m = /^scrypt:N(\d+)r(\d+)p(\d+)$/.exec(String(algo || ""));
  return m ? { N: +m[1], r: +m[2], p: +m[3], keylen: COST.keylen } : null;
};
var algoOf = (c) => `scrypt:N${c.N}r${c.r}p${c.p}`;
function hashPassword(password) {
  const c = costOverride || COST;
  const salt = randomBytes(16);
  const hash3 = scryptSync(String(password), salt, c.keylen, { N: c.N, r: c.r, p: c.p, maxmem: 128 * c.N * c.r * 2 });
  return { hash: hash3.toString("hex"), salt: salt.toString("hex"), algo: algoOf(c) };
}
function verifyPassword(password, credential) {
  const c = credential && parseAlgo(credential.algo);
  if (!c || !credential.hash || !credential.salt) return false;
  try {
    const got = scryptSync(String(password), Buffer.from(credential.salt, "hex"), c.keylen, { N: c.N, r: c.r, p: c.p, maxmem: 128 * c.N * c.r * 2 });
    const want = Buffer.from(credential.hash, "hex");
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}
var b64u = (buf) => Buffer.from(buf).toString("base64url");
var fromB64u = (s) => Buffer.from(String(s), "base64url");
var sign = (secret, data) => createHmac("sha256", secret).update(data).digest();
function signToken(secret, payload) {
  const body = b64u(JSON.stringify({ uid: payload.uid, tv: payload.tv, exp: payload.exp }));
  return `${body}.${b64u(sign(secret, body))}`;
}
function verifyToken(secret, token, nowMs = Date.now()) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const i = token.indexOf(".");
  if (i <= 0 || token.indexOf(".", i + 1) >= 0) return null;
  const body = token.slice(0, i);
  const sig = fromB64u(token.slice(i + 1));
  const want = sign(secret, body);
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  try {
    const p = JSON.parse(fromB64u(body).toString("utf8"));
    if (!p || typeof p.uid !== "string" || !Number.isInteger(p.tv) || typeof p.exp !== "number" || p.exp <= nowMs) return null;
    return { uid: p.uid, tv: p.tv, exp: p.exp };
  } catch {
    return null;
  }
}
var randomId = (prefix) => `${prefix}-${randomBytes(6).toString("hex")}`;
var randomSecret = () => randomBytes(32).toString("hex");
var sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
function newActivationCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += A[b[i] % A.length];
    if (i % 4 === 3 && i < 11) s += "-";
  }
  return s;
}
var normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
var hashCode = (c) => sha256(`activation|${normalizeCode(c)}`);

// server/identity/store.js
var SCHEMA_VERSION = 2;
var AUDIT_CAP = 5e3;
var SEED_ACCOUNTS = [
  { id: "usr-demo", username: "demo", password: "demo123", nameAr: "Li Fangjun", nameEn: "Li Fangjun", avatar: "LF", titleAr: "\u0645\u0631\u0643\u0632 \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629 \xB7 \u0645\u062F\u064A\u0631", titleEn: "Shared Service Center \xB7 Manager", roleId: ADMIN_ROLE_ID },
  { id: "usr-auditor", username: "auditor", password: "demo123", nameAr: "\u0623\u062D\u0645\u062F \u0622\u0644 \u0633\u0639\u0648\u062F", nameEn: "Ahmad Al-Saud", avatar: "AS", titleAr: "\u0645\u062F\u0642\u0642", titleEn: "Auditor", roleId: AUDITOR_ROLE_ID },
  { id: "usr-admin", username: "admin", password: "admin", nameAr: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645", nameEn: "System Admin", avatar: "AD", titleAr: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629", titleEn: "Platform Admin", roleId: ADMIN_ROLE_ID }
];
var defaultFile = () => path2.join(process.cwd(), "server", ".data", "identity.json");
var state2 = null;
function canWrite(file) {
  try {
    fs2.mkdirSync(path2.dirname(file), { recursive: true });
    const probe = `${file}.probe-${process.pid}`;
    fs2.writeFileSync(probe, "1");
    fs2.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
function chooseLocation(requested) {
  const want = requested || process.env.IIM_IDENTITY_FILE || defaultFile();
  if (want === ":memory:") return { file: null, mode: "memory" };
  if (canWrite(want)) return { file: want, mode: "file" };
  const tmp = path2.join(os.tmpdir(), "iim-identity.json");
  if (canWrite(tmp)) return { file: tmp, mode: "tmp" };
  return { file: null, mode: "memory" };
}
function readFile(file) {
  if (!file || !fs2.existsSync(file)) return null;
  try {
    const j = JSON.parse(fs2.readFileSync(file, "utf8"));
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}
function writeAtomic(file, db) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs2.writeFileSync(tmp, JSON.stringify(db), { mode: 384 });
  fs2.renameSync(tmp, file);
}
var emptyDb = () => ({ schemaVersion: 0, accessVersion: 1, secret: null, users: [], roles: [], audit: [], activations: [] });
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var OLD_MODULE_OF = (id) => {
  const [pre, action] = String(id).split(".");
  if (pre === "invoices") return ["invoices_collected", "invoices_uncollected"];
  if (pre === "collection") return ["invoices_uncollected"];
  if (pre === "reports") return ["smart_reports"];
  if (pre === "sources" || pre === "data" && action === "upload") return ["data_sources"];
  if (pre === "roles" || pre === "audit") return ["roles"];
  if (["dashboard", "exclusions", "contracts", "enforcement", "planning", "decisions", "metrics", "users"].includes(pre)) return [pre];
  return [];
};
var OLD_WRITE_ACTIONS = /* @__PURE__ */ new Set(["upload", "manage", "review", "followup", "update"]);
var OLD_WRITE_PERMS = { exclusions: ["exclusions.upload", "exclusions.manage"], enforcement: ["enforcement.upload", "enforcement.review"], planning: ["planning.update"], decisions: ["decisions.followup"], data_sources: ["data.upload"], users: ["users.manage"], roles: ["roles.manage"] };
var OLD_STARTER_NAMES = { "role-system-admin": "System Administrator", "role-collection": "Collection Officer", "role-auditor": "Read-only Auditor", "role-financial": "Financial Manager / Analyst", "role-enforcement": "Enforcement Reviewer" };
function mapOldRole(role) {
  const perms = Array.isArray(role.permissions) ? role.permissions : [];
  const mods = /* @__PURE__ */ new Set();
  for (const p of perms) for (const m of OLD_MODULE_OF(p)) mods.add(m);
  const readOnly = !perms.some((p) => OLD_WRITE_ACTIONS.has(String(p).split(".")[1]));
  const widened = readOnly ? [] : [...mods].filter((m) => OLD_WRITE_PERMS[m] && !OLD_WRITE_PERMS[m].some((p) => perms.includes(p)));
  return { modules: normalizeModules([...mods]), readOnly, widened: normalizeModules(widened) };
}
var SCOPE_TEXT = (s) => {
  const n = normalizeGeoScope(s);
  return n.all ? "all" : `${n.grants.length} Amanah grant(s)${n.nonMunicipal ? " + non-municipal" : ""}`;
};
function migrateToSimplified(db, now) {
  let changed = false;
  const summary3 = { roles: [], users: [], dropped: [], widened: {} };
  for (const r of db.roles) {
    if (Array.isArray(r.modules) && !Array.isArray(r.permissions)) {
      if (typeof r.readOnly !== "boolean") {
        r.readOnly = false;
        changed = true;
      }
      continue;
    }
    const m = mapOldRole(r);
    const starter = STARTER_ROLES.find((s) => s.id === r.id);
    r.modules = m.modules;
    r.readOnly = r.protected ? false : m.readOnly;
    delete r.permissions;
    if (starter && r.starter && r.nameEn === OLD_STARTER_NAMES[r.id]) {
      r.nameAr = starter.nameAr;
      r.nameEn = starter.nameEn;
      r.descriptionAr = starter.descriptionAr;
      r.descriptionEn = starter.descriptionEn;
    }
    r.updatedAt = now;
    changed = true;
    summary3.roles.push({ id: r.id, modules: r.modules.length, readOnly: r.readOnly });
    if (m.widened.length && !r.readOnly) summary3.widened[r.id] = m.widened;
  }
  for (const u of db.users) {
    if (!Array.isArray(u.assignments)) {
      if (u.roleId === void 0) {
        u.roleId = null;
        u.scope = EMPTY_SCOPE;
        changed = true;
      }
      continue;
    }
    const first = u.assignments[0];
    const dropped = u.assignments.slice(1);
    u.roleId = first ? first.roleId : null;
    u.scope = first ? normalizeGeoScope(first.scope) : EMPTY_SCOPE;
    delete u.assignments;
    if (dropped.length) {
      u.tokenVersion = (u.tokenVersion || 1) + 1;
      db.audit.push({
        id: randomId("aud"),
        at: now,
        actorId: "migration",
        actorName: "\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0646\u0638\u0627\u0645",
        actorNameEn: "System migration",
        action: "migration",
        targetType: "user",
        targetId: u.id,
        summary: `\u062A\u0631\u062D\u064A\u0644 ${u.username} \u0625\u0644\u0649 \u062F\u0648\u0631 \u0648\u0627\u062D\u062F \u0648\u0646\u0637\u0627\u0642 \u0648\u0627\u062D\u062F: \u0627\u062D\u062A\u064F\u0641\u0638 \u0628\u0627\u0644\u0623\u0648\u0644 \u0648\u0623\u064F\u0633\u0642\u0637 ${dropped.length}`,
        summaryEn: `${u.username} migrated to ONE role and ONE scope: the first assignment kept, ${dropped.length} dropped`,
        before: { assignments: [first, ...dropped].map((a) => ({ roleId: a.roleId, scope: SCOPE_TEXT(a.scope) })) },
        after: { roleId: u.roleId, scope: SCOPE_TEXT(u.scope), dropped: dropped.map((a) => ({ roleId: a.roleId, scope: SCOPE_TEXT(a.scope) })) }
      });
      summary3.dropped.push(u.username);
    }
    u.updatedAt = now;
    summary3.users.push(u.username);
    changed = true;
  }
  if (changed) db.audit.push({
    id: randomId("aud"),
    at: now,
    actorId: "migration",
    actorName: "\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0646\u0638\u0627\u0645",
    actorNameEn: "System migration",
    action: "migration",
    targetType: "session",
    targetId: "schema-v2",
    summary: `\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0647\u0648\u064A\u0629 \u0625\u0644\u0649 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0628\u0633\u0651\u0637 (\u0627\u0644\u0625\u0635\u062F\u0627\u0631 2): ${summary3.roles.length} \u0623\u062F\u0648\u0627\u0631\u060C ${summary3.users.length} \u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646\u060C ${summary3.dropped.length} \u0641\u0642\u062F\u0648\u0627 \u0625\u0633\u0646\u0627\u062F\u064B\u0627 \u0625\u0636\u0627\u0641\u064A\u064B\u0627`,
    summaryEn: `Identity migrated to the simplified model (schema 2): ${summary3.roles.length} roles, ${summary3.users.length} users, ${summary3.dropped.length} lost extra assignments`,
    after: { roles: summary3.roles, users: summary3.users, usersWithDroppedAssignments: summary3.dropped, rolesWithNewWritePower: summary3.widened }
  });
  return changed;
}
var OLD_DEMO_NAMES = { id: "usr-demo", nameAr: "\u0637\u0627\u0631\u0642", nameEn: "Li Fangjun" };
var hasOldDemoName = (u) => u && u.id === OLD_DEMO_NAMES.id && u.nameAr === OLD_DEMO_NAMES.nameAr && u.nameEn === OLD_DEMO_NAMES.nameEn;
var needsIdentityNameFix = (db) => Array.isArray(db && db.users) && db.users.some(hasOldDemoName);
function fixIdentityNames(db, now) {
  const fixed = db.users.filter(hasOldDemoName);
  if (!fixed.length) return false;
  for (const u of fixed) {
    u.nameAr = u.nameEn;
    u.avatar = "LF";
    u.updatedAt = now;
  }
  db.audit.push({
    id: randomId("aud"),
    at: now,
    actorId: "migration",
    actorName: "\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0646\u0638\u0627\u0645",
    actorNameEn: "System migration",
    action: "migration",
    targetType: "user",
    targetId: fixed[0].id,
    summary: "\u062A\u0648\u062D\u064A\u062F \u0627\u0633\u0645 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A: \u0627\u0633\u0645 \u0645\u0639\u062A\u0645\u062F \u0648\u0627\u062D\u062F (Li Fangjun) \u064A\u0638\u0647\u0631 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0628\u062F\u0644 \u0627\u0633\u0645\u064A\u0646 \u0645\u062E\u062A\u0644\u0641\u064A\u0646",
    summaryEn: "Demo account name unified: ONE verified display name (Li Fangjun) is shown in Arabic and English instead of two different names",
    before: { nameAr: OLD_DEMO_NAMES.nameAr, nameEn: OLD_DEMO_NAMES.nameEn },
    after: { nameAr: "Li Fangjun", nameEn: "Li Fangjun" }
  });
  return true;
}
function migrate(db, { now = nowIso() } = {}) {
  let changed = false;
  if (!Array.isArray(db.users)) {
    db.users = [];
    changed = true;
  }
  if (!Array.isArray(db.roles)) {
    db.roles = [];
    changed = true;
  }
  if (!Array.isArray(db.audit)) {
    db.audit = [];
    changed = true;
  }
  if (!Array.isArray(db.activations)) {
    db.activations = [];
    changed = true;
  }
  if (!Number.isInteger(db.accessVersion)) {
    db.accessVersion = 1;
    changed = true;
  }
  const from = Number.isInteger(db.schemaVersion) ? db.schemaVersion : 0;
  if (from < 1) {
    const added = { roles: [], users: [] };
    for (const r of STARTER_ROLES) if (!db.roles.some((x) => x.id === r.id)) {
      db.roles.push({ ...r, modules: [...r.modules], createdAt: now, updatedAt: now });
      added.roles.push(r.id);
    }
    for (const a of SEED_ACCOUNTS) {
      if (db.users.some((u) => u.id === a.id || u.username === a.username)) continue;
      db.users.push({
        id: a.id,
        username: a.username,
        email: null,
        nameAr: a.nameAr,
        nameEn: a.nameEn,
        avatar: a.avatar,
        titleAr: a.titleAr,
        titleEn: a.titleEn,
        status: "active",
        roleId: a.roleId,
        scope: ALL_SCOPE,
        tokenVersion: 1,
        createdAt: now,
        createdBy: "migration",
        updatedAt: now,
        lastLoginAt: null,
        credential: hashPassword(a.password)
      });
      added.users.push(a.username);
    }
    db.audit.push({
      id: randomId("aud"),
      at: now,
      actorId: "migration",
      actorName: "\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0646\u0638\u0627\u0645",
      actorNameEn: "System migration",
      action: "migration",
      targetType: "session",
      targetId: `schema-v${SCHEMA_VERSION}`,
      summary: `\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0647\u0648\u064A\u0629 (\u0627\u0644\u0625\u0635\u062F\u0627\u0631 ${SCHEMA_VERSION}): ${added.roles.length} \u0623\u062F\u0648\u0627\u0631\u060C ${added.users.length} \u062D\u0633\u0627\u0628\u0627\u062A`,
      summaryEn: `Identity initialised (schema ${SCHEMA_VERSION}): ${added.roles.length} roles, ${added.users.length} accounts`,
      after: { roles: added.roles, users: added.users }
    });
    changed = true;
  }
  if (from < 2 || db.roles.some((r) => Array.isArray(r.permissions)) || db.users.some((u) => Array.isArray(u.assignments))) {
    if (migrateToSimplified(db, now)) changed = true;
  }
  const admin = db.roles.find((r) => r.id === ADMIN_ROLE_ID);
  if (admin) {
    const missing = ADMIN_KEEP_MODULES.filter((m) => !admin.modules.includes(m));
    if (missing.length || !admin.protected || admin.readOnly) {
      admin.modules = normalizeModules([...admin.modules, ...ADMIN_KEEP_MODULES]);
      admin.protected = true;
      admin.readOnly = false;
      admin.updatedAt = now;
      changed = true;
    }
  }
  if (fixIdentityNames(db, now)) {
    changed = true;
  }
  if (from < SCHEMA_VERSION) {
    db.schemaVersion = SCHEMA_VERSION;
    db.accessVersion += 1;
    changed = true;
  }
  if (db.audit.length > AUDIT_CAP) {
    db.audit.splice(0, db.audit.length - AUDIT_CAP);
    changed = true;
  }
  return changed;
}
function backupOnce(file, db) {
  if (!file || !needsIdentityNameFix(db)) return;
  try {
    const bak = `${file}.pre-names.bak`;
    if (fs2.existsSync(file) && !fs2.existsSync(bak)) fs2.copyFileSync(file, bak, fs2.constants.COPYFILE_EXCL);
  } catch {
  }
}
function ensure() {
  if (state2) return state2;
  const loc = chooseLocation(null);
  const db = readFile(loc.file) || emptyDb();
  state2 = { ...loc, db, dirty: false };
  backupOnce(loc.file, db);
  if (migrate(db)) persist();
  return state2;
}
var getDb = () => ensure().db;
var storageInfo = () => {
  const s = ensure();
  return { mode: s.mode, durable: s.mode === "file" };
};
function persist() {
  const s = ensure();
  s.dirty = false;
  if (!s.file) return;
  try {
    writeAtomic(s.file, s.db);
  } catch {
    s.mode = "memory";
    s.file = null;
  }
}
function commit() {
  const s = ensure();
  s.db.accessVersion += 1;
  persist();
  return s.db.accessVersion;
}
function markDirty() {
  ensure().dirty = true;
}
if (typeof process !== "undefined" && process.on) process.on("beforeExit", () => {
  if (state2 && state2.dirty) persist();
});
function signingSecret() {
  if (process.env.IIM_AUTH_SECRET) return process.env.IIM_AUTH_SECRET;
  const s = ensure();
  if (s.mode !== "file" && process.env.VERCEL) return `vercel|${process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_PROJECT_ID || "local"}|iim-identity`;
  if (!s.db.secret) {
    s.db.secret = randomSecret();
    persist();
  }
  return s.db.secret;
}

// server/identity/service.js
var ApiError = class extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
};
var clock = () => Date.now();
var nowIso2 = () => new Date(clock()).toISOString();
var SESSION_MS = (Number(process.env.IIM_SESSION_HOURS) || 12) * 36e5;
var ACTIVATION_MS = 72 * 36e5;
var VERR = (field, code, ar, en) => ({ field, code, ar, en });
var validationError = (fields) => new ApiError(400, "validation_error", { fields });
var rolesIndex = (roles) => roles instanceof Map ? roles : Array.isArray(roles) ? new Map(roles.map((r) => [r.id, r])) : new Map(Object.entries(roles || {}));
var roleBrief = (r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, readOnly: !!r.readOnly });
function computeAccess(assignment, roles) {
  const idx = rolesIndex(roles);
  const role = assignment && idx.get(assignment.roleId);
  const scope = normalizeGeoScope(assignment && assignment.scope);
  if (!role) return { permissions: /* @__PURE__ */ new Set(), modules: [], scopes: {}, role: null, readOnly: false, overallScope: EMPTY_SCOPE };
  const permissions = permissionsOf(role);
  const scopes = {};
  for (const m of permissions) scopes[m] = scope;
  return { permissions, modules: normalizeModules([...permissions]), scopes, role: roleBrief(role), readOnly: !!role.readOnly, overallScope: scope };
}
function effectiveScopeFor(access, moduleId) {
  if (!access || !access.permissions || !access.permissions.has(moduleId)) return EMPTY_SCOPE;
  const s = access.scopes instanceof Map ? access.scopes.get(moduleId) : access.scopes?.[moduleId];
  return s ? normalizeGeoScope(s) : EMPTY_SCOPE;
}
function accessViolation(cand, base) {
  for (const m of cand.permissions) {
    if (!base.permissions.has(m)) return { module: m, permission: m, kind: "module" };
    if (isScopedModule(m) && !geoScopeSubset(effectiveScopeFor(cand, m), effectiveScopeFor(base, m))) return { module: m, permission: m, kind: "scope" };
  }
  if (base.readOnly && cand.permissions.size && !cand.readOnly) return { module: null, permission: "read_only", kind: "read_only" };
  return null;
}
var roleList = () => getDb().roles;
var accessCache = { db: null, version: -1, map: /* @__PURE__ */ new Map() };
function accessOfUser(user) {
  const db = getDb();
  if (accessCache.db !== db || accessCache.version !== db.accessVersion) {
    accessCache.db = db;
    accessCache.version = db.accessVersion;
    accessCache.map = /* @__PURE__ */ new Map();
  }
  let a = accessCache.map.get(user.id);
  if (!a) {
    a = computeAccess({ roleId: user.roleId, scope: user.scope }, roleList());
    accessCache.map.set(user.id, a);
  }
  return a;
}
var isFullAdminUser = (u) => u.status === "active" && u.roleId === ADMIN_ROLE_ID && isAllGeoScope(u.scope);
var fullAdminCount = (users) => users.filter(isFullAdminUser).length;
var summaryOf = (scope) => ({ ar: describeGeoScope(scope, "ar"), en: describeGeoScope(scope, "en") });
var userSummary = (u, role) => ({ ar: describeUserSummary(u, role, "ar"), en: describeUserSummary(u, role, "en") });
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email || null,
    nameAr: u.nameAr,
    nameEn: u.nameEn,
    avatar: initialsFor(u, "en"),
    titleAr: u.titleAr || null,
    titleEn: u.titleEn || null,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt || null,
    roleId: u.roleId || null,
    scope: normalizeGeoScope(u.scope)
  };
}
function buildMe(user, access) {
  const u = publicUser(user);
  const scope = u.scope;
  const role = getDb().roles.find((r) => r.id === u.roleId) || null;
  const scopes = {};
  for (const m of access.modules) scopes[m] = effectiveScopeFor(access, m);
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    nameAr: u.nameAr,
    nameEn: u.nameEn,
    avatar: initialsFor(u, "en"),
    titleAr: u.titleAr,
    titleEn: u.titleEn,
    status: u.status,
    role: access.role,
    readOnly: access.readOnly,
    modules: [...access.modules],
    permissions: [...access.modules],
    scope,
    scopes,
    scopeSummary: summaryOf(scope),
    summary: userSummary(u, role),
    accessVersion: getDb().accessVersion
  };
}
var activationPending = (db, userId) => db.activations.some((a) => a.userId === userId && !a.usedAt && !a.revokedAt && Date.parse(a.expiresAt) > clock());
function userRow(u, db = getDb()) {
  const access = accessOfUser(u);
  const role = db.roles.find((r) => r.id === u.roleId) || null;
  const scope = normalizeGeoScope(u.scope);
  return {
    id: u.id,
    username: u.username,
    email: u.email || null,
    nameAr: u.nameAr,
    nameEn: u.nameEn,
    avatar: initialsFor(u, "en"),
    titleAr: u.titleAr || null,
    titleEn: u.titleEn || null,
    status: u.status,
    createdAt: u.createdAt,
    createdBy: u.createdBy,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt || null,
    roleId: u.roleId || null,
    roleNameAr: role ? role.nameAr : null,
    roleNameEn: role ? role.nameEn : null,
    roleReadOnly: role ? !!role.readOnly : false,
    scope,
    scopeSummary: summaryOf(scope),
    summary: userSummary(u, role),
    moduleCount: access.permissions.size,
    activationPending: activationPending(db, u.id)
  };
}
var roleRow = (r, db = getDb()) => {
  const modules = normalizeModules(r.modules);
  return {
    id: r.id,
    nameAr: r.nameAr,
    nameEn: r.nameEn,
    descriptionAr: r.descriptionAr || "",
    descriptionEn: r.descriptionEn || "",
    modules,
    readOnly: !!r.readOnly,
    starter: !!r.starter,
    protected: !!r.protected,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    moduleCount: modules.length,
    userCount: db.users.filter((u) => u.roleId === r.id).length
  };
};
var actorFields = (actor) => actor ? { actorId: actor.id, actorName: actor.nameAr || actor.nameEn || actor.id, actorNameEn: actor.nameEn || actor.nameAr || actor.id } : { actorId: "system", actorName: "\u0627\u0644\u0646\u0638\u0627\u0645", actorNameEn: "System" };
function auditLog(actor, action, targetType, targetId, summary3, before, after, { persistNow = true } = {}) {
  const db = getDb();
  db.audit.push({ id: randomId("aud"), at: nowIso2(), ...actorFields(actor), action, targetType, targetId: String(targetId), summary: summary3.ar, summaryEn: summary3.en, ...before !== void 0 ? { before } : {}, ...after !== void 0 ? { after } : {} });
  if (db.audit.length > 5e3) db.audit.splice(0, db.audit.length - 5e3);
  if (persistNow) persist();
  else markDirty();
}
var recentDenied = /* @__PURE__ */ new Map();
function auditDenied(actor, permission, route, reason) {
  const k = `${actor ? actor.id : "-"}|${permission}|${route}|${reason || ""}`;
  const t = clock();
  if (recentDenied.has(k) && t - recentDenied.get(k) < 6e4) return;
  recentDenied.set(k, t);
  if (recentDenied.size > 500) recentDenied.delete(recentDenied.keys().next().value);
  auditLog(actor, "access_denied", "session", actor ? actor.id : "-", { ar: `\u0645\u062D\u0627\u0648\u0644\u0629 \u0648\u0635\u0648\u0644 \u0645\u0631\u0641\u0648\u0636\u0629: ${permission}${reason ? ` (${reason})` : ""}`, en: `Denied access attempt: ${permission}${reason ? ` (${reason})` : ""}` }, void 0, { permission, route, ...reason ? { reason } : {} });
}
function listAudit({ limit = 100, offset = 0, targetType, targetId, actorId, action } = {}) {
  let rows = getDb().audit;
  if (targetType) rows = rows.filter((e) => e.targetType === targetType);
  if (targetId) rows = rows.filter((e) => e.targetId === targetId);
  if (actorId) rows = rows.filter((e) => e.actorId === actorId);
  if (action) rows = rows.filter((e) => e.action === action);
  const total = rows.length;
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  const off = Math.max(0, Number(offset) || 0);
  return { total, entries: rows.slice().reverse().slice(off, off + lim) };
}
var auditUserState = (u) => ({ status: u.status, roleId: u.roleId || null, scope: describeGeoScope(u.scope, "en") });
var failures = /* @__PURE__ */ new Map();
var LOCK_AFTER = 8;
var LOCK_MS = 6e4;
function noteFailure(name) {
  const f = failures.get(name) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= LOCK_AFTER) {
    f.until = clock() + LOCK_MS;
    f.n = 0;
  }
  failures.set(name, f);
  if (failures.size > 2e3) failures.delete(failures.keys().next().value);
}
var isLocked = (name) => (failures.get(name)?.until || 0) > clock();
var dummyCredential = null;
var burnTime = (password) => {
  dummyCredential = dummyCredential || hashPassword("not-a-real-password");
  verifyPassword(password, dummyCredential);
};
function issueToken(user) {
  return signToken(signingSecret(), { uid: user.id, tv: user.tokenVersion, exp: clock() + SESSION_MS });
}
var findByUsername = (name) => {
  const n = String(name || "").trim().toLowerCase();
  return getDb().users.find((u) => u.username === n) || null;
};
function login({ username, password } = {}) {
  const name = String(username || "").trim().toLowerCase();
  if (!name || typeof password !== "string" || !password) throw new ApiError(401, "invalid_credentials");
  if (isLocked(name)) throw new ApiError(429, "too_many_attempts");
  const user = findByUsername(name);
  if (!user) {
    burnTime(password);
    noteFailure(name);
    throw new ApiError(401, "invalid_credentials");
  }
  if (!user.credential) {
    if (user.status === "inactive") {
      auditLog(null, "login_denied", "user", user.id, { ar: `\u0631\u064F\u0641\u0636 \u062F\u062E\u0648\u0644 \u062D\u0633\u0627\u0628 \u0645\u0639\u0637\u0651\u0644: ${user.username}`, en: `Login refused for a deactivated account: ${user.username}` });
      throw new ApiError(403, "account_inactive");
    }
    throw new ApiError(403, "account_not_activated");
  }
  if (!verifyPassword(password, user.credential)) {
    noteFailure(name);
    throw new ApiError(401, "invalid_credentials");
  }
  if (user.status === "inactive") {
    auditLog(null, "login_denied", "user", user.id, { ar: `\u0631\u064F\u0641\u0636 \u062F\u062E\u0648\u0644 \u062D\u0633\u0627\u0628 \u0645\u0639\u0637\u0651\u0644: ${user.username}`, en: `Login refused for a deactivated account: ${user.username}` });
    throw new ApiError(403, "account_inactive");
  }
  if (user.status !== "active") throw new ApiError(403, "account_not_activated");
  failures.delete(name);
  const access = accessOfUser(user);
  const me = buildMe(user, access);
  user.lastLoginAt = nowIso2();
  markDirty();
  return { token: issueToken(user), me };
}
function authenticate(req) {
  const h = req && req.headers ? req.headers.authorization || req.headers.Authorization : null;
  const v = Array.isArray(h) ? h[0] : h;
  const m = typeof v === "string" ? /^Bearer\s+(\S+)\s*$/i.exec(v) : null;
  if (!m) return null;
  const p = verifyToken(signingSecret(), m[1], clock());
  if (!p) return null;
  const user = getDb().users.find((u) => u.id === p.uid);
  if (!user || user.status !== "active" || !user.credential || user.tokenVersion !== p.tv) return null;
  return { user: publicUser(user), access: accessOfUser(user), accessVersion: getDb().accessVersion };
}
var currentAccessVersion = () => getDb().accessVersion;
function meOf(auth) {
  const u = getDb().users.find((x) => x.id === auth.user.id);
  return buildMe(u, auth.access);
}
var COMMON = /* @__PURE__ */ new Set(["12345678", "123456789", "password", "password1", "qwertyui", "11111111", "abcd1234"]);
function checkPassword(password, username) {
  const errs = [];
  if (typeof password !== "string" || password.length < 8) errs.push(VERR("password", "password_short", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 8 \u0623\u062D\u0631\u0641.", "The password must be at least 8 characters."));
  else if (password.length > 128) errs.push(VERR("password", "password_long", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0637\u0648\u064A\u0644\u0629 \u062C\u062F\u064B\u0627.", "The password is too long."));
  else if (String(password).toLowerCase() === String(username).toLowerCase() || COMMON.has(String(password).toLowerCase())) errs.push(VERR("password", "password_weak", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0633\u0647\u0644\u0629 \u0627\u0644\u062A\u062E\u0645\u064A\u0646.", "The password is too easy to guess."));
  if (errs.length) throw validationError(errs);
}
function activate({ code, password } = {}) {
  const db = getDb();
  const h = typeof code === "string" && code.trim() ? hashCode(code) : null;
  const act = h ? db.activations.find((a) => a.codeHash === h) : null;
  if (!act || act.usedAt || act.revokedAt) throw new ApiError(400, "invalid_activation_code");
  if (Date.parse(act.expiresAt) <= clock()) throw new ApiError(400, "activation_expired");
  const user = db.users.find((u) => u.id === act.userId);
  if (!user) throw new ApiError(400, "invalid_activation_code");
  if (user.status === "inactive") throw new ApiError(403, "account_inactive");
  checkPassword(password, user.username);
  const wasInvited = user.status === "invited";
  user.credential = hashPassword(password);
  user.status = "active";
  user.tokenVersion += 1;
  user.updatedAt = nowIso2();
  act.usedAt = nowIso2();
  user.lastLoginAt = nowIso2();
  commit();
  auditLog(null, wasInvited ? "user_activated" : "password_reset", "user", user.id, { ar: wasInvited ? `\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628: ${user.username}` : `\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631: ${user.username}`, en: wasInvited ? `Account activated: ${user.username}` : `Password reset: ${user.username}` });
  return { token: issueToken(user), me: buildMe(user, accessOfUser(user)) };
}
function requireModule(auth, modules, route) {
  if (!auth) throw new ApiError(401, "unauthenticated");
  const list2 = [].concat(modules);
  if (!list2.some((m) => auth.access.permissions.has(m))) {
    auditDenied(auth.user, list2[0], route || list2[0]);
    throw new ApiError(403, "forbidden", { permission: list2[0], module: list2[0] });
  }
}
function requireWritable(auth, route) {
  if (auth.access.readOnly) {
    auditDenied(auth.user, "read_only_role", route || "write", "read_only");
    throw new ApiError(403, "read_only_role");
  }
}
var isFullAdminAuth = (auth) => isFullAdminUser(getDb().users.find((u) => u.id === auth.user.id) || { status: "x" });
function lastAdminGuard(actor, afterUsers, route) {
  const before = fullAdminCount(getDb().users);
  const after = fullAdminCount(afterUsers);
  if (before >= 1 && after < 1) {
    auditDenied(actor, "users", route, "last_admin");
    throw new ApiError(409, "last_admin");
  }
}
var delegationError = (auth, route, v) => {
  auditDenied(auth.user, "users", route, "delegation");
  return new ApiError(403, "forbidden", { reason: "delegation", permission: v.permission, module: v.module || void 0 });
};
var USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var str2 = (x) => typeof x === "string" ? x.trim() : "";
function initials(nameEn, nameAr) {
  return initialsOf(str2(nameEn) || str2(nameAr));
}
function readRoleAndScope(input, roles, fields) {
  const idx = rolesIndex(roles);
  let roleId;
  let scope;
  if (typeof input.roleId !== "string" || !input.roleId) fields.push(VERR("roleId", "role_required", "\u0627\u062E\u062A\u0631 \u062F\u0648\u0631\u064B\u0627 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645.", "Choose a role for the user."));
  else if (!idx.has(input.roleId)) fields.push(VERR("roleId", "unknown_role", "\u0627\u062E\u062A\u0631 \u062F\u0648\u0631\u064B\u0627 \u0645\u0648\u062C\u0648\u062F\u064B\u0627.", "Choose an existing role."));
  else roleId = input.roleId;
  if (input.scope === void 0 || input.scope === null) fields.push(VERR("scope", "scope_required", "\u062D\u062F\u0651\u062F \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645.", "Set the geographic scope of the user."));
  else {
    const v = validateGeoScope(input.scope);
    if (!v.ok) for (const e of v.errors) fields.push(VERR(e.path || "scope", e.code, e.ar, e.en));
    else if (isEmptyGeoScope(input.scope)) fields.push(VERR("scope", "scope_empty", "\u0627\u062E\u062A\u0631 \u0623\u0645\u0627\u0646\u0629 \u0623\u0648 \u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644\u060C \u0623\u0648 \xAB\u0643\u0644 \u0627\u0644\u062C\u0647\u0627\u062A\xBB.", 'Choose at least one Amanah or municipality, or "all entities".'));
    else scope = normalizeGeoScope(input.scope);
  }
  return { roleId, scope };
}
function listUsers(auth) {
  requireModule(auth, "users", "GET /admin/users");
  const db = getDb();
  return { users: db.users.map((u) => userRow(u, db)), storage: storageInfo(), accessVersion: db.accessVersion };
}
function getUser(auth, id) {
  requireModule(auth, "users", "GET /admin/users/:id");
  const db = getDb();
  const u = db.users.find((x) => x.id === id);
  if (!u) throw new ApiError(404, "not_found");
  return { user: userRow(u, db) };
}
function issueActivationFor(user, actor) {
  const db = getDb();
  for (const a of db.activations) if (a.userId === user.id && !a.usedAt && !a.revokedAt) a.revokedAt = nowIso2();
  const cutoff = clock() - 30 * 864e5;
  db.activations = db.activations.filter((a) => Date.parse(a.expiresAt) > cutoff);
  const code = newActivationCode();
  const expiresAt = new Date(clock() + ACTIVATION_MS).toISOString();
  db.activations.push({ id: randomId("act"), userId: user.id, codeHash: hashCode(code), createdAt: nowIso2(), expiresAt, usedAt: null, revokedAt: null, createdBy: actor.id });
  return { code, expiresAt };
}
function createUser(auth, input = {}) {
  requireModule(auth, "users", "POST /admin/users");
  requireWritable(auth, "POST /admin/users");
  const db = getDb();
  const fields = [];
  const username = str2(input.username).toLowerCase();
  if (!USERNAME_RE.test(username)) fields.push(VERR("username", "username_invalid", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 3 \u0625\u0644\u0649 40 \u062D\u0631\u0641\u064B\u0627 (\u062D\u0631\u0648\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0635\u063A\u064A\u0631\u0629 \u0648\u0623\u0631\u0642\u0627\u0645 \u0648\u0646\u0642\u0637\u0629 \u0648\u0634\u0631\u0637\u0629).", "The username is 3\u201340 characters (lowercase letters, digits, dot, dash)."));
  else if (db.users.some((u) => u.username === username)) fields.push(VERR("username", "username_taken", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 \u0642\u0628\u0644.", "This username is already taken."));
  let nameAr = str2(input.nameAr);
  let nameEn = str2(input.nameEn);
  if (!nameAr && !nameEn) fields.push(VERR("nameAr", "name_required", "\u0627\u0644\u0627\u0633\u0645 \u0645\u0637\u0644\u0648\u0628.", "The name is required."));
  else {
    nameAr = nameAr || nameEn;
    nameEn = nameEn || nameAr;
  }
  if (nameAr.length > 80 || nameEn.length > 80) fields.push(VERR("nameAr", "name_long", "\u0627\u0644\u0627\u0633\u0645 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627.", "The name is too long."));
  const email = str2(input.email) || null;
  if (email && !EMAIL_RE.test(email)) fields.push(VERR("email", "email_invalid", "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", "The email address is not valid."));
  else if (email && db.users.some((u) => (u.email || "").toLowerCase() === email.toLowerCase())) fields.push(VERR("email", "email_taken", "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 \u0642\u0628\u0644.", "This email is already used."));
  const { roleId, scope } = readRoleAndScope(input, db.roles, fields);
  if (fields.length) throw validationError(fields);
  if (!isFullAdminAuth(auth)) {
    const v = accessViolation(computeAccess({ roleId, scope }, db.roles), auth.access);
    if (v) throw delegationError(auth, "POST /admin/users", v);
  }
  const now = nowIso2();
  const user = { id: randomId("usr"), username, email, nameAr, nameEn, avatar: str2(input.avatar).slice(0, 3) || initials(nameEn, nameAr), titleAr: str2(input.titleAr) || null, titleEn: str2(input.titleEn) || null, status: "invited", roleId, scope, tokenVersion: 1, createdAt: now, createdBy: auth.user.id, updatedAt: now, lastLoginAt: null, credential: null };
  db.users.push(user);
  const activation = issueActivationFor(user, auth.user);
  commit();
  auditLog(auth.user, "user_create", "user", user.id, { ar: `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${username}`, en: `User created: ${username}` }, void 0, auditUserState(user));
  return { user: userRow(user, db), activation };
}
function updateUser(auth, id, patch = {}) {
  requireModule(auth, "users", "PATCH /admin/users/:id");
  requireWritable(auth, "PATCH /admin/users/:id");
  const db = getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, "not_found");
  const fields = [];
  const self = auth.user.id === user.id;
  const full = isFullAdminAuth(auth);
  const next = { ...user };
  if (patch.username !== void 0 && str2(patch.username).toLowerCase() !== user.username) fields.push(VERR("username", "username_immutable", "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645.", "The username cannot be changed."));
  if (patch.nameAr !== void 0 || patch.nameEn !== void 0) {
    let nameAr = patch.nameAr !== void 0 ? str2(patch.nameAr) : user.nameAr;
    let nameEn = patch.nameEn !== void 0 ? str2(patch.nameEn) : user.nameEn;
    if (!nameAr && !nameEn) fields.push(VERR("nameAr", "name_required", "\u0627\u0644\u0627\u0633\u0645 \u0645\u0637\u0644\u0648\u0628.", "The name is required."));
    else {
      next.nameAr = nameAr || nameEn;
      next.nameEn = nameEn || nameAr;
    }
    if (next.nameAr.length > 80 || next.nameEn.length > 80) fields.push(VERR("nameAr", "name_long", "\u0627\u0644\u0627\u0633\u0645 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627.", "The name is too long."));
  }
  if (patch.email !== void 0) {
    const email = str2(patch.email) || null;
    if (email && !EMAIL_RE.test(email)) fields.push(VERR("email", "email_invalid", "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", "The email address is not valid."));
    else if (email && db.users.some((u) => u.id !== user.id && (u.email || "").toLowerCase() === email.toLowerCase())) fields.push(VERR("email", "email_taken", "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 \u0642\u0628\u0644.", "This email is already used."));
    else next.email = email;
  }
  if (patch.avatar !== void 0) next.avatar = str2(patch.avatar).slice(0, 3) || user.avatar;
  if (patch.titleAr !== void 0) next.titleAr = str2(patch.titleAr) || null;
  if (patch.titleEn !== void 0) next.titleEn = str2(patch.titleEn) || null;
  if (patch.status !== void 0) {
    if (patch.status !== "active" && patch.status !== "inactive") fields.push(VERR("status", "status_invalid", "\u0627\u0644\u062D\u0627\u0644\u0629 \u0625\u0645\u0627 \u0646\u0634\u0637 \u0623\u0648 \u0645\u0639\u0637\u0651\u0644.", "The status is either active or inactive."));
    else next.status = patch.status === "inactive" ? "inactive" : user.credential ? "active" : "invited";
  }
  if (patch.roleId !== void 0 || patch.scope !== void 0) {
    const { roleId, scope } = readRoleAndScope({ roleId: patch.roleId !== void 0 ? patch.roleId : user.roleId, scope: patch.scope !== void 0 ? patch.scope : user.scope }, db.roles, fields);
    if (roleId !== void 0) next.roleId = roleId;
    if (scope !== void 0) next.scope = scope;
  }
  if (fields.length) throw validationError(fields);
  const beforeAccess = accessOfUser(user);
  const accessChanged = next.roleId !== user.roleId || !geoScopesEqual(next.scope, user.scope);
  if (self && accessChanged) {
    auditDenied(auth.user, "users", "PATCH /admin/users/:id", "self_elevation");
    throw new ApiError(403, "self_elevation");
  }
  if (!full) {
    const cur = accessViolation(beforeAccess, auth.access);
    if (cur) throw delegationError(auth, "PATCH /admin/users/:id", cur);
  }
  const afterAccess = computeAccess({ roleId: next.roleId, scope: next.scope }, db.roles);
  if (accessChanged && !full) {
    const v = accessViolation(afterAccess, auth.access);
    if (v) throw delegationError(auth, "PATCH /admin/users/:id", v);
  }
  if (accessChanged || next.status !== user.status) lastAdminGuard(auth.user, db.users.map((u) => u.id === user.id ? next : u), "PATCH /admin/users/:id");
  const before = auditUserState(user);
  const statusChanged = next.status !== user.status;
  const changed = ["nameAr", "nameEn", "email", "avatar", "titleAr", "titleEn"].filter((k) => next[k] !== user[k]);
  Object.assign(user, { nameAr: next.nameAr, nameEn: next.nameEn, email: next.email, avatar: next.avatar, titleAr: next.titleAr, titleEn: next.titleEn, status: next.status, roleId: next.roleId, scope: next.scope });
  if (statusChanged || accessChanged) user.tokenVersion += 1;
  user.updatedAt = nowIso2();
  commit();
  if (changed.length) auditLog(auth.user, "user_update", "user", user.id, { ar: `\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.username}`, en: `User details updated: ${user.username}` }, void 0, { fields: changed });
  if (statusChanged) auditLog(auth.user, "user_status", "user", user.id, { ar: `\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 ${user.username} \u0625\u0644\u0649 ${user.status}`, en: `Status of ${user.username} changed to ${user.status}` }, { status: before.status }, { status: user.status });
  if (accessChanged) auditLog(auth.user, "user_assignments", "user", user.id, { ar: `\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062F\u0648\u0631 \u0648\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.username}`, en: `Role and geographic scope changed: ${user.username}` }, { roleId: before.roleId, scope: before.scope }, { roleId: user.roleId, scope: describeGeoScope(user.scope, "en") });
  return { user: userRow(user, db) };
}
function reissueActivation(auth, id) {
  requireModule(auth, "users", "POST /admin/users/:id/activation");
  requireWritable(auth, "POST /admin/users/:id/activation");
  const db = getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, "not_found");
  if (user.status === "inactive") throw validationError([VERR("status", "user_inactive", "\u0641\u0639\u0651\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648\u0644\u064B\u0627 \u0642\u0628\u0644 \u0625\u0635\u062F\u0627\u0631 \u0631\u0645\u0632 \u062A\u0641\u0639\u064A\u0644.", "Re-activate the account before issuing an activation code.")]);
  if (!isFullAdminAuth(auth)) {
    const v = accessViolation(accessOfUser(user), auth.access);
    if (v) throw delegationError(auth, "POST /admin/users/:id/activation", v);
  }
  const activation = issueActivationFor(user, auth.user);
  user.updatedAt = nowIso2();
  commit();
  auditLog(auth.user, "activation_issued", "user", user.id, { ar: `\u0625\u0635\u062F\u0627\u0631 \u0631\u0645\u0632 \u062A\u0641\u0639\u064A\u0644 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.username}`, en: `Activation code issued: ${user.username}` });
  return { user: userRow(user, db), activation };
}
function listRoles(auth) {
  requireModule(auth, ["roles", "users"], "GET /admin/roles");
  const db = getDb();
  return { roles: db.roles.map((r) => roleRow(r, db)) };
}
function readRoleFields(input, existing, fields, db) {
  const out = {};
  for (const k of ["nameAr", "nameEn"]) {
    if (input[k] === void 0 && existing) continue;
    const v = str2(input[k]);
    if (!v) fields.push(VERR(k, "name_required", "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0631 \u0645\u0637\u0644\u0648\u0628 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629.", "The role name is required in Arabic and English."));
    else if (v.length > 60) fields.push(VERR(k, "name_long", "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0631 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627.", "The role name is too long."));
    else if (db.roles.some((r) => (!existing || r.id !== existing.id) && String(r[k]).trim().toLowerCase() === v.toLowerCase())) fields.push(VERR(k, "name_taken", "\u064A\u0648\u062C\u062F \u062F\u0648\u0631 \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645.", "A role with this name exists."));
    else out[k] = v;
  }
  for (const k of ["descriptionAr", "descriptionEn"]) if (input[k] !== void 0) {
    const v = str2(input[k]);
    if (v.length > 300) fields.push(VERR(k, "description_long", "\u0627\u0644\u0648\u0635\u0641 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627.", "The description is too long."));
    else out[k] = v;
  }
  if (input.modules !== void 0 || !existing) {
    if (!Array.isArray(input.modules) || input.modules.length === 0) fields.push(VERR("modules", "modules_required", "\u0627\u062E\u062A\u0631 \u0648\u062D\u062F\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.", "Choose at least one module."));
    else {
      const bad = unknownModules(input.modules);
      if (bad.length) fields.push(VERR("modules", "unknown_module", "\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.", "Unknown module."));
      else out.modules = normalizeModules(input.modules);
    }
  }
  if (input.readOnly !== void 0) {
    if (typeof input.readOnly !== "boolean") fields.push(VERR("readOnly", "read_only_invalid", "\u0642\u064A\u0645\u0629 \xAB\u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637\xBB \u0625\u0645\u0627 \u0646\u0639\u0645 \u0623\u0648 \u0644\u0627.", "The read-only value is yes or no."));
    else out.readOnly = input.readOnly;
  }
  return out;
}
function createRole(auth, input = {}) {
  requireModule(auth, "roles", "POST /admin/roles");
  requireWritable(auth, "POST /admin/roles");
  const db = getDb();
  const fields = [];
  const v = readRoleFields(input, null, fields, db);
  if (fields.length) throw validationError(fields);
  if (!isFullAdminAuth(auth)) {
    const over = v.modules.find((m) => !auth.access.permissions.has(m));
    if (over) {
      auditDenied(auth.user, "roles", "POST /admin/roles", "delegation");
      throw new ApiError(403, "forbidden", { reason: "delegation", permission: over, module: over });
    }
  }
  const now = nowIso2();
  const role = { id: randomId("role"), nameAr: v.nameAr, nameEn: v.nameEn, descriptionAr: v.descriptionAr || "", descriptionEn: v.descriptionEn || "", modules: v.modules, readOnly: v.readOnly === true, starter: false, protected: false, createdAt: now, updatedAt: now };
  db.roles.push(role);
  commit();
  auditLog(auth.user, "role_create", "role", role.id, { ar: `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062F\u0648\u0631 ${role.nameAr}`, en: `Role created: ${role.nameEn}` }, void 0, { modules: role.modules, readOnly: role.readOnly });
  return { role: roleRow(role, db) };
}
function updateRole(auth, id, patch = {}) {
  requireModule(auth, "roles", "PATCH /admin/roles/:id");
  requireWritable(auth, "PATCH /admin/roles/:id");
  const db = getDb();
  const role = db.roles.find((r) => r.id === id);
  if (!role) throw new ApiError(404, "not_found");
  const fields = [];
  const v = readRoleFields(patch, role, fields, db);
  if (fields.length) throw validationError(fields);
  const oldMods = normalizeModules(role.modules);
  const newMods = v.modules || oldMods;
  const newRO = v.readOnly !== void 0 ? v.readOnly : !!role.readOnly;
  if (role.protected && (ADMIN_KEEP_MODULES.some((m) => !newMods.includes(m)) || newRO)) {
    auditDenied(auth.user, "roles", "PATCH /admin/roles/:id", "protected_role");
    throw new ApiError(403, "forbidden", { reason: "protected_role" });
  }
  const full = isFullAdminAuth(auth);
  if (!full) {
    const cur = oldMods.find((m) => !auth.access.permissions.has(m));
    const add = newMods.find((m) => !oldMods.includes(m) && !auth.access.permissions.has(m));
    const bad = cur || add;
    if (bad) {
      auditDenied(auth.user, "roles", "PATCH /admin/roles/:id", "delegation");
      throw new ApiError(403, "forbidden", { reason: "delegation", permission: bad, module: bad });
    }
  }
  const me = db.users.find((u) => u.id === auth.user.id);
  if (me && me.roleId === role.id && (newMods.some((m) => !oldMods.includes(m)) || role.readOnly && !newRO)) {
    auditDenied(auth.user, "roles", "PATCH /admin/roles/:id", "self_elevation");
    throw new ApiError(403, "self_elevation", { permission: newMods.find((m) => !oldMods.includes(m)) || "read_only" });
  }
  const before = { modules: oldMods, readOnly: !!role.readOnly };
  Object.assign(role, { nameAr: v.nameAr ?? role.nameAr, nameEn: v.nameEn ?? role.nameEn, descriptionAr: v.descriptionAr ?? role.descriptionAr, descriptionEn: v.descriptionEn ?? role.descriptionEn, modules: newMods, readOnly: newRO, updatedAt: nowIso2() });
  commit();
  auditLog(auth.user, "role_update", "role", role.id, { ar: `\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062F\u0648\u0631 ${role.nameAr}`, en: `Role updated: ${role.nameEn}` }, before, { modules: newMods, readOnly: newRO });
  return { role: roleRow(role, db) };
}
function deleteRole(auth, id) {
  requireModule(auth, "roles", "DELETE /admin/roles/:id");
  requireWritable(auth, "DELETE /admin/roles/:id");
  const db = getDb();
  const role = db.roles.find((r) => r.id === id);
  if (!role) throw new ApiError(404, "not_found");
  if (role.protected) {
    auditDenied(auth.user, "roles", "DELETE /admin/roles/:id", "protected_role");
    throw new ApiError(403, "forbidden", { reason: "protected_role" });
  }
  const users = db.users.filter((u) => u.roleId === id).length;
  if (users) throw new ApiError(409, "role_in_use", { users });
  db.roles = db.roles.filter((r) => r.id !== id);
  commit();
  auditLog(auth.user, "role_delete", "role", id, { ar: `\u062D\u0630\u0641 \u0627\u0644\u062F\u0648\u0631 ${role.nameAr}`, en: `Role deleted: ${role.nameEn}` }, { modules: normalizeModules(role.modules), readOnly: !!role.readOnly });
  return { ok: true };
}
var hierarchyPayload = null;
function hierarchyForPickers() {
  if (hierarchyPayload) return hierarchyPayload;
  hierarchyPayload = {
    amanahs: ENTITIES.slice(0, N_AMANAH).map((e) => ({ key: e.en, nameAr: e.ar, nameEn: e.en, municipalities: municipalitiesOf(e.en).map((m) => ({ ref: m.refId, nameAr: m.ar, nameEn: m.en !== m.ar ? m.en : null })) })),
    nonMunicipalEntities: ENTITIES.slice(N_AMANAH).map((e) => ({ key: e.en, nameAr: e.ar, nameEn: e.en }))
  };
  return hierarchyPayload;
}
function adminCatalog(auth) {
  requireModule(auth, ["users", "roles"], "GET /admin/catalog");
  return {
    modules: MODULES.map((m) => ({ id: m.id, group: m.group, nameAr: m.nameAr, nameEn: m.nameEn, routes: m.routes, descriptionAr: m.descriptionAr, descriptionEn: m.descriptionEn, scoped: m.scoped })),
    starterRoles: STARTER_ROLES.map((r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, descriptionAr: r.descriptionAr, descriptionEn: r.descriptionEn, modules: r.modules, readOnly: r.readOnly, protected: r.protected })),
    adminKeepModules: ADMIN_KEEP_MODULES,
    hierarchy: hierarchyForPickers(),
    amanahKeys: AMANAH_KEYS,
    storage: storageInfo(),
    adminRoleId: ADMIN_ROLE_ID,
    systemAdminRoleId: ADMIN_ROLE_ID,
    accessVersion: getDb().accessVersion
  };
}

// server/identity/index.js
var getRoles = () => getDb().roles.map((r) => ({ ...r, modules: [...r.modules] }));

// server/adminApi.js
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "x-access-version": String(currentAccessVersion()) });
  res.end(body);
}
function sendError(res, e) {
  if (e instanceof ApiError) {
    const { fields, permission, module, reason, users } = e.extra || {};
    return send(res, e.status, { error: e.code, ...fields ? { fields } : {}, ...permission ? { permission } : {}, ...module ? { module } : {}, ...reason ? { reason } : {}, ...users !== void 0 ? { users } : {} });
  }
  return send(res, 500, { error: "server_error" });
}
var q2 = (req) => {
  try {
    return Object.fromEntries(new URL(req.url, "http://x").searchParams.entries());
  } catch {
    return {};
  }
};
function resolveAccess(assignment, roles = getRoles()) {
  return computeAccess(Array.isArray(assignment) ? assignment[0] : assignment, roles);
}
function describeAccess(access) {
  const scopes = {};
  for (const m of MODULE_IDS) if (access.permissions.has(m)) {
    const s = effectiveScopeFor(access, m);
    scopes[m] = { scope: s, summary: { ar: describeGeoScope(s, "ar"), en: describeGeoScope(s, "en") } };
  }
  const modules = MODULE_IDS.filter((m) => access.permissions.has(m));
  return { role: access.role, readOnly: !!access.readOnly, modules, permissions: modules, scopes };
}
async function handleIdentityRoute(req, res, path5, body, ctx = {}) {
  const isAuth = path5 === "/auth" || path5.startsWith("/auth/");
  const isAdmin = path5 === "/admin" || path5.startsWith("/admin/");
  if (!isAuth && !isAdmin) return false;
  if (path5 === "/admin/preview") return false;
  const method = req.method || "GET";
  const b = body && typeof body === "object" ? body : {};
  try {
    if (isAuth) {
      if (method === "POST" && path5 === "/auth/login") return send(res, 200, login(b)), true;
      if (method === "POST" && path5 === "/auth/activate") return send(res, 200, activate(b)), true;
      if (method === "POST" && path5 === "/auth/logout") return send(res, 200, { ok: true }), true;
      if (method === "GET" && path5 === "/auth/me") {
        const a = ctx.auth || authenticate(req);
        if (!a) throw new ApiError(401, "unauthenticated");
        return send(res, 200, { me: meOf(a) }), true;
      }
      return send(res, 404, { error: "not_found" }), true;
    }
    const auth = ctx.auth || authenticate(req);
    if (!auth) throw new ApiError(401, "unauthenticated");
    const seg = path5.split("/").filter(Boolean);
    if (method === "GET" && path5 === "/admin/catalog") return send(res, 200, adminCatalog(auth)), true;
    if (seg[1] === "users") {
      if (seg.length === 2 && method === "GET") return send(res, 200, listUsers(auth)), true;
      if (seg.length === 2 && method === "POST") return send(res, 201, createUser(auth, b)), true;
      if (seg.length === 3 && method === "GET") return send(res, 200, getUser(auth, decodeURIComponent(seg[2]))), true;
      if (seg.length === 3 && method === "PATCH") return send(res, 200, updateUser(auth, decodeURIComponent(seg[2]), b)), true;
      if (seg.length === 4 && seg[3] === "activation" && method === "POST") return send(res, 200, reissueActivation(auth, decodeURIComponent(seg[2]))), true;
    }
    if (seg[1] === "roles") {
      if (seg.length === 2 && method === "GET") return send(res, 200, listRoles(auth)), true;
      if (seg.length === 2 && method === "POST") return send(res, 201, createRole(auth, b)), true;
      if (seg.length === 3 && method === "PATCH") return send(res, 200, updateRole(auth, decodeURIComponent(seg[2]), b)), true;
      if (seg.length === 3 && method === "DELETE") return send(res, 200, deleteRole(auth, decodeURIComponent(seg[2]))), true;
    }
    if (method === "GET" && path5 === "/admin/audit") {
      if (!["users", "roles"].some((m) => auth.access.permissions.has(m))) {
        auditDenied(auth.user, "roles", "GET /admin/audit");
        throw new ApiError(403, "forbidden", { permission: "roles", module: "roles" });
      }
      return send(res, 200, listAudit(q2(req))), true;
    }
    return send(res, 404, { error: "not_found" }), true;
  } catch (e) {
    return sendError(res, e), true;
  }
}

// server/endpointAccess.js
var DATA_MODULES = ["dashboard", "invoices_collected", "invoices_uncollected", "exclusions", "contracts", "enforcement", "planning", "decisions", "smart_reports"];
var F2 = (b) => b && b.filters && typeof b.filters === "object" ? b.filters : {};
var set = (v) => v !== void 0 && v !== null && v !== "" && v !== "all";
var exclusionMode = (b) => set(F2(b).primary) || b?.withExclusions === true;
var collectionMode = (b) => b?.withNc === true || b?.withPriority === true || !!F2(b).nc || F2(b).eligible === true || F2(b).ageMin !== void 0 && F2(b).ageMin !== null || set(F2(b).age) || set(F2(b).category);
var UNCOLLECTED_STATES = /* @__PURE__ */ new Set(["open", "uncollected", "noncollected"]);
function listPermissions(body) {
  if (exclusionMode(body)) return ["exclusions"];
  if (collectionMode(body)) return ["invoices_uncollected"];
  const f = F2(body);
  if (set(f.exec)) return ["invoices_collected", "invoices_uncollected", "enforcement"];
  if (UNCOLLECTED_STATES.has(f.state)) return ["invoices_uncollected"];
  if (f.state === "excluded" || set(f.reason) || set(f.rule)) return ["exclusions", "invoices_uncollected"];
  return ["invoices_collected"];
}
function exportPermissions(body) {
  return listPermissions(body);
}
var P = (anyOf, note, extra = {}) => ({ kind: "permission", anyOf, note, ...extra });
var ID = (modules, note, write = false) => ({ kind: "identity", modules, note, ...write ? { write: true } : {} });
var ENDPOINTS = [
  ["POST", "/auth/login", () => ({ kind: "public" })],
  ["POST", "/auth/activate", () => ({ kind: "public" })],
  ["GET", "/auth/me", () => ({ kind: "identity" })],
  ["POST", "/auth/logout", () => ({ kind: "identity" })],
  ["GET", "/meta", () => ({ kind: "auth", note: "labels, dates and figures counted over the user's own geographic access" })],
  ["POST", "/snapshot", () => P(DATA_MODULES, "any data module that reads the metric layer; scope = the user's scope")],
  ["POST", "/series", () => P(DATA_MODULES, "same as /snapshot")],
  ["POST", "/bridge", () => P(DATA_MODULES, "same as /snapshot")],
  ["POST", "/list", (b) => P(listPermissions(b), "by mode: exclusions register \u2192 exclusions; uncollected worklist / non-collection \u2192 invoices_uncollected; enforcement dimension \u2192 invoices_collected|invoices_uncollected|enforcement; otherwise the collected register \u2192 invoices_collected")],
  ["GET", "/export.csv", (b) => P(exportPermissions(b), "the module of the same mode as /list (no separate export permission); all filtered rows, same mask")],
  ["POST", "/invoice", () => P(["invoices_collected", "invoices_uncollected", "exclusions", "enforcement"], "an invoice opens for any module that lists invoice rows; its documents belong to the module")],
  ["POST", "/noncollection", () => P(["invoices_uncollected"], "non-collection analysis")],
  ["POST", "/worklist", () => P(["invoices_uncollected"], "uncollected worklist")],
  ["POST", "/anomalies", () => P(["invoices_uncollected", "exclusions"], "data-quality findings of invoice rows")],
  ["POST", "/distributions", () => P(["dashboard", "invoices_uncollected"], "chart distributions")],
  ["POST", "/plan-actions", () => P(["planning"], "planning action lines (\xAB\u0623\u064A\u0646 \u0646\u0631\u0643\u0632\xBB): the planning module only \u2014 no other data module reads it")],
  ["POST", "/contracts", () => P(["contracts"], "contract cards + rollup")],
  ["POST", "/contract", () => P(["contracts"], "one contract number")],
  ["GET", "/sanad-cases", () => P(["enforcement"], "Sanad / white-lands enforcement feed")],
  ["POST", "/order-match", () => P(["enforcement"], "reference resolution (read-only on the server; link review decisions are made in the client, which a read-only role may not make)")],
  ["POST", "/order-debtor-invoices", () => P(["enforcement"], "same-debtor invoices of an order")],
  ["POST", "/enforcement-collections", () => P(["enforcement"], "amounts collected through enforcement")],
  ["POST", "/exclusion-check", () => P(["exclusions"], "row validation of the exclusions template (read-only on the server; applying exclusions happens in the client, which a read-only role may not do)")],
  ["POST", "/upload", () => P(["data_sources"], "upload invoice records (owner = the authenticated user)", { write: true })],
  ["POST", "/upload/clear", () => P(["data_sources"], "remove the user's own uploaded records", { write: true })],
  ["POST", "/sources", () => P(["data_sources"], "source report, counts over visible records")],
  ["POST", "/quality", () => P(["data_sources"], "data-quality counts over visible records")],
  ["GET", "/furas/status", () => P(["contracts"], "Furas dataset mode (local-only)")],
  ["GET", "/furas/summary", () => P(["contracts"], "Furas dataset mode")],
  ["POST", "/furas/contracts", () => P(["contracts"], "Furas dataset mode")],
  ["POST", "/furas/contract", () => P(["contracts"], "Furas dataset mode")],
  ["GET", "/furas/decisions", () => P(["contracts"], "Furas dataset mode")],
  // revenue plans («خطط الإيرادات»): module `planning`; every mutating call is write:true (a read-only role is refused 403 read_only_role). The plan-level scope check (403 forbidden + reason) is made by server/plans/service.js.
  // The per-plan routes (GET/PUT /plans/:id, GET /plans/:id/versions/:n, GET /plans/:id/audit) are matched by prefix in requiredPermissionFor (spec §10: no draft / activate / archive routes).
  ["GET", "/plans", () => P(["planning"], "revenue plans: list (masked for a restricted viewer)")],
  ["POST", "/plans", () => P(["planning"], "save a NEW plan (owner = the authenticated user; may set the caller's personal default)", { write: true })],
  ["PUT", "/plans/default", () => P(["planning"], "the caller's OWN default plan (a personal preference: not a plan change, so a read-only role may set it)")],
  ["GET", "/plans/system-default", () => P(["planning"], "the GLOBAL default plan every user opens (as this caller sees it)")],
  ["PUT", "/plans/system-default", () => P(["planning"], "change the GLOBAL default plan (needs all-entities access and a non-read-only role)", { write: true })],
  ["GET", "/plans/references", () => P(["planning"], "the reference plan per calendar year")],
  ["POST", "/plans/references", () => P(["planning"], "set / clear the reference plan of a year (needs all-entities access)", { write: true })],
  ["POST", "/plans/import-legacy", () => P(["planning"], "import the browser's legacy plan record as a saved plan", { write: true })],
  ["POST", "/admin/preview", () => P(["users", "roles"], "effective-access preview of a role + scope; the figures are clamped to the administrator's own data scope")],
  // the identity module (server/identity/service.js) enforces these itself; listed so the map is complete
  ["GET", "/admin/catalog", () => ID(["users", "roles"], "modules, starter roles, hierarchy")],
  ["GET", "/admin/users", () => ID(["users"], "user list")],
  ["POST", "/admin/users", () => ID(["users"], "create a user (one-time activation code); read-only role refused", true)],
  ["GET", "/admin/roles", () => ID(["users", "roles"], "role list (the user pages need it for the role picker)")],
  ["POST", "/admin/roles", () => ID(["roles"], "create a role; read-only role refused", true)],
  ["GET", "/admin/audit", () => ID(["users", "roles"], "audit trail")]
];
var BY_KEY = new Map(ENDPOINTS.map(([m, p, f]) => [`${m} ${p}`, f]));
function requiredPermissionFor(method, path5, body) {
  const m = String(method || "GET").toUpperCase();
  const p = String(path5 || "");
  if (p.startsWith("/auth/") || p.startsWith("/admin/")) {
    const f2 = BY_KEY.get(`${m} ${p}`);
    if (f2) return f2(body || {});
    if (p.startsWith("/admin/users/")) return ID(["users"], "one user / activation code", m !== "GET");
    if (p.startsWith("/admin/roles/")) return ID(["roles"], "one role", m !== "GET");
    return { kind: "identity" };
  }
  if (p.startsWith("/plans/")) {
    const f0 = BY_KEY.get(`${m} ${p}`);
    return f0 ? f0(body || {}) : P(["planning"], "revenue plans: one plan (read, versions, audit) or one of its mutations", m === "GET" ? {} : { write: true });
  }
  if (p.startsWith("/furas/")) return P(["contracts"], "Furas dataset mode (any method)");
  const f = BY_KEY.get(`${m} ${p}`);
  return f ? f(body || {}) : { kind: "unknown" };
}

// src/data/plans/legacyStore.js
var LEGACY_KEY = "ib_plan_targets_v1";
var MONTHS2 = 12;
var DEFAULT_OVERALL_COVERAGE = 0.66;
var DEFAULT_OVERALL_COLLECTION = 0.68;
var evenWeights = () => Array.from({ length: MONTHS2 }, () => 1 / MONTHS2);
var normalizeWeights = (w) => {
  const a = Array.from({ length: MONTHS2 }, (_, i) => Math.max(0, Number(w?.[i]) || 0));
  const s = a.reduce((t, x) => t + x, 0);
  return s > 0 ? a.map((x) => x / s) : evenWeights();
};
var cumulative = (parts) => {
  let run = 0;
  return parts.map((v) => run += v);
};
function targetMetaOf(store, year) {
  const m = store?.meta?.[year] || null;
  const n = m?.version || 0;
  return { version: n, versionId: m?.versionId || (n ? `${year}-v${n}` : `${year}-default`), status: m?.status === "approved" ? "approved" : "illustrative", owner: m?.owner || null, editedAt: m?.savedAt || null, editedBy: m?.savedBy || null };
}
function overallOf(store, year) {
  const o = store?.overall?.[year] || null;
  return { coverage: o?.coverage != null ? o.coverage : DEFAULT_OVERALL_COVERAGE, collectionRate: o?.collectionRate != null ? o.collectionRate : DEFAULT_OVERALL_COLLECTION, billing: o?.billing != null ? o.billing : null, source: o ? "saved" : "default", savedAt: o?.savedAt || null, savedBy: o?.savedBy || null };
}
function overrideOn(store, year) {
  const x = store?.override?.[year];
  if (typeof x === "boolean") return x;
  const y = store?.years?.[year] || {};
  return Object.values(y).some((e) => e && (e.coverage != null || e.collectionRate != null));
}
function entityTargets(store, year, items) {
  const ov = overallOf(store, year);
  const on = overrideOn(store, year);
  const totalBudget = items.reduce((t, x) => t + (x.a?.expAdjusted || 0), 0);
  const totalRev = items.reduce((t, x) => t + (x.a?.revAdjusted || 0), 0);
  return items.map(({ key, a }) => {
    const budget = a?.expAdjusted || 0;
    const rev = a?.revAdjusted || 0;
    const saved = store?.years?.[year]?.[key] || null;
    const baseTarget = totalRev > 0 ? ov.coverage * totalBudget * (rev / totalRev) : 0;
    const baseCoverage = budget > 0 ? baseTarget / budget : null;
    const typedCov = on && saved?.coverage != null;
    const typedRate = on && saved?.collectionRate != null;
    const coverage = typedCov ? saved.coverage : baseCoverage;
    const collectionRate = typedRate ? saved.collectionRate : ov.collectionRate;
    const revenueTarget = coverage != null && budget > 0 ? coverage * budget : 0;
    const billing = revenueTarget > 0 && collectionRate > 0 ? revenueTarget / collectionRate : 0;
    const weights = normalizeWeights(saved?.weights);
    return { key, year, budget, coverage, collectionRate, billing, weights, revenueTarget, monthly: weights.map((w) => revenueTarget * w), cumulative: cumulative(weights.map((w) => revenueTarget * w)), source: typedCov || typedRate ? "saved" : "default" };
  });
}
function entityTargetsFull(store, year) {
  return entityTargets(store, year, appropriationKeys().map((k) => ({ key: k, a: appropriationOf(k, year) })));
}

// src/data/plans/planDefaults.js
var SEED_COVERAGE = DEFAULT_OVERALL_COVERAGE;
var seedPlanName = (year) => `\u062E\u0637\u0629 \u062A\u062D\u0635\u064A\u0644 ${year} \u2014 \u062A\u0648\u0636\u064A\u062D\u064A\u0629 (\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629)`;
function seedPlanContent(year = APPROPRIATION_YEAR, { at = null } = {}) {
  if (!appropriationKeys().some((k) => appropriationOf(k, year))) return null;
  const keys = appropriationKeys();
  const budget = keys.reduce((t, k) => t + (appropriationOf(k, year)?.expAdjusted || 0), 0);
  const target = Math.round(budget * SEED_COVERAGE);
  const ents = entityUniverse();
  const ap = apportion(target, ents.map((k) => appropriationOf(k, year)?.revAdjusted || 0));
  const c = emptyContent({ name: seedPlanName(year), scope: { kind: "ministry" }, period: fiscalYearPeriod(year) });
  c.target = { amount: target, basis: { method: "budget_x_coverage", coverage: SEED_COVERAGE, budget, at } };
  c.allocations = ents.map((k, i) => ({ entityKey: k, amount: ap.amounts[i], origin: "seed" })).filter((a) => a.amount > 0);
  c.distribution = { profile: "equal" };
  return normalizeContent(c);
}
var COLLECTION_PLAN_2027 = Object.freeze({ seedKey: "collection-plan-2027", id: "plan-2027c0de", year: 2027, carriedFromYear: 2026, nameAr: "\u062E\u0637\u0629 \u062A\u062D\u0635\u064A\u0644 2027", nameEn: "2027 Collection Plan" });
var carriedForwardNote = (year = COLLECTION_PLAN_2027.year, from = COLLECTION_PLAN_2027.carriedFromYear, coveragePct = Math.round(SEED_COVERAGE * 100)) => ({
  ar: `\u0645\u064A\u0632\u0627\u0646\u064A\u0629 ${year} \u062A\u0648\u0636\u064A\u062D\u064A\u0629 = \u0645\u064A\u0632\u0627\u0646\u064A\u0629 ${from} \u0627\u0644\u0645\u0628\u0644\u063A\u0629 \u0644\u062D\u064A\u0646 \u0648\u0635\u0648\u0644 \u0645\u064A\u0632\u0627\u0646\u064A\u0629 ${year}\u061B \u0627\u0644\u062A\u063A\u0637\u064A\u0629 ${coveragePct}% \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629`,
  en: `The ${year} budget is illustrative: it equals the communicated ${from} budget until the ${year} budget arrives; the ${coveragePct}% coverage is an assumption`
});
function carryForwardPlanContent({ year, fromYear = APPROPRIATION_YEAR, name, at = null, coverage = SEED_COVERAGE } = {}) {
  const keys = appropriationKeys();
  if (!keys.some((k) => appropriationOf(k, fromYear))) return null;
  const budget = keys.reduce((t, k) => t + (appropriationOf(k, fromYear)?.expAdjusted || 0), 0);
  const target = Math.round(budget * coverage);
  const ents = entityUniverse();
  const ap = apportion(target, ents.map((k) => appropriationOf(k, fromYear)?.revAdjusted || 0));
  const c = emptyContent({ name: name || `\u062E\u0637\u0629 \u062A\u062D\u0635\u064A\u0644 ${year}`, scope: { kind: "ministry" }, period: fiscalYearPeriod(year) });
  c.target = { amount: target, basis: { method: "budget_x_coverage", coverage, budget, at, carriedFromYear: fromYear } };
  c.allocations = ents.map((k, i) => ({ entityKey: k, amount: ap.amounts[i], origin: "seed" })).filter((a) => a.amount > 0);
  c.distribution = { profile: "equal" };
  return normalizeContent(c);
}
var collectionPlan2027Content = ({ at = null } = {}) => carryForwardPlanContent({ year: COLLECTION_PLAN_2027.year, fromYear: COLLECTION_PLAN_2027.carriedFromYear, name: COLLECTION_PLAN_2027.nameAr, at });
var REMAINING_PLAN_2026 = Object.freeze({ seedKey: "remaining-2026-collection-plan", id: "plan-2026d0ec", year: 2026, baselineCutoff: "2026-11-06", period: Object.freeze({ start: "2026-11-07", end: "2026-12-31", preset: "range" }), nameAr: "\u062E\u0637\u0629 \u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0645\u0646 2026", nameEn: "Remaining 2026 Collection Plan" });
var dayLabel = (iso, lang) => {
  const [y, m, d] = iso.split("-").map(Number);
  const AR = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
  const EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return lang === "ar" ? `${d} ${AR[m - 1]} ${y}` : `${d} ${EN[m - 1]} ${y}`;
};
var derivedRowNote = (cutoff) => `\u0627\u0644\u0645\u062A\u0628\u0642\u064A = \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0627\u0644\u0633\u0646\u0648\u064A \u2212 \u0627\u0644\u0645\u062D\u0635\u0651\u0644 \u062D\u062A\u0649 ${dayLabel(cutoff, "ar")}`;
function deriveRemainingPlanContent({ annualContent, actualByEntity = {}, cutoff = REMAINING_PLAN_2026.baselineCutoff, period = REMAINING_PLAN_2026.period, annualPlanId = null, annualPlanRevision = null, derivedAt = null, name = REMAINING_PLAN_2026.nameAr } = {}) {
  const annualRows = (annualContent?.allocations || []).filter((a) => a && typeof a.entityKey === "string");
  const rows = annualRows.map((a) => {
    const annual = Math.round(Number(a.amount) || 0);
    const raw = Number(actualByEntity?.[a.entityKey]);
    const actual = Number.isFinite(raw) ? Math.round(raw) : 0;
    return { entityKey: a.entityKey, annual, actual, remaining: Math.max(0, annual - actual), surplus: Math.max(0, actual - annual) };
  });
  const sum2 = (k) => rows.reduce((t, r) => t + r[k], 0);
  const remaining = sum2("remaining");
  const surplus = sum2("surplus");
  const c = emptyContent({ name, scope: { kind: "ministry" }, period: { start: period.start, end: period.end, preset: "range" } });
  c.target = { amount: remaining };
  c.allocations = rows.filter((r) => r.remaining > 0).map((r) => ({ entityKey: r.entityKey, amount: r.remaining, origin: "derived", note: derivedRowNote(cutoff) }));
  c.distribution = { profile: "equal" };
  c.baseline = {
    kind: "remaining_of_annual",
    cutoff,
    annualPlanId,
    annualPlanRevision,
    derivedAt,
    annualPeriod: annualContent?.period ? { start: annualContent.period.start, end: annualContent.period.end } : null,
    convention: { ar: "\u0627\u0644\u0647\u062F\u0641 \u0627\u0644\u0645\u062A\u0628\u0642\u064A = \u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0644\u0643\u0644 \u062C\u0647\u0629 (\u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0627\u0644\u0633\u0646\u0648\u064A \u0644\u0644\u062C\u0647\u0629 \u2212 \u0627\u0644\u0645\u062D\u0635\u0651\u0644 \u062D\u062A\u0649 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0623\u0633\u0627\u0633\u060C \u0648\u0628\u062D\u062F \u0623\u062F\u0646\u0649 \u0635\u0641\u0631). \u064A\u062E\u062A\u0644\u0641 \u0639\u0646 \xAB\u0645\u0633\u062A\u0647\u062F\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0633\u0646\u0648\u064A \u2212 \u0645\u062D\u0635\u0651\u0644 \u0627\u0644\u0648\u0632\u0627\u0631\u0629\xBB \u062A\u0645\u0627\u0645\u0627\u064B \u062D\u064A\u0646 \u062A\u062A\u062C\u0627\u0648\u0632 \u0628\u0639\u0636 \u0627\u0644\u062C\u0647\u0627\u062A \u0645\u062E\u0635\u0635\u0647\u0627\u061B \u0648\u064A\u064F\u0639\u0631\u0636 \u0627\u0644\u0641\u0627\u0626\u0636 \u0644\u0643\u0644 \u062C\u0647\u0629 \u0645\u0646\u0641\u0635\u0644\u0627\u064B \u0648\u0644\u0627 \u064A\u064F\u062E\u0635\u0645 \u0645\u0646 \u062C\u0647\u0629 \u0623\u062E\u0631\u0649.", en: "The remaining target is the sum of each entity's remaining (its annual target \u2212 its collections to the baseline date, never below zero). It differs from \xABMinistry annual \u2212 Ministry actual\xBB exactly when some entities exceed their allocation; each entity's surplus is shown separately and is never netted against another entity." },
    note: { ar: `\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629. \u0627\u0644\u0623\u0633\u0627\u0633 \u062D\u062A\u0649 ${dayLabel(cutoff, "ar")}: \u0627\u0644\u0645\u062A\u0628\u0642\u064A = \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0627\u0644\u0633\u0646\u0648\u064A \u2212 \u0627\u0644\u0645\u062D\u0635\u0651\u0644 (\u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0628\u0627\u0644\u0631\u064A\u0627\u0644 \u062D\u0633\u0628 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062F\u0641\u0639) \u0644\u0643\u0644 \u062C\u0647\u0629. \u062A\u0648\u0632\u064A\u0639 \u0645\u062A\u0633\u0627\u0648\u064D \u0639\u0644\u0649 \u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629 \u2014 \u0627\u0641\u062A\u0631\u0627\u0636. \u0644\u0627 \u062A\u064F\u0639\u0627\u062F \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0639\u0646\u062F \u0641\u062A\u062D \u0627\u0644\u062E\u0637\u0629.`, en: `Illustrative data. Baseline to ${dayLabel(cutoff, "en")}: remaining = annual target \u2212 collected (receipts by payment date) for each entity. Equal distribution over the remaining days \u2014 an assumption. The figures are not recomputed when the plan is opened.` },
    entities: rows,
    annualTarget: sum2("annual"),
    actualToCutoff: sum2("actual"),
    remaining,
    surplus
  };
  return normalizeContent(c);
}
var isEqualWeights = (w) => w.length > 0 && w.every((x) => Math.abs(x - 1 / w.length) < 1e-9);
var safeStore = (s) => ({ v: 2, years: {}, meta: {}, ...s && typeof s === "object" ? s : {}, years: s?.years && typeof s.years === "object" ? s.years : {}, meta: s?.meta && typeof s.meta === "object" ? s.meta : {} });
var bpOf = (weights, year) => {
  const ap = apportion(BP_TOTAL, weights);
  const o = {};
  ap.amounts.forEach((v, i) => {
    o[`${year}-${String(i + 1).padStart(2, "0")}`] = v;
  });
  return o;
};
function legacyStoreToContent(store, year = APPROPRIATION_YEAR) {
  const st = safeStore(store);
  const rows = entityTargetsFull(st, year).filter((r) => r.key !== HQ_KEY);
  const sumRev = rows.reduce((t, r) => t + r.revenueTarget, 0);
  const target = Math.round(sumRev);
  const withT = rows.filter((r) => r.revenueTarget > 0);
  const ap = apportion(target, withT.map((r) => r.revenueTarget));
  const allocations = withT.map((r, i) => ({ entityKey: r.key, amount: ap.amounts[i], origin: "migrated" })).filter((a) => a.amount > 0);
  const ov = overallOf(st, year);
  const meta2 = targetMetaOf(st, year);
  const c = emptyContent({ name: `\u062E\u0637\u0629 ${year} \u2014 \u0645\u0633\u062A\u0648\u0631\u062F\u0629 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 (${meta2.versionId})`, scope: { kind: "ministry" }, period: fiscalYearPeriod(year) });
  c.target = { amount: target };
  const totalBudget = appropriationKeys().reduce((t, k) => t + (appropriationOf(k, year)?.expAdjusted || 0), 0);
  if (!Object.values(st.years?.[year] || {}).some((e) => e && e.coverage != null) && totalBudget > 0) c.target.basis = { method: "budget_x_coverage", coverage: ov.coverage, budget: totalBudget, at: null };
  c.allocations = allocations;
  const profOf = (r) => isEqualWeights(r.weights) ? { key: "equal", dist: { profile: "equal" } } : { key: JSON.stringify(bpOf(r.weights, year)), dist: { profile: "manual", weights: bpOf(r.weights, year) } };
  const groups = /* @__PURE__ */ new Map();
  for (const r of withT) {
    const p = profOf(r);
    const g = groups.get(p.key) || { dist: p.dist, total: 0 };
    g.total += r.revenueTarget;
    groups.set(p.key, g);
  }
  let main = { key: "equal", dist: { profile: "equal" }, total: -1 };
  for (const [key, g] of groups) if (g.total > main.total) main = { key, ...g };
  c.distribution = main.dist;
  const ed = {};
  for (const r of withT) {
    const p = profOf(r);
    if (p.key !== main.key) ed[r.key] = p.dist;
  }
  if (Object.keys(ed).length) c.entityDistributions = ed;
  c.advanced = { collectionRate: ov.collectionRate };
  if (ov.billing > 0) c.advanced.billingTarget = Math.round(ov.billing);
  return normalizeContent(c);
}
function legacyRecord(store, year = APPROPRIATION_YEAR) {
  const st = safeStore(store);
  const raw = st.meta?.[year] || null;
  const d = targetMetaOf(st, year);
  return { versionId: d.versionId, status: raw?.status ?? d.status, owner: raw?.owner ?? null, savedBy: raw?.savedBy ?? null, savedAt: raw?.savedAt ?? null, source: "device-localStorage", year, storageKey: LEGACY_KEY };
}

// server/plans/store.js
import fs3 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";
import { randomBytes as randomBytes2 } from "node:crypto";
var SCHEMA_VERSION2 = 3;
var SEED_PLAN_ID = "plan-5eed2026";
var SYSTEM_ACTOR = Object.freeze({ system: true });
var clockOverride = null;
var nowIso3 = () => clockOverride ? clockOverride() : (/* @__PURE__ */ new Date()).toISOString();
var defaultFile2 = () => path3.join(process.cwd(), "server", ".data", "plans.json");
function canWrite2(file) {
  try {
    fs3.mkdirSync(path3.dirname(file), { recursive: true });
    const probe = `${file}.probe-${process.pid}`;
    fs3.writeFileSync(probe, "1");
    fs3.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
function chooseLocation2(requested) {
  const want = requested || process.env.IIM_PLANS_FILE || defaultFile2();
  if (want === ":memory:") return { file: null, mode: "memory" };
  if (canWrite2(want)) return { file: want, mode: "file" };
  const tmp = path3.join(os2.tmpdir(), "iim-plans.json");
  if (canWrite2(tmp)) return { file: tmp, mode: "tmp" };
  return { file: null, mode: "memory" };
}
var looksLikeDb = (j) => !!j && typeof j === "object" && !Array.isArray(j) && Array.isArray(j.plans) && Array.isArray(j.audit) && j.references && typeof j.references === "object" && !Array.isArray(j.references);
function readFile2(file) {
  if (!file || !fs3.existsSync(file)) return null;
  try {
    const j = JSON.parse(fs3.readFileSync(file, "utf8"));
    if (looksLikeDb(j)) return j;
  } catch {
  }
  try {
    fs3.renameSync(file, `${file}.unreadable-${Date.now()}`);
  } catch {
  }
  return null;
}
function writeAtomic2(file, db) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs3.writeFileSync(tmp, JSON.stringify(db), { mode: 384 });
  fs3.renameSync(tmp, file);
}
var emptySettings = () => ({ systemDefaultPlanId: null, systemDefaultConfigured: false });
var emptyDb2 = () => ({ schemaVersion: SCHEMA_VERSION2, plans: [], references: {}, userDefaults: {}, settings: emptySettings(), audit: [] });
var hex = (bytes) => randomBytes2(bytes).toString("hex");
var newPlanId = (db) => {
  for (; ; ) {
    const id = `plan-${hex(4)}`;
    if (!db.plans.some((p) => p.id === id)) return id;
  }
};
var newAuditId = () => `aud-${hex(6)}`;
function addAudit(db, { actor, action, planId = null, summary: summary3, details = null, at = nowIso3() }) {
  const a = actor && actor.system ? { system: true } : actor ? { userId: actor.userId, name: actor.name, ...actor.nameEn ? { nameEn: actor.nameEn } : {} } : { system: true };
  db.audit.push({ id: newAuditId(), at, actor: a, action, ...planId ? { planId } : {}, summary: summary3, ...details ? { details } : {} });
}
function seedIfEmpty(db, now = nowIso3()) {
  if (db.plans.length) return false;
  const content = seedPlanContent(APPROPRIATION_YEAR, { at: now });
  if (!content) return false;
  const plan2 = {
    id: SEED_PLAN_ID,
    name: content.name,
    isSystem: true,
    origin: "seed",
    content,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    lastEditedBy: null,
    revision: 1,
    versions: [{ n: 1, revision: 1, content: JSON.parse(JSON.stringify(content)), savedBy: null, savedAt: now, label: "seed" }],
    legacy: null,
    state: "active"
  };
  db.plans.push(plan2);
  addAudit(db, { actor: SYSTEM_ACTOR, action: "seed", planId: plan2.id, at: now, summary: { ar: `\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0644\u0644\u0646\u0638\u0627\u0645 \xAB${seedPlanName(APPROPRIATION_YEAR)}\xBB (\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629)`, en: `System default plan created: ${seedPlanName(APPROPRIATION_YEAR)} (illustrative data)` } });
  db.references[String(APPROPRIATION_YEAR)] = { planId: plan2.id, setBy: { system: true }, at: now };
  addAudit(db, { actor: SYSTEM_ACTOR, action: "reference_set", planId: plan2.id, at: now, summary: { ar: `\u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0644\u0644\u0646\u0638\u0627\u0645 \u0643\u062E\u0637\u0629 \u0645\u0631\u062C\u0639\u064A\u0629 \u0644\u0633\u0646\u0629 ${APPROPRIATION_YEAR}`, en: `The system default plan was set as the ${APPROPRIATION_YEAR} reference plan` }, details: { year: APPROPRIATION_YEAR } });
  return true;
}
function ensureCollectionPlan2027(db, now = nowIso3()) {
  const out = { created: false, referenceSet: false };
  if (!db.settings || typeof db.settings !== "object" || Array.isArray(db.settings)) db.settings = emptySettings();
  const K2 = COLLECTION_PLAN_2027;
  let plan2 = db.plans.find((p) => p.seedKey === K2.seedKey) || null;
  if (!plan2) {
    const content = collectionPlan2027Content({ at: now });
    if (!content) return out;
    const names = new Set(db.plans.map((p) => String(p.name || "").trim().toLowerCase()));
    let nameAr = K2.nameAr;
    let nameEn = K2.nameEn;
    if (names.has(nameAr.trim().toLowerCase()) || db.plans.some((p) => p.nameEn && String(p.nameEn).trim().toLowerCase() === nameEn.toLowerCase())) {
      nameAr = `${K2.nameAr} (\u0627\u0644\u0646\u0638\u0627\u0645)`;
      nameEn = `${K2.nameEn} (system)`;
    }
    content.name = nameAr;
    const id = db.plans.some((p) => p.id === K2.id) ? newPlanId(db) : K2.id;
    plan2 = {
      id,
      name: nameAr,
      nameEn,
      seedKey: K2.seedKey,
      isSystem: true,
      origin: "seed",
      content,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      lastEditedBy: null,
      revision: 1,
      versions: [{ n: 1, revision: 1, content: JSON.parse(JSON.stringify(content)), savedBy: null, savedAt: now, label: "seed" }],
      legacy: null,
      state: "active"
    };
    db.plans.push(plan2);
    out.created = true;
    const note = carriedForwardNote();
    addAudit(db, { actor: SYSTEM_ACTOR, action: "seed", planId: plan2.id, at: now, summary: { ar: `\u062A\u0647\u064A\u0626\u0629 \xAB${nameAr}\xBB (\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629): \u0627\u0644\u0641\u062A\u0631\u0629 1 \u064A\u0646\u0627\u064A\u0631 \u2013 31 \u062F\u064A\u0633\u0645\u0628\u0631 ${K2.year}. ${note.ar}`, en: `"${nameEn}" created (illustrative data): 1 January \u2013 31 December ${K2.year}. ${note.en}` }, details: { seedKey: K2.seedKey, year: K2.year, carriedFromYear: K2.carriedFromYear } });
  }
  if (out.created && !db.references[String(K2.year)]) {
    db.references[String(K2.year)] = { planId: plan2.id, setBy: { system: true }, at: now };
    out.referenceSet = true;
    addAudit(db, { actor: SYSTEM_ACTOR, action: "reference_set", planId: plan2.id, at: now, summary: { ar: `\u062A\u0639\u064A\u064A\u0646 \xAB${plan2.name}\xBB \u0643\u062E\u0637\u0629 \u0645\u0631\u062C\u0639\u064A\u0629 \u0644\u0633\u0646\u0629 ${K2.year}`, en: `"${plan2.nameEn || plan2.name}" was set as the ${K2.year} reference plan` }, details: { year: K2.year } });
  }
  return out;
}
function ensureRemaining2026(db, content, now = nowIso3()) {
  const out = { created: false, madeDefault: false };
  if (!db.settings || typeof db.settings !== "object" || Array.isArray(db.settings)) db.settings = emptySettings();
  const K2 = REMAINING_PLAN_2026;
  if (db.plans.some((p) => p.seedKey === K2.seedKey) || !content) return out;
  const names = new Set(db.plans.map((p) => String(p.name || "").trim().toLowerCase()));
  let nameAr = K2.nameAr;
  let nameEn = K2.nameEn;
  if (names.has(nameAr.trim().toLowerCase()) || db.plans.some((p) => p.nameEn && String(p.nameEn).trim().toLowerCase() === nameEn.toLowerCase())) {
    nameAr = `${K2.nameAr} (\u0627\u0644\u0646\u0638\u0627\u0645)`;
    nameEn = `${K2.nameEn} (system)`;
  }
  const c = JSON.parse(JSON.stringify(content));
  c.name = nameAr;
  const id = db.plans.some((p) => p.id === K2.id) ? newPlanId(db) : K2.id;
  const plan2 = {
    id,
    name: nameAr,
    nameEn,
    seedKey: K2.seedKey,
    isSystem: true,
    origin: "seed",
    content: c,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    lastEditedBy: null,
    revision: 1,
    versions: [{ n: 1, revision: 1, content: JSON.parse(JSON.stringify(c)), savedBy: null, savedAt: now, label: "seed" }],
    legacy: null,
    state: "active"
  };
  db.plans.push(plan2);
  out.created = true;
  const b = c.baseline;
  addAudit(db, { actor: SYSTEM_ACTOR, action: "seed", planId: plan2.id, at: now, summary: { ar: `\u062A\u0647\u064A\u0626\u0629 \xAB${nameAr}\xBB (\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0636\u064A\u062D\u064A\u0629): \u0627\u0644\u0641\u062A\u0631\u0629 ${K2.period.start} \u2013 ${K2.period.end}\u061B \u0627\u0644\u0623\u0633\u0627\u0633 \u062D\u062A\u0649 ${b?.cutoff}\u060C \u0645\u0634\u062A\u0642\u0629 \u0645\u0646 \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0633\u0646\u0648\u064A\u0629`, en: `"${nameEn}" created (illustrative data): ${K2.period.start} \u2013 ${K2.period.end}; baseline to ${b?.cutoff}, derived from the annual plan` }, details: { seedKey: K2.seedKey, cutoff: b?.cutoff ?? null, annualPlanId: b?.annualPlanId ?? null, annualPlanRevision: b?.annualPlanRevision ?? null } });
  return out;
}
function ensureInitialGlobalDefault(db, now = nowIso3()) {
  if (!db.settings || typeof db.settings !== "object" || Array.isArray(db.settings)) db.settings = emptySettings();
  const seed = db.plans.find((p) => p.id === SEED_PLAN_ID && p.isSystem);
  if (!seed) return false;
  if (db.audit.some((e) => e.action === "system_default_set" && e.actor && !e.actor.system)) return false;
  const prev = db.settings.systemDefaultPlanId || null;
  if (prev === seed.id) {
    db.settings.systemDefaultConfigured = true;
    return false;
  }
  db.settings.systemDefaultPlanId = seed.id;
  db.settings.systemDefaultConfigured = true;
  const prevPlan = prev ? db.plans.find((p) => p.id === prev) : null;
  addAudit(db, { actor: SYSTEM_ACTOR, action: "system_default_set", planId: seed.id, at: now, summary: { ar: `\u062A\u0639\u064A\u064A\u0646 \xAB${seed.name}\xBB \u062E\u0637\u0629 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0639\u0627\u0645\u0629 \u0644\u0643\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 (\u0644\u0645 \u064A\u062E\u062A\u0631 \u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u062E\u0637\u0629 \u0623\u062E\u0631\u0649)`, en: `"${seed.nameEn || seed.name}" set as the global default plan for every user (no administrator chose another)` }, details: { reason: "no_administrator_choice", previous: prevPlan ? prevPlan.id : null } });
  return true;
}
var jc = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
var isOldPlan = (p) => !!p && typeof p === "object" && !(p.content && typeof p.content === "object");
function migratePlan(p, now) {
  const versions = Array.isArray(p.versions) ? p.versions : [];
  const inForceV = versions.find((v) => v.n === p.inForce) || null;
  const lastV = versions.length ? versions[versions.length - 1] : null;
  const keep = inForceV || (p.state === "archived" ? lastV : null);
  const working = p.working && p.working.content ? p.working : null;
  const counters = { promotedDraft: 0, keptWorkingAsSnapshot: 0, seedToSystem: 0 };
  let content;
  if (keep) content = jc(keep.content);
  else if (working) {
    content = jc(working.content);
    counters.promotedDraft = 1;
  } else if (lastV) content = jc(lastV.content);
  else return null;
  const snaps = versions.map((v, i) => ({ n: i + 1, revision: null, content: jc(v.content), savedBy: v.activatedBy ?? null, savedAt: v.activatedAt || p.updatedAt || now, label: "migrated-version", migratedFrom: { versionNumber: v.n, supersededAt: v.supersededAt ?? null } }));
  if (working && keep) {
    snaps.push({ n: snaps.length + 1, revision: null, content: jc(working.content), savedBy: working.lastEditedBy ?? null, savedAt: working.updatedAt || p.updatedAt || now, label: "migrated-draft" });
    counters.keptWorkingAsSnapshot = 1;
  }
  if (counters.promotedDraft) snaps.push({ n: snaps.length + 1, revision: p.revision ?? 1, content: jc(content), savedBy: working.lastEditedBy ?? p.lastEditedBy ?? null, savedAt: working.updatedAt || p.updatedAt || now, label: "migrated-draft-promoted" });
  const isSystem = p.origin === "seed";
  if (isSystem) counters.seedToSystem = 1;
  const migrated = { fromSchema: 1, at: now, previousState: p.state ?? null, previousType: p.type ?? "baseline", ...p.scenarioOf ? { scenarioOf: p.scenarioOf } : {}, inForce: p.inForce ?? null, ...p.archivedAt ? { archivedAt: p.archivedAt } : {} };
  for (const k of ["working", "inForce", "archivedAt", "type", "scenarioOf"]) delete p[k];
  p.name = content.name;
  p.isSystem = isSystem;
  p.content = content;
  p.versions = snaps;
  p.state = "active";
  p.migrated = migrated;
  return counters;
}
function migrateDb(db, now = nowIso3()) {
  const from = db.schemaVersion ?? 1;
  let result = null;
  const old = db.plans.filter(isOldPlan);
  if (old.length || from < 2) {
    const total = { plans: 0, promotedDrafts: 0, workingKeptAsSnapshot: 0, seedMarkedSystem: 0 };
    for (const p of old) {
      const c = migratePlan(p, now);
      if (!c) continue;
      total.plans += 1;
      total.promotedDrafts += c.promotedDraft;
      total.workingKeptAsSnapshot += c.keptWorkingAsSnapshot;
      total.seedMarkedSystem += c.seedToSystem;
    }
    if (!db.userDefaults || typeof db.userDefaults !== "object" || Array.isArray(db.userDefaults)) db.userDefaults = {};
    db.schemaVersion = 2;
    if (total.plans) {
      addAudit(db, { actor: SYSTEM_ACTOR, action: "migrate", at: now, summary: { ar: `\u062A\u0631\u062D\u064A\u0644 \u0645\u062E\u0632\u0646 \u0627\u0644\u062E\u0637\u0637 \u0625\u0644\u0649 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0628\u0633\u0651\u0637 (${total.plans} \u062E\u0637\u0629): \u0644\u0627 \u062A\u064F\u062D\u0630\u0641 \u0623\u064A \u0642\u064A\u0645\u0629`, en: `The plans store was migrated to the simplified model (${total.plans} plans); no value was dropped` }, details: { fromSchema: from, toSchema: 2, ...total } });
      result = total;
    }
  }
  if (!db.settings || typeof db.settings !== "object" || Array.isArray(db.settings) || (db.schemaVersion ?? 2) < 3) {
    const had = db.settings && typeof db.settings === "object" && !Array.isArray(db.settings) ? db.settings : {};
    db.settings = { systemDefaultPlanId: typeof had.systemDefaultPlanId === "string" ? had.systemDefaultPlanId : null, systemDefaultConfigured: had.systemDefaultConfigured === true };
    if (db.plans.length && from >= 2) {
      addAudit(db, { actor: SYSTEM_ACTOR, action: "migrate", at: now, summary: { ar: `\u062A\u0631\u062D\u064A\u0644 \u0645\u062E\u0632\u0646 \u0627\u0644\u062E\u0637\u0637 \u0625\u0644\u0649 \u0627\u0644\u0645\u062E\u0637\u0637 3: \u0625\u0636\u0627\u0641\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 (\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629)\u061B \u0644\u0645 \u062A\u064F\u062D\u0630\u0641 \u0623\u064A \u062E\u0637\u0629 \u0648\u0644\u0627 \u0623\u064A \u062E\u0637\u0629 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0634\u062E\u0635\u064A\u0629 \u0648\u0644\u0627 \u0623\u064A \u062E\u0637\u0629 \u0645\u0631\u062C\u0639\u064A\u0629`, en: "The plans store was migrated to schema 3: shared settings added (the global default plan); no plan, personal default or reference was dropped" }, details: { fromSchema: from, toSchema: SCHEMA_VERSION2, plans: db.plans.length, personalDefaults: Object.keys(db.userDefaults || {}).length, references: Object.keys(db.references || {}).length } });
      result = result || { plans: 0 };
    }
  }
  db.schemaVersion = SCHEMA_VERSION2;
  return result;
}
function normalizeDb(db, file = null) {
  let changed = false;
  if (!Array.isArray(db.plans)) {
    db.plans = [];
    changed = true;
  }
  if (!Array.isArray(db.audit)) {
    db.audit = [];
    changed = true;
  }
  if (!db.references || typeof db.references !== "object" || Array.isArray(db.references)) {
    db.references = {};
    changed = true;
  }
  const backupOnce2 = (suffix) => {
    if (!file) return;
    try {
      const bak = `${file}${suffix}`;
      if (!fs3.existsSync(bak) && fs3.existsSync(file)) fs3.copyFileSync(file, bak);
    } catch {
    }
  };
  if (db.plans.some(isOldPlan)) backupOnce2(".pre-v2.bak");
  else if (db.plans.length && (db.schemaVersion ?? 1) < SCHEMA_VERSION2) backupOnce2(".pre-v3.bak");
  const sv = db.schemaVersion;
  if (migrateDb(db) || sv !== db.schemaVersion) changed = true;
  if (db.schemaVersion !== SCHEMA_VERSION2) {
    db.schemaVersion = SCHEMA_VERSION2;
    changed = true;
  }
  if (!db.settings || typeof db.settings !== "object" || Array.isArray(db.settings)) {
    db.settings = emptySettings();
    changed = true;
  }
  if (!db.userDefaults || typeof db.userDefaults !== "object" || Array.isArray(db.userDefaults)) {
    db.userDefaults = {};
    changed = true;
  }
  return changed;
}
function seedSystemPlans(db, now = nowIso3()) {
  const a = seedIfEmpty(db, now);
  const b = ensureCollectionPlan2027(db, now);
  const c = ensureInitialGlobalDefault(db, now);
  return a || b.created || c;
}
function openPlanStore(requested = null, { seed = true } = {}) {
  const loc = chooseLocation2(requested);
  const store = {
    file: loc.file,
    mode: loc.mode,
    db: readFile2(loc.file) || emptyDb2(),
    /** tests: a function called at named checkpoints inside a mutation (and with 'commit' right before the swap); a throw aborts the whole mutation */
    fault: null,
    checkpoint(name) {
      if (typeof this.fault === "function") this.fault(name);
    },
    info() {
      return { mode: this.mode, durable: this.mode === "file", localDemo: true };
    },
    /** write the document (atomic). A write failure downgrades to memory instead of failing the request. */
    persist() {
      if (!this.file) return;
      try {
        writeAtomic2(this.file, this.db);
      } catch {
        this.mode = "memory";
        this.file = null;
      }
    },
    /** all-or-nothing change: fn(workingCopy) → result. Throw to abort; nothing is stored then. */
    mutate(fn) {
      const work = structuredClone(this.db);
      const result = fn(work);
      this.checkpoint("commit");
      this.db = work;
      this.persist();
      return result;
    },
    /** drop the in-memory document and re-read the file (a restart in place) */
    reload() {
      this.db = readFile2(this.file) || emptyDb2();
      const a = normalizeDb(this.db, this.file);
      const b = seed ? seedSystemPlans(this.db) : false;
      if (a || b) this.persist();
      return this.db;
    }
  };
  const changed = normalizeDb(store.db, store.file);
  const seeded = seed ? seedSystemPlans(store.db) : false;
  if ((changed || seeded) && store.file) store.persist();
  return store;
}
var current = null;
var planStore = () => current || (current = openPlanStore(null));

// server/plans/service.js
var PlanError = class extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.name = "PlanError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
};
var T3 = (ar, en) => ({ ar, en });
var clone2 = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
var isObj3 = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var verr = (code, path5, ar, en, params) => ({ code, path: path5, params: params || {}, ar, en });
var invalid = (errors) => new PlanError(400, "validation_error", { errors });
var notFound = () => new PlanError(404, "plan_not_found");
var MAX_LEGACY_BYTES = 6e5;
var refOf = (actor) => ({ userId: actor.userId, name: actor.name, ...actor.nameEn ? { nameEn: actor.nameEn } : {} });
var refusal = (reason) => new PlanError(403, "forbidden", { reason });
function checkableMunicipalRows(content) {
  const rows = [];
  for (const m of municipalRowsOf(content)) {
    if (!isObj3(m) || typeof m.entityKey !== "string" || typeof m.muniId !== "string") continue;
    const entityKey = m.entityKey.trim();
    const muniId = m.muniId.trim();
    if (municipalityByRef(muniId) && municipalitiesOf(entityKey).some((x) => x.refId === muniId)) rows.push({ entityKey, muniId });
  }
  return rows;
}
function scopeRefusal(actor, scope, content = null) {
  const d = mutateDecision(actor.geoScope, scope, { readOnly: actor.readOnly, municipalities: content ? checkableMunicipalRows(content) : null });
  return d.ok || d.reason === "unknown_scope" ? null : d.reason;
}
function mayMutate(actor, plan2) {
  const c = plan2.content;
  return !!c && mutateDecision(actor.geoScope, c.scope, { readOnly: actor.readOnly, municipalities: checkableMunicipalRows(c) }).ok;
}
function editBlock(actor, plan2) {
  if (plan2.isSystem) return "system_plan";
  if (actor.readOnly) return "read_only_role";
  return mayMutate(actor, plan2) ? null : "scope";
}
function assertCanEdit(actor, plan2) {
  const r = scopeRefusal(actor, plan2.content.scope, plan2.content);
  if (r) throw refusal(r);
  if (actor.readOnly) throw refusal("read_only_role");
}
function viewable(actor, plan2) {
  return !!plan2.content && (mayMutate(actor, plan2) || canViewScope(actor.geoScope, plan2.content.scope));
}
var maskedFull = (actor, plan2) => maskPlanForViewer(clone2(plan2), visibleEntityKeysOfScope(actor.geoScope), actor.geoScope);
function present(actor, plan2) {
  const out = maskedFull(actor, plan2);
  out.versions = (out.versions || []).map(({ content, migratedFrom, ...meta2 }) => meta2);
  out.versionCount = out.versions.length;
  delete out.migrated;
  const reason = editBlock(actor, plan2);
  out.viewer = { canEdit: reason === null, ...reason ? { reason } : {} };
  return out;
}
var findPlan = (db, id) => db.plans.find((p) => p.id === id) || null;
function load(actor, db, id) {
  const p = typeof id === "string" ? findPlan(db, id) : null;
  if (!p || !viewable(actor, p)) throw notFound();
  return p;
}
function checkRevision(plan2, body) {
  const rev = body?.revision;
  if (!Number.isInteger(rev)) throw invalid([verr("revision_required", "revision", "\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0637\u0644\u0648\u0628", "The revision number is required")]);
  if (rev !== plan2.revision) throw new PlanError(409, "revision_conflict", { currentRevision: plan2.revision, lastEditedBy: plan2.lastEditedBy || null, updatedAt: plan2.updatedAt });
}
var touch = (plan2, actor, now) => {
  plan2.lastEditedBy = refOf(actor);
  plan2.updatedAt = now;
  plan2.revision += 1;
};
var visibleNames = (actor, db, exceptId = null) => db.plans.filter((p) => p.id !== exceptId && viewable(actor, p)).flatMap((p) => p.nameEn ? [p.name, p.nameEn] : [p.name]);
function defaultsOf(actor, db) {
  const vis = db.plans.filter((p) => viewable(actor, p));
  const r = defaultPlanResolution({ plans: vis, userDefaultPlanId: db.userDefaults?.[actor.userId] || null, globalDefaultPlanId: db.settings?.systemDefaultPlanId || null, visibleIds: vis.map((p) => p.id) });
  return { userDefaultPlanId: r.userDefaultPlanId, globalDefaultPlanId: r.globalDefaultPlanId, systemDefaultPlanId: r.systemDefaultPlanId, effectiveDefaultPlanId: r.effectiveDefaultPlanId, source: r.source };
}
var storageOf = (store) => store.info();
var strOrNull = (x) => typeof x === "string" && x.trim() && x.trim() !== "all" ? x.trim() : null;
function resolveViewScope2(actor, q3) {
  const raw = isObj3(q3) ? q3 : {};
  const amanahIn = strOrNull(raw.amanah) ?? strOrNull(raw.entity);
  const muniIn = strOrNull(raw.muni);
  if (!amanahIn && !muniIn) return null;
  let amanah = amanahIn;
  let muniId = null;
  if (muniIn) {
    const byKey = muniIn.includes("|") ? municipalityByKey(muniIn) : null;
    const byRef = byKey ? null : municipalityByRef(muniIn);
    const m = byKey || byRef;
    if (!m) throw invalid([verr("unknown_municipality", "muni", "\u0628\u0644\u062F\u064A\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629", "Unknown municipality", { muni: muniIn })]);
    if (amanah == null && byKey) amanah = byKey.amanahKey;
    if (amanah == null) throw invalid([verr("municipality_without_amanah", "muni", "\u0627\u062E\u062A\u0631 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0642\u0628\u0644 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Choose the Amanah before the municipality")]);
    if (!entityUniverse().includes(amanah)) throw invalid([verr("unknown_entity", "amanah", "\u062C\u0647\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629", "Unknown entity", { entityKey: amanah })]);
    if (m.amanahKey !== amanah) throw invalid([verr("municipality_not_in_entity", "muni", "\u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0644\u0627 \u062A\u062A\u0628\u0639 \u0647\u0630\u0647 \u0627\u0644\u0623\u0645\u0627\u0646\u0629", "The municipality does not belong to this Amanah", { entityKey: amanah, muniId: m.refId })]);
    muniId = m.refId;
    if (!canViewMunicipality(actor.geoScope, amanah, muniId)) throw refusal("municipality");
  }
  return { amanah: amanah || "all", muni: muniId || "all" };
}
function listPlans(actor, filters = {}, store = planStore()) {
  const f = isObj3(filters) ? filters : {};
  const yr = Number(f.year);
  const out = [];
  const vs = resolveViewScope2(actor, f);
  const entity = vs && vs.amanah !== "all" ? vs.amanah : strOrNull(f.entity);
  for (const p of store.db.plans) {
    if (!viewable(actor, p)) continue;
    if (f.owner) {
      if (f.owner === "none" ? p.createdBy != null : p.createdBy?.userId !== f.owner) continue;
    }
    const c = p.content;
    if (Number.isInteger(yr) && yr > 0 && !(c && periodsOverlap(c.period, fiscalYearPeriod(yr)))) continue;
    if (entity && !(c && scopeEntityKeys(c.scope).includes(entity))) continue;
    out.push(present(actor, p));
  }
  return { plans: out, defaults: defaultsOf(actor, store.db), references: clone2(store.db.references), capabilities: capabilitiesOf(actor), storage: storageOf(store), ...vs ? { viewScope: vs } : {} };
}
var capabilitiesOf = (actor) => {
  const mayAdmin = canSetReference(actor.geoScope, { readOnly: actor.readOnly });
  const caps = { canSetReference: mayAdmin, canSetSystemDefault: mayAdmin, readOnly: !!actor.readOnly, canCreate: !actor.readOnly, canCreateMinistry: mutateDecision(actor.geoScope, { kind: "ministry" }, { readOnly: actor.readOnly }).ok };
  const geo = normalizeGeoScope(actor.geoScope);
  if (!geo.all) {
    const cov = {};
    for (const k of visibleEntityKeysOfScope(geo)) {
      if (!GEO_HIERARCHY.has(k)) continue;
      const c = municipalCoverage(geo, k);
      cov[k] = { whole: c.whole, all: c.all, direct: c.direct, notSpecified: c.notSpecified, ...c.all ? {} : { muniIds: c.muniIds } };
    }
    caps.municipalCoverage = cov;
  }
  return caps;
};
function getPlan(actor, id, store = planStore(), view2 = null) {
  const vs = resolveViewScope2(actor, view2);
  const p = load(actor, store.db, id);
  return { plan: present(actor, p), storage: storageOf(store), ...vs ? { viewScope: vs } : {} };
}
function getVersion(actor, id, n, store = planStore(), view2 = null) {
  const vs = resolveViewScope2(actor, view2);
  const p = load(actor, store.db, id);
  const num2 = Number(n);
  const shown = maskedFull(actor, p);
  const v = (shown.versions || []).find((x) => x.n === num2);
  if (!Number.isInteger(num2) || !v || !v.content) throw new PlanError(404, "version_not_found");
  const { migratedFrom, ...meta2 } = v;
  return { planId: p.id, version: { ...meta2, isCurrent: v.revision != null && v.revision === p.revision }, view: planView(shown, num2), ...vs ? { viewScope: vs } : {} };
}
function getAudit(actor, id, store = planStore()) {
  const p = load(actor, store.db, id);
  const entries = store.db.audit.filter((e) => e.planId === p.id).map(clone2).reverse();
  return { planId: p.id, total: entries.length, entries };
}
function getReferences(actor, store = planStore()) {
  return { references: clone2(store.db.references), defaults: defaultsOf(actor, store.db), capabilities: capabilitiesOf(actor), storage: storageOf(store) };
}
function prepareSave(actor, db, raw, nameIn, exceptId) {
  const named = { ...raw, name: typeof nameIn === "string" ? nameIn.trim() : nameIn };
  const v = validateDraft(named, { actorScope: actor.geoScope, readOnly: actor.readOnly });
  const nm2 = validatePlanName(nameIn, visibleNames(actor, db, exceptId));
  const taken = nm2.errors.filter((e) => e.code === "name_taken");
  const nameBad = nm2.errors.filter((e) => e.code !== "name_taken");
  const errors = [...nameBad, ...v.errors];
  if (errors.length) throw invalid(errors);
  if (taken.length) throw new PlanError(409, "name_taken", { errors: taken });
  const content = normalizeContent({ ...named, name: nm2.name });
  const res = saveChecks(content, { actorScope: actor.geoScope, readOnly: actor.readOnly });
  if (!res.ok) throw new PlanError(422, "save_checks_failed", { checks: res.checks });
  return { content, checks: res.checks };
}
var snapshotOf = (db, plan2, content, actor, now, revision, label = null) => ({ n: (plan2.versions || []).reduce((m, x) => Math.max(m, x.n || 0), 0) + 1, revision, content: clone2(content), savedBy: actor ? refOf(actor) : null, savedAt: now, ...label ? { label } : {} });
function createPlan(actor, input, store = planStore()) {
  const b = isObj3(input) ? input : {};
  if (b.copyOf != null && typeof b.copyOf !== "string") throw invalid([verr("copy_of_invalid", "copyOf", "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0646\u0633\u0648\u062E\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", "The copied plan id is not valid")]);
  return store.mutate((db) => {
    const src = b.copyOf != null ? load(actor, db, b.copyOf) : null;
    let raw = isObj3(b.content) ? b.content : null;
    if (!raw && src) {
      if (maskedFull(actor, src).masked) throw refusal("scope");
      raw = clone2(src.content);
    }
    if (!raw) throw invalid([verr("content_required", "content", "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0629 \u0645\u0637\u0644\u0648\u0628", "The plan content is required")]);
    if (actor.readOnly) throw refusal("read_only_role");
    const sr = isObj3(raw.scope) ? scopeRefusal(actor, raw.scope, raw) : null;
    if (sr) throw refusal(sr);
    const { content } = prepareSave(actor, db, raw, b.name != null ? b.name : raw.name, null);
    const now = nowIso3();
    const plan2 = { id: newPlanId(db), name: content.name, isSystem: false, origin: "user", content, createdBy: refOf(actor), createdAt: now, updatedAt: now, lastEditedBy: refOf(actor), revision: 1, versions: [], legacy: null, state: "active" };
    plan2.versions.push(snapshotOf(db, plan2, content, actor, now, 1));
    db.plans.push(plan2);
    store.checkpoint("create.insert");
    if (b.setDefault === true) {
      db.userDefaults = { ...db.userDefaults || {}, [actor.userId]: plan2.id };
    }
    addAudit(db, { actor: refOf(actor), action: src ? "copy" : "create", planId: plan2.id, at: now, summary: T3(`${src ? "\u062D\u0641\u0638 \u0646\u0633\u062E\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u062E\u0637\u0629" : "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062E\u0637\u0629"} \xAB${content.name}\xBB`, `Plan "${content.name}" ${src ? "saved as a new plan" : "created"}`), details: { ...src ? { copyOf: src.id } : {}, ...b.setDefault === true ? { setDefault: true } : {} } });
    return { plan: present(actor, plan2), defaults: defaultsOf(actor, db) };
  });
}
function updatePlan(actor, id, input, store = planStore()) {
  const b = isObj3(input) ? input : {};
  return store.mutate((db) => {
    const plan2 = load(actor, db, id);
    if (actor.readOnly) throw refusal("read_only_role");
    if (plan2.isSystem) throw new PlanError(403, "system_plan_readonly");
    assertCanEdit(actor, plan2);
    checkRevision(plan2, b);
    const raw = isObj3(b.content) ? b.content : b.name != null ? clone2(plan2.content) : null;
    if (!raw) throw invalid([verr("content_required", "content", "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0629 \u0645\u0637\u0644\u0648\u0628", "The plan content is required")]);
    const widened = isObj3(raw.scope) ? scopeRefusal(actor, raw.scope, raw) : null;
    if (widened) throw refusal(widened);
    const { content } = prepareSave(actor, db, raw, b.name != null ? b.name : raw.name, plan2.id);
    const now = nowIso3();
    const next = plan2.revision + 1;
    plan2.versions = plan2.versions || [];
    plan2.versions.push(snapshotOf(db, plan2, content, actor, now, next));
    store.checkpoint("save.snapshot");
    plan2.content = content;
    plan2.name = content.name;
    store.checkpoint("save.content");
    touch(plan2, actor, now);
    store.checkpoint("save.state");
    addAudit(db, { actor: refOf(actor), action: "update", planId: plan2.id, at: now, summary: T3(`\u062D\u0641\u0638 \u0627\u0644\u062E\u0637\u0629 \xAB${content.name}\xBB`, `Plan "${content.name}" saved`), details: { revision: plan2.revision } });
    return { plan: present(actor, plan2) };
  });
}
function setPersonalDefault(actor, input, store = planStore()) {
  const b = isObj3(input) ? input : {};
  if (!("planId" in b) || b.planId !== null && typeof b.planId !== "string") throw invalid([verr("plan_required", "planId", "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062E\u0637\u0629 \u0645\u0637\u0644\u0648\u0628 (\u0623\u0648 null \u0644\u0644\u0645\u0633\u062D)", "A plan id is required (or null to clear)")]);
  return store.mutate((db) => {
    const map = { ...db.userDefaults || {} };
    if (b.planId === null) delete map[actor.userId];
    else {
      load(actor, db, b.planId);
      map[actor.userId] = b.planId;
    }
    db.userDefaults = map;
    return { defaults: defaultsOf(actor, db) };
  });
}
function setSystemDefault(actor, input, store = planStore()) {
  const b = isObj3(input) ? input : {};
  if (typeof b.planId !== "string" || !b.planId) throw invalid([verr("plan_required", "planId", "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062E\u0637\u0629 \u0645\u0637\u0644\u0648\u0628", "A plan id is required")]);
  if (!canSetReference(actor.geoScope, { readOnly: actor.readOnly })) throw refusal(actor.readOnly ? "read_only_role" : "scope");
  return store.mutate((db) => {
    const plan2 = load(actor, db, b.planId);
    const now = nowIso3();
    const prev = db.settings?.systemDefaultPlanId || null;
    db.settings = { ...db.settings || {}, systemDefaultPlanId: plan2.id, systemDefaultConfigured: true };
    addAudit(db, { actor: refOf(actor), action: "system_default_set", planId: plan2.id, at: now, summary: T3(`\u062A\u0639\u064A\u064A\u0646 \xAB${plan2.name}\xBB \u062E\u0637\u0629 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0639\u0627\u0645\u0629 \u0644\u0643\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646`, `"${plan2.nameEn || plan2.name}" set as the global default plan for every user`), details: { ...prev ? { previous: prev } : {}, unchanged: prev === plan2.id } });
    return { defaults: defaultsOf(actor, db) };
  });
}
var getSystemDefault = (actor, store = planStore()) => ({ defaults: defaultsOf(actor, store.db), canSetSystemDefault: canSetReference(actor.geoScope, { readOnly: actor.readOnly }) });
function setReference(actor, input, store = planStore()) {
  const b = isObj3(input) ? input : {};
  const year = b.year;
  if (!Number.isInteger(year) || year < 1990 || year > 2200) throw invalid([verr("year_invalid", "year", "\u0627\u0644\u0633\u0646\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629", "The year is not valid")]);
  if (b.planId !== null && typeof b.planId !== "string") throw invalid([verr("plan_required", "planId", "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062E\u0637\u0629 \u0645\u0637\u0644\u0648\u0628 (\u0623\u0648 null \u0644\u0644\u0645\u0633\u062D)", "A plan id is required (or null to clear)")]);
  if (!canSetReference(actor.geoScope, { readOnly: actor.readOnly })) throw refusal(actor.readOnly ? "read_only_role" : "scope");
  return store.mutate((db) => {
    const now = nowIso3();
    const key = String(year);
    const prev = db.references[key] || null;
    if (b.planId === null) {
      if (prev) delete db.references[key];
      addAudit(db, { actor: refOf(actor), action: "reference_clear", ...prev ? { planId: prev.planId } : {}, at: now, summary: T3(`\u0645\u0633\u062D \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 \u0644\u0633\u0646\u0629 ${year}`, `The ${year} reference plan was cleared`), details: { year, ...prev ? { previous: prev.planId } : {} } });
      return { references: clone2(db.references), cleared: !!prev };
    }
    const plan2 = findPlan(db, b.planId);
    if (!plan2) throw notFound();
    if (!eligibleReferencePlans(year, [plan2]).length) throw invalid([verr("reference_not_eligible", "planId", "\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u062A\u0642\u0627\u0637\u0639 \u0641\u062A\u0631\u062A\u0647\u0627 \u0645\u0639 \u0627\u0644\u0633\u0646\u0629", "The reference plan must overlap the year", { reason: "period_mismatch" })]);
    db.references[key] = { planId: plan2.id, setBy: refOf(actor), at: now };
    addAudit(db, { actor: refOf(actor), action: "reference_set", planId: plan2.id, at: now, summary: T3(`\u062A\u0639\u064A\u064A\u0646 \xAB${plan2.name}\xBB \u062E\u0637\u0629 \u0645\u0631\u062C\u0639\u064A\u0629 \u0644\u0633\u0646\u0629 ${year}`, `"${plan2.name}" set as the ${year} reference plan`), details: { year, ...prev ? { previous: prev.planId } : {} } });
    return { references: clone2(db.references), cleared: false };
  });
}
var uniqueName = (base, names) => {
  const taken = new Set(names.map((n) => String(n).trim().toLowerCase()));
  let name = base;
  for (let i = 2; taken.has(name.trim().toLowerCase()); i += 1) name = `${base} (${i})`;
  return name;
};
function importLegacy(actor, input, store = planStore()) {
  const b = isObj3(input) ? input : {};
  const year = b.year == null ? APPROPRIATION_YEAR : b.year;
  if (!Number.isInteger(year) || year < 1990 || year > 2200) throw invalid([verr("year_invalid", "year", "\u0627\u0644\u0633\u0646\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629", "The year is not valid")]);
  if (!isObj3(b.store)) throw invalid([verr("store_required", "store", "\u0633\u062C\u0644 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0642\u062F\u064A\u0645 \u0645\u0637\u0644\u0648\u0628", "The legacy device record is required")]);
  let size = 0;
  try {
    size = JSON.stringify(b.store).length;
  } catch {
    size = Infinity;
  }
  if (size > MAX_LEGACY_BYTES) throw invalid([verr("store_too_large", "store", "\u0633\u062C\u0644 \u0627\u0644\u062C\u0647\u0627\u0632 \u0643\u0628\u064A\u0631 \u062C\u062F\u064B\u0627", "The device record is too large")]);
  if (actor.readOnly) throw refusal("read_only_role");
  const sr = scopeRefusal(actor, { kind: "ministry" });
  if (sr) throw refusal(sr);
  return store.mutate((db) => {
    const rec = legacyRecord(b.store, year);
    const dup = db.plans.find((p) => p.legacy && p.legacy.versionId === rec.versionId && p.legacy.savedAt === rec.savedAt && p.legacy.year === rec.year);
    if (dup) throw new PlanError(409, "legacy_already_imported", { plan: { planId: dup.id, name: dup.name } });
    const raw = legacyStoreToContent(b.store, year);
    const mr = scopeRefusal(actor, raw.scope, raw);
    if (mr) throw refusal(mr);
    raw.name = uniqueName(raw.name, visibleNames(actor, db));
    const { content } = prepareSave(actor, db, raw, raw.name, null);
    const now = nowIso3();
    const plan2 = { id: newPlanId(db), name: content.name, isSystem: false, origin: "imported", content, createdBy: null, createdAt: now, updatedAt: now, lastEditedBy: refOf(actor), revision: 1, versions: [], legacy: clone2(rec), state: "active" };
    plan2.versions.push(snapshotOf(db, plan2, content, actor, now, 1, "import"));
    db.plans.push(plan2);
    addAudit(db, { actor: refOf(actor), action: "import", planId: plan2.id, at: now, summary: T3(`\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0633\u062C\u0644 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0642\u062F\u064A\u0645 \u0644\u0633\u0646\u0629 ${year} \u0643\u062E\u0637\u0629 \xAB${content.name}\xBB`, `Legacy device record for ${year} imported as the plan "${content.name}"`), details: { year, legacyVersionId: rec.versionId, legacySavedAt: rec.savedAt } });
    return { plan: present(actor, plan2) };
  });
}

// src/data/planInputs.js
var approvedConfigOf = (cfg) => normalizeConfig({ ...cfg, rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.approval === "approved"])) });
async function loadPlanInputsForPlan(rev, { view: view2, reporting, approvedCfg, entityKeys = null, viewScope = null, upcomingHistory = false }) {
  const period = view2?.period || view2?.content?.period;
  if (!reporting || !periodValid(period)) return null;
  const rv = resolveViewScope({ scope: view2.scope || view2.content?.scope, entityKeys, viewScope });
  const sc = rv.sc;
  const cutoff = reporting < period.end ? reporting : period.end;
  const meta2 = { planId: view2.planId ?? null, versionId: view2.versionId ?? null, scopeKey: rv.scopeKey, period: { start: period.start, end: period.end }, cutoff };
  if (rv.mode === "invalid") return { meta: meta2, invalid: rv.invalid, future: false, actual: null, history: null, byAmanah: {}, total: 0, monthly: [], facts: null };
  if (cutoff < period.start) {
    const futureOut = { meta: meta2, future: true, actual: null, history: null, byAmanah: {}, total: 0, monthly: [], facts: null };
    if (!upcomingHistory || !upcomingForecastSupport({ asOf: cutoff, periodStart: period.start }).supported) return futureOut;
    const hmF = historyMonths(cutoff);
    const needF = hmF.filter((ym) => monthEnd(ym) >= DATA_START);
    const sF = needF.length ? { from: monthStart(needF[0]) < DATA_START ? DATA_START : monthStart(needF[0]), to: monthEnd(needF[needF.length - 1]), amanah: sc.amanah, source: "all", scopeType: "all", muni: rv.mode === "municipality" ? rv.muniKey : "all", status: "all" } : null;
    const serF = sF ? await rev.data.series(sF, { cfg: approvedCfg }) : null;
    const valF = (ym) => {
      if (!serF) return null;
      const i = serF.months.indexOf(ym);
      return i >= 0 ? serF.values[i] : null;
    };
    return { ...futureOut, history: { ...meta2, months: hmF.map((ym) => ({ ym, value: monthEnd(ym) < DATA_START ? null : valF(ym) })) } };
  }
  const rows = monthRows(period).filter((r) => r.start <= cutoff);
  const from = period.start < DATA_START ? DATA_START : period.start;
  const scope = { from, to: cutoff, amanah: sc.amanah, source: "all", scopeType: "all", muni: rv.mode === "municipality" ? rv.muniKey : "all", status: "all" };
  const hm = historyMonths(cutoff);
  const covered = (ym) => rows.some((r) => r.ym === ym && r.start === monthStart(ym) && r.end === monthEnd(ym) && r.end <= cutoff && monthStart(ym) >= from);
  const needExtra = hm.filter((ym) => monthEnd(ym) >= DATA_START && !covered(ym));
  const extraScope = needExtra.length ? { ...scope, from: monthStart(needExtra[0]) < DATA_START ? DATA_START : monthStart(needExtra[0]), to: monthEnd(needExtra[needExtra.length - 1]) } : null;
  const noData = from > cutoff;
  const [snap, ser, serHist] = await Promise.all([
    noData ? null : rev.data.snapshot(scope, { cfg: approvedCfg }),
    noData ? null : rev.data.series(scope, { cfg: approvedCfg }),
    extraScope && extraScope.from <= extraScope.to ? rev.data.series(extraScope, { cfg: approvedCfg }) : null
  ]);
  const valOf = (series2, ym) => {
    if (!series2) return null;
    const i = series2.months.indexOf(ym);
    return i >= 0 ? series2.values[i] : null;
  };
  const monthly = rows.map((r) => r.end < DATA_START || !ser ? null : valOf(ser, r.ym));
  const history = {
    ...meta2,
    months: hm.map((ym) => {
      if (monthEnd(ym) < DATA_START) return { ym, value: null };
      const i = rows.findIndex((r) => r.ym === ym);
      return { ym, value: covered(ym) && i >= 0 ? monthly[i] : valOf(serHist, ym) };
    })
  };
  const R = snap?.receivedInPeriod || { byAmanah: {}, total: 0 };
  const byEntity = R.byAmanah || {};
  const actual = { monthly, byEntity, total: monthly.some((x) => x != null) ? monthly.reduce((t, x) => t + (x || 0), 0) : null, meta: meta2 };
  if (rv.mode === "amanah" && snap) {
    const prefix = `${rv.amanah}|`;
    const byMunicipality = {};
    const un = { total: 0, direct: 0, notSpecified: 0, unresolved: 0 };
    for (const [k, v] of Object.entries(R.byMunicipality || {})) {
      if (!k.startsWith(prefix) || !(typeof v === "number")) continue;
      const tok = k.slice(prefix.length);
      if (tok === "DIRECT") {
        un.direct += v;
        un.total += v;
      } else if (tok === "NOT_SPECIFIED") {
        un.notSpecified += v;
        un.total += v;
      } else if (tok === "UNRESOLVED") {
        un.unresolved += v;
        un.total += v;
      } else byMunicipality[tok] = v;
    }
    actual.byMunicipality = byMunicipality;
    actual.unattributed = un;
  }
  let facts = null;
  let billedMonthly = [];
  let standing = null;
  let cells = [];
  if (snap) {
    const netBy = new Map(snap.byMonth.map((x) => [x.month, x.net]));
    const t = snap.totals;
    const nc = snap.noncollection || {};
    facts = {
      net: t.net,
      gross: t.gross,
      exclusions: t.exclusions,
      cancelled: t.cancelled,
      cancelledCount: t.cancelledCount,
      fromPriorInvoices: R.fromPriorInvoices ?? null,
      collectedCohort: t.net > 0 ? t.collected / t.net : null,
      netUncollected: snap.stock?.netUncollected ?? null,
      objectionOutstanding: snap.stock?.objectionOutstanding ?? 0,
      linkageUnresolved: { count: nc.linkage_unresolved?.count || 0, amount: nc.linkage_unresolved?.amount || 0 },
      quality: { missingFieldCount: snap.quality?.missingFieldCount ?? 0, amountConflictCount: snap.quality?.amountConflictCount ?? 0 }
    };
    billedMonthly = rows.map((r) => netBy.get(r.ym) || 0);
    standing = snap.stock.netUncollected;
    cells = snap.matrix.amanahSource;
  }
  return { meta: meta2, future: false, actual, history, byAmanah: byEntity, total: R.total ?? 0, monthly, billedMonthly, standing, cells, facts, partialDataStart: period.start < DATA_START ? DATA_START : null };
}

// server/plans/remaining2026.js
async function engineActualsToCutoff(annualContent, cutoff) {
  const st = currentStore();
  if (!st || !st.meta || !st.meta.today || st.meta.today < cutoff) return null;
  const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: st.meta.today });
  const rev = { data: { snapshot: async (scope, o = {}) => snapshot2(st, { scope, cfg: o.cfg || cfg }), series: async (scope, o = {}) => series(st, { scope, cfg: o.cfg || cfg }) } };
  const view2 = { planId: null, versionId: null, period: annualContent.period, scope: annualContent.scope, content: annualContent };
  const D = await loadPlanInputsForPlan(rev, { view: view2, reporting: cutoff, approvedCfg: cfg, entityKeys: null, viewScope: null });
  if (!D || !D.actual || !D.actual.byEntity) return null;
  return { byEntity: D.actual.byEntity, total: D.actual.total };
}
var provider = engineActualsToCutoff;
function ensureRemainingPlan(store) {
  if (!store || store.remainingSettled) return Promise.resolve(false);
  if (store.db.plans.some((p) => p.seedKey === REMAINING_PLAN_2026.seedKey)) {
    store.remainingSettled = true;
    return Promise.resolve(false);
  }
  const annual = store.db.plans.find((p) => p.id === SEED_PLAN_ID && p.content && p.content.period && p.content.period.start === "2026-01-01");
  if (!annual) return Promise.resolve(false);
  if (store.remainingPending) return store.remainingPending;
  const run = (async () => {
    const act = await provider(annual.content, REMAINING_PLAN_2026.baselineCutoff);
    if (!act || !act.byEntity) return false;
    const now = nowIso3();
    return store.mutate((db) => {
      const a = db.plans.find((p) => p.id === annual.id) || annual;
      const content = deriveRemainingPlanContent({ annualContent: a.content, actualByEntity: act.byEntity, cutoff: REMAINING_PLAN_2026.baselineCutoff, period: REMAINING_PLAN_2026.period, annualPlanId: a.id, annualPlanRevision: a.revision, derivedAt: now });
      return ensureRemaining2026(db, content, now).created;
    });
  })().then((created) => {
    if (store.db.plans.some((p) => p.seedKey === REMAINING_PLAN_2026.seedKey)) store.remainingSettled = true;
    return created;
  }, () => false).finally(() => {
    store.remainingPending = null;
  });
  store.remainingPending = run;
  return run;
}

// server/plansApi.js
function send2(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}
function sendError2(res, e, path5) {
  if (e instanceof PlanError) return send2(res, e.status, { error: e.code, ...e.extra });
  console.error("[plans]", path5);
  return send2(res, 500, { error: "server_error" });
}
function actorOf(auth, principal) {
  const u = auth.user || {};
  const scope = principal && typeof principal.scopeOf === "function" ? principal.scopeOf("planning") : effectiveScopeFor(auth.access, "planning");
  return { userId: u.id, name: u.nameAr || u.nameEn || u.username || u.id, ...u.nameEn ? { nameEn: u.nameEn } : {}, geoScope: scope, readOnly: !!(auth.access && auth.access.readOnly) };
}
var usersById = null;
function currentNames() {
  try {
    const db = getDb();
    if (!usersById || usersById.db !== db || usersById.n !== db.users.length) usersById = { db, n: db.users.length, map: new Map(db.users.map((u) => [u.id, { ar: u.nameAr || u.nameEn, en: u.nameEn || u.nameAr }])) };
    return usersById.map;
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
var withName = (ref, names) => {
  if (!ref || ref.system || !ref.userId) return ref;
  const cur = names.get(ref.userId);
  return cur ? { ...ref, currentName: cur } : ref;
};
function decoratePlan(p, names) {
  if (!p) return p;
  const o = { ...p, createdBy: withName(p.createdBy, names), lastEditedBy: withName(p.lastEditedBy, names) };
  if (Array.isArray(p.versions)) o.versions = p.versions.map((v) => ({ ...v, savedBy: withName(v.savedBy, names) }));
  return o;
}
function decorate(result) {
  if (!result || typeof result !== "object") return result;
  const names = currentNames();
  const out = { ...result };
  if (out.plan && out.plan.id) out.plan = decoratePlan(out.plan, names);
  if (Array.isArray(out.plans)) out.plans = out.plans.map((p) => decoratePlan(p, names));
  if (out.references) out.references = Object.fromEntries(Object.entries(out.references).map(([y, r]) => [y, r ? { ...r, setBy: withName(r.setBy, names) } : r]));
  if (Array.isArray(out.entries)) out.entries = out.entries.map((e) => ({ ...e, actor: withName(e.actor, names) }));
  if (out.version && out.version.savedBy !== void 0) out.version = { ...out.version, savedBy: withName(out.version.savedBy, names) };
  return out;
}
async function handlePlansRoute(req, res, path5, body, ctx = {}) {
  if (path5 !== "/plans" && !path5.startsWith("/plans/")) return false;
  const method = String(req.method || "GET").toUpperCase();
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const auth = ctx.auth;
  if (!auth || !auth.user) {
    send2(res, 401, { error: "unauthenticated" });
    return true;
  }
  const seg = path5.split("/").filter(Boolean).slice(1).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const actor = actorOf(auth, ctx.principal);
  const store = planStore();
  await ensureRemainingPlan(store);
  const q3 = (() => {
    try {
      return Object.fromEntries((ctx.url || new URL(req.url, "http://x")).searchParams.entries());
    } catch {
      return {};
    }
  })();
  const ok = (code, r) => {
    send2(res, code, decorate(r));
    return true;
  };
  try {
    if (seg.length === 0) {
      if (method === "GET") return ok(200, listPlans(actor, { year: q3.year, owner: q3.owner, entity: q3.entity, amanah: q3.amanah, muni: q3.muni }, store));
      if (method === "POST") return ok(201, createPlan(actor, b, store));
    } else if (seg.length === 1 && seg[0] === "references") {
      if (method === "GET") return ok(200, getReferences(actor, store));
      if (method === "POST") return ok(200, setReference(actor, b, store));
    } else if (seg.length === 1 && seg[0] === "import-legacy") {
      if (method === "POST") return ok(201, importLegacy(actor, b, store));
    } else if (seg.length === 1 && seg[0] === "default") {
      if (method === "PUT") return ok(200, setPersonalDefault(actor, b, store));
    } else if (seg.length === 1 && seg[0] === "system-default") {
      if (method === "PUT") return ok(200, setSystemDefault(actor, b, store));
      if (method === "GET") return ok(200, getSystemDefault(actor, store));
    } else if (seg.length === 1) {
      if (method === "GET") return ok(200, getPlan(actor, seg[0], store, { amanah: q3.amanah, muni: q3.muni }));
      if (method === "PUT") return ok(200, updatePlan(actor, seg[0], b, store));
    } else if (seg.length === 2) {
      if (method === "GET" && seg[1] === "audit") return ok(200, getAudit(actor, seg[0], store));
    } else if (seg.length === 3 && method === "GET" && seg[1] === "versions") return ok(200, getVersion(actor, seg[0], seg[2], store, { amanah: q3.amanah, muni: q3.muni }));
    send2(res, 404, { error: "not_found" });
  } catch (e) {
    sendError2(res, e, path5);
  }
  return true;
}

// server/api.js
var memo3 = /* @__PURE__ */ new Map();
var MAX_MEMO = 60;
function memoize(key, fn) {
  if (memo3.has(key)) {
    const v2 = memo3.get(key);
    memo3.delete(key);
    memo3.set(key, v2);
    return v2;
  }
  const v = fn();
  memo3.set(key, v);
  if (memo3.size > MAX_MEMO) memo3.delete(memo3.keys().next().value);
  return v;
}
var epoch2 = 0;
var lastAccessVersion = null;
function readBody(req) {
  if (req.body !== void 0 && req.body !== null) {
    try {
      const b = req.body;
      return Promise.resolve(Buffer.isBuffer(b) ? b.length ? JSON.parse(b.toString("utf8")) : {} : typeof b === "string" ? b ? JSON.parse(b) : {} : b);
    } catch (e) {
      return Promise.reject(e);
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > 2e7) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
var send3 = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
};
var stable = (o) => JSON.stringify(o, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
var authenticator = null;
var owners = /* @__PURE__ */ new Map();
var hashOwner = (sess) => {
  let h = 7;
  for (const ch of String(sess)) h = Math.imul(h, 31) + ch.charCodeAt(0) >>> 0;
  return 1 + h % 6e4;
};
function ownerForUser(userId) {
  if (!userId) return 0;
  const k = String(userId);
  let n = owners.get(k);
  if (!n) {
    n = owners.size < 6e4 ? owners.size + 1 : hashOwner(k);
    owners.set(k, n);
  }
  return n;
}
function narrowingOf(scope) {
  const sc = scope && typeof scope === "object" && !Array.isArray(scope) ? scope : {};
  const ofKeys = (keys) => normalizeGeoScope({ all: false, nonMunicipal: keys.includes("Housing Sector"), grants: keys.filter((k) => typeof k === "string" && GEO_HIERARCHY.has(k)).map(entireAmanahGrant) });
  let n = ALL_SCOPE;
  const org = sc.org && typeof sc.org === "object" ? sc.org.amanahKeys : sc.orgKeys;
  if (Array.isArray(org)) n = intersectGeoScopes(n, ofKeys(org));
  if (sc.amanah !== void 0 && sc.amanah !== null && sc.amanah !== "all") n = intersectGeoScopes(n, ofKeys([].concat(sc.amanah).map(String)));
  if (sc.muni !== void 0 && sc.muni !== null && sc.muni !== "all" && sc.muni !== "") {
    const pm = parseMuniKey(sc.muni);
    if (pm && pm.invalid) n = intersectGeoScopes(n, EMPTY_SCOPE);
    else if (pm) {
      if (!GEO_HIERARCHY.has(pm.amanahEn)) n = intersectGeoScopes(n, normalizeGeoScope({ all: false, nonMunicipal: true, grants: [] }));
      else n = intersectGeoScopes(n, normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: pm.amanahEn, municipalities: pm.kind === "mapped" ? [pm.refId] : [], direct: pm.kind === "direct_amanah", notSpecified: pm.kind === "not_specified" || pm.kind === "unresolved" }] }));
    }
  }
  return n;
}
var principalOf = (auth) => ({ id: auth.user.id, user: auth.user, access: auth.access, accessVersion: auth.accessVersion, readOnly: !!auth.access.readOnly, has: (p) => auth.access.permissions.has(p), scopeOf: (p) => effectiveScopeFor(auth.access, p) });
var scopeOfGranted = (principal, granted) => granted.reduce((s, p) => unionGeoScopes(s, principal.scopeOf(p)), EMPTY_SCOPE);
var accessOfRequest = (principal, granted, clientScope) => intersectGeoScopes(scopeOfGranted(principal, granted), narrowingOf(clientScope));
async function furasRoute(req, res, path5, body, access) {
  const av = furasAvailableFor(access);
  if (path5 === "/furas/status") return send3(res, 200, av);
  if (!av.available) return send3(res, 404, { error: "furas_unavailable" });
  try {
    switch (path5) {
      case "/furas/summary":
        return send3(res, 200, await furasSummary());
      case "/furas/contracts":
        return send3(res, 200, await furasContracts(body));
      case "/furas/contract": {
        const c = await furasContract(body.no);
        return c ? send3(res, 200, c) : send3(res, 404, { error: "contract_not_found" });
      }
      case "/furas/decisions":
        return send3(res, 200, await furasDecisionInput());
      default:
        return send3(res, 404, { error: "not_found" });
    }
  } catch (e) {
    return send3(res, 500, { error: "furas_error" });
  }
}
function previewResponse(st, today, principal, body) {
  const fields = [];
  if (typeof body.roleId !== "string" || !body.roleId) fields.push({ field: "roleId", code: "required" });
  const v = validateGeoScope(body.scope);
  if (!v.ok) fields.push({ field: "scope", code: "scope_invalid", errors: v.errors });
  if (fields.length) return { code: 400, body: { error: "validation_error", fields } };
  const access = resolveAccess({ roleId: body.roleId, scope: normalizeGeoScope(body.scope) });
  if (!access.role) return { code: 400, body: { error: "validation_error", fields: [{ field: "roleId", code: "unknown_role" }] } };
  const described = describeAccess(access);
  const adminData = DATA_MODULES.filter((p) => principal.has(p)).reduce((s, p) => unionGeoScopes(s, principal.scopeOf(p)), EMPTY_SCOPE);
  const held = DATA_MODULES.filter((p) => access.permissions.has(p));
  const previewScope = held.reduce((s, p) => unionGeoScopes(s, effectiveScopeFor(access, p)), EMPTY_SCOPE);
  const visible = intersectGeoScopes(previewScope, adminData);
  const label = { ar: "\u0623\u0631\u0642\u0627\u0645 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0644\u0644\u0639\u0631\u0636 \u0641\u0642\u0637", en: "Synthetic figures, illustrative only" };
  const adminHasData = DATA_MODULES.some((p) => principal.has(p));
  const out = { ...described, scopeSummary: { ar: describeGeoScope(normalizeGeoScope(body.scope), "ar"), en: describeGeoScope(normalizeGeoScope(body.scope), "en") }, figuresLabel: label };
  if (!adminHasData || !held.length) return { code: 200, body: { ...out, figures: null, figuresWithheld: !adminHasData, moduleFigures: {}, clamped: false } };
  const cfg = { cutoff: today };
  const snap = snapshot2(st, { access: visible, scope: { from: "2000-01-01", to: today }, cfg, owner: 0 });
  const t = snap.totals;
  const moduleFigures = {};
  for (const p of held) {
    const s = intersectGeoScopes(effectiveScopeFor(access, p), adminData);
    const tab = accessTable(s);
    const cutN = dayNum(today);
    let n = 0;
    for (let i = 0; i < st.n; i += 1) if (st.owner[i] === 0 && st.issue[i] <= cutN && (tab.all || isVisible(st, i, tab))) n += 1;
    const m = { records: n };
    if (p === "contracts") m.contracts = st.contracts.filter((c) => c && contractVisible(st, c, tab)).length;
    if (p === "enforcement") m.requests = st.requests.filter((q3) => requestVisible(st, q3, tab)).length;
    moduleFigures[p] = m;
  }
  const clamped = geoScopeKey(visible) !== geoScopeKey(previewScope);
  return { code: 200, body: { ...out, figures: { count: t.count, gross: t.gross, exclusions: t.exclusions, net: t.net, collected: t.collected, uncollected: t.outstanding }, moduleFigures, clamped, figuresWithheld: false } };
}
async function handleApi(req, res) {
  const url = new URL(req.url, "http://x");
  const path5 = url.pathname.replace(/^\/api/, "") || "/";
  const hdr = (k) => {
    const v = req.headers[k];
    return Array.isArray(v) ? v[0] : v;
  };
  {
    const wh = res.writeHead.bind(res);
    let v;
    try {
      v = String(currentAccessVersion());
    } catch {
      v = "0";
    }
    res.writeHead = (code, headers) => wh(code, { ...headers || {}, "x-access-version": v });
  }
  const method = String(req.method || "GET").toUpperCase();
  let body = {};
  if ((path5.startsWith("/auth/") || path5.startsWith("/admin/")) && path5 !== "/admin/preview") {
    try {
      body = method === "GET" || method === "HEAD" ? {} : await readBody(req);
    } catch (e) {
      return send3(res, 400, { error: "invalid_json" });
    }
    try {
      const handled = await handleIdentityRoute(req, res, path5, body, {});
      if (!handled) return send3(res, 404, { error: "not_found" });
      return void 0;
    } catch (e) {
      console.error("[api]", path5);
      return send3(res, 500, { error: "server_error" });
    }
  }
  let auth = null;
  try {
    if (authenticator) auth = await authenticator(req);
    else {
      let r = req;
      if (method === "GET" && path5 === "/export.csv" && !(req.headers && (req.headers.authorization || req.headers.Authorization)) && url.searchParams.get("access_token")) r = { headers: { authorization: `Bearer ${url.searchParams.get("access_token")}` } };
      auth = authenticate(r);
    }
  } catch (e) {
    auth = null;
  }
  if (!auth || !auth.user || !auth.access) return send3(res, 401, { error: "unauthenticated" });
  const principal = principalOf(auth);
  if (principal.accessVersion !== lastAccessVersion) {
    lastAccessVersion = principal.accessVersion;
    bumpAccessEpoch();
    epoch2 += 1;
    bumpEpoch();
  }
  const owner = ownerForUser(principal.id);
  try {
    if (method === "GET" && path5 === "/export.csv") {
      try {
        body = JSON.parse(url.searchParams.get("q") || "{}");
      } catch {
        return send3(res, 400, { error: "invalid_json" });
      }
    } else if (method !== "GET" && method !== "HEAD") {
      try {
        body = await readBody(req);
      } catch (e) {
        return send3(res, 400, { error: "invalid_json" });
      }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) body = {};
    const need = requiredPermissionFor(method, path5, body);
    if (need.kind === "unknown") return send3(res, 404, { error: "not_found" });
    let granted = [];
    if (need.kind === "permission") {
      granted = need.anyOf.filter((p) => principal.has(p));
      if (!granted.length) {
        try {
          auditDenied(principal.user, need.anyOf[0], `${method} ${path5}`);
        } catch {
        }
        return send3(res, 403, { error: "forbidden", permission: need.anyOf[0], module: need.anyOf[0], ...need.anyOf.length > 1 ? { anyOf: need.anyOf } : {} });
      }
      if (need.write && principal.readOnly) {
        try {
          auditDenied(principal.user, "read_only_role", `${method} ${path5}`, "read_only");
        } catch {
        }
        return send3(res, 403, { error: "read_only_role" });
      }
    } else if (need.kind === "auth") granted = DATA_MODULES.filter((p) => principal.has(p));
    if (path5 === "/plans" || path5.startsWith("/plans/")) {
      await handlePlansRoute(req, res, path5, body, { auth, principal, url });
      return void 0;
    }
    delete body.access;
    delete body.accessMask;
    const access = accessOfRequest(principal, granted, body.scope);
    body.access = access;
    body.owner = owner;
    const aKey = `${accessKeyOf(access)}|${granted.join("+")}`;
    if (path5.startsWith("/furas/")) return await furasRoute(req, res, path5, body, effectiveScopeOfAll(principal, granted));
    const st = currentStore(hdr("x-demo-today") || url.searchParams.get("today"), hdr("x-demo-size") || url.searchParams.get("size"));
    const today = st.meta.today;
    if (method === "GET" && path5 === "/meta") return send3(res, 200, memoize(`meta|${today}|${epoch2}|${owner}|${aKey}`, () => meta(st, today, access)));
    if (method === "GET" && path5 === "/sanad-cases") return send3(res, 200, { cases: memoize(`cases|${today}|${epoch2}|${aKey}`, () => sanadCases(st, { access, cfg: { cutoff: today } })) });
    if (method === "GET" && path5 === "/export.csv") {
      body.cfg = { ...body.cfg || {}, cutoff: today };
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="invoices-${today}.csv"`, "Cache-Control": "no-store" });
      const it = exportChunks(st, body);
      const pump = () => {
        for (; ; ) {
          const { value, done } = it.next();
          if (done) {
            res.end();
            return;
          }
          if (!res.write(value)) {
            res.once("drain", pump);
            return;
          }
        }
      };
      return pump();
    }
    if (method !== "POST") return send3(res, 404, { error: "not_found" });
    body.cfg = { ...body.cfg || {}, cutoff: path5 === "/series" && body.asOf && body.asOf < today ? body.asOf : today };
    const key = (k) => `${k}|${today}|${epoch2}|${aKey}|${stable(body)}`;
    switch (path5) {
      case "/admin/preview": {
        const r = previewResponse(st, today, principal, body);
        return send3(res, r.code, r.body);
      }
      case "/snapshot":
        return send3(res, 200, memoize(key("snap"), () => snapshot2(st, body)));
      case "/series":
        return send3(res, 200, memoize(key("series"), () => series(st, body)));
      case "/bridge":
        return send3(res, 200, memoize(key("bridge"), () => bridge(st, body)));
      case "/list":
        return send3(res, 200, list(st, body));
      case "/noncollection":
        return send3(res, 200, memoize(key("nc"), () => nonCollectionAnalysis(st, body)));
      case "/distributions":
        return send3(res, 200, memoize(key("dist"), () => chartDistributions(st, body)));
      case "/plan-actions":
        return send3(res, 200, memoize(key("planact"), () => actionLines(st, body)));
      case "/worklist":
        return send3(res, 200, memoize(key("wl"), () => worklist(st, body)));
      case "/anomalies":
        return send3(res, 200, memoize(key("an"), () => anomalies(st, body)));
      case "/sources":
        return send3(res, 200, memoize(key("src"), () => sourcesReport(st, body)));
      case "/quality":
        return send3(res, 200, memoize(key("q"), () => quality(st, body)));
      case "/contracts":
        return send3(res, 200, memoize(key("ct"), () => {
          const cards = contractCards(st, body);
          return { cards, rollup: contractRollup(cards) };
        }));
      case "/contract": {
        const c = memoize(key("ct1"), () => contractCard(st, body, body.no));
        return c?.ambiguous ? send3(res, 409, { error: "contract_number_ambiguous", matches: c.matches }) : c ? send3(res, 200, c) : send3(res, 404, { error: "contract_not_found" });
      }
      case "/invoice": {
        const ref = lookupRef(st, body.id);
        const orgKeys = body.scope?.org?.amanahKeys || null;
        const tab = accessTable(access);
        const vis = ref.indexes.filter((x) => (st.owner[x] === 0 || st.owner[x] === owner) && isVisible(st, x, tab) && (!orgKeys || orgKeys.includes(ENTITIES[st.ent[x]].en)));
        if (vis.length > 1) return send3(res, 409, { error: "invoice_ambiguous", candidates: invoiceCandidates(st, body, vis) });
        const i = vis.length === 1 ? vis[0] : -1;
        if (i < 0) return send3(res, 404, { error: "invoice_not_found" });
        const d = detail(st, i, makeCtx(st, body));
        return send3(res, 200, d);
      }
      case "/exclusion-check":
        return send3(res, 200, checkExclusionRows(st, body));
      case "/order-match":
        return send3(res, 200, resolveReferences(st, body));
      case "/enforcement-collections":
        return send3(res, 200, enforcementCollections(st, body));
      case "/order-debtor-invoices":
        return send3(res, 200, sameDebtorInvoices(st, body));
      case "/upload": {
        const recs = [];
        const duplicates = [];
        const outOfScope = [];
        const tab = accessTable(access);
        for (const r of body.records || []) {
          const e = ENTITY_INDEX[r.amanahEn];
          if (e != null && !visibleCode(tab, e, classifySourceValues(e, r.municipalitySourceValues || (r.municipalityAr ? [r.municipalityAr] : [])).code)) {
            outOfScope.push(r.id);
            continue;
          }
          const ck = recordCompositeKey(r);
          const ex = Math.max(lookupId(st, r.id), ck ? lookupComposite(st, ck) : -1);
          if (ex >= 0 && (st.owner[ex] === 0 || st.owner[ex] === owner)) duplicates.push(r.id);
          else recs.push(r);
        }
        if (st.n + recs.length > st.cap || st.pn + recs.length * 3 > st.pcap) return send3(res, 413, { error: "upload_capacity_exceeded" });
        for (const r of recs) appendRecord(st, r, { owner, kind: "upload" });
        epoch2 += 1;
        bumpEpoch();
        return send3(res, 200, { ok: true, added: recs.length, duplicates, ...outOfScope.length ? { outOfScope } : {} });
      }
      case "/upload/clear": {
        let n = 0;
        for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === owner && owner !== 0) {
          st.owner[i] = 65535;
          n += 1;
        }
        epoch2 += 1;
        bumpEpoch();
        return send3(res, 200, { ok: true, removed: n });
      }
      default:
        return send3(res, 404, { error: "not_found" });
    }
  } catch (e) {
    console.error("[api]", path5, e);
    return send3(res, 500, { error: "server_error", message: String(e.message || e) });
  }
}
var effectiveScopeOfAll = (principal, granted) => scopeOfGranted(principal, granted);

// server/standalone.js
var here = path4.dirname(fileURLToPath(import.meta.url));
var DIST = fs4.existsSync(path4.join(here, "..", "dist")) ? path4.join(here, "..", "dist") : path4.join(here, "dist");
var PORT = process.env.PORT || process.env._APP_PORT || 3e3;
var MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon", ".pdf": "application/pdf", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json" };
var sendFile = (res, filePath) => {
  res.writeHead(200, { "Content-Type": MIME[path4.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": /\/assets\//.test(filePath) ? "public, max-age=31536000, immutable" : "no-cache" });
  fs4.createReadStream(filePath).pipe(res);
};
var sendIndex = (res) => fs4.readFile(path4.join(DIST, "index.html"), (err2, data) => {
  if (err2) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    return res.end("dist/index.html not found \u2014 run npm run build");
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
  res.end(data);
});
var server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/api" || urlPath.startsWith("/api/")) return await handleApi(req, res);
    if (urlPath === "/") return sendIndex(res);
    const filePath = path4.join(DIST, urlPath);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("Forbidden");
    }
    fs4.stat(filePath, (err2, stat) => !err2 && stat.isFile() ? sendFile(res, filePath) : sendIndex(res));
    return void 0;
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/plain" });
    return res.end("Server error");
  }
});
server.listen(PORT, "0.0.0.0", () => {
  const t = Date.now();
  currentStore();
  console.log(`INTELLIBILL listening on port ${PORT} \xB7 demo world ready in ${Date.now() - t} ms`);
});
