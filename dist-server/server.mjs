// server/standalone.js
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
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
      const q2 = new URLSearchParams(window.location.search).get("demoToday");
      if (q2 && ISO.test(q2)) {
        window.sessionStorage.setItem("ib_demo_today", q2);
        return q2;
      }
      if (q2 === "reset") window.sessionStorage.removeItem("ib_demo_today");
      const s = window.sessionStorage.getItem("ib_demo_today");
      if (s && ISO.test(s) && q2 !== "reset") return s;
    }
  } catch {
  }
  return null;
}
var DEMO_TODAY = override() || riyadhToday();
var IS_TIME_TRAVEL = DEMO_TODAY !== riyadhToday();

// src/data/mock.js
var INVOICES = [
  {
    id: "INV-2026-0731",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Rajhi \u5EFA\u8BBE\u96C6\u56E2",
    entityEn: "Al-Rajhi Construction Group",
    entityAr: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0631\u0627\u062C\u062D\u064A \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0730",
    payType: "deferred",
    centralSource: true,
    entity: "NEOM \u7269\u6D41\u670D\u52A1",
    entityEn: "NEOM Logistics",
    entityAr: "\u0646\u064A\u0648\u0645 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    amanah: "\u5854\u5E03\u514B",
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
    id: "INV-2026-0729",
    payType: "deferred",
    centralSource: true,
    entity: "Saudi Tech Solutions",
    entityEn: "Saudi Tech Solutions",
    entityAr: "\u0627\u0644\u062D\u0644\u0648\u0644 \u0627\u0644\u062A\u0642\u0646\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0728",
    payType: "deferred",
    centralSource: true,
    entity: "Gulf Facility Mgmt",
    entityEn: "Gulf Facility Mgmt",
    entityAr: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u062E\u0644\u064A\u062C",
    amanah: "\u4E1C\u90E8\u7701",
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
    id: "INV-2026-0727",
    payType: "deferred",
    centralSource: true,
    entity: "Aramco \u540E\u52E4\u4F9B\u5E94",
    entityEn: "Aramco Logistics Supply",
    entityAr: "\u0623\u0631\u0627\u0645\u0643\u0648 \u0644\u0644\u0625\u0645\u062F\u0627\u062F \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    amanah: "\u4E1C\u90E8\u7701",
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
    id: "INV-2026-0726",
    payType: "prepaid",
    centralSource: false,
    entity: "Riyadh \u5E02\u653F\u5DE5\u7A0B",
    entityEn: "Riyadh Municipal Works",
    entityAr: "\u0623\u0639\u0645\u0627\u0644 \u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0725",
    payType: "prepaid",
    centralSource: false,
    entity: "STC \u901A\u4FE1\u670D\u52A1",
    entityEn: "STC Telecom Services",
    entityAr: "STC \u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amanah: "\u9EA6\u52A0",
    amanahEn: "Makkah Amanah",
    amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629",
    municipality: "Al-Aziziyah",
    municipalityEn: "Al-Aziziyah Municipality",
    municipalityAr: "\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0639\u0632\u064A\u0632\u064A\u0629",
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
    id: "INV-2026-0724",
    payType: "deferred",
    centralSource: true,
    entity: "Bahri \u6D77\u8FD0\u7269\u6D41",
    entityEn: "Bahri Maritime Logistics",
    entityAr: "\u0627\u0644\u0628\u062D\u0631\u064A \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0627\u0644\u0628\u062D\u0631\u064A\u0629",
    amanah: "\u5409\u8FBE",
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
    id: "INV-2026-0722",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Noor \u8D38\u6613",
    entityEn: "Al-Noor Trading",
    entityAr: "\u0627\u0644\u0646\u0648\u0631 \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
    amanah: "\u5409\u8FBE",
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
    id: "INV-2025-0810",
    payType: "deferred",
    centralSource: true,
    entity: "Red Sea \u627F\u5305",
    entityEn: "Red Sea Global Contracting",
    entityAr: "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0623\u062D\u0645\u0631 \u0644\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062A",
    amanah: "\u5854\u5E03\u514B",
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
    id: "INV-2025-0855",
    payType: "prepaid",
    centralSource: false,
    entity: "Jeddah \u5F00\u53D1\u516C\u53F8",
    entityEn: "Jeddah Development Co.",
    entityAr: "\u062C\u062F\u0629 \u0644\u0644\u062A\u0637\u0648\u064A\u0631",
    amanah: "\u5409\u8FBE",
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
    id: "INV-2025-0902",
    payType: "deferred",
    centralSource: true,
    entity: "NEOM \u7269\u6D41\u670D\u52A1",
    entityEn: "NEOM Logistics",
    entityAr: "\u0646\u064A\u0648\u0645 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    amanah: "\u5854\u5E03\u514B",
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
    id: "INV-2025-0940",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Ahsa \u519C\u4E1A\u673A\u6784",
    entityEn: "Al-Ahsa Agricultural Est.",
    entityAr: "\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621 \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "\u54C8\u8428",
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
    id: "INV-2025-0975",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Rajhi \u5EFA\u8BBE\u96C6\u56E2",
    entityEn: "Al-Rajhi Construction Group",
    entityAr: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0631\u0627\u062C\u062D\u064A \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0520",
    payType: "deferred",
    centralSource: true,
    entity: "Bahri \u6D77\u8FD0\u7269\u6D41",
    entityEn: "Bahri Maritime Logistics",
    entityAr: "\u0627\u0644\u0628\u062D\u0631\u064A \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0627\u0644\u0628\u062D\u0631\u064A\u0629",
    amanah: "\u5409\u8FBE",
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
    id: "INV-2026-0530",
    payType: "prepaid",
    centralSource: false,
    entity: "STC \u901A\u4FE1\u670D\u52A1",
    entityEn: "STC Telecom Services",
    entityAr: "STC \u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    amanah: "\u9EA6\u52A0",
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
    id: "INV-2026-0545",
    payType: "deferred",
    centralSource: true,
    entity: "Tabuk \u4F4F\u623F\u673A\u6784",
    entityEn: "Tabuk Housing Authority",
    entityAr: "\u0647\u064A\u0626\u0629 \u0625\u0633\u0643\u0627\u0646 \u062A\u0628\u0648\u0643",
    amanah: "\u5854\u5E03\u514B",
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
    id: "INV-2026-0560",
    payType: "deferred",
    centralSource: true,
    entity: "Gulf Facility Mgmt",
    entityEn: "Gulf Facility Mgmt",
    entityAr: "\u0625\u062F\u0627\u0631\u0629 \u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u062E\u0644\u064A\u062C",
    amanah: "\u4E1C\u90E8\u7701",
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
    id: "INV-2026-0575",
    payType: "deferred",
    centralSource: true,
    entity: "Saudi Tech Solutions",
    entityEn: "Saudi Tech Solutions",
    entityAr: "\u0627\u0644\u062D\u0644\u0648\u0644 \u0627\u0644\u062A\u0642\u0646\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0590",
    payType: "deferred",
    centralSource: true,
    entity: "Aramco \u540E\u52E4\u4F9B\u5E94",
    entityEn: "Aramco Logistics Supply",
    entityAr: "\u0623\u0631\u0627\u0645\u0643\u0648 \u0644\u0644\u0625\u0645\u062F\u0627\u062F \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    amanah: "\u4E1C\u90E8\u7701",
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
    id: "INV-2026-0605",
    payType: "prepaid",
    centralSource: false,
    entity: "Riyadh \u5E02\u653F\u5DE5\u7A0B",
    entityEn: "Riyadh Municipal Works",
    entityAr: "\u0623\u0639\u0645\u0627\u0644 \u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0631\u064A\u0627\u0636",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0620",
    payType: "deferred",
    centralSource: true,
    entity: "Al-Noor \u8D38\u6613",
    entityEn: "Al-Noor Trading",
    entityAr: "\u0627\u0644\u0646\u0648\u0631 \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
    amanah: "\u5409\u8FBE",
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
    id: "INV-2026-0635",
    payType: "deferred",
    centralSource: true,
    entity: "Metro \u8FD0\u8F93",
    entityEn: "Metro Transport",
    entityAr: "\u0645\u062A\u0631\u0648 \u0644\u0644\u0646\u0642\u0644",
    amanah: "\u5229\u96C5\u5F97",
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
    id: "INV-2026-0650",
    payType: "deferred",
    centralSource: true,
    entity: "Coastal \u7269\u6D41",
    entityEn: "Coastal Logistics",
    entityAr: "\u0627\u0644\u0633\u0627\u062D\u0644\u064A\u0629 \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    amanah: "\u4E1C\u90E8\u7701",
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
    id: "INV-2026-0801",
    payType: "deferred",
    centralSource: true,
    entity: "Najran \u8FB9\u5883\u8D38\u6613\u516C\u53F8",
    entityEn: "Najran Border Trading Co.",
    entityAr: "\u0634\u0631\u0643\u0629 \u0646\u062C\u0631\u0627\u0646 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0627\u0644\u062D\u062F\u0648\u062F\u064A\u0629",
    amanah: "\u7EB3\u5B63\u5170",
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
    id: "INV-2026-0802",
    payType: "prepaid",
    centralSource: false,
    entity: "Arar \u7269\u6D41\u67A2\u7EBD",
    entityEn: "Arar Logistics Hub",
    entityAr: "\u0645\u0631\u0643\u0632 \u0639\u0631\u0639\u0631 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    amanah: "\u5317\u90E8\u8FB9\u5883",
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
    id: "INV-2026-0803",
    payType: "deferred",
    centralSource: true,
    entity: "Hail \u519C\u4E1A\u5DE5\u4E1A\u516C\u53F8",
    entityEn: "Hail Agri Industries",
    entityAr: "\u062D\u0627\u0626\u0644 \u0644\u0644\u0635\u0646\u0627\u0639\u0627\u062A \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "\u54C8\u4F0A\u52D2",
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
    id: "INV-2026-0804",
    payType: "deferred",
    centralSource: true,
    entity: "Abha \u9AD8\u5730\u5F00\u53D1\u5546",
    entityEn: "Abha Highland Developers",
    entityAr: "\u0645\u0637\u0648\u0631\u0648 \u0623\u0628\u0647\u0627 \u0644\u0644\u0645\u0631\u062A\u0641\u0639\u0627\u062A",
    amanah: "\u963F\u897F\u5C14",
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
    tag: "taxfail",
    // Exclusion category: struck-off commercial registry / deceased debtor —
    // excluded from net-invoiced entirely, never counted as collected. A sole
    // establishment (مؤسسة فردية) is legally tied to one individual owner, so
    // this one is flagged for the debtor's death, not a registry lapse.
    debtorInvalid: true,
    debtorInvalidReason: "deceased_person"
  },
  {
    id: "INV-2026-0805",
    payType: "prepaid",
    centralSource: false,
    entity: "Madinah \u9152\u5E97\u96C6\u56E2",
    entityEn: "Madinah Hospitality Group",
    entityAr: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0644\u0644\u0636\u064A\u0627\u0641\u0629",
    amanah: "\u9EA6\u5730\u90A3",
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
    id: "INV-2026-0806",
    payType: "deferred",
    centralSource: true,
    entity: "Qassim \u519C\u4E1A\u79D1\u6280",
    entityEn: "Qassim AgroTech",
    entityAr: "\u0627\u0644\u0642\u0635\u064A\u0645 \u0644\u0644\u062A\u0642\u0646\u064A\u0629 \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "\u5361\u897F\u59C6",
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
    id: "INV-2026-0807",
    payType: "prepaid",
    centralSource: false,
    entity: "Al Bahah \u65C5\u6E38\u5730\u4EA7",
    entityEn: "Al Bahah Tourism Estates",
    entityAr: "\u0639\u0642\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u0627\u062D\u0629 \u0627\u0644\u0633\u064A\u0627\u062D\u064A\u0629",
    amanah: "\u5DF4\u54C8",
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
    id: "INV-2026-0808",
    payType: "deferred",
    centralSource: true,
    entity: "Jazan \u6E2F\u53E3\u670D\u52A1",
    entityEn: "Jazan Port Services",
    entityAr: "\u062E\u062F\u0645\u0627\u062A \u0645\u064A\u0646\u0627\u0621 \u062C\u0627\u0632\u0627\u0646",
    amanah: "\u5409\u8D5E",
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
    id: "INV-2026-0809",
    payType: "prepaid",
    centralSource: false,
    entity: "Al Jawf \u519C\u4E1A\u516C\u53F8",
    entityEn: "Al Jawf Agricultural Co.",
    entityAr: "\u0634\u0631\u0643\u0629 \u0627\u0644\u062C\u0648\u0641 \u0627\u0644\u0632\u0631\u0627\u0639\u064A\u0629",
    amanah: "\u7126\u592B",
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
    invoiceNo: "INV-2026-0731",
    payer: "Al-Rajhi Construction Group",
    co: "CO-88231",
    accrual: "AC-2026-4471",
    contract: "SANAD-CT-2231",
    currency: "SAR",
    lines: [
      { no: 1, item: { zh: "\u573A\u5730\u5360\u7528\u8D39 (m\xB2)", en: "Site occupation fee (m\xB2)", ar: "\u0631\u0633\u0648\u0645 \u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0645\u0648\u0642\u0639 (\u0645\xB2)" }, qty: 2e3, poQty: 2e3, grnQty: 2e3, invUnit: 375, poUnit: 375, benchUnit: 372 },
      { no: 2, item: { zh: "\u5EFA\u7B51\u5E9F\u5F03\u7269\u5904\u7406\u8D39 (\u5428)", en: "Construction-waste disposal fee (ton)", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u062E\u0644\u0635 \u0645\u0646 \u0645\u062E\u0644\u0641\u0627\u062A \u0627\u0644\u0628\u0646\u0627\u0621 (\u0637\u0646)" }, qty: 250, poQty: 250, grnQty: 250, invUnit: 1400, poUnit: 1400, benchUnit: 1385 },
      { no: 3, item: { zh: "\u811A\u624B\u67B6\u8BB8\u53EF\u6708\u8D39 (\u6708)", en: "Scaffolding permit fee (month)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0631\u062E\u064A\u0635 \u0627\u0644\u0633\u0642\u0627\u0644\u0627\u062A \u0627\u0644\u0634\u0647\u0631\u064A\u0629 (\u0634\u0647\u0631)" }, qty: 5, poQty: 5, grnQty: 5, invUnit: 3e4, poUnit: 3e4, benchUnit: 29500 }
    ],
    vat: { subtotal: 125e4, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: "3001234567800003", valid: true }
  },
  fraud: {
    invoiceNo: "INV-2026-0730",
    payer: "NEOM Logistics",
    co: "CO-88192",
    accrual: "AC-2026-4460",
    contract: "SANAD-CT-7715",
    currency: "SAR",
    // Invoice↔CO↔Accrual are internally consistent (3-way verification PASSES at Validation);
    // the anomaly signal is fee-vs-tariff, caught downstream by Anomaly & Fraud Detection.
    lines: [
      { no: 1, item: { zh: "\u91CD\u578B\u8F66\u8F86\u901A\u884C\u8BB8\u53EF\u8D39 (\u8F66\u6B21)", en: "Heavy-vehicle route permit fee (trip)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0635\u0631\u064A\u062D \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0631\u0643\u0628\u0627\u062A \u0627\u0644\u062B\u0642\u064A\u0644\u0629 (\u0631\u062D\u0644\u0629)" }, qty: 120, poQty: 120, grnQty: 120, invUnit: 3200, poUnit: 3200, benchUnit: 2320 },
      { no: 2, item: { zh: "\u71C3\u6CB9\u4E0E\u73AF\u4FDD\u9644\u52A0\u8D39", en: "Fuel & environmental levy", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0648\u0642\u0648\u062F \u0648\u0627\u0644\u0628\u064A\u0626\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 102e3, poUnit: 102e3, benchUnit: 98e3 }
    ],
    vat: { subtotal: 486e3, declared: 72900, expected: 72900, rate: 15 },
    taxId: { value: "3009988776600001", valid: true }
  },
  dup: {
    invoiceNo: "INV-2026-0728",
    payer: "Gulf Facility Mgmt",
    co: "CO-88231",
    accrual: "AC-2026-4471",
    contract: "SANAD-CT-2231",
    currency: "SAR",
    duplicateOf: "INV-2026-0731",
    lines: [
      { no: 1, item: { zh: "\u8BBE\u65BD\u8FD0\u8425\u8BB8\u53EF\u8D39 (\u6708)", en: "Facility operating license fee (month)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0631\u062E\u064A\u0635 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u0631\u0641\u0642 (\u0634\u0647\u0631)" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 125e4, poUnit: 125e4, benchUnit: 125e4 }
    ],
    vat: { subtotal: 125e4, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: "3001234567800003", valid: true }
  },
  taxfail: {
    invoiceNo: "INV-2026-0727",
    payer: "Aramco Logistics Supply",
    co: "CO-87990",
    accrual: "AC-2026-4402",
    contract: "SANAD-CT-2799",
    currency: "SAR",
    // Line 1 unit rate differs from the Collection Order → total variance +2.4%; VAT declared
    // ≠ ZATCA-expected; tax-ID fails ZATCA check-digit validation.
    lines: [
      { no: 1, item: { zh: "\u4ED3\u50A8\u5206\u533A\u8BB8\u53EF\u8D39 (\u6708)", en: "Warehouse zoning fee (month)", ar: "\u0631\u0633\u0648\u0645 \u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A (\u0634\u0647\u0631)" }, qty: 12, poQty: 12, grnQty: 12, invUnit: 18e4, poUnit: 173750, benchUnit: 172e3 },
      { no: 2, item: { zh: "\u8F66\u961F\u767B\u8BB0\u7EED\u671F\u8D39", en: "Fleet registration renewal fee", ar: "\u0631\u0633\u0648\u0645 \u062A\u062C\u062F\u064A\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0623\u0633\u0637\u0648\u0644" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 62e4, poUnit: 62e4, benchUnit: 61e4 },
      { no: 3, item: { zh: "\u88C5\u5378\u4E0E\u6E05\u5173\u5F81\u8D39", en: "Handling & customs levy", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0646\u0627\u0648\u0644\u0629 \u0648\u0627\u0644\u062A\u062E\u0644\u064A\u0635 \u0627\u0644\u062C\u0645\u0631\u0643\u064A" }, qty: 1, poQty: 1, grnQty: 1, invUnit: 4e5, poUnit: 4e5, benchUnit: 395e3 }
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
    { enforceNum: "EN-2607714", amanahEn: "Riyadh Amanah", amanah: "\u5229\u96C5\u5F97", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", amount: 355e3, defendant: { en: "Individual (investor)", zh: "\u4E2A\u4EBA\uFF08\u6295\u8D44\u8005\uFF09", ar: "\u0641\u0631\u062F (\u0645\u0633\u062A\u062B\u0645\u0631)" } },
    { enforceNum: "EN-2119843", amanahEn: "Eastern Province Amanah", amanah: "\u4E1C\u90E8\u7701", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", amount: 590500, defendant: { en: "Registered company", zh: "\u6CE8\u518C\u516C\u53F8", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } },
    { enforceNum: "EN-2884026", amanahEn: "Jeddah Amanah", amanah: "\u5409\u8FBE", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", amount: 875250, defendant: { en: "Registered company", zh: "\u6CE8\u518C\u516C\u53F8", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } },
    { enforceNum: "EN-2093317", amanahEn: "Tabuk Amanah", amanah: "\u5854\u5E03\u514B", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", amount: 412500, defendant: { en: "Registered company", zh: "\u6CE8\u518C\u516C\u53F8", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } },
    { enforceNum: "EN-2451982", amanahEn: "Makkah Amanah", amanah: "\u9EA6\u52A0", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629", amount: 268e3, defendant: { en: "Individual (investor)", zh: "\u4E2A\u4EBA\uFF08\u6295\u8D44\u8005\uFF09", ar: "\u0641\u0631\u062F (\u0645\u0633\u062A\u062B\u0645\u0631)" } },
    { enforceNum: "EN-2760541", amanahEn: "Al Madinah Amanah", amanah: "\u9EA6\u5730\u90A3", amanahAr: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", amount: 1245e3, defendant: { en: "Registered company", zh: "\u6CE8\u518C\u516C\u53F8", ar: "\u0634\u0631\u0643\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629" } }
  ]
};

// src/data/catalog.js
var ENTITIES = [
  { en: "Riyadh Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636", zh: "\u5229\u96C5\u5F97" },
  { en: "Jeddah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629", zh: "\u5409\u8FBE" },
  { en: "Eastern Province Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064A\u0629", zh: "\u4E1C\u90E8\u7701" },
  { en: "Makkah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0645\u0643\u0629 \u0627\u0644\u0645\u0643\u0631\u0645\u0629", zh: "\u9EA6\u52A0" },
  { en: "Al Madinah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0645\u0646\u0648\u0631\u0629", zh: "\u9EA6\u5730\u90A3" },
  { en: "Asir Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0639\u0633\u064A\u0631", zh: "\u963F\u897F\u5C14" },
  { en: "Taif Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0637\u0627\u0626\u0641", zh: "\u5854\u4F0A\u592B" },
  { en: "Al-Qassim Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0642\u0635\u064A\u0645", zh: "\u5361\u897F\u59C6" },
  { en: "Al-Ahsa Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0623\u062D\u0633\u0627\u0621", zh: "\u54C8\u8428" },
  { en: "Jazan Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062C\u0627\u0632\u0627\u0646", zh: "\u5409\u8D5E" },
  { en: "Tabuk Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062A\u0628\u0648\u0643", zh: "\u5854\u5E03\u514B" },
  { en: "Ha'il Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u062D\u0627\u0626\u0644", zh: "\u54C8\u4F0A\u52D2" },
  { en: "Northern Borders Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u062F\u0648\u062F \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629", zh: "\u5317\u90E8\u8FB9\u5883" },
  { en: "Najran Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0646\u062C\u0631\u0627\u0646", zh: "\u7EB3\u5B63\u5170" },
  { en: "Hafr Al-Batin Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u062D\u0641\u0631 \u0627\u0644\u0628\u0627\u0637\u0646", zh: "\u54C8\u8D39\u5C14\u5DF4\u5EF7" },
  { en: "Al Bahah Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0628\u0627\u062D\u0629", zh: "\u5DF4\u54C8" },
  { en: "Al Jawf Amanah", ar: "\u0623\u0645\u0627\u0646\u0629 \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062C\u0648\u0641", zh: "\u7126\u592B" },
  { en: "Housing Sector", ar: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646", zh: "\u4F4F\u623F\u90E8\u95E8" },
  { en: "Unassigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0627\u0644\u0623\u0645\u0627\u0646\u0629 (\u0644\u0645 \u062A\u064F\u0637\u0627\u0628\u0642 \u0641\u064A \u0645\u0643\u064A\u0646)", zh: "\u672A\u5206\u914D" }
];
var N_AMANAH = 17;
var ENT_HOUSING = 17;
var ENT_UNASSIGNED = 18;
var ENTITY_INDEX = Object.fromEntries(ENTITIES.map((e, i) => [e.en, i]));
var AMANAH_CATALOG = ENTITIES.slice(0, N_AMANAH);
var MUNI_DIRS = [{ en: "North", ar: "\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629" }, { en: "Central", ar: "\u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629" }, { en: "South", ar: "\u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629" }];
var shortAr = (s) => s.replace(/^أمانة\s*(منطقة|محافظة)?\s*/, "");
var shortEn = (s) => s.replace(/ Amanah$/, "");
function municipalityOf(ent, muni) {
  const e = ENTITIES[ent];
  if (!e) return null;
  if (ent === ENT_HOUSING) return muni === 0 ? { key: `${e.en}|Sales`, en: "Housing sales unit", ar: "\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629" } : null;
  if (ent === ENT_UNASSIGNED || muni == null || muni > 2) return null;
  const d = MUNI_DIRS[muni];
  return { key: `${e.en}|${d.en}`, en: `${shortEn(e.en)} ${d.en} Municipality`, ar: `\u0628\u0644\u062F\u064A\u0629 ${shortAr(e.ar)} ${d.ar}` };
}
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
  { key: "housing_fees", source: "housing_sales", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", en: "Sales fees" }
];
var ITEM_INDEX = Object.fromEntries(ITEMS.map((x, i) => [x.key, i]));
var REVENUE_ITEMS = ITEMS.reduce((m, it) => {
  (m[it.source] = m[it.source] || []).push(it);
  return m;
}, {});
var RULE_IDS = ["DUP-1", "CR-1", "DEC-1", "NOC-1", "INC-1", "EXE-1", "EFA-1", "OBJ-1", "ENF-1"];
var RULE_BIT = Object.fromEntries(RULE_IDS.map((id, i) => [id, 1 << i]));
var CR_STATUS = [null, "Active", "Deleted", "Suspended", "Cancelled"];
var EFAA_STATUS = [null, "\u0645\u0633\u062F\u062F\u0629", "\u0642\u0627\u0626\u0645\u0629", "\u062A\u062D\u062A \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629", "\u0645\u0646\u0641\u0630 \u0636\u062F\u0647"];
var CSTAT = ["not_applicable", "linked", "unmatched", "confirmed_none", "unlinked", "unverified"];
var CHANNELS = ["sadad", "voluntary", "enforcement", "transfer", "card", "wallet"];
var CH_WALLET = 5;
var ALINK = ["internal_report", "makeen_matched", "makeen_unmatched"];
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

// src/data/revenueLedger.js
var DATA_CUTOFF = DEMO_TODAY;
var REVENUE_SOURCES = {
  investment: { gfs: "1421901", en: "Investment (Furas)", ar: "\u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631 (\u0641\u0631\u0635)", zh: "\u6295\u8D44\u6536\u5165", platform: "Foras" },
  fines: { gfs: "1438001", en: "Fines & penalties", ar: "\u0627\u0644\u063A\u0631\u0627\u0645\u0627\u062A \u0648\u0627\u0644\u062C\u0632\u0627\u0621\u0627\u062A", zh: "\u7F5A\u6B3E\u4E0E\u5904\u7F5A", platform: "Mumathil" },
  municipal_fees: { gfs: "142113", en: "Municipal fees", ar: "\u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", zh: "\u5E02\u653F\u6536\u8D39", platform: "Baladi" },
  licenses: { gfs: "142162", en: "Licence fees", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0631\u0627\u062E\u064A\u0635", zh: "\u8BB8\u53EF\u8D39", platform: "Amanah Internal Reports" },
  accommodation: { gfs: "11442", en: "Accommodation facilities", ar: "\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0625\u064A\u0648\u0627\u0621", zh: "\u4F4F\u5BBF\u8BBE\u65BD", platform: "Baladi" },
  tobacco: { gfs: "1422110", en: "Tobacco service fee", ar: "\u0631\u0633\u0645 \u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u062A\u0628\u063A", zh: "\u70DF\u8349\u670D\u52A1\u8D39", platform: "Baladi" },
  white_lands: { gfs: "1422111", en: "White-land fees", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", zh: "\u7A7A\u5730\u8D39", platform: "Baladi" },
  housing_sales: { gfs: "1422112", en: "Housing sector sales", ar: "\u0645\u0628\u064A\u0639\u0627\u062A \u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u0633\u0643\u0627\u0646", zh: "\u4F4F\u623F\u9500\u552E", platform: "Baladi" }
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
var REVIEWER = { en: "Revenue data steward (demo reviewer)", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A (\u0645\u0631\u0627\u062C\u0639 \u062A\u062C\u0631\u064A\u0628\u064A)" };
var OVERLAY = {
  // Partial payment, short payment terms -> due before the data cutoff.
  "INV-2026-0724": { dueDate: "2026-07-30", payments: [{ date: "2026-07-29", amount: 4e5, channel: "voluntary" }] },
  // Small partial receipt on an overdue invoice.
  "INV-2026-0650": { payments: [{ date: "2026-07-27", amount: 15e4, channel: "voluntary" }] },
  // Approved credit note reduces the billed amount.
  "INV-2026-0520": { adjustments: [{ date: "2026-02-10", amount: -5e4, kind: "credit_note", reason: { en: "Approved credit note (area re-measurement)", ar: "\u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 \u0645\u0639\u062A\u0645\u062F (\u0625\u0639\u0627\u062F\u0629 \u0642\u064A\u0627\u0633 \u0627\u0644\u0645\u0633\u0627\u062D\u0629)" } }] },
  // Missing mandatory debtor identifier: invoice cannot be referred as-is.
  "INV-2026-0802": { missing: ["debtor_id_number"] },
  // Exclusion records (explicit, with evidence and review state).
  "INV-2026-0728": { exclusion: { category: "duplicate", ruleId: "DUP-1", evidence: { en: "Line items identical to INV-2026-0731 (duplicate detection); same contract reference CO-88231.", ar: "\u0628\u0646\u0648\u062F \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 INV-2026-0731 (\u0643\u0634\u0641 \u0627\u0644\u062A\u0643\u0631\u0627\u0631)\u061B \u0646\u0641\u0633 \u0645\u0631\u062C\u0639 \u0627\u0644\u0639\u0642\u062F CO-88231." }, reviewStatus: "approved", reviewDate: "2026-07-28" } },
  "INV-2025-0940": { exclusion: { category: "duplicate", ruleId: "DUP-1", evidence: { en: "Re-submission of an invoice already registered under the same contract reference.", ar: "\u0625\u0639\u0627\u062F\u0629 \u062A\u0642\u062F\u064A\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0633\u062C\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0646\u0641\u0633 \u0645\u0631\u062C\u0639 \u0627\u0644\u0639\u0642\u062F." }, reviewStatus: "approved", reviewDate: "2025-12-04" } },
  "INV-2026-0808": { exclusion: { category: "duplicate", ruleId: "DUP-1", evidence: { en: "Same payer, amount and period as an earlier Jazan invoice.", ar: "\u0646\u0641\u0633 \u0627\u0644\u062F\u0627\u0641\u0639 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u0641\u062A\u0631\u0629 \u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0633\u0627\u0628\u0642\u0629 \u0641\u064A \u062C\u0627\u0632\u0627\u0646." }, reviewStatus: "approved", reviewDate: "2026-04-20" } },
  "INV-2026-0545": { exclusion: { category: "struck_off_registry", ruleId: "CR-1", evidence: { en: "Commercial registration reported struck-off by the commerce registry check.", ar: "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0645\u0634\u0637\u0648\u0628 \u0648\u0641\u0642 \u0641\u062D\u0635 \u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u0629." }, reviewStatus: "approved", reviewDate: "2026-03-10" } },
  // Candidate exclusion that is NOT yet approved -> stays in net billed.
  "INV-2026-0804": { exclusion: { category: "deceased_debtor", ruleId: "DEC-1", evidence: { en: "Civil-registry flag suggests the debtor is deceased; heir/estate position not established.", ar: "\u0625\u0634\u0627\u0631\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u062F\u0646\u064A \u062A\u0641\u064A\u062F \u0628\u0648\u0641\u0627\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u061B \u0648\u0636\u0639 \u0627\u0644\u0648\u0631\u062B\u0629/\u0627\u0644\u062A\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u062B\u0628\u062A." }, reviewStatus: "pending", reviewDate: null } }
};
var CONFIRMED_SEED = [
  { enforceNum: "EN-2301188", system: "sanad", amanahEn: "Jeddah Amanah", amount: 687500, openedDate: "2026-05-28", links: [{ invoiceId: "INV-2026-0722", allocated: 687500, status: "confirmed", evidence: ["reference_match"], reviewedBy: "Revenue data steward (demo reviewer)", reviewedAt: "2026-06-30" }] },
  { enforceNum: "EN-2188420", system: "sanad", amanahEn: "Riyadh Amanah", amount: 1363500, openedDate: "2026-04-30", links: [{ invoiceId: "INV-2026-0635", allocated: 1363500, status: "confirmed", evidence: ["reference_match"], reviewedBy: "Revenue data steward (demo reviewer)", reviewedAt: "2026-06-12" }] },
  { enforceNum: "EN-2455512", system: "sanad", amanahEn: "Al-Qassim Amanah", amount: 356500, openedDate: "2026-07-02", links: [{ invoiceId: "INV-2026-0806", allocated: 356500, status: "confirmed", evidence: ["reference_match", "amount_exact"], reviewedBy: "Revenue data steward (demo reviewer)", reviewedAt: "2026-07-09" }] }
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
      entity: inv2.entity,
      entityEn: inv2.entityEn,
      entityAr: inv2.entityAr,
      amanah: inv2.amanah,
      amanahEn: inv2.amanahEn,
      amanahAr: inv2.amanahAr,
      municipalityEn: inv2.municipalityEn,
      municipalityAr: inv2.municipalityAr,
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
      objection: inv2.hasOpenObjection ? { open: true, ref: `OBJ-${inv2.id.slice(-4)}`, system: "momtathil" } : null,
      enforcementLinks: linkByInvoice.get(inv2.id) || [],
      contract: contractLinkOf(inv2),
      exclusion: ex,
      exclusions: ex ? [ex] : [],
      cancelled: null,
      subscriptionNo: textId("", inv2.id + "7", 10),
      sadadNo: textId("1", inv2.id + "33", 13),
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
var IMPORT_VERSIONS = { tahseel_central: 6, tahseel_internal: 4, incorta_items: 2, makeen: 5, furas: 4, sanad: 3, efaa_v2: 7, sadad: 9, tobacco: 3, accommodation: 3, white_lands: 5, balady: 4, violations: 7, white_lands_enforcement: 2 };
var GFS_BY_SOURCE = { investment: "1421901", fines: "1438001", municipal_fees: "142113", licenses: "142162", accommodation: "11442", tobacco: "1422110", white_lands: "1422111", housing_sales: "1422112" };
var SOURCE_PROFILE = {
  tobacco: {
    label: BI("\u0627\u0644\u062A\u0628\u063A", "Tobacco"),
    files: ["Tobacco_Schema.xlsx"],
    sheets: ["INVOICES", "DISCLOSURES", "SCHEDULES", "FACILITIES"],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 (INVOICES) \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0625\u0641\u0635\u0627\u062D \u0634\u0647\u0631\u064A (DISCLOSURES) \u0648\u062C\u062F\u0648\u0644\u0629 (SCHEDULES) \u0648\u0645\u0646\u0634\u0623\u0629 (FACILITIES)", "Invoice linked to a monthly disclosure, a schedule and a facility"),
    keys: ["INVOICE_KEY", "DISCLOSURE_KEY", "FACILITY_KEY", "SADAD_NO"],
    supplier: BI("\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u062A\u0628\u063A (\u062C\u062F\u0627\u0648\u0644 TB_*) \u0639\u0628\u0631 \u0625\u0646\u0643\u0648\u0631\u062A\u0627\u060C \u062B\u0645 \u062A\u062D\u0635\u064A\u0644 \u0644\u0644\u062D\u0627\u0644\u0629 \u0648\u0627\u0644\u0633\u062F\u0627\u062F", "Tobacco disclosure platform (TB_* tables) via Incorta, then Tahseel for status and collection")
  },
  accommodation: {
    label: BI("\u0627\u0644\u0625\u064A\u0648\u0627\u0621", "Accommodation"),
    files: ["ACCOMMODATION_Schema.xlsx (\u063A\u064A\u0631 \u0645\u0631\u0641\u0642 \u0644\u0643\u0646\u0647 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u062C\u0644\u062F)"],
    sheets: ["Invoices", "Disclosures", "Schedules", "Facilities"],
    level: BI("\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0625\u0641\u0635\u0627\u062D \u0625\u0634\u063A\u0627\u0644 (\u0623\u064A\u0627\u0645 \xD7 \u0633\u0639\u0631 \u064A\u0648\u0645\u064A) \u0648\u062C\u062F\u0648\u0644\u0629 \u0648\u0645\u0646\u0634\u0623\u0629", "Invoice linked to an occupancy disclosure (days x daily price), a schedule and a facility"),
    keys: ["INVOICE_KEY", "DISCLOSURE_KEY", "FACILITY_KEY", "SADAD_NO"],
    supplier: BI("\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0625\u064A\u0648\u0627\u0621 \u0639\u0628\u0631 \u0625\u0646\u0643\u0648\u0631\u062A\u0627\u060C \u062B\u0645 \u062A\u062D\u0635\u064A\u0644", "Accommodation disclosure platform via Incorta, then Tahseel")
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
    supplier: BI("\u0625\u064A\u0641\u0627\u0621 / \u0645\u0645\u062A\u062B\u0644 (\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0639\u0628\u0631 \u0625\u0646\u0643\u0648\u0631\u062A\u0627)", "Efaa / Mumathil (violations report via Incorta)")
  },
  municipal_fees: {
    label: BI("\u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipal fees"),
    files: ["Revenues_Schema.xlsx (ENT_REVENUES)"],
    sheets: ["ENT_REVENUES"],
    level: BI("\u0628\u0646\u062F \u0641\u0627\u062A\u0648\u0631\u0629 (DETAIL_ID) \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0643\u0631\u0631 \u0639\u0644\u0649 \u0643\u0644 \u0628\u0646\u062F", "Invoice line (DETAIL_ID); the invoice total is repeated on every line"),
    keys: ["ACCOUNT_NO", "REVENUE_KEY", "REQUEST_ID"],
    supplier: BI("\u0625\u0646\u0643\u0648\u0631\u062A\u0627 - \u0637\u0628\u0642\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0648\u062D\u062F\u0629", "Incorta consolidated revenue layer")
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
    const q2 = r / nr;
    [t, nt] = [nt, t - q2 * nt];
    [r, nr] = [nr, r - q2 * nr];
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
var invoiceIdOf = (idKey) => `INV-${Math.floor(idKey / 1e8)}-${String(idKey % 1e8).padStart(7, "0")}`;
function parseInvoiceId(s) {
  const m = /^INV-(\d{4})-(\d{7})$/.exec(String(s || "").trim());
  return m ? Number(m[1]) * 1e8 + Number(m[2]) : null;
}
var sadadOf = (idKey) => String((BigInt(keyOf(idKey)) * A12 + B12) % M12).padStart(12, "0");
var subscriptionOf = (idKey) => String((BigInt(keyOf(idKey)) * A10 + B10) % M10).padStart(10, "0");
var violationOf = (idKey) => String((BigInt(keyOf(idKey)) * A14 + B14) % M14).padStart(14, "0");
function decode(num, I, B, M2) {
  if (!/^\d+$/.test(num)) return null;
  const x = Number(((BigInt(num) - B) % M2 + M2) % M2 * I % M2);
  return x < 3e8 ? idKeyOf(x) : null;
}
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
  const M2 = 10n ** BigInt(width);
  const Ainv = inv(BigInt(A), M2);
  const Bn = BigInt(B) % M2;
  return {
    of: (idKey) => `${prefix}${String((BigInt(keyOf(idKey)) * BigInt(A) + Bn) % M2).padStart(width, "0")}`,
    num: (idKey) => String((BigInt(keyOf(idKey)) * BigInt(A) + Bn) % M2).padStart(width, "0"),
    decode: (s) => {
      const t = String(s || "").trim().toUpperCase();
      if (!t.startsWith(prefix)) return null;
      const d = t.slice(prefix.length);
      if (!/^\d+$/.test(d) || d.length !== width) return null;
      const x = Number(((BigInt(d) - Bn) % M2 + M2) % M2 * Ainv % M2);
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
  alink: Uint8Array,
  payer: Uint16Array,
  owner: Uint16Array
};
var PCOLS = { pInv: Int32Array, pDay: Int32Array, pAmt: Float64Array, pCh: Uint8Array };
var Store = class {
  constructor(cap = 1 << 16) {
    this.n = 0;
    this.cap = cap;
    this.pn = 0;
    this.pcap = cap;
    for (const [k, T] of Object.entries(COLS)) this[k] = new T(cap);
    for (const [k, T] of Object.entries(PCOLS)) this[k] = new T(cap);
    this.nGen = 0;
    this.fixtures = /* @__PURE__ */ new Map();
    this.fixtureById = /* @__PURE__ */ new Map();
    this.contracts = [];
    this.requests = [];
    this.crView = /* @__PURE__ */ new Map();
    this.meta = {};
  }
  grow() {
    const nc = this.cap * 2;
    for (const [k, T] of Object.entries(COLS)) {
      const a = new T(nc);
      a.set(this[k]);
      this[k] = a;
    }
    this.cap = nc;
  }
  growPay() {
    const nc = this.pcap * 2;
    for (const [k, T] of Object.entries(PCOLS)) {
      const a = new T(nc);
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
    for (const [k, T] of Object.entries(COLS)) {
      const a = new T(nc);
      a.set(this[k].subarray(0, this.n));
      this[k] = a;
    }
    this.cap = nc;
    const pc = this.pn + extraPay;
    for (const [k, T] of Object.entries(PCOLS)) {
      const a = new T(pc);
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
    st.alink[i] = o.alink ?? (o.scope === 1 ? 0 : 1);
    st.payer[i] = o.payer;
    st.owner[i] = 0;
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
  const licItems = ["commercial_license", "commercial_license", "signboard_license", "building_permit", "health_certificate"].map((k) => ITEM_INDEX[k]);
  const finesItems = ["building_violations", "signage_violations", "health_violations"].map((k) => ITEM_INDEX[k]);
  const linesFor = (r) => {
    const x = r.next();
    return x < 0.77 ? 1 : x < 0.89 ? 2 : x < 0.95 ? 3 : 4 + r.int(3);
  };
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
    const ct = { future: start > todayN, idx: c, contractNo: `CT-${startY}-${pad(c * 7 + 13, 4)}`, ent, muni, payer, item, start, end, intervalMonths: mixMonths, anchor, dueDay, annual: Math.round(annual), crNo: `10${pad(Math.floor(mix(7, c) / 43), 8).slice(-8)}`, crSt, status, dues: [], invs: [], totalValue: 0 };
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
          if (dueN - 10 >= startN - 10 && dueN <= horizonN) {
            const d = { no, due: dueN, amount, inv: -1 };
            ct.dues.push(d);
            const issueN = dueN - 10;
            if (issueN >= startN && issueN <= todayN + 40) {
              const ym = isoOf(issueN).slice(0, 7);
              if (!instByMonth.has(ym)) instByMonth.set(ym, []);
              instByMonth.get(ym).push([c, ct.dues.length - 1]);
            }
          }
        }
      }
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (dayNum(`${y}-${pad(m, 2)}-01`) > horizonN) break;
    }
    if (ct.dues.length) {
      let rem = ct.totalValue;
      for (const d of ct.dues) {
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
          const makeenMiss = !internal && ri.next() < 0.04;
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
            payer: payerIdx,
            alink: internal ? 0 : makeenMiss ? 2 : 1
          });
          if (makeenMiss) st.ent[st.n - 1] = ENT_UNASSIGNED;
          if (replaced && replIssue <= todayN) {
            const g2 = Math.max(100, Math.round(gross * (0.9 + 0.2 * rr.next()) / 10) * 10);
            const due2 = replIssue + cfg.due;
            const pl2 = planPayment(rr, due2, g2, payProb, lagM).map((p) => ({ ...p }));
            writeInvoice({
              idKey: y * 1e8 + replSerial,
              issue: replIssue,
              due: due2,
              gross: g2,
              ent: makeenMiss ? ENT_UNASSIGNED : e,
              muni: muniIdx,
              scope: 0,
              src: SOURCE_INDEX[srcFinal],
              item: itemIdx,
              lines: 1,
              pay: pl2,
              flags: withGrp(GRP.TB_REPLACEMENT),
              efaa: 0,
              payer: payerIdx,
              alink: makeenMiss ? 2 : 1
            });
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
        const owners = roll < A.ownerSplit[0] ? 1 : roll < A.ownerSplit[0] + A.ownerSplit[1] ? 2 : 3;
        let shares = [];
        let sh = 0;
        for (let j = 0; j < owners; j += 1) {
          const x = owners === 1 ? 1 : 0.6 + rd.next();
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
        for (let j = 0; j < owners; j += 1) {
          const serial = nextSerial(y);
          if (issueN > todayN) continue;
          const ri = rI.reset(mix(3, y * 12 + mo, 9 * 32 + ENT_HOUSING, k * 4 + j));
          const gross = Math.max(1e3, Math.round(deedFee * shares[j] / 10) * 10);
          const pl = planWhiteLand(ri, issueN, dueN, gross).map((p) => ({ ...p }));
          const never = pl.length === 0;
          const objection = never && ri.next() < A.objectionShare / 0.72;
          const cancelDay = never && !objection && ri.next() < 0.06 ? issueN + 20 + ri.int(120) : 0;
          const grp = owners === 1 ? 0 : j === 0 ? owners === 2 ? GRP.WL_HEAD2 : GRP.WL_HEAD3 : j === 1 ? GRP.WL_OWN2 : GRP.WL_OWN3;
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
            payer: WL_PAYER_BASE + ri.int(3e4),
            alink: 1
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
        writeInvoice({ idKey: y * 1e8 + serial, issue: issueN, due: dueN, gross, ent: ENT_HOUSING, muni: 0, scope: 0, src: SOURCE_INDEX.housing_sales, item: ri.next() < 0.7 ? ITEM_INDEX.housing_sales : ITEM_INDEX.housing_fees, lines: 1, pay: pl, cancelDay, payer: HOUSING_PAYER_BASE + ri.int(2e4), alink: 1 });
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
        payer: ct.payer,
        alink: ri.next() < 0.04 ? 2 : 1
      });
      if (st.alink[i] === 2) st.ent[i] = ENT_UNASSIGNED;
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
  st.nGen = st.n;
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
        if (used.has(j) || out.includes(j) || st.ent[j] !== st.ent[lead]) continue;
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
      const amount = all.reduce((sum, i) => sum + st.gross[i], 0);
      const idOfi = (i) => invoiceIdOf(st.idKey[i]);
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
  }
  for (const w of wlEnforce) {
    if (w.opened > todayN) continue;
    const roll = mix(14, st.idKey[w.i] % 1000003) / 4294967296;
    const req = { idx: reqCount, enforceNum: `WLX-${String(st.idKey[w.i] % 1e8).padStart(7, "0")}`, system: "white_lands", ent: ENT_HOUSING, amount: st.gross[w.i], openedDay: w.opened, contractIdx: -1, contractNo: null, status: roll < 0.55 ? "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" : roll < 0.8 ? "\u0645\u0648\u0642\u0648\u0641" : "\u0645\u063A\u0644\u0642", identified: [w.i], crNo: null, method: 0, confidence: 1, debtor: st.payer[w.i] };
    st.requests.push(req);
    st.exec[w.i] = req.idx;
    reqCount += 1;
  }
  st.trim();
  st.meta = { today, scale, generatedFrom: GEN_START, seed: SEED, ms: Date.now() - t0, contracts: contracts.filter(Boolean).length, requests: reqCount };
  worldCache.set(key, st);
  if (worldCache.size > 3) worldCache.delete(worldCache.keys().next().value);
  return st;
}

// server/fixtures.js
function appendRecord(st, rec, { owner = 0, kind = "fixture" } = {}) {
  const i = st.addInvoice();
  const e = ENTITY_INDEX[rec.amanahEn] ?? ENT_UNASSIGNED;
  st.idKey[i] = 0;
  st.issue[i] = dayNum(rec.issueDate);
  st.due[i] = dayNum(rec.dueDate);
  st.gross[i] = rec.grossAmount;
  const adj = (rec.adjustments || [])[0];
  st.adjAmt[i] = adj ? adj.amount : 0;
  st.adjDay[i] = adj ? dayNum(adj.date) : 0;
  st.ent[i] = e;
  st.muni[i] = 255;
  st.scope[i] = rec.scopeType === "internal" ? 1 : 0;
  st.src[i] = SOURCE_INDEX[rec.revenueSource] ?? SOURCE_INDEX.municipal_fees;
  st.item[i] = rec.revenueItem?.key && ITEM_INDEX[rec.revenueItem.key] !== void 0 ? ITEM_INDEX[rec.revenueItem.key] : 0;
  st.lines[i] = Math.max(1, (rec.lineItems || []).length);
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
  if (rec.objection?.open) flags |= F.OBJECTION;
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
  st.alink[i] = rec.amanahLinkage === "makeen_unmatched" ? 2 : rec.scopeType === "internal" ? 0 : 1;
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

// src/data/revenueMetrics.js
function ratio(num, den) {
  const ok = Number.isFinite(num) && Number.isFinite(den) && den > 0;
  return { calculable: ok, value: ok ? num / den : null, num, den };
}
function ppChange(curr, prev) {
  if (!curr?.calculable || !prev?.calculable) return { calculable: false, value: null };
  return { calculable: true, value: Math.round((curr.value - prev.value) * 1e3) / 10 };
}
var EXCLUSION_RULE_SET_VERSION = "EXCL-RULES v2 (demo configuration)";
var EXCLUSION_RULES = [
  {
    id: "DUP-1",
    category: "duplicate",
    version: 1,
    priority: 1,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-07-01",
    owner: { en: "Revenue data steward", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A" },
    label: { en: "Duplicate / erroneous invoice", ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0643\u0631\u0631\u0629 / \u062E\u0627\u0637\u0626\u0629" },
    note: { en: "Amanah exclusion lists cite invoices with errors; duplicate detection is in HLSD V0.4 scope. Formal approval authority unresolved.", ar: "\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F \u0645\u0646 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u062A\u0630\u0643\u0631 \u0641\u0648\u0627\u062A\u064A\u0631 \u0628\u0647\u0627 \u0623\u062E\u0637\u0627\u0621\u061B \u0643\u0634\u0641 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0636\u0645\u0646 \u0646\u0637\u0627\u0642 \u0648\u062B\u064A\u0642\u0629 \u0627\u0644\u062A\u0635\u0645\u064A\u0645. \u062C\u0647\u0629 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0631\u0633\u0645\u064A\u0629 \u063A\u064A\u0631 \u0645\u062D\u0633\u0648\u0645\u0629." }
  },
  {
    id: "CR-1",
    category: "struck_off_registry",
    version: 1,
    priority: 2,
    defaultEnabled: true,
    locked: false,
    basis: "stated_in_meeting",
    approval: "approved",
    effectiveFrom: "2026-07-01",
    owner: { en: "Revenue data steward", ar: "\u0623\u0645\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A" },
    label: { en: "Struck-off commercial registration", ar: "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A \u0645\u0634\u0637\u0648\u0628" },
    note: { en: "Meeting: all invoices of a struck-off registration are ready for exclusion without judgement. The raw CR status is kept as-is; only statuses listed in the rule parameter qualify, and only after human review.", ar: "\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639: \u062C\u0645\u064A\u0639 \u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0627\u0644\u0645\u0634\u0637\u0648\u0628 \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u0627\u0633\u062A\u0628\u0639\u0627\u062F \u062F\u0648\u0646 \u062A\u0642\u062F\u064A\u0631. \u062A\u064F\u062D\u0641\u0638 \u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062E\u0627\u0645 \u0643\u0645\u0627 \u0647\u064A\u061B \u0648\u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0645\u062F\u0631\u062C\u0629 \u0641\u064A \u0645\u0639\u0627\u0645\u0644 \u0627\u0644\u0642\u0627\u0639\u062F\u0629 \u0641\u0642\u0637 \u0647\u064A \u0627\u0644\u0645\u0624\u0647\u0644\u0629\u060C \u0648\u0628\u0639\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0628\u0634\u0631\u064A\u0629." }
  },
  {
    id: "DEC-1",
    category: "deceased_debtor",
    version: 1,
    priority: 3,
    defaultEnabled: true,
    locked: false,
    basis: "proposed",
    approval: "unapproved",
    effectiveFrom: null,
    owner: { en: "Not assigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F" },
    label: { en: "Deceased debtor (evidence required)", ar: "\u0645\u062F\u064A\u0646 \u0645\u062A\u0648\u0641\u0649 (\u064A\u062A\u0637\u0644\u0628 \u062F\u0644\u064A\u0644\u0627\u064B)" },
    note: { en: "Proposed category; requires human review of evidence before it affects net billed.", ar: "\u0641\u0626\u0629 \u0645\u0642\u062A\u0631\u062D\u0629\u061B \u062A\u062A\u0637\u0644\u0628 \u0645\u0631\u0627\u062C\u0639\u0629 \u0628\u0634\u0631\u064A\u0629 \u0644\u0644\u062F\u0644\u064A\u0644 \u0642\u0628\u0644 \u0623\u0646 \u062A\u0624\u062B\u0631 \u0639\u0644\u0649 \u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0641\u0648\u062A\u0631." }
  },
  {
    id: "NOC-1",
    category: "no_contract",
    version: 1,
    priority: 4,
    defaultEnabled: true,
    locked: false,
    basis: "proposed",
    approval: "unapproved",
    effectiveFrom: null,
    owner: { en: "Not assigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F" },
    label: { en: "Investment invoice with no contract (confirmed by Furas)", ar: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0628\u0644\u0627 \u0639\u0642\u062F (\u0645\u0624\u0643\u062F \u0645\u0646 \u0641\u0631\u0635)" },
    note: { en: "Applies only when Furas confirms no contract exists. An UNMATCHED contract (not found) is never excluded \u2014 it stays in net billed and is flagged.", ar: "\u062A\u0646\u0637\u0628\u0642 \u0641\u0642\u0637 \u0639\u0646\u062F \u062A\u0623\u0643\u064A\u062F \u0641\u0631\u0635 \u0639\u062F\u0645 \u0648\u062C\u0648\u062F \u0639\u0642\u062F. \u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0627\u0644\u0645\u0637\u0627\u0628\u0642 (\u0644\u0645 \u064A\u064F\u0639\u062B\u0631 \u0639\u0644\u064A\u0647) \u0644\u0627 \u064A\u064F\u0633\u062A\u0628\u0639\u062F \u0623\u0628\u062F\u0627\u064B \u2014 \u064A\u0628\u0642\u0649 \u0641\u064A \u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0641\u0648\u062A\u0631 \u0648\u064A\u064F\u0639\u0644\u064E\u0651\u0645." }
  },
  {
    id: "INC-1",
    category: "incomplete_data",
    version: 1,
    priority: 5,
    defaultEnabled: true,
    locked: false,
    basis: "proposed",
    approval: "unapproved",
    effectiveFrom: null,
    owner: { en: "Not assigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F" },
    label: { en: "Incomplete data (Efaa incomplete-violations report)", ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u062A\u0642\u0631\u064A\u0631 \u0625\u064A\u0641\u0627\u0621 \u0644\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629)" },
    note: { en: "Candidate rule from the Efaa incomplete report. Not confirmed by the business; configurable.", ar: "\u0642\u0627\u0639\u062F\u0629 \u0645\u0631\u0634\u062D\u0629 \u0645\u0646 \u062A\u0642\u0631\u064A\u0631 \u0625\u064A\u0641\u0627\u0621 \u063A\u064A\u0631 \u0627\u0644\u0645\u0643\u062A\u0645\u0644. \u063A\u064A\u0631 \u0645\u0624\u0643\u062F\u0629 \u0645\u0646 \u0627\u0644\u062C\u0647\u0629\u061B \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0636\u0628\u0637." }
  },
  {
    id: "EXE-1",
    category: "executed_against",
    version: 1,
    priority: 6,
    defaultEnabled: true,
    locked: false,
    basis: "proposed",
    approval: "unapproved",
    effectiveFrom: null,
    owner: { en: "Not assigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F" },
    label: { en: "Executed-against list (Efaa)", ar: "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647 (\u0625\u064A\u0641\u0627\u0621)" },
    note: { en: "Candidate rule. Being executed against does not mean the amount ended; treated as a configurable, unapproved exclusion.", ar: "\u0642\u0627\u0639\u062F\u0629 \u0645\u0631\u0634\u062D\u0629. \u0643\u0648\u0646 \u0627\u0644\u0645\u062F\u064A\u0646 \u0645\u0646\u0641\u0630\u0627\u064B \u0636\u062F\u0647 \u0644\u0627 \u064A\u0639\u0646\u064A \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0645\u0628\u0644\u063A\u061B \u062A\u064F\u0639\u0627\u0645\u0644 \u0643\u0627\u0633\u062A\u0628\u0639\u0627\u062F \u0642\u0627\u0628\u0644 \u0644\u0644\u0636\u0628\u0637 \u0648\u063A\u064A\u0631 \u0645\u0639\u062A\u0645\u062F." }
  },
  {
    id: "EFA-1",
    category: "outside_efaa",
    version: 1,
    priority: 7,
    defaultEnabled: true,
    locked: false,
    basis: "proposed",
    approval: "unapproved",
    effectiveFrom: null,
    owner: { en: "Not assigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F" },
    label: { en: "Violation not present in Efaa (system of record)", ar: "\u0645\u062E\u0627\u0644\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0625\u064A\u0641\u0627\u0621 (\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0631\u062C\u0639\u064A)" },
    note: { en: "Candidate rule. Tahseel and Efaa statuses are kept separate; a missing Efaa match is evidence for review, not proof.", ar: "\u0642\u0627\u0639\u062F\u0629 \u0645\u0631\u0634\u062D\u0629. \u062A\u064F\u062D\u0641\u0638 \u062D\u0627\u0644\u062A\u0627 \u062A\u062D\u0635\u064A\u0644 \u0648\u0625\u064A\u0641\u0627\u0621 \u0645\u0646\u0641\u0635\u0644\u062A\u064A\u0646\u061B \u063A\u064A\u0627\u0628 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0641\u064A \u0625\u064A\u0641\u0627\u0621 \u062F\u0644\u064A\u0644 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0644\u064A\u0633 \u0625\u062B\u0628\u0627\u062A\u0627\u064B." }
  },
  {
    id: "OBJ-1",
    category: "objection",
    version: 1,
    priority: 8,
    defaultEnabled: false,
    locked: false,
    basis: "unresolved",
    approval: "unapproved",
    effectiveFrom: null,
    owner: { en: "Not assigned", ar: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F" },
    label: { en: "Open objection / appeal", ar: "\u0627\u0639\u062A\u0631\u0627\u0636 / \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0645\u0641\u062A\u0648\u062D" },
    note: { en: "Not confirmed in the latest meeting. Default OFF: an objection is a follow-up state, not an exclusion. Configurable.", ar: "\u063A\u064A\u0631 \u0645\u0624\u0643\u062F \u0641\u064A \u0622\u062E\u0631 \u0627\u062C\u062A\u0645\u0627\u0639. \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A: \u0645\u0639\u0637\u0651\u0644\u061B \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636 \u062D\u0627\u0644\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0644\u064A\u0633 \u0627\u0633\u062A\u0628\u0639\u0627\u062F\u0627\u064B. \u0642\u0627\u0628\u0644 \u0644\u0644\u0636\u0628\u0637." }
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
    note: { en: 'Meeting correction: enforcement-referred invoices (often shown "cancelled" in the source) are counted UNCOLLECTED, not excluded. Locked off.', ar: '\u062A\u0635\u062D\u064A\u062D \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639: \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u062D\u0627\u0644\u0629 \u0644\u0644\u062A\u0646\u0641\u064A\u0630 (\u0648\u062A\u0638\u0647\u0631 \u063A\u0627\u0644\u0628\u0627\u064B "\u0645\u0644\u063A\u0627\u0629" \u0641\u064A \u0627\u0644\u0645\u0635\u062F\u0631) \u062A\u064F\u062D\u062A\u0633\u0628 \u063A\u064A\u0631 \u0645\u062D\u0635\u0651\u0644\u0629 \u0648\u0644\u064A\u0633\u062A \u0645\u0633\u062A\u0628\u0639\u062F\u0629. \u0645\u063A\u0644\u0642\u0629.' }
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
var DEFAULT_TARGETS = {
  fiscalYear: Number(DATA_CUTOFF.slice(0, 4)),
  collectionRate: { value: 0.6, status: "demo", provenance: { en: "Illustrative demo input \u2014 no approved collection-rate target was supplied. Replace via configuration.", ar: "\u0645\u064F\u062F\u062E\u0644 \u062A\u0648\u0636\u064A\u062D\u064A \u2014 \u0644\u0645 \u064A\u064F\u0632\u0648\u064E\u0651\u062F \u0628\u0647\u062F\u0641 \u0645\u0639\u062A\u0645\u062F \u0644\u0645\u0639\u062F\u0644 \u0627\u0644\u062A\u062D\u0635\u064A\u0644. \u0627\u0633\u062A\u0628\u062F\u0644\u0647 \u0639\u0628\u0631 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A." }, version: 1 },
  collectionAmountAnnual: { value: 17e9, status: "demo", provenance: { en: "Illustrative demo input (SAR) \u2014 scaled like the monthly reports; the approved annual collection target was not supplied.", ar: "\u0645\u064F\u062F\u062E\u0644 \u062A\u0648\u0636\u064A\u062D\u064A (\u0631\u064A\u0627\u0644) \u2014 \u0644\u0645 \u064A\u064F\u0632\u0648\u064E\u0651\u062F \u0628\u0627\u0644\u0647\u062F\u0641 \u0627\u0644\u0633\u0646\u0648\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0644\u0644\u062A\u062D\u0635\u064A\u0644." }, version: 1 },
  // Monthly weights summing to 1: the meeting says the annual target is curved low early in the year and
  // rising toward year end; exact weights were not supplied, so this is a configurable demo shape.
  // curveMode 'equal' reproduces the pro-rata (annual ÷ 12) basis printed in the monthly revenue reports;
  // 'curved' follows the meeting's description. Which one is the approved basis is unresolved.
  monthlyCurve: { curveMode: "curved", weights: [0.05, 0.06, 0.07, 0.08, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.1, 0.1], equalWeights: Array(12).fill(1 / 12), status: "demo" },
  coverage: {
    status: "demo",
    // Eligible ORIGINAL (start-of-year) budget for chapters 1-3 only. Chapter 4 and Vision-programme initiative
    // costs are excluded; no reinforcement, revised appropriation or actual spend is substituted.
    chapters: { ch1: 149e8, ch2: 88e8, ch3: 33e8 },
    visionInitiativeDeduction: { value: 0, status: "unresolved", note: { en: "Amount of Vision-programme initiative costs sitting inside chapters 1-3 was not supplied; left at 0.", ar: "\u0644\u0645 \u064A\u064F\u0632\u0648\u064E\u0651\u062F \u0628\u0645\u0628\u0644\u063A \u062A\u0643\u0627\u0644\u064A\u0641 \u0645\u0628\u0627\u062F\u0631\u0627\u062A \u0627\u0644\u0631\u0624\u064A\u0629 \u062F\u0627\u062E\u0644 \u0627\u0644\u0623\u0628\u0648\u0627\u0628 1-3\u061B \u062A\u064F\u0631\u0643\u062A \u0635\u0641\u0631\u0627\u064B." } },
    targetPct: { value: 0.66, status: "demo", provenance: { en: "Illustrative demo input (the transcript example mentions a 66% ask; the Implementation Card mentions 85% \u2014 neither is confirmed as the live target).", ar: "\u0645\u064F\u062F\u062E\u0644 \u062A\u0648\u0636\u064A\u062D\u064A (\u0645\u062B\u0627\u0644 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u064A\u0630\u0643\u0631 66% \u0648\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u062A\u0630\u0643\u0631 85% \u2014 \u0648\u0644\u0627 \u0623\u064A\u064C\u0651 \u0645\u0646\u0647\u0645\u0627 \u0645\u0624\u0643\u062F \u0643\u0647\u062F\u0641 \u062D\u0627\u0644\u064A)." } },
    proration: "equal_monthly",
    transferRules: { status: "unresolved", note: { en: "Inter-chapter transfer eligibility rules unresolved (MoF matter).", ar: "\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0645\u0646\u0627\u0642\u0644\u0629 \u0628\u064A\u0646 \u0627\u0644\u0623\u0628\u0648\u0627\u0628 \u063A\u064A\u0631 \u0645\u062D\u0633\u0648\u0645\u0629 (\u0634\u0623\u0646 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629)." } }
  }
};

// server/engine.js
var CLASSES = ["collected", "cancelled", "excluded", "objection", "enforcement", "linkage_unresolved", "ineligible_referral", "partial", "overdue", "not_due"];
var C = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
var CLASS_INDEX = C;
var RULES = EXCLUSION_RULES.map((r, i) => ({ id: r.id, bit: 1 << i, priority: r.priority, approved: r.approval === "approved", category: r.category, locked: r.locked }));
if (RULES.some((r, i) => r.id !== RULE_IDS[i])) throw new Error("rule order mismatch between catalog and revenueMetrics");
var OBJ_BIT = RULE_BIT["OBJ-1"];
var CR_BIT = RULE_BIT["CR-1"];
var BY_PRIORITY = [...RULES].sort((a, b) => a.priority - b.priority);
var NBITS = RULES.length;
var K = 22;
var M = { exclusionsRules: 21, count: 0, gross: 1, adjustments: 2, exclusions: 3, net: 4, collected: 5, outstanding: 6, overpayment: 7, receiptsOnExcluded: 8, excludedCount: 9, cancelled: 10, cancelledCount: 11, overlapCount: 12, overlapAmount: 13, multiReasonCount: 14, exclusionsApproved: 15, exclusionsUnapproved: 16, overdueOutstanding: 17, notDueOutstanding: 18, violationCount: 19, enforcementCount: 20 };
var Acc = class {
  constructor(groups) {
    this.a = new Float64Array(groups * K);
    this.groups = groups;
  }
  add(g, D) {
    const a = this.a;
    const o = g * K;
    a[o + M.count] += 1;
    a[o + M.gross] += D.gross;
    a[o + M.adjustments] += D.adj;
    a[o + M.exclusions] += D.exclTotal;
    a[o + M.exclusionsRules] += D.exclusionAmount;
    a[o + M.net] += D.net;
    a[o + M.collected] += D.collected;
    a[o + M.outstanding] += D.outstanding;
    a[o + M.overpayment] += D.overpayment;
    if (D.excluded) {
      a[o + M.excludedCount] += 1;
      if (D.nReasons > 1) a[o + M.multiReasonCount] += 1;
      if (D.primaryApproved) a[o + M.exclusionsApproved] += D.exclusionAmount;
      else a[o + M.exclusionsUnapproved] += D.exclusionAmount;
    }
    if (D.cancelled) {
      a[o + M.cancelled] += D.cancelledAmount;
      a[o + M.cancelledCount] += 1;
    }
    if (D.overlaps) {
      a[o + M.overlapCount] += 1;
      a[o + M.overlapAmount] += D.cancelledAmount;
      if (D.nReasons > 1) a[o + M.multiReasonCount] += 1;
    }
    if (D.outstanding > 0) {
      if (D.daysOverdue > 0) a[o + M.overdueOutstanding] += D.outstanding;
      else a[o + M.notDueOutstanding] += D.outstanding;
    }
  }
  addMeta(g, viol, enf) {
    const o = g * K;
    if (viol) this.a[o + M.violationCount] += 1;
    if (enf) this.a[o + M.enforcementCount] += 1;
  }
  toAgg(g) {
    const a = this.a;
    const o = g * K;
    const r = {};
    for (const [k, i] of Object.entries(M)) r[k] = a[o + i];
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
function lookupId(st, id) {
  const s = String(id || "").trim();
  if (st.fixtureById.has(s)) return st.fixtureById.get(s);
  const key = parseInvoiceId(s);
  if (key == null) return -1;
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
function lowerBound(st, key) {
  let lo = 0;
  let hi = st.nGen;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (st.idKey[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function idOf(st, i) {
  if (i >= st.nGen) return st.fixtures.get(i)?.id ?? `X-${i}`;
  return invoiceIdOf(st.idKey[i]);
}
function makeCtx(st, req = {}) {
  const cfg = normalizeConfig(req.cfg || {});
  const cutoffN = dayNum(cfg.cutoff);
  const ctx = { st, cfg, cutoffN, owner: Number(req.owner) || 0, graceDays: cfg.graceDays || 0, periodEndMode: cfg.collectionsAsOf === "periodEnd" };
  let enabled = 0;
  RULES.forEach((r) => {
    if (cfg.rules[r.id] && !r.locked) enabled |= r.bit;
  });
  ctx.enabled = enabled;
  ctx.objOn = !!cfg.rules["OBJ-1"];
  ctx.crOk = [true, true, false, false, false];
  const names = ["", "Active", "Deleted", "Suspended", "Cancelled"];
  ctx.crOk = names.map((n, k) => k === 0 ? true : (cfg.crStatuses || []).includes(n));
  ctx.mark = null;
  ctx.ov = /* @__PURE__ */ new Map();
  const dec = req.decisions || {};
  const links = req.links || {};
  const need = Object.keys(dec).length + Object.keys(links).length;
  if (need) {
    ctx.mark = new Uint8Array(st.n);
    for (const [id, d] of Object.entries(dec)) {
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
    for (const [id, status] of Object.entries(links)) {
      const i = lookupId(st, id);
      if (i < 0) continue;
      const o = ctx.ov.get(i) || { set: 0, clr: 0, rej: 0, link: 0 };
      o.link = status === "confirmed" || status === "open" ? 2 : status === "suspended" ? 3 : status === "closed" ? 4 : status === "candidate" ? 1 : 0;
      ctx.ov.set(i, o);
      ctx.mark[i] = 1;
    }
  }
  ctx.D = { payStatus: "not_due", gross: 0, adj: 0, billed: 0, received: 0, cancelled: false, overlaps: false, cancelledAmount: 0, mask: 0, nReasons: 0, primaryBit: 0, primaryApproved: false, excluded: false, exclusionAmount: 0, net: 0, collected: 0, overpayment: 0, outstanding: 0, daysOverdue: 0, cls: 0, pendingMask: 0, link: 0, exclTotal: 0 };
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
  let m = st.exMask[i] & appr & ctx.enabled;
  if (m & CR_BIT) {
    const cs = st.crSt[i];
    if (!ctx.crOk[cs]) m &= ~CR_BIT;
  }
  if (ctx.objOn && flags & F.OBJECTION && !(m & OBJ_BIT)) m |= OBJ_BIT;
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
  const cancelled = cd !== 0 && cd <= asOfN && link < 2;
  const excluded = !cancelled && m !== 0;
  const overlaps = cancelled && m !== 0;
  const cancelledAmount = cancelled ? Math.max(0, billed - received) : 0;
  const base = Math.max(billed - cancelledAmount, 0);
  const collected = excluded ? 0 : Math.min(received, base);
  const overpayment = excluded ? 0 : Math.max(0, received - base);
  const outstanding = excluded || cancelled ? 0 : Math.max(0, billed - received);
  const daysOverdue = Math.max(0, ctx.cutoffN - (st.due[i] + ctx.graceDays));
  D.gross = billed;
  D.adj = adj;
  D.billed = billed;
  D.received = received;
  D.cancelled = cancelled;
  D.overlaps = overlaps;
  D.cancelledAmount = cancelledAmount;
  D.mask = m;
  D.nReasons = m ? popcount(m) : 0;
  D.primaryBit = primaryBit;
  D.primaryApproved = primaryApproved;
  D.excluded = excluded;
  D.exclusionAmount = excluded ? billed : 0;
  D.net = excluded ? 0 : billed - cancelledAmount;
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
    if (flags & F.OBJECTION) cls = C.objection;
    else if (flags & F.LEGACY_CANCELLED || st.src[i] === 0 && (cs === 2 || cs === 4) && isOverdue) cls = C.linkage_unresolved;
    else if (isOverdue && flags & F.MISSING_ID) cls = C.ineligible_referral;
    else if (isPartial) cls = C.partial;
    else if (isOverdue) cls = C.overdue;
    else cls = C.not_due;
  }
  D.cls = cls;
  D.payStatus = cancelled ? "cancelled" : excluded ? "excluded" : outstanding <= 0 ? "collected" : received > 0 ? "partial" : daysOverdue > 0 ? "overdue" : "not_due";
  return D;
}
function resolveScope(ctx, scope = {}) {
  const st = ctx.st;
  const cfg = ctx.cfg;
  const toS = scope.to || cfg.cutoff;
  const fromS = scope.from || `${cfg.cutoff.slice(0, 4)}-01-01`;
  const out = { owner: ctx.owner, from: fromS, to: toS, fromN: dayNum(fromS), toN: Math.min(dayNum(toS), ctx.cutoffN), entOk: new Uint8Array(ENTITIES.length), srcOk: new Uint8Array(SOURCES.length), scopeType: scope.scopeType ?? "all", muni: scope.muni ?? "all", item: scope.item ?? "all", issuedFromN: scope.issuedFrom ? dayNum(scope.issuedFrom) : null, issuedToN: scope.issuedTo ? dayNum(scope.issuedTo) : null };
  const orgKeys = scope.org?.amanahKeys || scope.orgKeys || null;
  const am = scope.amanah ?? "all";
  const amSet = am === "all" ? null : new Set([].concat(am));
  for (let e = 0; e < ENTITIES.length; e += 1) {
    const en = ENTITIES[e].en;
    let ok = true;
    if (orgKeys && !orgKeys.includes(en)) ok = false;
    if (amSet && !amSet.has(en)) ok = false;
    out.entOk[e] = ok ? 1 : 0;
  }
  const srcF = scope.source ?? "all";
  for (let s = 0; s < SOURCES.length; s += 1) out.srcOk[s] = srcF === "all" || SOURCES[s].key === srcF ? 1 : 0;
  out.muniIdx = out.muni !== "all" ? Number(String(out.muni).split("|").pop() === "Sales" ? 0 : ["North", "Central", "South"].indexOf(String(out.muni).split("|").pop())) : -1;
  out.muniEnt = out.muni !== "all" ? ENTITY_INDEX[String(out.muni).split("|")[0]] : -1;
  out.itemIdx = out.item !== "all" ? ITEMS.findIndex((x) => x.key === out.item) : -1;
  out.scopeIdx = out.scopeType === "central" ? 0 : out.scopeType === "internal" ? 1 : -1;
  out.status = scope.status ?? "all";
  out.statusSet = null;
  if (out.status !== "all") {
    const set = new Uint8Array(CLASSES.length);
    if (out.status === "open") CLASSES.forEach((c, k) => {
      if (c !== "collected" && c !== "cancelled" && c !== "excluded") set[k] = 1;
    });
    else if (C[out.status] != null) set[C[out.status]] = 1;
    else set.fill(1);
    out.statusSet = set;
  }
  out.key = `${out.from}|${out.to}|${am === "all" ? "all" : [].concat(am).join(",")}|${srcF}|${orgKeys ? orgKeys.join(",") : "all"}|${out.scopeType}|${out.muni}|${out.item}|${out.status}`;
  return out;
}
var inScope = (st, sc, i) => (st.owner[i] === 0 || st.owner[i] === sc.owner) && sc.entOk[st.ent[i]] === 1 && sc.srcOk[st.src[i]] === 1 && (sc.scopeIdx < 0 || st.scope[i] === sc.scopeIdx) && (sc.itemIdx < 0 || st.item[i] === sc.itemIdx) && (sc.muniEnt < 0 || st.ent[i] === sc.muniEnt && st.muni[i] === sc.muniIdx);
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
var labelOfEnt = (e) => ({ en: ENTITIES[e].en, ar: ENTITIES[e].ar, zh: ENTITIES[e].zh });
var catOf = (bit) => RULES.find((r) => r.bit === bit);
function snapshot(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const NE = ENTITIES.length;
  const NS = SOURCES.length;
  const per = { tot: new Acc(1), ent: new Acc(NE), src: new Acc(NS), scope: new Acc(2) };
  const stk = { tot: new Acc(1), ent: new Acc(NE), src: new Acc(NS) };
  const ncCount = new Float64Array(CLASSES.length);
  const ncAmt = new Float64Array(CLASSES.length);
  const ncTop = CLASSES.map(() => new TopK(60));
  const ncMaxDays = new Float64Array(CLASSES.length);
  const ncEnt = new Float64Array(CLASSES.length * NE);
  const exCat = /* @__PURE__ */ new Map();
  const reasonCounts = new Array(NBITS).fill(0);
  const unappr = /* @__PURE__ */ new Set();
  const primCnt = new Float64Array(NBITS);
  const primAmt = new Float64Array(NBITS);
  const pendCnt = new Float64Array(NBITS);
  const entSrcGross = new Float64Array(NE * NS);
  const entSrcNet = new Float64Array(NE * NS);
  const MX = 6;
  const mxA = new Float64Array(NE * NS * MX);
  const NCOL = NBITS + 1;
  const exMx = new Float64Array(NE * NCOL * 2);
  const aging = new Float64Array(5 * 2);
  const accMonth = /* @__PURE__ */ new Map();
  const accMuni = new Acc(NE * 5);
  const accStatus = new Acc(CLASSES.length);
  const agingC = new Float64Array(5 * 2);
  let ageSum = 0;
  let ageN = 0;
  let objAmt = 0;
  const recv = { total: 0, fromPeriodInvoices: 0, fromPriorInvoices: 0, onExcluded: 0, count: 0, byChannel: new Float64Array(CHANNELS.length) };
  const q2 = { records: 0, conflicts: new TopK(40), conflictN: 0, conflictAtStake: 0, pendingAtStake: 0, pendingN: 0, pending: new TopK(40), missingN: 0, missing: new TopK(40), contractN: 0, contract: new TopK(40), unverifiedN: 0, uploaded: 0, checkable: 0 };
  const enfStock = { inExecution: { count: 0, outstanding: 0 }, suspended: { count: 0, outstanding: 0 }, closedOnly: { count: 0, outstanding: 0 } };
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
    if (okCut && D.link >= 2) {
      const b = D.link === 2 ? enfStock.inExecution : D.link === 3 ? enfStock.suspended : enfStock.closedOnly;
      b.count += 1;
      b.outstanding += D.outstanding;
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
    per.scope.add(st.scope[i], dd);
    {
      const ym = isoOf(st.issue[i]).slice(0, 7);
      let am = accMonth.get(ym);
      if (!am) {
        am = new Acc(1);
        accMonth.set(ym, am);
      }
      am.add(0, dd);
    }
    accMuni.add(e * 5 + (municipalityOf(e, Math.min(st.muni[i], 4)) ? Math.min(st.muni[i], 4) : 3), dd);
    accStatus.add(dd.cls, dd);
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
      const o = (e * NS + s) * MX;
      mxA[o] += 1;
      mxA[o + 1] += dd.gross;
      mxA[o + 2] += dd.exclTotal;
      mxA[o + 3] += dd.net;
      mxA[o + 4] += dd.collected;
      mxA[o + 5] += dd.outstanding;
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
      ncEnt[cls * NE + e] += amt;
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
    q2.records += 1;
    if (st.flags[i] & F.AMT_CONFLICT) {
      q2.conflictN += 1;
      q2.conflictAtStake += st.gross[i];
      q2.conflicts.push(i, st.gross[i]);
    }
    if (dd.pendingMask) {
      q2.pendingN += 1;
      q2.pendingAtStake += st.gross[i];
      q2.pending.push(i, st.gross[i]);
    }
    if (st.flags[i] & F.MISSING_ID) {
      q2.missingN += 1;
      q2.missing.push(i, st.gross[i]);
    }
    {
      const cs = st.cstat[i];
      if (s === 0 && (cs === 2 || cs === 4)) {
        q2.contractN += 1;
        q2.contract.push(i, st.gross[i]);
      }
      if (cs === 5) q2.unverifiedN += 1;
    }
    if (st.flags[i] & F.UPLOADED) q2.uploaded += 1;
    if (!(st.flags[i] & F.NOT_CHECKABLE)) q2.checkable += 1;
  }
  const ids = (t) => t.sorted().map(([i]) => idOf(st, i));
  const groupOut = (acc, count, labelFn, keyFn) => {
    const out = [];
    for (let g = 0; g < count; g += 1) {
      if (acc.a[g * K + M.count] === 0) continue;
      out.push({ key: keyFn(g), label: labelFn(g), ...acc.toAgg(g) });
    }
    return out.sort((a, b) => b.outstanding - a.outstanding || b.gross - a.gross);
  };
  const entLabel = (g) => labelOfEnt(g);
  const totals = per.tot.toAgg(0);
  const noncollection = {};
  for (const c of [...NONCOLLECTION_CATEGORIES, "enforcement"]) {
    const k = C[c];
    let te = -1;
    let tv = 0;
    for (let e = 0; e < NE; e += 1) if (ncEnt[k * NE + e] > tv) {
      tv = ncEnt[k * NE + e];
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
  const byAmanah = groupOut(per.ent, NE, entLabel, (g) => ENTITIES[g].en);
  const byMonth = [...accMonth.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([month, acc]) => ({ month, ...acc.toAgg(0) }));
  const byMunicipality = [];
  for (let g = 0; g < NE * 5; g += 1) {
    if (accMuni.a[g * K + M.count] === 0) continue;
    const e = Math.floor(g / 5);
    const mu = municipalityOf(e, g % 5);
    byMunicipality.push({ key: `${ENTITIES[e].en}|${mu ? mu.key.split("|")[1] : "-"}`, amanah: ENTITIES[e].en, amanahLabel: labelOfEnt(e), municipality: mu ? { key: mu.key, ar: mu.ar, en: mu.en } : null, ...accMuni.toAgg(g) });
  }
  byMunicipality.sort((a, b) => b.outstanding - a.outstanding);
  const byStatus = [];
  for (let k = 0; k < CLASSES.length; k += 1) {
    if (accStatus.a[k * K + M.count] === 0) continue;
    byStatus.push({ key: CLASSES[k], ...accStatus.toAgg(k) });
  }
  const bySource = groupOut(per.src, NS, () => null, (g) => SOURCES[g].key);
  const byScope = [0, 1].map((g) => ({ key: g === 0 ? "central" : "internal", ...per.scope.toAgg(g) }));
  const matrix = { amanahSource: [], amanahReasons: [] };
  for (let e = 0; e < NE; e += 1) {
    for (let s = 0; s < NS; s += 1) {
      const o = (e * NS + s) * MX;
      if (mxA[o]) matrix.amanahSource.push({ amanah: ENTITIES[e].en, source: SOURCES[s].key, count: mxA[o], gross: mxA[o + 1], exclusions: mxA[o + 2], net: mxA[o + 3], collected: mxA[o + 4], outstanding: mxA[o + 5] });
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
    amanahCheck: byAmanah.every((r) => checkEquation(r).ok),
    sourceCheck: bySource.every((r) => checkEquation(r).ok),
    scopeCheck: byScope.every((r) => checkEquation(r).ok),
    monthsSumToTotal: addsUp(byMonth),
    municipalitiesSumToTotal: addsUp(byMunicipality),
    statusSumsToTotal: addsUp(byStatus),
    amanahSumsToTotal: addsUp(byAmanah),
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
    byAmanah: groupOut(stk.ent, NE, entLabel, (g) => ENTITIES[g].en),
    bySource: groupOut(stk.src, NS, () => null, (g) => SOURCES[g].key)
  };
  const byAmanahSource = {};
  for (let e = 0; e < NE; e += 1) for (let s = 0; s < NS; s += 1) {
    const v = entSrcGross[e * NS + s];
    if (v) {
      (byAmanahSource[ENTITIES[e].en] = byAmanahSource[ENTITIES[e].en] || {})[SOURCES[s].key] = v;
    }
  }
  const quality2 = {
    records: q2.records,
    kinds: { demo: q2.records - q2.uploaded, ...q2.uploaded ? { uploaded: q2.uploaded } : {} },
    amountConflicts: ids(q2.conflicts),
    amountConflictCount: q2.conflictN,
    amountCheckable: q2.checkable,
    pendingExclusions: ids(q2.pending),
    pendingExclusionCount: q2.pendingN,
    pendingExclusionAmount: q2.pendingAtStake,
    missingFieldRecords: ids(q2.missing),
    missingFieldCount: q2.missingN,
    contractIssues: ids(q2.contract),
    contractIssueCount: q2.contractN,
    contractUnverified: [],
    contractUnverifiedCount: q2.unverifiedN,
    conflictAmountAtStake: q2.conflictAtStake,
    completenessNote: { en: `${q2.checkable} of ${q2.records} records have line-item evidence for an amount check; the rest could not be checked.`, ar: `${q2.checkable} \u0645\u0646 ${q2.records} \u0633\u062C\u0644\u0627\u064B \u0644\u062F\u064A\u0647\u0627 \u0628\u0646\u0648\u062F \u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0628\u0644\u063A\u061B \u0648\u0627\u0644\u0628\u0627\u0642\u064A \u062A\u0639\u0630\u0651\u0631 \u0641\u062D\u0635\u0647.` }
  };
  const byChannel = {};
  CHANNELS.forEach((c, k) => {
    if (recv.byChannel[k]) byChannel[c] = recv.byChannel[k];
  });
  return {
    scope: { from: sc.from, to: sc.to, status: req.scope?.status ?? "all", amanah: req.scope?.amanah ?? "all", source: req.scope?.source ?? "all", scopeType: req.scope?.scopeType ?? "all", muni: req.scope?.muni ?? "all", org: req.scope?.org || null, ...req.scope?.basis ? { basis: req.scope.basis } : {} },
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
    byAmanah,
    bySource,
    byScope,
    byMonth,
    byMunicipality,
    byStatus,
    equation,
    basis: { invoices: "issue_date", invoicesFrom: sc.from, invoicesTo: sc.to, collectionsAsOf: isoOf(periodAsOf), collectionsMode: periodAsOf === ctx.cutoffN ? "reference_date" : "period_end", referenceDate: ctx.cfg.cutoff, receiptsByPaymentDate: "separate_indicator", timezone: "Asia/Riyadh" },
    byAmanahSource,
    matrix,
    receivedInPeriod: { total: recv.total, fromPeriodInvoices: recv.fromPeriodInvoices, fromPriorInvoices: recv.fromPriorInvoices, onExcluded: recv.onExcluded, byChannel, count: recv.count },
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
    let hasReason = -1;
    for (let p = ps; p < ps + pc; p += 1) {
      const d = st.pDay[p];
      if (d < sc.fromN || d > asOf) continue;
      if (hasReason < 0) {
        derive(ctx, i, ctx.cutoffN);
        hasReason = ctx.D.mask !== 0 ? 1 : 0;
      }
      if (hasReason) continue;
      const k = idx.get(isoOf(d).slice(0, 7));
      if (k === void 0) continue;
      values[k] += st.pAmt[p];
      amts.push(st.pAmt[p]);
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
  const nat = national && (!req.scope?.source || req.scope.source === "all") && !req.scope?.org?.amanahKeys;
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
    unmatched: { scopedOut: !nat, nationalCount: UNMATCHED_REPORT_ROWS.length, nationalAmount: UNMATCHED_REPORT_ROWS.reduce((s, u) => s + u.amount, 0), count: nat ? unmatchedCount : 0, amount: nat ? unmatchedAmt : 0, rows: nat ? UNMATCHED_REPORT_ROWS.map((u) => ({ invoiceNo: u.invoiceNo, invoiceValue: u.amount, lines: u.lines, hint: u.hint })) : [] },
    ruleSetApproval: { unapprovedAmount: exclUnapproved, approvedAmount: exclApproved }
  };
}

// server/sourceRecords.js
var BI2 = (ar, en) => ({ ar, en });
var fld = (n, ar, en, v) => ({ n, l: BI2(ar, en), v: v === void 0 ? null : v });
var view = (id, table, title, fields) => ({ id, table, title, fields });
var pad2 = (n, w) => String(n).padStart(w, "0");
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
var addDays2 = (iso, n) => isoOf(Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5) + n);
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
  const muni = municipalityOf(st.ent[i], st.muni[i]);
  const payer = payerName(st.payer[i]);
  const gross = rec.grossAmount;
  const sadad = rec.sadadNo;
  const pf = paymentFacts(rec);
  const r = new Rng(mix(40, idKey % 1000003, year));
  const flags = st.flags[i];
  const amanaNo = String(1e3 + st.ent[i] * 10);
  const baladyaNo = muni ? String(amanaNo * 1 + 1 + st.muni[i]) : null;
  const geoFields = [
    fld("AMANA_NO", "\u0643\u0648\u062F \u0627\u0644\u0623\u0645\u0627\u0646\u0629", "Amanah code", amanaNo),
    fld("ARABIC_AMANA_NAME", "\u0627\u0644\u0623\u0645\u0627\u0646\u0629", "Amanah", ent.ar),
    ...muni ? [fld("BALADYA_NO", "\u0643\u0648\u062F \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipality code", baladyaNo), fld("ARABIC_BRANCH_BALADYA_NAME", "\u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Municipality", muni.ar)] : []
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
    const reqId = `SR${pad2(hash(idKey % 1e6, 2) % 1e10, 10)}`;
    out.providingSystem = BI2(tob ? "\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u062A\u0628\u063A (TB_*) \u0639\u0628\u0631 \u0625\u0646\u0643\u0648\u0631\u062A\u0627" : "\u0645\u0646\u0635\u0629 \u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0625\u064A\u0648\u0627\u0621 \u0639\u0628\u0631 \u0625\u0646\u0643\u0648\u0631\u062A\u0627", tob ? "Tobacco disclosure platform (TB_*) via Incorta" : "Accommodation disclosure platform via Incorta").ar;
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
      fld("CREATED_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0628\u062F\u0627\u064A\u0629", "Period start", `${dy}-${pad2(dm, 2)}-01`),
      fld(tob ? "DISCLOSURE_DATE" : "MODIFIED_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u062F\u064A\u0645", "Submission date", addDays2(rec.issueDate, -(hash(idKey % 1e6, 4) % 3))),
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
      fld("CREATED_DATE", "\u062A\u0627\u0631\u064A\u062E \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062C\u062F\u0648\u0644\u0629", "Schedule created", `${dy}-${pad2(dm, 2)}-01`),
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
    if (replacedBy) out.related.push({ kind: "replaced_by", label: BI2("\u0627\u0633\u062A\u064F\u0628\u062F\u0644\u062A \u0628\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0641\u0635\u0627\u062D \u0645\u0639\u062F\u0651\u0644", "Replaced by an amended-disclosure invoice"), invoiceId: invoiceIdOf(replacedBy), note: BI2("\u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0644\u063A\u0627\u0629\u061B \u062A\u064F\u062E\u0635\u0645 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0648\u062A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0639\u062F\u0651\u0644\u0629 \u0641\u0642\u0637.", "This invoice is cancelled and deducted once; only the amended invoice is counted.") });
    if (replaces) out.related.push({ kind: "replaces", label: BI2("\u062A\u062D\u0644 \u0645\u062D\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0625\u0641\u0635\u0627\u062D \u0627\u0644\u0623\u0635\u0644\u064A", "Replaces the original-disclosure invoice"), invoiceId: invoiceIdOf(replaces) });
    out.checks = { disclosureBase: base, feePercent: pct, fee, vat: tax, amountEqualsFeePlusVat: Math.abs(fee + tax - gross) < 0.5, walletPaid: pf.wallet, sadadPaid: pf.other };
    out.facility = { key: facilityKey, name: facName };
  } else if (src.key === "white_lands") {
    const A = PARAMS.white_lands;
    const grp = grpOf(flags);
    const offset = grp === GRP.WL_OWN2 ? 1 : grp === GRP.WL_OWN3 ? 2 : 0;
    const headIdx = i - offset;
    const headKey = idKey - offset;
    const headGrp = grpOf(st.flags[headIdx]);
    const owners = headGrp === GRP.WL_HEAD2 ? 2 : headGrp === GRP.WL_HEAD3 ? 3 : 1;
    let groupGross = 0;
    const group = [];
    for (let k = 0; k < owners; k += 1) {
      groupGross += st.gross[headIdx + k];
      group.push(headIdx + k);
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
      fld("PublishedDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0646\u0634\u0631", "Published date", addDays2(issueD, 1)),
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
      fld("OwnersCount", "\u0639\u062F\u062F \u0627\u0644\u0645\u0644\u0627\u0643", "Owners", owners),
      fld("DeedTypeName", "\u0646\u0648\u0639 \u0627\u0644\u0635\u0643", "Deed type", ["\u0635\u0643 \u0645\u0644\u0643\u064A\u0629", "\u0635\u0643 \u0625\u0641\u0631\u0627\u063A", "\u0635\u0643 \u0625\u0631\u062B"][hash(headKey % 1e6, 27) % 3]),
      fld("DeedExpirationStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0635\u0643", "Deed validity", "\u0633\u0627\u0631\u064A"),
      fld("LandTypeName", "\u0646\u0648\u0639 \u0627\u0644\u0623\u0631\u0636", "Land type", ["\u0633\u0643\u0646\u064A", "\u062A\u062C\u0627\u0631\u064A", "\u0633\u0643\u0646\u064A \u062A\u062C\u0627\u0631\u064A"][hash(headKey % 1e6, 28) % 3]),
      fld("CityName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u062F\u064A\u0646\u0629", "City", city),
      fld("LandId", "\u0645\u0639\u0631\u0641 \u0642\u0637\u0639\u0629 \u0627\u0644\u0623\u0631\u0636", "Land id", landId),
      fld("InvoiceCount", "\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631", "Invoices on the deed", owners),
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
      const recv = addDays2(issueD, 5 + hash(idKey % 1e6, 37) % 25);
      out.views.push(view("DS_041_TimeLimitRequest", "BIDSCIDLELANDS_ds_041_development_period_extension_1", BI2("\u0637\u0644\u0628 \u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0645\u0647\u0644\u0629", "Time-limit extension request"), [
        fld("Id", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0637\u0644\u0628", "Request id", 4e6 + idKey % 1e8),
        fld("InvoiceId", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Invoice id", 8e6 + idKey % 1e8),
        fld("RequestStatusName", "\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "Request status", ext === 1 ? "\u0645\u0642\u0628\u0648\u0644" : ext === 2 ? "\u0645\u0631\u0641\u0648\u0636" : "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629"),
        fld("Reason", "\u0633\u0628\u0628 \u0627\u0644\u0637\u0644\u0628", "Reason", "\u0637\u0644\u0628 \u0645\u0647\u0644\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u0637\u0648\u064A\u0631 (\u0646\u0635 \u062A\u062C\u0631\u064A\u0628\u064A)"),
        fld("ReceivedDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645", "Received", recv),
        fld("TimeLimitApprovalStatus", "\u062D\u0627\u0644\u0629 \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u062A\u0645\u062F\u064A\u062F", "Approval status", ext),
        fld("GivenPeriod", "\u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u0645\u0646\u0648\u062D\u0629 (\u064A\u0648\u0645)", "Given period (days)", ext === 1 ? given : null),
        fld("RefuseDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0631\u0641\u0636", "Refuse date", ext === 2 ? addDays2(recv, 10) : null),
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
        fld("CreatedDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", "Created", addDays2(issueD, 8 + hash(idKey % 1e6, 38) % 30)),
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
      label: BI2(owners > 1 ? `\u0635\u0643 \u0645\u0634\u062A\u0631\u0643 \u0628\u064A\u0646 ${owners} \u0645\u0644\u0627\u0643 \u2014 \u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0643\u0644 \u0645\u0627\u0644\u0643` : "\u0635\u0643 \u0628\u0645\u0627\u0644\u0643 \u0648\u0627\u062D\u062F", owners > 1 ? `Deed shared by ${owners} owners - one invoice per owner` : "Single-owner deed"),
      deedNo,
      invoices: group.map((g) => ({ id: invoiceIdOf(st.idKey[g]), amount: st.gross[g], share: Math.round(st.gross[g] / groupGross * 1e4) / 100, current: g === i }))
    });
    if (st.exec[i] >= 0 && st.requests[st.exec[i]]?.system === "white_lands") {
      const q2 = st.requests[st.exec[i]];
      out.links.push({ system: "\u0645\u0644\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u0644\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0628\u064A\u0636\u0627\u0621", dataset: "white_lands_enforcement", importVersion: IMPORT_VERSIONS.white_lands_enforcement, keyField: "\u0631\u0642\u0645 \u0623\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", key: q2.enforceNum, role: "enforcement", note: BI2("\u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0644\u0627 \u064A\u064F\u062D\u062A\u0633\u0628 \u062A\u062D\u0635\u064A\u0644\u0627\u064B\u060C \u0648\u0645\u0628\u0644\u063A \u0627\u0644\u0623\u0645\u0631 \u0644\u0627 \u064A\u064F\u0636\u0627\u0641 \u0625\u0644\u0649 \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629.", "Execution is not collection and the order amount is not added to the debt.") });
    }
    out.checks = { owners, ownershipSharePct: Math.round(share * 1e4) / 100, groupGross, zoneRate: rate, evaluatedAreaTimesRate: Math.round(evalArea * rate), extension: ext, extensionDays: given, objection: !!(flags & F.OBJECTION) };
    out.land = { landId, deedNo, city };
  } else if (src.key === "licenses" || src.key === "municipal_fees") {
    const fam = item.key;
    const svcList = SERVICES[fam];
    const svc = svcList ? svcList[hash(idKey % 1e6, 51) % svcList.length] : [900, "\u062E\u062F\u0645\u0629 \u0628\u0644\u062F\u064A\u0629", "Municipal service"];
    const billStatus = rec.cancelled ? hash(idKey % 1e6, 52) % 2 ? 2 : 3 : pf.paid >= gross - 0.5 ? 1 : 0;
    const licId = LICENCE.num(idKey);
    const reqId = Number(REQUEST.num(idKey).slice(0, 9));
    const nat = hash(st.payer[i], 53) % 100 < 70 ? "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" : "\u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629";
    out.providingSystem = src.key === "licenses" ? "\u0645\u0646\u0635\u0629 \u0628\u0644\u062F\u064A (BALADY_BILLS) \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0623\u0645\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629" : "\u0625\u0646\u0643\u0648\u0631\u062A\u0627 \u2014 \u0637\u0628\u0642\u0629 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0648\u062D\u062F\u0629 (ENT_REVENUES)";
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
      fld("NATIONAL_NUMBER", "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u062D\u062F", "Unified number", nat === "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A" ? `700${pad2(hash(st.payer[i], 54) % 1e7, 7)}` : null),
      fld("BILL_UPDATE_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u062D\u062F\u064A\u062B", "Updated", pf.last || rec.issueDate),
      fld("PAID_DATE", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062F\u0627\u062F", "Paid date", pf.last),
      fld("BILL_AMOUNT", "\u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", "Bill amount", gross),
      fld("BILL_STATUS_KEY", "\u0643\u0648\u062F \u0627\u0644\u062D\u0627\u0644\u0629", "Status key", billStatus),
      fld("BILL_STATUS_NAME", "\u0648\u0635\u0641 \u0627\u0644\u062D\u0627\u0644\u0629", "Status", PARAMS.licenses.billStatusCodes[billStatus]),
      fld("AMANA_NO", "\u0643\u0648\u062F \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A", "Amanah accounting code", amanaNo),
      fld("BALADYA_NO", "\u0643\u0648\u062F \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A", "Municipality accounting code", baladyaNo),
      fld("GIS_CODE", "\u0643\u0648\u062F \u0627\u0644\u0628\u0644\u062F\u064A\u0629", "GIS code", muni ? `GIS-${amanaNo}-${st.muni[i] + 1}` : null)
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
        fld("SADAD_END_DATE", "\u062A\u0627\u0631\u064A\u062E \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0631\u062E\u0635\u0629", "Licence end", addDays2(issue, 365)),
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
    out.providingSystem = "\u0625\u064A\u0641\u0627\u0621 / \u0645\u0645\u062A\u062B\u0644 (\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0639\u0628\u0631 \u0625\u0646\u0643\u0648\u0631\u062A\u0627)";
    out.importVersion = IMPORT_VERSIONS.violations;
    const visitStart = addDays2(rec.issueDate, -(hash(idKey % 1e6, 75) % 4));
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
      fld("\u0645\u0639\u0631\u0641_\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", "Violation id", `V${pad2(idKey % 1e8, 9)}`),
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
      fld("UNIT_REF", "\u0645\u0631\u062C\u0639 \u0627\u0644\u0648\u062D\u062F\u0629", "Unit reference", `UNIT-${pad2(hash(idKey % 1e6, 91) % 1e6, 6)}`),
      fld("SADAD", "\u0631\u0642\u0645 \u0633\u062F\u0627\u062F", "SADAD number", sadad),
      fld("SALE_AMOUNT", "\u0642\u064A\u0645\u0629 \u0627\u0644\u0628\u064A\u0639", "Sale amount", gross)
    ]));
    out.notes.push(BI2("\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u062E\u0637\u0637 \u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0631\u0641\u0642\u0629\u061B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062A\u0628\u0639 \u0628\u0646\u064A\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u062D\u062F\u0629 \u0641\u0642\u0637.", "There is no sales-invoice schema in the supplied files; the data follows the unified-invoice structure only."));
  } else if (src.key === "investment") {
    out.providingSystem = "\u0641\u0631\u0635 (\u0639\u0642\u0648\u062F) \u062B\u0645 \u062A\u062D\u0635\u064A\u0644";
    out.importVersion = IMPORT_VERSIONS.furas;
    out.views.push(view("FURAS_CONTRACT_PAYMENT", "Furas", BI2("\u062F\u0641\u0639\u0629 \u0639\u0642\u062F \u0641\u0631\u0635", "Furas contract payment"), [
      fld("contract_no", "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F", "Contract number", rec.co || rec.contract?.ref || null),
      fld("installment_no", "\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629", "Installment", rec.contractPaymentNo),
      fld("installments_total", "\u0639\u062F\u062F \u0627\u0644\u062F\u0641\u0639\u0627\u062A", "Installments", rec.contractPaymentTotal),
      fld("contract_status", "\u062D\u0627\u0644\u0629 \u0631\u0628\u0637 \u0627\u0644\u0639\u0642\u062F", "Contract link state", rec.contract?.status)
    ]));
  }
  const tot = rec.lineItems.reduce((s, l) => s + l.amount, 0);
  const settleDay = pf.last ? addDays2(pf.last, 1 + hash(idKey % 1e6, 95) % 3) : null;
  out.revenueLines = rec.lineItems.map((l) => ({
    REVENUE_KEY: `RV-${pad2(idKey % 1e8, 9)}-${l.no}`,
    DETAIL_ID: l.no,
    ACCOUNT_NO: sadad,
    SADAD_TRANSACTION_ID: pf.last ? `TX${pad2(hash(idKey % 1e6, 96) % 1e10, 10)}` : null,
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
  out.links.push({ system: "\u0625\u0646\u0643\u0648\u0631\u062A\u0627", dataset: "ENT_REVENUES", importVersion: IMPORT_VERSIONS.incorta_items, keyField: "ACCOUNT_NO", key: sadad, role: "items", note: BI2(`${out.revenueLines.length} \u0628\u0646\u062F\u061B \u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0643\u0631\u0631 \u0639\u0644\u0649 \u0643\u0644 \u0628\u0646\u062F \u0648\u064A\u064F\u062D\u062A\u0633\u0628 \u0645\u0631\u0629`, `${out.revenueLines.length} line(s); the total repeats on every line and is counted once`) });
  if (central) out.links.push({ system: "\u0645\u0643\u064A\u0646", dataset: "invoice_amanah", importVersion: IMPORT_VERSIONS.makeen, keyField: "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", key: rec.id, role: "amanah", present: st.alink[i] !== 2, note: st.alink[i] === 2 ? BI2("\u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0645\u0643\u064A\u0646 \u2014 \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \xAB\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\xBB", "Not in Makeen - Amanah shown as unassigned") : BI2("\u062A\u062D\u062F\u062F \u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0648\u0627\u0644\u0628\u0644\u062F\u064A\u0629", "Gives the Amanah and municipality") });
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
  "DUP-1": { evidence: { en: "Same payer, amount and period as an earlier invoice (duplicate detection).", ar: "\u0646\u0641\u0633 \u0627\u0644\u062F\u0627\u0641\u0639 \u0648\u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0627\u0644\u0641\u062A\u0631\u0629 \u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0633\u0627\u0628\u0642\u0629 (\u0643\u0634\u0641 \u0627\u0644\u062A\u0643\u0631\u0627\u0631)." }, sources: [{ system: "\u062A\u062D\u0635\u064A\u0644 \u2014 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631", field: "\u0628\u0646\u0648\u062F \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", value: "\u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0633\u0627\u0628\u0642\u0629" }] },
  "CR-1": { evidence: { en: "CR status (raw) linked through Sanad document extraction.", ar: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A (\u062E\u0627\u0645) \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0639\u0628\u0631 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0633\u0646\u062F." }, sources: [] },
  "DEC-1": { evidence: { en: "Civil-registry flag suggests the debtor is deceased; heir/estate position not established.", ar: "\u0625\u0634\u0627\u0631\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u062F\u0646\u064A \u062A\u0641\u064A\u062F \u0628\u0648\u0641\u0627\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u061B \u0648\u0636\u0639 \u0627\u0644\u0648\u0631\u062B\u0629/\u0627\u0644\u062A\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u062B\u0628\u062A." }, sources: [{ system: "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u062F\u0646\u064A", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u0641\u0627\u0629", value: "\u0645\u062A\u0648\u0641\u0649" }] },
  "NOC-1": { evidence: { en: "Furas confirms no contract exists for this invoice.", ar: "\u0641\u0631\u0635 \u062A\u0624\u0643\u062F \u0639\u062F\u0645 \u0648\u062C\u0648\u062F \u0639\u0642\u062F \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629." }, sources: [{ system: "\u0641\u0631\u0635 \u2014 \u0627\u0644\u0639\u0642\u0648\u062F", field: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F", value: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0639\u0642\u062F (\u0645\u0624\u0643\u062F)" }] },
  "INC-1": { evidence: { en: "Mandatory data incomplete in the source report.", ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u0625\u0644\u0632\u0627\u0645\u064A\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0635\u062F\u0631." }, sources: [{ system: "\u0625\u064A\u0641\u0627\u0621 \u2014 \u062A\u0642\u0631\u064A\u0631 \u063A\u064A\u0631 \u0627\u0644\u0645\u0643\u062A\u0645\u0644", field: "\u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", value: "\u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644" }] },
  "EXE-1": { evidence: { en: "Appears in the executed-against report.", ar: "\u0648\u0627\u0631\u062F \u0641\u064A \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647." }, sources: [{ system: "\u0625\u064A\u0641\u0627\u0621 \u2014 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0646\u0641\u0630 \u0636\u062F\u0647", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", value: "\u0645\u0646\u0641\u0630 \u0636\u062F\u0647" }] },
  "EFA-1": { evidence: { en: "Violation is not present in the Efaa system of record.", ar: "\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0646\u0638\u0627\u0645 \u0625\u064A\u0641\u0627\u0621 \u0627\u0644\u0645\u0631\u062C\u0639\u064A." }, sources: [{ system: "\u062A\u062D\u0635\u064A\u0644 \u2014 \u0625\u064A\u0641\u0627\u0621 v2", field: "\u0631\u0642\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0629", value: "\u063A\u064A\u0631 \u0645\u0637\u0627\u0628\u0642 \u0641\u064A \u0625\u064A\u0641\u0627\u0621" }] },
  "OBJ-1": { evidence: { en: "Open objection in the violations system.", ar: "\u0627\u0639\u062A\u0631\u0627\u0636 \u0645\u0641\u062A\u0648\u062D \u0641\u064A \u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A." }, sources: [{ system: "\u0625\u064A\u0641\u0627\u0621 \u2014 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A \u0627\u0644\u0639\u0627\u0645", field: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0639\u062A\u0631\u0627\u0636", value: "\u0645\u0641\u062A\u0648\u062D" }] },
  "ENF-1": { evidence: { en: "Referred to enforcement.", ar: "\u0645\u062D\u0627\u0644 \u0625\u0644\u0649 \u0627\u0644\u062A\u0646\u0641\u064A\u0630." }, sources: [] }
};
function materialize(st, i, ctx = null) {
  if (i >= st.nGen) {
    const f = st.fixtures.get(i);
    return f ? structuredCloneSafe(f) : null;
  }
  const c = ctx || makeCtx(st, {});
  const idKey = st.idKey[i];
  const id = invoiceIdOf(idKey);
  const e = st.ent[i];
  const ent = ENTITIES[e];
  const src = SOURCES[st.src[i]];
  const item = ITEMS[st.item[i]];
  const issueDate = isoOf(st.issue[i]);
  const dueDate = isoOf(st.due[i]);
  const muni = municipalityOf(e, st.muni[i]);
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
  const ctReq = ct ? st.requests.find((q2) => q2.contractIdx === ct.idx) : null;
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
    const sources = ruleId === "CR-1" ? [{ system: "CR View", field: "Crstatus", value: crRaw }, { system: "\u0633\u0646\u062F", field: "CrNo (\u0627\u0633\u062A\u062E\u0631\u0627\u062C)", value: ctReq?.method === 1 ? "OCR" : "\u0645\u0646\u0638\u0645" }] : tpl.sources;
    exclusions.push({
      category: RULE_BY_ID[ruleId].category,
      ruleId,
      ruleVersion: 1,
      evidence: ruleId === "CR-1" ? { en: `CR status "${crRaw}" (raw) linked through Sanad document extraction.`, ar: `\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A "${crRaw}" (\u062E\u0627\u0645) \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0639\u0628\u0631 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0633\u0646\u062F.` } : tpl.evidence,
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
    amanah: ent.zh,
    amanahEn: ent.en,
    amanahAr: ent.ar,
    municipalityEn: muni?.en || null,
    municipalityAr: muni?.ar || null,
    municipalityKey: muni?.key || null,
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
    objection: flags & F.OBJECTION ? { open: true, ref: `OBJ-${String(idKey % 1e7).padStart(7, "0")}`, system: "momtathil" } : null,
    enforcementLinks: [],
    contract: { required: src.key === "investment", status: CSTAT[st.cstat[i]], ref: ct && st.cstat[i] === 1 ? ct.contractNo : null },
    contractPaymentNo: st.inst[i] || null,
    contractPaymentTotal: ct ? ct.dues.length : null,
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
    amanahLinkage: ALINK[st.alink[i]],
    exceptional: !!(flags & F.EXCEPTIONAL),
    provenance: { kind: "demo", system: "demo-world", ref: id }
  };
  return rec;
}
var structuredCloneSafe = (o) => typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o));
function detail(st, i, ctx) {
  const rec = materialize(st, i, ctx);
  const D = derive(ctx, i, ctx.cutoffN);
  const derived = { gross: D.gross, adjustments: D.adj, billedAfterAdj: D.billed, exclusionsTotal: D.exclTotal, received: D.received, collected: D.collected, overpayment: D.overpayment, outstanding: D.outstanding, payStatus: D.payStatus, cancelled: D.cancelled, cancelledAmount: D.cancelledAmount, overlapsCancelled: D.overlaps, excluded: D.excluded, exclusionAmount: D.exclusionAmount, net: D.net, daysOverdue: D.daysOverdue, reasonMask: D.mask, nReasons: D.nReasons, primaryRuleId: D.primaryBit ? RULE_IDS[Math.log2(D.primaryBit)] : null };
  const sourceRec = i < st.nGen ? sourceRecord(st, i, rec, D, ctx.cfg.cutoff) : null;
  return { rec, derived, cls: CLASSES[D.cls], idStr: idOf(st, i), sourceRecord: sourceRec };
}

// server/lists.js
var low0 = (x) => x.toLowerCase();
var RULE_PRIORITY = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.priority]));
function resolveSearch(st, q2) {
  const s = String(q2 || "").trim();
  if (!s) return null;
  const exact = lookupId(st, s);
  if (exact >= 0) return { list: Int32Array.of(exact) };
  const key = parseInvoiceId(s);
  const upper = s.toUpperCase();
  let m = /^INV-(\d{4})(?:-(\d{1,7}))?$/.exec(upper);
  if (m) {
    const y = Number(m[1]);
    const frag = m[2] || "";
    const lo = y * 1e8 + (frag ? Number(frag.padEnd(7, "0")) : 0);
    const hi = y * 1e8 + (frag ? Number(frag.padEnd(7, "9")) : 99999999);
    return { range: [lowerBound(st, lo), lowerBound(st, hi + 1)] };
  }
  if (key != null) return { list: new Int32Array(0) };
  if (/^CT-\d{4}-\d{4}$/.test(upper)) {
    const ct = st.contracts.find((c) => c && c.contractNo === upper);
    return { list: Int32Array.from(ct ? ct.invs : []) };
  }
  if (/^\d{10}$/.test(s)) {
    const ct = st.contracts.find((c) => c && c.crNo === s);
    if (ct) return { list: Int32Array.from(ct.invs) };
  }
  if (/^\d{12}$/.test(s)) {
    const k = idKeyFromSadad(s);
    if (k != null) {
      const i = lookupId(st, `INV-${Math.floor(k / 1e8)}-${String(k % 1e8).padStart(7, "0")}`);
      if (i >= 0) return { list: Int32Array.of(i) };
    }
  }
  if (/^\d{10}$/.test(s)) {
    const k = idKeyFromSubscription(s);
    if (k != null) {
      const i = lookupId(st, `INV-${Math.floor(k / 1e8)}-${String(k % 1e8).padStart(7, "0")}`);
      if (i >= 0) return { list: Int32Array.of(i) };
    }
  }
  if (/^\d{14}$/.test(s)) {
    const k = idKeyFromViolation(s);
    if (k != null) {
      const i = lookupId(st, `INV-${Math.floor(k / 1e8)}-${String(k % 1e8).padStart(7, "0")}`);
      if (i >= 0) return { list: Int32Array.of(i) };
    }
  }
  for (const codec2 of [DISCLOSURE, SCHEDULE, VISIT, LICENCE, REQUEST]) {
    const k = codec2.decode(upper);
    if (k != null) {
      const i = lookupId(st, invoiceIdOf(k));
      return { list: i >= 0 ? Int32Array.of(i) : new Int32Array(0) };
    }
  }
  {
    const k = DEED.decode(upper);
    if (k != null) {
      const i = lookupId(st, invoiceIdOf(k));
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
    const q3 = st.requests.find((x) => x.enforceNum === upper);
    if (q3) return { list: Int32Array.from(q3.identified.length ? q3.identified : st.contracts[q3.contractIdx]?.invs || []) };
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
function rowOut(st, ctx, i, D) {
  const e = st.ent[i];
  const muni = municipalityOf(e, st.muni[i]);
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ct = st.contract[i] >= 0 ? st.contracts[st.contract[i]] : null;
  const rules = [];
  for (let b = 0; b < RULE_IDS.length; b += 1) if (st.exMask[i] & 1 << b) rules.push(RULE_IDS[b]);
  return {
    id: idOf(st, i),
    index: i,
    entityKey: ENTITIES[e].en,
    amanahAr: ENTITIES[e].ar,
    amanahEn: ENTITIES[e].en,
    amanahZh: ENTITIES[e].zh,
    municipalityAr: fx ? fx.municipalityAr : muni?.ar || null,
    municipalityEn: fx ? fx.municipalityEn : muni?.en || null,
    municipalityKey: muni?.key || null,
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
    rules,
    nReasons: D.nReasons,
    primaryRule: D.primaryBit ? RULE_IDS[Math.log2(D.primaryBit)] : null,
    tags: tagsOf(st, i, D),
    amanahLinkage: st.alink[i],
    uploaded: !!(st.flags[i] & F.UPLOADED)
  };
}
var SORT_KEYS = { issue: "issue", gross: "gross", outstanding: "outstanding", daysOverdue: "daysOverdue", collected: "collected", id: "id" };
var cache = /* @__PURE__ */ new Map();
var hashOf = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (h * 33 ^ str.charCodeAt(i)) >>> 0;
  return `${str.length}.${h.toString(36)}`;
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
var PROBLEM_TAGS = /* @__PURE__ */ new Set(["amount_conflict", "contract_unmatched", "contract_unlinked", "missing_fields", "exclusion_pending", "enforcement_candidate"]);
function candidates(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const f = req.filters || {};
  const srch = resolveSearch(st, f.search);
  const ageB = f.age && f.age !== "all" ? ["0", "1-30", "31-90", "91-180", "180+"].indexOf(f.age) : -1;
  const stateIdx = f.state && f.state !== "all" && f.state !== "open" && f.state !== "noncollected" ? CLASS_INDEX[f.state] : -1;
  const ruleBit = f.rule && f.rule !== "all" && f.rule !== "none" && f.rule !== "any" ? 1 << RULE_IDS.indexOf(f.rule) : 0;
  const cs = f.contract && f.contract !== "all" ? f.contract === "issue" ? -2 : CSTAT.indexOf(f.contract) : -1;
  const periodFilter = !f.allPeriods;
  const out = [];
  const sums = { gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 };
  const lo = srch?.range ? srch.range[0] : 0;
  const hi = srch?.range ? srch.range[1] : st.n;
  const D = ctx.D;
  const consider = (i) => {
    if (st.issue[i] > ctx.cutoffN) return;
    if (!inScope(st, sc, i)) return;
    if (periodFilter && (st.issue[i] < sc.fromN || st.issue[i] > sc.toN)) return;
    if (cs >= 0 && st.cstat[i] !== cs) return;
    if (cs === -2 && st.cstat[i] !== 2 && st.cstat[i] !== 4) return;
    if (f.exec && f.exec !== "all") {
      const lk = ctx.mark ? ctx.ov.get(i)?.link || 0 : 0;
      const ok = f.exec === "inexec" ? lk === 2 : f.exec === "suspended" ? lk === 3 : f.exec === "closed" ? lk === 4 : f.exec === "ever" ? lk >= 2 : f.exec === "none" ? lk < 2 : f.exec === "yes" ? st.exec[i] >= 0 || lk >= 2 : f.exec === "no" ? st.exec[i] < 0 && lk < 2 : true;
      if (!ok) return;
    }
    if (f.rule === "none" && st.exMask[i]) return;
    if (f.rule === "any" && !st.exMask[i]) return;
    if (ruleBit && !(st.exMask[i] & ruleBit)) return;
    derive(ctx, i, ctx.cutoffN);
    if (sc.statusSet && !sc.statusSet[D.cls]) return;
    if (stateIdx >= 0 && D.cls !== stateIdx) return;
    if (f.state === "open" && !(D.outstanding > 0)) return;
    if (f.state === "noncollected" && D.cls === CLASS_INDEX.collected) return;
    if (ageB >= 0 && !(D.outstanding > 0 && agingBucket(D.daysOverdue) === ageB)) return;
    if (f.ageMin != null && !(D.outstanding > 0 && !D.excluded && D.daysOverdue >= f.ageMin && D.daysOverdue <= f.ageMax)) return;
    if (f.tag) {
      const tg = tagsOf(st, i, D);
      if (f.tag === "problem" ? !tg.some((x) => PROBLEM_TAGS.has(x)) : !tg.includes(f.tag)) return;
    }
    out.push(i);
    sums.gross += D.gross;
    sums.exclusions += D.exclTotal;
    sums.net += D.net;
    sums.collected += D.collected;
    sums.outstanding += D.outstanding;
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
  return { ctx, sc, cand: Int32Array.from(out), sums };
}
function list(st, req) {
  const page = Math.max(0, Number(req.page) || 0);
  const size = Math.min(500, Math.max(1, Number(req.pageSize) || 50));
  const sortKey = SORT_KEYS[req.sort?.key] || "issue";
  const dir = req.sort?.dir === "asc" ? 1 : -1;
  const ck = JSON.stringify([epoch, req.scope, req.cfg, req.filters, req.decisions && hashOf(JSON.stringify(req.decisions)), req.links && hashOf(JSON.stringify(req.links)), req.owner, sortKey, dir]);
  let hit = lruGet(ck);
  if (!hit) {
    const { ctx: ctx2, cand, sums } = candidates(st, req);
    let order;
    if (sortKey === "id") {
      order = Int32Array.from(cand);
      if (dir < 0) order.reverse();
    } else {
      const keys = new Float64Array(cand.length);
      for (let j = 0; j < cand.length; j += 1) {
        const i = cand[j];
        if (sortKey === "issue") keys[j] = st.issue[i];
        else if (sortKey === "gross") keys[j] = st.gross[i];
        else {
          derive(ctx2, i, ctx2.cutoffN);
          keys[j] = sortKey === "outstanding" ? ctx2.D.outstanding : sortKey === "collected" ? ctx2.D.collected : ctx2.D.outstanding > 0 ? ctx2.D.daysOverdue : 0;
        }
      }
      const perm = new Uint32Array(cand.length);
      for (let j = 0; j < perm.length; j += 1) perm[j] = j;
      perm.sort((a, b) => (keys[a] - keys[b]) * dir || a - b);
      order = new Int32Array(cand.length);
      for (let j = 0; j < perm.length; j += 1) order[j] = cand[perm[j]];
    }
    hit = { order, sums, total: cand.length };
    lruSet(ck, hit);
  }
  const ctx = makeCtx(st, req);
  const rows = [];
  for (let j = page * size; j < Math.min(hit.total, (page + 1) * size); j += 1) {
    const i = hit.order[j];
    derive(ctx, i, ctx.cutoffN);
    const row = rowOut(st, ctx, i, ctx.D);
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
  return { total: hit.total, page, pageSize: size, sums: hit.sums, rows };
}
var EXPORT_COLUMNS = ["invoice_id", "sadad_no", "issue_date", "due_date", "amanah_en", "amanah_ar", "municipality_ar", "scope", "revenue_source", "supplying_system", "revenue_item", "amount_sar", "collected_sar", "outstanding_sar", "cancelled_sar", "excluded_sar", "exclusions_sar", "net_billed_sar", "uncollected_sar", "state", "status_tahseel_raw", "status_efaa_raw", "days_overdue", "contract_no", "exclusion_rules", "line_items", "demo_data"];
var q = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function* exportChunks(st, req, chunk = 4e3) {
  const { ctx, cand } = candidates(st, req);
  yield `\uFEFF# demo data: synthetic, inspired by the monthly reports \u2014 not the Ministry's actual data. Amounts are exact values in SAR
${EXPORT_COLUMNS.join(",")}
`;
  let buf = [];
  for (let j = 0; j < cand.length; j += 1) {
    const i = cand[j];
    derive(ctx, i, ctx.cutoffN);
    const r = rowOut(st, ctx, i, ctx.D);
    const sadad = i < st.nGen ? sadadOf(st.idKey[i]) : st.fixtures.get(i)?.sadadNo || "";
    buf.push([r.id, sadad, r.issueDate, r.dueDate, r.amanahEn, r.amanahAr, r.municipalityAr || "", r.scopeType, r.source, r.platform, r.itemEn, r.gross, r.collected, r.outstanding, r.cancelledAmount, r.exclusionAmount, r.exclusions, r.net, r.outstanding, r.cls, r.statusRawTahseel, r.statusRawEfaa || "", r.daysOverdue, r.contractNo || "", r.rules.join("|"), r.lines, "\u062A\u062C\u0631\u064A\u0628\u064A\u0629"].map(q).join(","));
    if (buf.length >= chunk) {
      yield `${buf.join("\n")}
`;
      buf = [];
    }
  }
  if (buf.length) yield `${buf.join("\n")}
`;
}
var ACT = { overdue: 1, partial: 0.85, linkage_unresolved: 0.5, ineligible_referral: 0.35, enforcement: 0.45, objection: 0.2, not_due: 0.1 };
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
    var top = pass === 1 ? new TopK(limit) : null;
    for (let i = 0; i < st.n; i += 1) {
      if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
      derive(ctx, i, ctx.cutoffN);
      if (!(D.outstanding > 0) || D.excluded || D.cls === CLASS_INDEX.collected) continue;
      if (req.category && req.category !== "all" && CLASSES[D.cls] !== req.category) continue;
      if (pass === 0) {
        total += 1;
        totalOut += D.outstanding;
        if (D.outstanding > maxAmt) maxAmt = D.outstanding;
        if (D.daysOverdue > maxAge) maxAge = D.daysOverdue;
        continue;
      }
      const ev = evidenceQuality(st, i, D);
      const act = ACT[CLASSES[D.cls]] ?? 0.3;
      top.push(i, W_.amount * (D.outstanding / maxAmt) + W_.aging * (D.daysOverdue / maxAge) + W_.actionability * act + W_.evidence * ev);
    }
    if (pass === 1) {
      const rows = top.sorted().map(([i, score]) => {
        derive(ctx, i, ctx.cutoffN);
        const r = rowOut(st, ctx, i, D);
        return { ...r, category: r.cls, actionability: ACT[r.cls] ?? 0.3, evidenceQuality: Math.round(evidenceQuality(st, i, D) * 100) / 100, score: Math.round(score * 1e3) / 1e3 };
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
  const top = new TopK(limit);
  const counts = {};
  let total = 0;
  const bump = (k) => {
    counts[k] = (counts[k] || 0) + 1;
  };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
    derive(ctx, i, ctx.cutoffN);
    const f = st.flags[i];
    let sev = 0;
    const codes = [];
    if (f & F.AMT_CONFLICT) {
      codes.push("amount_conflict");
      sev = 3;
    }
    if (D.pendingMask) {
      codes.push("exclusion_pending");
      sev = Math.max(sev, 2);
    }
    if (f & F.MISSING_ID) {
      codes.push("missing_fields");
      sev = Math.max(sev, 2);
    }
    if (st.src[i] === 0 && st.cstat[i] === 4) {
      codes.push("contract_unlinked");
      sev = Math.max(sev, 2);
    }
    if (st.src[i] === 0 && st.cstat[i] === 2) {
      codes.push("contract_unmatched");
      sev = Math.max(sev, 2);
    }
    if (D.link === 1) {
      codes.push("enforcement_candidate");
      sev = Math.max(sev, 2);
    }
    if (D.excluded && D.received > 0) {
      codes.push("receipts_on_excluded");
      sev = 3;
    }
    for (const c of codes) bump(c);
    if (sev && (!req.code || req.code === "all" || codes.includes(req.code))) {
      total += 1;
      top.push(i, sev * 1e12 + st.gross[i]);
    }
  }
  const rows = top.sorted().map(([i]) => {
    derive(ctx, i, ctx.cutoffN);
    return rowOut(st, ctx, i, D);
  });
  return { total, counts, rows };
}
var VALUE_ANOMALY_MULTIPLE = 10;
function risk(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const D = ctx.D;
  const limit = req.limit || 60;
  const sum = new Float64Array(ENTITIES.length * SOURCES.length);
  const cnt = new Float64Array(ENTITIES.length * SOURCES.length);
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i) || st.issue[i] < sc.fromN || st.issue[i] > sc.toN) continue;
    const g = st.ent[i] * SOURCES.length + st.src[i];
    sum[g] += st.gross[i];
    cnt[g] += 1;
  }
  const cat = { duplicate: { n: 0, amt: 0, top: new TopK(limit) }, struck_off_registry: { n: 0, amt: 0, top: new TopK(limit) }, deceased_person: { n: 0, amt: 0, top: new TopK(limit) }, value_anomaly: { n: 0, amt: 0, top: new TopK(limit) } };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i) || st.issue[i] < sc.fromN || st.issue[i] > sc.toN) continue;
    const f = st.flags[i];
    if (f & F.DUPLICATE_WF) {
      cat.duplicate.n += 1;
      cat.duplicate.amt += st.gross[i];
      cat.duplicate.top.push(i, 90);
    }
    const fx = i >= st.nGen ? st.fixtures.get(i) : null;
    if (fx?.debtorInvalid || fx?.invalidDebtor) {
      const c = fx.debtorInvalidReason === "deceased_person" ? "deceased_person" : "struck_off_registry";
      cat[c].n += 1;
      cat[c].amt += st.gross[i];
      cat[c].top.push(i, 85);
    } else if (st.crSt[i] === 2 || st.crSt[i] === 4) {
      derive(ctx, i, ctx.cutoffN);
      if (D.outstanding > 0) {
        cat.struck_off_registry.n += 1;
        cat.struck_off_registry.amt += st.gross[i];
        cat.struck_off_registry.top.push(i, 85);
      }
    }
    const g = st.ent[i] * SOURCES.length + st.src[i];
    if (cnt[g] >= 30) {
      const avg = (sum[g] - st.gross[i]) / (cnt[g] - 1);
      const ratio2 = avg > 0 ? st.gross[i] / avg : 0;
      if (ratio2 >= VALUE_ANOMALY_MULTIPLE) {
        cat.value_anomaly.n += 1;
        cat.value_anomaly.amt += st.gross[i];
        cat.value_anomaly.top.push(i, Math.min(99, 60 + (ratio2 - VALUE_ANOMALY_MULTIPLE) * 2));
      }
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(cat)) out[k] = { count: v.n, amount: v.amt, rows: v.top.sorted().map(([i, score]) => {
    derive(ctx, i, ctx.cutoffN);
    return { ...rowOut(st, ctx, i, D), score: Math.round(score) };
  }) };
  return { categories: out, valueAnomalyMultiple: VALUE_ANOMALY_MULTIPLE };
}

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
function cardOf(st, ctx, ct) {
  const D = ctx.D;
  const today = ctx.cutoffN;
  const schedule = ct.dues.map((d) => {
    const issueN = d.due - 10;
    if (d.inv < 0) return { no: d.no, dueDate: isoOf(d.due), amount: d.amount, remainingContractBalance: d.balance, invoiceNo: null, sadadNo: null, state: issueN <= today ? "unlinked" : "future", invoiced: false, collected: 0, outstanding: 0 };
    derive(ctx, d.inv, today);
    return { no: d.no, dueDate: isoOf(st.due[d.inv]), issueDate: isoOf(st.issue[d.inv]), amount: d.amount, remainingContractBalance: d.balance, invoiceNo: idOf(st, d.inv), sadadNo: sadadOf(st.idKey[d.inv]), invoiceIdx: d.inv, state: stateOf(D), invoiced: true, collected: D.collected, outstanding: D.outstanding, daysOverdue: D.daysOverdue };
  });
  const sum = (f) => schedule.reduce((s, x) => s + f(x), 0);
  const reqs = st.requests.filter((q2) => q2.contractIdx === ct.idx).map((q2) => {
    const ids = q2.identified.map((i) => idOf(st, i));
    return { enforceNum: q2.enforceNum, system: "sanad", amount: q2.amount, openedDate: isoOf(q2.openedDay), status: q2.status, contractNo: ct.contractNo, identifiedInvoices: ids, identified: ids.length > 0, crViewStatusRaw: CR_STATUS[ct.crSt], addedToNetUncollected: false, documents: [{ type: "\u0641\u0627\u062A\u0648\u0631\u0629", item: `\u0628\u0646\u062F \u0661 \u2014 ${payerName(ct.payer).ar}`, crNo: q2.crNo, method: METHOD[q2.method], confidence: q2.confidence }] };
  });
  const linkedDebt = reqs.reduce((s, q2) => s + q2.identifiedInvoices.reduce((t, id) => t + (schedule.find((x) => x.invoiceNo === id)?.outstanding || 0), 0), 0);
  const arrears = sum((x) => x.state === "overdue" || x.state === "partial" ? x.outstanding : 0);
  const notDue = sum((x) => x.state === "not_due" ? x.outstanding : 0);
  return {
    contractNo: ct.contractNo,
    idx: ct.idx,
    amanahEn: ENTITIES[ct.ent].en,
    amanahAr: ENTITIES[ct.ent].ar,
    municipalityKey: municipalityOf(ct.ent, ct.muni)?.key,
    municipalityAr: municipalityOf(ct.ent, ct.muni)?.ar,
    tenantAr: payerName(ct.payer).ar,
    tenantEn: payerName(ct.payer).en,
    itemKey: ITEMS[ct.item].key,
    itemAr: ITEMS[ct.item].ar,
    itemEn: ITEMS[ct.item].en,
    start: isoOf(ct.start),
    end: isoOf(ct.end),
    intervalMonths: ct.intervalMonths,
    status: ct.status,
    crNo: ct.crNo,
    crStatusRaw: CR_STATUS[ct.crSt] || null,
    annualValue: ct.annualValue,
    totalValue: ct.totalValue,
    schedule,
    invoiceIds: schedule.filter((x) => x.invoiced).map((x) => x.invoiceNo),
    // kept in the summary: which invoices belong to the contract (never inferred — taken from the contract's own schedule)
    totals: {
      contractValue: ct.totalValue,
      installments: schedule.length,
      invoiced: sum((x) => x.invoiced ? x.amount : 0),
      collected: sum((x) => x.collected),
      arrears,
      notDue,
      futureNotInvoiced: sum((x) => x.state === "future" ? x.amount : 0),
      netUncollected: arrears + notDue,
      dueToDate: sum((x) => x.dueDate <= ctx.cfg.cutoff ? x.amount : 0),
      remainingOfDue: sum((x) => x.invoiced && x.dueDate <= ctx.cfg.cutoff ? x.outstanding : 0),
      overdueInstallments: schedule.filter((x) => x.state === "overdue" || x.state === "partial").length,
      futureInstallments: schedule.filter((x) => x.state === "future").length,
      unlinkedInstallments: schedule.filter((x) => x.state === "unlinked").length
    },
    requests: reqs,
    execution: {
      amount: reqs.reduce((s, q2) => s + q2.amount, 0),
      linkedDebt,
      unidentifiedAmount: reqs.filter((q2) => !q2.identified).reduce((s, q2) => s + q2.amount, 0),
      invoicesIdentified: reqs.some((q2) => q2.identified),
      addedToNetUncollected: false,
      note: reqs.length && !reqs.some((q2) => q2.identified) ? { ar: "\u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u0639\u0642\u062F \u062F\u0648\u0646 \u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u2014 \u064A\u064F\u0639\u0631\u0636 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0642\u062F \u0648\u0644\u0627 \u064A\u064F\u0636\u0627\u0641 \u0625\u0644\u0649 \u0635\u0627\u0641\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u0635\u0644 \u0645\u0631\u0629 \u062B\u0627\u0646\u064A\u0629.", en: "Execution request is linked to the contract with no invoices identified \u2014 shown at contract level and not added to net uncollected again." } : reqs.length ? { ar: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0636\u0645\u0646 \u0637\u0644\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u062A\u0628\u0642\u0649 \u063A\u064A\u0631 \u0645\u062D\u0635\u0644\u0629 \u0648\u0644\u0627 \u062A\u064F\u062D\u062A\u0633\u0628 \u0645\u0631\u062A\u064A\u0646.", en: "Invoices identified in the request stay uncollected and are not counted twice." } : null
    },
    crChain: reqs.map((q2) => ({ sanadRequest: q2.enforceNum, document: `${q2.documents[0].type} \u2014 ${q2.documents[0].item}`, crNo: q2.crNo || ct.crNo, method: q2.documents[0].method, confidence: q2.documents[0].confidence, crViewStatusRaw: CR_STATUS[ct.crSt] || null }))
  };
}
function contractCards(st, req, { summary: summary2 = true } = {}) {
  const ctx = makeCtx(st, req);
  const allowed = req.scope?.org?.amanahKeys || req.scope?.orgKeys || null;
  const am = req.scope?.amanah;
  const picked = am && am !== "all" ? new Set([].concat(am)) : null;
  const out = [];
  for (const ct of st.contracts) {
    if (!ct) continue;
    if (allowed && !allowed.includes(ENTITIES[ct.ent].en)) continue;
    if (picked && !picked.has(ENTITIES[ct.ent].en)) continue;
    const c = cardOf(st, ctx, ct);
    if (summary2) {
      c.schedule = void 0;
    }
    out.push(c);
  }
  return out;
}
function contractCard(st, req, no) {
  const ctx = makeCtx(st, req);
  const ct = st.contracts.find((c) => c && c.contractNo === no);
  return ct ? cardOf(st, ctx, ct) : null;
}
function contractRollup(cards) {
  return {
    contracts: cards.length,
    multiPayment: cards.filter((c) => c.totals.installments > 1).length,
    arrears: cards.reduce((s, c) => s + c.totals.arrears, 0),
    notDue: cards.reduce((s, c) => s + c.totals.notDue, 0),
    futureNotInvoiced: cards.reduce((s, c) => s + c.totals.futureNotInvoiced, 0),
    executionAtContractLevel: cards.reduce((s, c) => s + (c.execution.invoicesIdentified ? 0 : c.execution.amount), 0)
  };
}
function sanadCases(st) {
  return st.requests.map((q2) => {
    const wl = q2.system === "white_lands";
    return {
      enforceNum: q2.enforceNum,
      system: q2.system || "sanad",
      amanahEn: ENTITIES[q2.ent].en,
      amount: q2.amount,
      openedDate: isoOf(q2.openedDay),
      contractNo: q2.contractNo || null,
      requestStatus: q2.status,
      // what the feed supplies for the order: the invoice references it carries (possibly none / incomplete / wrong), the debtor, and whether the order document can be fetched
      refs: q2.refs ? q2.refs.map((r) => ({ ...r })) : q2.identified.map((i) => ({ kind: "invoice_no", value: idOf(st, i) })),
      debtorIdx: q2.debtor ?? null,
      debtorName: q2.debtor != null ? payerName(q2.debtor) : null,
      debtorId: q2.debtor != null ? beneficiaryIdOf(q2.debtor) : null,
      closeReason: q2.status === "\u0645\u063A\u0644\u0642" ? q2.closeReason || null : null,
      orderDocument: { retrievable: false, reason: "sanad_document_integration_not_connected" },
      feed: "synthetic_demo",
      documents: wl ? [] : [{ type: "\u0641\u0627\u062A\u0648\u0631\u0629", item: "\u0628\u0646\u062F \u0661", crNo: q2.crNo, method: METHOD[q2.method], confidence: q2.confidence }],
      links: q2.identified.map((i) => ({ invoiceId: idOf(st, i), allocated: 0, gross: st.gross[i], origin: "sanad_structured", status: "confirmed", evidence: wl ? ["reference_match"] : ["contract_match", "reference_match"], reviewedBy: wl ? "White-lands enforcement file (demo feed)" : "Sanad structured reference (demo feed)", reviewedAt: isoOf(q2.openedDay) })),
      history: []
    };
  });
}

// server/misc.js
function meta(st, today) {
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
    if (st.owner[i] !== 0) continue;
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
  for (let p = 0; p < st.pn; p += 1) if (st.pDay[p] >= yN && st.pDay[p] <= todayN) pays += 1;
  return {
    today,
    timezone: "Asia/Riyadh",
    demo: true,
    label: { ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629", en: "Demo data" },
    labelDetail: { ar: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0645\u0633\u062A\u0648\u062D\u0627\u0629 \u0645\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629\u060C \u0648\u0644\u064A\u0633\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0639\u0644\u064A\u0629 \u0644\u0644\u0648\u0632\u0627\u0631\u0629.", en: "Synthetic data inspired by the monthly reports \u2014 not the Ministry's actual data." },
    counts: { invoicesTotal: all, invoicesYtd: ytd, invoicesPriorYear: prior, invoicesPriorSamePeriod: priorSamePeriod, lineItemsTotal: lines, lineItemsYtd: ytdLines, paymentsYtd: pays, paymentsTotal: st.pn, contracts: st.contracts.filter(Boolean).length, sanadRequests: st.requests.filter((r) => (r.system || "sanad") === "sanad").length, whiteLandsOrders: st.requests.filter((r) => r.system === "white_lands").length, fixtures: st.nGen < st.n ? st.n - st.nGen : 0 },
    period: { from: isoOf(dayNum(`${y}-01-01`)), to: today, priorFrom: isoOf(pyN), priorTo: isoOf(pyEnd), dataFrom: isoOf(Math.min(...[st.issue[0] || yN])) },
    size: st.meta.size || "full",
    sizeNote: st.meta.size === "compact" ? { ar: `\u0639\u064A\u0646\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0645\u0635\u063A\u0651\u0631\u0629: ${all.toLocaleString("en-US")} \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0628\u0645\u0628\u0627\u0644\u063A \u0643\u0628\u064A\u0631\u0629 \u062A\u062D\u0641\u0638 \u0625\u062C\u0645\u0627\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0634\u0647\u0631\u064A\u0629\u061B \u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0644\u0627 \u064A\u0645\u062B\u0644 \u0627\u0644\u062D\u062C\u0645 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0627\u0644\u0641\u0639\u0644\u064A.`, en: `Compact synthetic sample: ${all.toLocaleString("en-US")} synthetic invoices with large values that keep the monthly-report totals; the invoice count does not represent actual operational volume.` } : null,
    generation: st.meta
  };
}
function quality(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const D = ctx.D;
  const q2 = { records: 0, conflicts: 0, pending: 0, missing: 0, contractUnmatched: 0, contractConfirmedNone: 0, unassigned: 0, makeenMatched: 0, makeenUnmatched: 0, efaaDifferent: 0, efaaTotal: 0, centralInvoices: 0, internalInvoices: 0, lines: 0, investmentInvoices: 0, installmentsInvoiced: 0 };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    q2.records += 1;
    q2.lines += st.lines[i];
    if (st.scope[i] === 0) q2.centralInvoices += 1;
    else q2.internalInvoices += 1;
    if (st.flags[i] & F.AMT_CONFLICT) q2.conflicts += 1;
    if (st.flags[i] & F.MISSING_ID) q2.missing += 1;
    if (st.exMask[i] & ~st.exAppr[i]) q2.pending += 1;
    if (st.src[i] === 0) {
      q2.investmentInvoices += 1;
      if (st.cstat[i] === 2) q2.contractUnmatched += 1;
      if (st.cstat[i] === 3) q2.contractConfirmedNone += 1;
      if (st.contract[i] >= 0) q2.installmentsInvoiced += 1;
    }
    if (st.ent[i] === ENTITIES.length - 1) q2.unassigned += 1;
    if (st.scope[i] === 0 && i < st.nGen) {
      if (st.alink[i] === 2) q2.makeenUnmatched += 1;
      else q2.makeenMatched += 1;
    }
    if (st.efaa[i]) {
      q2.efaaTotal += 1;
      if (st.efaa[i] >= 3) q2.efaaDifferent += 1;
    }
  }
  const sanad = st.requests.filter((r) => (r.system || "sanad") === "sanad");
  const ocrLow = sanad.filter((r) => r.method === 1 && r.confidence < 0.8).length;
  const future = st.contracts.reduce((s, c) => s + (c ? c.dues.filter((d) => d.inv < 0 && d.due - 10 > ctx.cutoffN).length : 0), 0);
  return { ...q2, requests: sanad.length, requestsIdentified: sanad.filter((r) => r.identified.length).length, whiteLandsOrders: st.requests.length - sanad.length, ocrCrChains: sanad.filter((r) => r.method === 1).length, crChains: sanad.length, crChainsMatched: sanad.filter((r) => st.crView.has(r.crNo)).length, ocrLowConfidence: ocrLow, futureInstallments: future, crViewKnown: st.crView.size, void: D.gross };
}

// server/sourcesReport.js
var shiftYear = (iso, d) => `${Number(iso.slice(0, 4)) + d}${iso.slice(4)}`;
function sourcesReport(st, req = {}) {
  const ctx = makeCtx(st, req);
  const D = ctx.D;
  const today = ctx.cfg.cutoff;
  const y = today.slice(0, 4);
  const range = { ytd: [dayNum(`${y}-01-01`), ctx.cutoffN], prior: [dayNum(`${Number(y) - 1}-01-01`), dayNum(shiftYear(today, -1))] };
  const NS = SOURCES.length;
  const mk = () => ({ invoices: 0, lines: 0, payments: 0, gross: 0, grossCancelled: 0, wallet: 0, replacedPairs: 0, ownersMulti: 0, ext: [0, 0, 0, 0], objections: 0, billStatus: [0, 0, 0, 0], valuesDiffer: 0, paidOverGross: 0, amtConflict: 0, enforcement: 0, internal: 0, central: 0, items: {} });
  const acc = { ytd: Array.from({ length: NS }, mk), prior: Array.from({ length: NS }, mk), all: Array.from({ length: NS }, mk) };
  const checks = { idsStrictlyIncreasing: true, duplicateIds: 0, tobaccoPairsBroken: 0, whiteLandGroupsBroken: 0, groupShareNot100: 0, cancelledAndExcludedOverlap: 0 };
  let prevKey = -1;
  for (let i = 0; i < st.nGen; i += 1) {
    const k = st.idKey[i];
    if (k <= prevKey) {
      checks.idsStrictlyIncreasing = false;
      if (k === prevKey) checks.duplicateIds += 1;
    }
    prevKey = k;
    const s = st.src[i];
    const a = [acc.all[s]];
    const iss = st.issue[i];
    if (iss >= range.ytd[0] && iss <= range.ytd[1]) a.push(acc.ytd[s]);
    if (iss >= range.prior[0] && iss <= range.prior[1]) a.push(acc.prior[s]);
    derive(ctx, i, ctx.cutoffN);
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
      let sum = 0;
      let ok = true;
      for (let j = 1; j < n; j += 1) {
        const q2 = i + j;
        if (q2 >= st.nGen || grpOf(st.flags[q2]) !== (j === 1 ? GRP.WL_OWN2 : GRP.WL_OWN3) || st.issue[q2] !== st.issue[i]) ok = false;
        sum += q2 < st.nGen ? st.gross[q2] : 0;
      }
      if (!ok) checks.whiteLandGroupsBroken += 1;
      sum += st.gross[i];
      if (!(sum > 0)) checks.groupShareNot100 += 1;
    }
  }
  let fixturesYtd = 0;
  for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === 0 && st.issue[i] >= range.ytd[0] && st.issue[i] <= range.ytd[1]) fixturesYtd += 1;
  const sc = { from: `${y}-01-01`, to: today, amanah: "all", source: "all" };
  const scp = { from: `${Number(y) - 1}-01-01`, to: shiftYear(today, -1), amanah: "all", source: "all" };
  const sn = snapshot(st, { ...req, scope: sc, cfg: ctx.cfg });
  const sp = snapshot(st, { ...req, scope: scp, cfg: ctx.cfg });
  const fin = (snap) => Object.fromEntries(snap.bySource.map((g) => [g.key, { count: g.count, gross: g.gross, net: g.net, collected: g.collected, outstanding: g.outstanding, cancelled: g.cancelled, exclusions: g.exclusions, rate: g.collectedOverNet }]));
  const finY = fin(sn);
  const finP = fin(sp);
  const sumBy = (f, k) => Object.values(f).reduce((t, v) => t + v[k], 0);
  const totals = { ytd: sn.totals, prior: sp.totals };
  const reconcile = {
    ytdCountMatches: sumBy(finY, "count") === sn.totals.count,
    ytdGrossMatches: Math.abs(sumBy(finY, "gross") - sn.totals.gross) < 1,
    ytdCollectedMatches: Math.abs(sumBy(finY, "collected") - sn.totals.collected) < 1,
    ytdOutstandingMatches: Math.abs(sumBy(finY, "outstanding") - sn.totals.outstanding) < 1,
    priorCountMatches: sumBy(finP, "count") === sp.totals.count,
    priorGrossMatches: Math.abs(sumBy(finP, "gross") - sp.totals.gross) < 1,
    countByLoopMatchesSnapshot: acc.ytd.reduce((t, x) => t + x.invoices, 0) + fixturesYtd === sn.population.issuedInPeriod
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
  const enforcement = { whiteLandsOrders: st.requests.filter((q2) => q2.system === "white_lands").length, sanadRequests: st.requests.filter((q2) => (q2.system || "sanad") === "sanad").length };
  return { fixturesYtd, today, period: { from: sc.from, to: sc.to, priorFrom: scp.from, priorTo: scp.to }, sources, totals, reconcile, checks, enforcement, params: PARAMS, generatedAt: isoOf(ctx.cutoffN) };
}

// server/orderMatch.js
var FULL_ID = /^INV-(\d{4})-(\d{1,7})$/i;
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
function summary(st, ctx, i) {
  const D = derive(ctx, i, ctx.cutoffN);
  const exec = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
  const generated = i < st.nGen;
  return {
    invoiceId: idOf(st, i),
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
    contractNo: st.contract[i] >= 0 && st.contracts[st.contract[i]] ? st.contracts[st.contract[i]].contractNo : null,
    // only the contract the invoice itself carries — never inferred
    serverIdentifiedOrder: exec ? exec.enforceNum : null
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
    if (kind === "invoice_id_exact") {
      const i = lookupId(st, value);
      if (i >= 0) idx = [i];
    } else if (kind === "invoice_no") {
      let id = value.toUpperCase();
      const m = FULL_ID.exec(id);
      if (m && m[2].length < 7 && !st.fixtureById.has(id)) {
        id = `INV-${m[1]}-${m[2].padStart(7, "0")}`;
        normalized = id;
        weak = true;
      }
      const i = lookupId(st, id);
      if (i >= 0) idx = [i];
    } else if (kind === "invoice_serial") {
      const digits = value.replace(/\D/g, "");
      weak = true;
      if (digits) idx = serialIndex(st).get(Number(digits)) || [];
    } else if (kind === "sadad_no") {
      const key = idKeyFromSadad(value.replace(/\D/g, ""));
      const i = key == null ? -1 : lookupId(st, invoiceIdOf(key));
      if (i >= 0) idx = [i];
    } else if (kind === "violation_no") {
      const key = idKeyFromViolation(value.replace(/\D/g, ""));
      const i = key == null ? -1 : lookupId(st, invoiceIdOf(key));
      if (i >= 0) idx = [i];
    } else {
      out.push({ ref, status: "not_invoice_reference", weak: false, normalized: null, candidates: [] });
      continue;
    }
    idx = idx.filter((i) => i >= 0 && st.issue[i] <= ctx.cutoffN);
    out.push({ ref, status: idx.length === 0 ? "unmatched" : idx.length === 1 ? "matched" : "ambiguous", weak, normalized, candidates: idx.map((i) => summary(st, ctx, i)) });
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
    if (st.payer[i] !== debtor || st.issue[i] > ctx.cutoffN) continue;
    const s = summary(st, ctx, i);
    if (exclude.has(s.invoiceId) || !(s.outstanding > 0)) continue;
    out.push(s);
    if (out.length >= 30) break;
  }
  return { invoices: out };
}

// server/api.js
var memo = /* @__PURE__ */ new Map();
var MAX_MEMO = 60;
function memoize(key, fn) {
  if (memo.has(key)) {
    const v2 = memo.get(key);
    memo.delete(key);
    memo.set(key, v2);
    return v2;
  }
  const v = fn();
  memo.set(key, v);
  if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value);
  return v;
}
var epoch2 = 0;
var ownerOf = (sess) => {
  if (!sess) return 0;
  let h = 7;
  for (const ch of String(sess)) h = Math.imul(h, 31) + ch.charCodeAt(0) >>> 0;
  return 1 + h % 6e4;
};
function readBody(req) {
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
var send = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
};
var stable = (o) => JSON.stringify(o, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
async function handleApi(req, res) {
  const url = new URL(req.url, "http://x");
  const path2 = url.pathname.replace(/^\/api/, "") || "/";
  const hdr = (k) => {
    const v = req.headers[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const st = currentStore(hdr("x-demo-today") || url.searchParams.get("today"), hdr("x-demo-size") || url.searchParams.get("size"));
  const today = st.meta.today;
  const owner = ownerOf(hdr("x-session") || url.searchParams.get("session"));
  try {
    if (req.method === "GET" && path2 === "/meta") return send(res, 200, memoize(`meta|${today}|${epoch2}|${owner}`, () => meta(st, today)));
    if (req.method === "GET" && path2 === "/sanad-cases") return send(res, 200, { cases: memoize(`cases|${today}`, () => sanadCases(st)) });
    if (req.method === "GET" && path2 === "/export.csv") {
      const body2 = JSON.parse(url.searchParams.get("q") || "{}");
      body2.owner = owner;
      body2.cfg = { ...body2.cfg || {}, cutoff: today };
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="invoices-${today}.csv"`, "Cache-Control": "no-store" });
      const it = exportChunks(st, body2);
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
    if (req.method !== "POST") return send(res, 404, { error: "not_found" });
    const body = await readBody(req);
    body.owner = owner;
    body.cfg = { ...body.cfg || {}, cutoff: path2 === "/series" && body.asOf && body.asOf < today ? body.asOf : today };
    const key = (k) => `${k}|${today}|${epoch2}|${stable(body)}`;
    switch (path2) {
      case "/snapshot":
        return send(res, 200, memoize(key("snap"), () => snapshot(st, body)));
      case "/series":
        return send(res, 200, memoize(key("series"), () => series(st, body)));
      case "/bridge":
        return send(res, 200, memoize(key("bridge"), () => bridge(st, body)));
      case "/list":
        return send(res, 200, list(st, body));
      case "/worklist":
        return send(res, 200, memoize(key("wl"), () => worklist(st, body)));
      case "/anomalies":
        return send(res, 200, memoize(key("an"), () => anomalies(st, body)));
      case "/risk":
        return send(res, 200, memoize(key("risk"), () => risk(st, body)));
      case "/sources":
        return send(res, 200, memoize(key("src"), () => sourcesReport(st, body)));
      case "/quality":
        return send(res, 200, memoize(key("q"), () => quality(st, body)));
      case "/contracts":
        return send(res, 200, memoize(key("ct"), () => {
          const cards = contractCards(st, body);
          return { cards, rollup: contractRollup(cards) };
        }));
      case "/contract": {
        const c = contractCard(st, body, body.no);
        return c ? send(res, 200, c) : send(res, 404, { error: "contract_not_found" });
      }
      case "/invoice": {
        const i = lookupId(st, body.id);
        if (i < 0 || st.owner[i] !== 0 && st.owner[i] !== owner) return send(res, 404, { error: "invoice_not_found" });
        return send(res, 200, detail(st, i, makeCtx(st, body)));
      }
      case "/order-match":
        return send(res, 200, resolveReferences(st, body));
      case "/order-debtor-invoices":
        return send(res, 200, sameDebtorInvoices(st, body));
      case "/upload": {
        const recs = [];
        const duplicates = [];
        for (const r of body.records || []) {
          const ex = lookupId(st, r.id);
          if (ex >= 0 && (st.owner[ex] === 0 || st.owner[ex] === owner)) duplicates.push(r.id);
          else recs.push(r);
        }
        if (st.n + recs.length > st.cap || st.pn + recs.length * 3 > st.pcap) return send(res, 413, { error: "upload_capacity_exceeded" });
        for (const r of recs) appendRecord(st, r, { owner, kind: "upload" });
        epoch2 += 1;
        bumpEpoch();
        return send(res, 200, { ok: true, added: recs.length, duplicates });
      }
      case "/upload/clear": {
        let n = 0;
        for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === owner && owner !== 0) {
          st.owner[i] = 65535;
          n += 1;
        }
        epoch2 += 1;
        bumpEpoch();
        return send(res, 200, { ok: true, removed: n });
      }
      default:
        return send(res, 404, { error: "not_found" });
    }
  } catch (e) {
    console.error("[api]", path2, e);
    return send(res, 500, { error: "server_error", message: String(e.message || e) });
  }
}

// server/standalone.js
var here = path.dirname(fileURLToPath(import.meta.url));
var DIST = fs.existsSync(path.join(here, "..", "dist")) ? path.join(here, "..", "dist") : path.join(here, "dist");
var PORT = process.env.PORT || process.env._APP_PORT || 3e3;
var MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon", ".pdf": "application/pdf", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json" };
var sendFile = (res, filePath) => {
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": /\/assets\//.test(filePath) ? "public, max-age=31536000, immutable" : "no-cache" });
  fs.createReadStream(filePath).pipe(res);
};
var sendIndex = (res) => fs.readFile(path.join(DIST, "index.html"), (err, data) => {
  if (err) {
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
    const filePath = path.join(DIST, urlPath);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("Forbidden");
    }
    fs.stat(filePath, (err, stat) => !err && stat.isFile() ? sendFile(res, filePath) : sendIndex(res));
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
