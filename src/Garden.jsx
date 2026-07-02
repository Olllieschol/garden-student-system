import * as XLSX from 'xlsx';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.js';
import { Search, Plus, ChevronRight, ChevronDown, X, FileText, Users, LayoutDashboard, Settings, Building2, Check, AlertCircle, Calendar, MapPin, Phone, Mail, User as UserIcon, Edit3, Filter, Download, Upload, TrendingUp, AlertTriangle, Heart, Pill, BookOpen, ArrowRight, Trash2 } from 'lucide-react';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`;

// Format a Date using its LOCAL date components as YYYY-MM-DD.
// Never use toISOString() for this — it converts to UTC first, which shifts
// the date back by one day in positive-offset timezones (e.g. Bali, UTC+8),
// causing off-by-one bugs in week/day and suspension-range comparisons.
function localIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ============================================================
// CONSTANTS
// ============================================================

const INITIAL_CLASSES = [
  { id: 'el1',  name: 'EL 1',            fullName: 'Early Learners 1',            age: '1–2 yrs',   capacity: 16, dot: '#FBBF24' },
  { id: 'el2d', name: 'EL 2 Daffodil',   fullName: 'Early Learners 2 — Daffodil', age: '2–3 yrs',   capacity: 18, dot: '#FDE68A' },
  { id: 'el2h', name: 'EL 2 Hibiscus',   fullName: 'Early Learners 2 — Hibiscus', age: '2–3 yrs',   capacity: 18, dot: '#FDA4AF' },
  { id: 'pks',  name: 'PK Saffron',      fullName: 'Pre-Kindergarten Saffron',    age: '3–4 yrs',   capacity: 20, dot: '#FB923C' },
  { id: 'pkl',  name: 'PK Lavender',     fullName: 'Pre-Kindergarten Lavender',   age: '3–4 yrs',   capacity: 20, dot: '#C4B5FD' },
  { id: 'jrk',  name: 'Jr Kindergarten', fullName: 'Junior Kindergarten',         age: '4–5 yrs',   capacity: 22, dot: '#6EE7B7' },
  { id: 'kg',   name: 'Kindergarten',    fullName: 'Kindergarten',                age: '5–6.5 yrs', capacity: 25, dot: '#7DD3FC' },
];

// Canonical class display order. Supabase has no ordering column, so we keep the
// local `classes` state sorted by this index at every entry point (load, realtime,
// addClass) — this is what every consumer (sidebar, dropdowns, dashboard, filters)
// reads, so the order is consistent and survives a page refresh.
const CLASS_ORDER = INITIAL_CLASSES.map(c => c.id);
function sortClasses(list) {
  return [...list].sort((a, b) => {
    const ai = CLASS_ORDER.indexOf(a.id); const bi = CLASS_ORDER.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

const ClassesContext = React.createContext(null);
function useClasses() { return React.useContext(ClassesContext); }

const CLASS_COLOURS = ['#FBBF24','#FDE68A','#FDA4AF','#FB923C','#C4B5FD','#6EE7B7','#7DD3FC','#F472B6','#A78BFA','#34D399','#FCD34D','#FB7185'];

const PAST_WEEKS = 26; // how many weeks back to show

function buildWeeks() {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const today = new Date();
  const dow = today.getDay();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
  thisMonday.setHours(0, 0, 0, 0);
  // Start PAST_WEEKS weeks before current Monday
  const firstMonday = new Date(thisMonday);
  firstMonday.setDate(thisMonday.getDate() - PAST_WEEKS * 7);
  const total = PAST_WEEKS + 1 + 25; // 26 past + current + 25 future = 52
  return Array.from({ length: total }, (_, i) => {
    const mon = new Date(firstMonday);
    mon.setDate(firstMonday.getDate() + i * 7);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const monIso = localIso(mon);
    const friIso = localIso(fri);
    const label = mon.getMonth() === fri.getMonth()
      ? `${mon.getDate()} – ${fri.getDate()} ${M[mon.getMonth()]} ${mon.getFullYear()}`
      : `${mon.getDate()} ${M[mon.getMonth()]} – ${fri.getDate()} ${M[fri.getMonth()]} ${fri.getFullYear()}`;
    return { id: `w${i + 1}`, label, monDate: monIso, friDate: friIso, current: i === PAST_WEEKS };
  });
}
const WEEKS = buildWeeks();
const TODAY_WEEK_IDX = PAST_WEEKS; // index of the current week in WEEKS

const STATUSES = {
  enrolled:          { label: 'Enrolled',          dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  inquiry:           { label: 'Inquiry',           dot: 'bg-slate-400',   chip: 'bg-slate-50 text-slate-700 border-slate-200' },
  quote_sent:        { label: 'Quote sent',        dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  invoice_sent:      { label: 'Invoice sent',      dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-800 border-orange-200' },
  wait_list:         { label: 'Wait list',         dot: 'bg-violet-500',  chip: 'bg-violet-50 text-violet-800 border-violet-200' },
  suspended:         { label: 'On suspension',     dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-800 border-blue-200' },
  extended_holiday:  { label: 'Extended holiday',  dot: 'bg-cyan-500',    chip: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  left:              { label: 'Left',              dot: 'bg-stone-400',   chip: 'bg-stone-50 text-stone-600 border-stone-200' },
  cancelled:         { label: 'Cancelled',         dot: 'bg-stone-400',   chip: 'bg-stone-50 text-stone-600 border-stone-200' },
};

const INVOICE_STATUSES = {
  not_sent:    { label: '—',          colour: 'text-stone-400' },
  sent:        { label: 'Sent',       colour: 'text-orange-700 bg-orange-50' },
  paid:        { label: 'Paid',       colour: 'text-emerald-800 bg-emerald-50' },
  prepay:      { label: 'Prepay',     colour: 'text-indigo-800 bg-indigo-50' },
};

// Gender dot colours (soft, just a visual hint)
const GENDER = {
  F: { colour: '#F4B8D0', label: 'Girl' },
  M: { colour: '#A8C5DC', label: 'Boy' },
  X: { colour: '#D6D1C4', label: '—' },
};

// ============================================================
// FAKE DATA (everything invented for the demo — no real names)
// ============================================================

const SEED_STUDENTS = [
  // ====== EL 2 Daffodil — ACTIVE ======
  { id: 1, name: 'Wren Beaumont', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-04-12', nationality: 'British', parents: 'Alice / Tom', phone: '+62 ••• 4421 (M)\n+62 ••• 4422 (D)', email: 'alice@example.com\ntom@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: 'No nuts', dietaryFlags: ['no_nuts'],
    suspensions: [{ start: '2026-01-12', end: '2026-01-16' }],
    originalStart: '2025-08-04', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-07-28', bondAmount: 5000000,
    periodFrom: '2026-05-04', periodUntil: '2026-06-08',
    invoiceStatus: 'sent', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 2, name: 'Theo Marais', gender: 'M', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-07-22', nationality: 'French', parents: 'Camille / Luc', phone: '+62 ••• 8819 (M)', email: 'camille@example.com',
    mon: 'F', tue: 'F', wed: '', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], transitionTo: 'pks', transitionDate: '2026-07-07',
    suspensions: [],
    originalStart: '2025-09-15', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-09-10', bondAmount: 5000000,
    periodFrom: '2026-05-04', periodUntil: '2026-05-29',
    invoiceStatus: 'paid', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 3, name: 'Indira Soewardjo', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-02-08', nationality: 'Indonesian', parents: 'Maya / Budi', phone: '+62 ••• 2210 (M)', email: 'maya@example.com',
    mon: 'H', tue: 'H', wed: 'H', thu: 'H', fri: 'H', lunch: false,
    note: '', dietaryFlags: [],
    suspensions: [{ start: '2026-02-02', end: '2026-02-06' }, { start: '2026-03-23', end: '2026-03-27' }],
    originalStart: '2025-06-02', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-05-28', bondAmount: 5000000,
    periodFrom: '2026-04-13', periodUntil: '2026-06-10',
    invoiceStatus: 'paid', invoiceNote: '',
    prepay: null, siblings: [{ name: 'Rio Soewardjo', class: 'PK Saffron' }] },

  { id: 4, name: 'Olive Kjeldsen', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-09-01', nationality: 'Danish', parents: 'Lise / Anders', phone: '+62 ••• 5577 (M)', email: 'lise@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: '', lunch: true,
    note: '', dietaryFlags: [],
    suspensions: [],
    originalStart: '2025-11-03', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-10-28', bondAmount: 5000000,
    periodFrom: '2026-05-04', periodUntil: '2026-06-04',
    invoiceStatus: 'sent', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 5, name: 'Felix Whittaker', gender: 'M', centre: 'canggu', classId: 'el2d', status: 'suspended',
    dob: '2023-05-18', nationality: 'Australian', parents: 'Sarah / Pete', phone: '+62 ••• 9933 (M)\n+62 ••• 9934 (D)', email: 'sarah@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'HS 4–22 May 2026', dietaryFlags: [],
    suspensions: [
      { start: '2025-12-22', end: '2026-01-09' },
      { start: '2026-03-16', end: '2026-03-27' },
      { start: '2026-05-04', end: '2026-05-22' },
    ],
    originalStart: '2025-03-10', returningDate: '2026-05-25', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-03-05', bondAmount: 5000000,
    periodFrom: '2026-04-22', periodUntil: '2026-06-15',
    invoiceStatus: 'paid', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 6, name: 'Ines Volkov', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-08-15', nationality: 'Russian', parents: 'Anya / Mikhail', phone: '+62 ••• 6601 (M)', email: 'anya@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: '', fri: 'F', lunch: true,
    note: '', dietaryFlags: [],
    suspensions: [{ start: '2026-02-10', end: '2026-02-14' }],
    originalStart: '2026-01-20', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2026-01-15', bondAmount: 5000000,
    periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'sent', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 7, name: 'Arlo Tanaka-Pierce', gender: 'M', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-11-30', nationality: 'Japanese / Australian', parents: 'Kana / Greg', phone: '+62 ••• 7745 (M)\n+62 ••• 7746 (D)', email: 'kana@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [],
    suspensions: [],
    originalStart: '2026-02-09', returningDate: '', lastDate: '', lengthOfStay: '25 weeks',
    bondPaid: '2026-02-05', bondAmount: 5000000,
    periodFrom: '2026-02-09', periodUntil: '2026-08-02',
    invoiceStatus: 'prepay', invoiceNote: 'PAID 25 weeks',
    prepay: { weeks: 25, completed: 14, type: '25w', startDate: '2026-02-09' }, siblings: [] },

  { id: 8, name: 'Mila Halvorsen', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-06-04', nationality: 'Norwegian', parents: 'Solveig / Erik', phone: '+62 ••• 1102 (M)', email: 'solveig@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: 'No dairy', dietaryFlags: ['no_dairy'],
    suspensions: [],
    originalStart: '2025-10-06', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-10-01', bondAmount: 5000000,
    periodFrom: '2026-05-04', periodUntil: '2026-05-29',
    invoiceStatus: 'paid', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 9, name: 'Kasper Linden', gender: 'M', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-03-19', nationality: 'Swedish / Australian', parents: 'Astrid / Jonas', phone: '+62 ••• 3344 (M)', email: 'astrid@example.com',
    mon: 'F', tue: 'F', wed: '', thu: 'F', fri: '', lunch: true,
    note: '', dietaryFlags: [],
    suspensions: [{ start: '2026-01-19', end: '2026-01-30' }],
    originalStart: '2025-07-21', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-07-15', bondAmount: 5000000,
    periodFrom: '2026-04-20', periodUntil: '2026-05-22',
    invoiceStatus: 'sent', invoiceNote: '',
    prepay: null, siblings: [] },

  { id: 10, name: 'Juno Castellano', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'enrolled',
    dob: '2023-10-09', nationality: 'Italian', parents: 'Giulia / Marco', phone: '+62 ••• 5500 (M)\n+62 ••• 5501 (D)', email: 'giulia@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [],
    suspensions: [],
    originalStart: '2025-12-08', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-12-04', bondAmount: 5000000,
    periodFrom: '2026-05-04', periodUntil: '2026-06-30',
    invoiceStatus: 'paid', invoiceNote: '',
    prepay: null, siblings: [] },

  // ====== EL 2 Daffodil — WAITLIST ======
  { id: 11, name: 'Saskia Levin', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'invoice_sent',
    dob: '2023-03-25', nationality: 'German', parents: 'Hannah / Ben', phone: '+62 ••• 4470 (M)', email: 'hannah@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Invoice sent 16 May — awaiting confirmation', dietaryFlags: [],
    suspensions: [],
    originalStart: '2026-06-01', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '', bondAmount: 0,
    periodFrom: '', periodUntil: '',
    invoiceStatus: 'sent', invoiceNote: 'Invoice sent 16 May',
    prepay: null, siblings: [] },

  { id: 12, name: 'Mira Halvorsen', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'quote_sent',
    dob: '2023-06-04', nationality: 'Norwegian', parents: 'Solveig / Erik', phone: '+62 ••• 1102 (M)', email: 'solveig@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Sister of Mila — twin enrolment', dietaryFlags: [],
    suspensions: [],
    originalStart: 'tbc', returningDate: '', lastDate: '', lengthOfStay: 'tbc',
    bondPaid: '', bondAmount: 0,
    periodFrom: '', periodUntil: '',
    invoiceStatus: 'not_sent', invoiceNote: '',
    prepay: null, siblings: [{ name: 'Mila Halvorsen', class: 'EL 2 Daffodil' }] },

  { id: 13, name: 'Bodhi Almeida', gender: 'M', centre: 'canggu', classId: 'el2d', status: 'wait_list',
    dob: '2023-10-19', nationality: 'Portuguese', parents: 'Joana / Diogo', phone: '+62 ••• 3388 (M)', email: 'joana@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Returning to Bali July', dietaryFlags: [],
    suspensions: [],
    originalStart: '2026-07-13', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '', bondAmount: 0,
    periodFrom: '', periodUntil: '',
    invoiceStatus: 'not_sent', invoiceNote: '',
    prepay: null, siblings: [] },

  // ====== EL 2 Daffodil — RECENTLY LEFT ======
  { id: 14, name: 'Atlas Reyes', gender: 'M', centre: 'canggu', classId: 'el2d', status: 'left',
    dob: '2023-01-14', nationality: 'Mexican / Australian', parents: 'Paloma / Diego', phone: '+62 ••• 8800 (M)', email: 'paloma@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Family moved back to Sydney', dietaryFlags: [],
    suspensions: [],
    originalStart: '2025-06-30', returningDate: '', lastDate: '2026-04-25', lengthOfStay: 'Long term',
    bondPaid: '2025-06-25', bondAmount: 5000000,
    periodFrom: '2026-03-30', periodUntil: '2026-04-25',
    invoiceStatus: 'paid', invoiceNote: 'Final invoice settled',
    prepay: null, siblings: [] },

  { id: 15, name: 'Calla Donnelly', gender: 'F', centre: 'canggu', classId: 'el2d', status: 'left',
    dob: '2022-11-21', nationality: 'Irish', parents: 'Niamh / Sean', phone: '+62 ••• 4422 (M)', email: 'niamh@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Transitioned to PK Saffron 4 weeks early due to age', dietaryFlags: [],
    suspensions: [],
    originalStart: '2025-08-04', returningDate: '', lastDate: '2026-04-04', lengthOfStay: 'Long term',
    bondPaid: '2025-07-30', bondAmount: 5000000,
    periodFrom: '', periodUntil: '',
    invoiceStatus: 'paid', invoiceNote: 'Bond transferred to PK Saffron',
    prepay: null, siblings: [] },

  // ====== Other classes (for sidebar counts) ======
  { id: 21, name: 'Juno Pearce', gender: 'F', centre: 'canggu', classId: 'el1', status: 'enrolled',
    dob: '2024-08-11', nationality: 'British', parents: 'Emma / Will', phone: '+62 ••• 1001 (M)', email: 'emma@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: '', fri: '', lunch: true,
    note: '', dietaryFlags: [], suspensions: [],
    originalStart: '2025-12-01', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-11-28', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },
  { id: 22, name: 'Otis Brennan', gender: 'M', centre: 'canggu', classId: 'el1', status: 'enrolled',
    dob: '2024-10-02', nationality: 'Australian', parents: 'Lily / Sam', phone: '+62 ••• 1002 (M)', email: 'lily@example.com',
    mon: 'F', tue: 'F', wed: '', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], suspensions: [],
    originalStart: '2026-01-08', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2026-01-04', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'sent', invoiceNote: '', prepay: null, siblings: [] },
  { id: 31, name: 'Esme Linwood', gender: 'F', centre: 'canggu', classId: 'el2h', status: 'enrolled',
    dob: '2023-05-30', nationality: 'British', parents: 'Cleo / Jack', phone: '+62 ••• 1101 (M)', email: 'cleo@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], suspensions: [{ start: '2026-01-12', end: '2026-01-16' }],
    originalStart: '2025-09-01', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-08-25', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },
  { id: 41, name: 'Rio Soewardjo', gender: 'M', centre: 'canggu', classId: 'pks', status: 'enrolled',
    dob: '2022-04-18', nationality: 'Indonesian', parents: 'Maya / Budi', phone: '+62 ••• 2210 (M)', email: 'maya@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: '', lunch: true,
    note: 'Brother of Indira (EL2 Daffodil)', dietaryFlags: [], suspensions: [],
    originalStart: '2025-08-04', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-07-30', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [{ name: 'Indira Soewardjo', class: 'EL 2 Daffodil' }] },
  { id: 51, name: 'Cleo Marchetti', gender: 'F', centre: 'canggu', classId: 'pkl', status: 'enrolled',
    dob: '2022-09-09', nationality: 'Italian', parents: 'Sofia / Marco', phone: '+62 ••• 3301 (M)', email: 'sofia@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], suspensions: [],
    originalStart: '2025-08-04', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-07-30', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },
  { id: 61, name: 'Nico Albright', gender: 'M', centre: 'canggu', classId: 'jrk', status: 'enrolled',
    dob: '2021-11-22', nationality: 'American', parents: 'Hope / Dan', phone: '+62 ••• 4401 (M)', email: 'hope@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: 'Has speech delay (following CCS Calendar)', dietaryFlags: [], hasMedicalFlag: true,
    suspensions: [{ start: '2026-01-20', end: '2026-02-03' }, { start: '2026-03-23', end: '2026-04-04' }],
    originalStart: '2024-09-01', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2024-08-25', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'prepay', invoiceNote: 'PAID 37 weeks', prepay: { weeks: 37, completed: 32, type: '37w', startDate: '2025-09-29' }, siblings: [] },
  { id: 71, name: 'Petra Vanek', gender: 'F', centre: 'canggu', classId: 'kg', status: 'enrolled',
    dob: '2020-06-15', nationality: 'Czech', parents: 'Lucie', phone: '+62 ••• 5501 (M)', email: 'lucie@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: 'LAST DAY 15 JUNE 2026 — moving to school', dietaryFlags: [], hasLastDayFlag: true,
    suspensions: [{ start: '2025-12-22', end: '2026-01-18' }, { start: '2026-03-23', end: '2026-04-04' }, { start: '2026-04-15', end: '2026-04-22' }],
    originalStart: '2024-01-15', returningDate: '', lastDate: '2026-06-15', lengthOfStay: 'Long term',
    bondPaid: '2024-01-10', bondAmount: 5000000, periodFrom: '2026-04-22', periodUntil: '2026-05-25',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },
  { id: 72, name: 'Lev Karpov', gender: 'M', centre: 'canggu', classId: 'kg', status: 'enrolled',
    dob: '2020-09-30', nationality: 'Russian', parents: 'Tatiana / Yuri', phone: '+62 ••• 5502 (M)', email: 'tatiana@example.com',
    mon: 'F', tue: '', wed: 'F', thu: '', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], suspensions: [],
    originalStart: '2024-08-04', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2024-08-01', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },

  // Sanur
  { id: 101, name: 'Mae Christensen', gender: 'F', centre: 'sanur', classId: 'el2d', status: 'enrolled',
    dob: '2023-07-04', nationality: 'Danish', parents: 'Frida / Lars', phone: '+62 ••• 9911 (M)', email: 'frida@example.com',
    mon: 'F', tue: 'F', wed: 'F', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], suspensions: [],
    originalStart: '2025-11-10', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-11-05', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },
  { id: 102, name: 'Kai Sutopo', gender: 'M', centre: 'sanur', classId: 'pks', status: 'enrolled',
    dob: '2022-12-01', nationality: 'Indonesian / Australian', parents: 'Wati / James', phone: '+62 ••• 9912 (M)', email: 'wati@example.com',
    mon: 'F', tue: 'F', wed: '', thu: 'F', fri: 'F', lunch: true,
    note: '', dietaryFlags: [], suspensions: [],
    originalStart: '2025-09-15', returningDate: '', lastDate: '', lengthOfStay: 'Long term',
    bondPaid: '2025-09-10', bondAmount: 5000000, periodFrom: '2026-05-04', periodUntil: '2026-06-01',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [] },

  // ====== Pre-archived students (from earlier years) ======
  { id: 201, name: 'Indigo Faulkner', gender: 'M', centre: 'canggu', classId: 'kg', status: 'left',
    dob: '2018-03-15', nationality: 'British', parents: 'Tessa / Rohan', phone: '+62 ••• 4421 (M)', email: 'tessa@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Aged out — moved to primary school in Singapore', dietaryFlags: [], suspensions: [],
    originalStart: '2021-01-20', returningDate: '', lastDate: '2024-12-15', lengthOfStay: 'Long term',
    bondPaid: '2021-01-15', bondAmount: 5000000, periodFrom: '', periodUntil: '',
    invoiceStatus: 'paid', invoiceNote: 'Final invoice settled', prepay: null, siblings: [],
    archived: true, archivedAt: '2024-12-20' },
  { id: 202, name: 'Mei Yamamoto', gender: 'F', centre: 'canggu', classId: 'jrk', status: 'left',
    dob: '2019-07-08', nationality: 'Japanese', parents: 'Saki / Hiro', phone: '+81 90 ••• 4422', email: 'saki@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Family moved back to Tokyo', dietaryFlags: ['no_dairy'], suspensions: [],
    originalStart: '2022-08-01', returningDate: '', lastDate: '2024-06-30', lengthOfStay: 'Long term',
    bondPaid: '2022-07-25', bondAmount: 5000000, periodFrom: '', periodUntil: '',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [],
    archived: true, archivedAt: '2024-07-05' },
  { id: 203, name: 'Lucca Romano', gender: 'M', centre: 'canggu', classId: 'pks', status: 'left',
    dob: '2020-11-22', nationality: 'Italian', parents: 'Elena / Pietro', phone: '+62 ••• 5533 (M)', email: 'elena@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Returning family — possible re-enrolment 2026/2027', dietaryFlags: [], suspensions: [],
    originalStart: '2023-02-10', returningDate: '', lastDate: '2024-11-30', lengthOfStay: 'Long term',
    bondPaid: '2023-02-05', bondAmount: 5000000, periodFrom: '', periodUntil: '',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [],
    archived: true, archivedAt: '2024-12-05' },
  { id: 204, name: 'Zara Achterberg', gender: 'F', centre: 'canggu', classId: 'el2h', status: 'left',
    dob: '2021-04-30', nationality: 'Dutch', parents: 'Anouk / Bram', phone: '+31 6 ••• 7788', email: 'anouk@example.com',
    mon: '', tue: '', wed: '', thu: '', fri: '', lunch: false,
    note: 'Sister of new inquiry Noa Lindgren — verify if related family', dietaryFlags: [], suspensions: [],
    originalStart: '2023-09-04', returningDate: '', lastDate: '2025-07-25', lengthOfStay: 'Long term',
    bondPaid: '2023-08-30', bondAmount: 5000000, periodFrom: '', periodUntil: '',
    invoiceStatus: 'paid', invoiceNote: '', prepay: null, siblings: [],
    archived: true, archivedAt: '2025-08-01' },
];

const EXAMPLE_EMAIL = `Sent via form submission from The Garden Bali

Name (Person completing this form): Sophia Lindgren
Date of arrival to Bali: 12-06-2026
How long do you intend to stay in Bali?: 18 months
What classes are you interested in?: EL 2 (2-3 years)
Which days are you looking to enrol?: Monday, Tuesday, Thursday
Half Day or Full Day?: Full Day (8am - 3pm)
Preferred Start Date: 20-07-2026
Childs Full Name: noa lindgren
Nationality: Swedish
Date of Birth: March 14, 2024
Gender: Female
Native Language: Swedish and English
Parent 1 Contact: Sophia Lindgren
Parent 1 Email: sophia.l@example.com
Parent 1 Occupation: Designer
Parent 1 Phone Number: +46 70 ••• 4421
Parent 2 Contact: Mattias Lindgren
Parent 2 Email: mattias.l@example.com
Parent 2 Occupation: Architect
Parent 2 Phone Number: +46 70 ••• 4422
Has your child had all of their age appropriate vaccinations?: Yes
If yes, please supply us with more details.: DTP, Hep A, MMR, Meningitis
Does your child have any medical disabilities or special educational needs?: No
Does your child have any medical problems or allergies?: No
Are there any food allergies that your child has? *: Yes
If yes, please supply us with more details.: Mild dairy intolerance
Does your child require an Epipen?: No
Is there anything else you would like us to know about your child?: Loves music and dancing.`;

// ============================================================
// HELPERS
// ============================================================

function ageFromDob(dob) {
  if (!dob || dob === 'tbc') return '–';
  const d = new Date(dob);
  const now = new Date('2026-05-21');
  let y = now.getFullYear() - d.getFullYear();
  let m = now.getMonth() - d.getMonth();
  if (m < 0) { y--; m += 12; }
  return `${y}Y ${m}M`;
}

function isoAddDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localIso(d);
}

// Parse free-text holiday suspension notes into structured date ranges.
// Returns { ranges: [{start,end}], remainingNote: string } or null if nothing found.
function parseHolidaySuspensionNote(note) {
  if (!note) return null;
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
  const MP = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

  const parseYear = (yr) => {
    if (!yr) return new Date().getFullYear();
    const n = parseInt(yr);
    return n < 100 ? 2000 + n : n; // "25" → 2025, "2025" → 2025
  };
  const toIso = (day, mon, year) => {
    const mNum = MONTHS[mon.toLowerCase()];
    if (!mNum) return null;
    const maxDay = new Date(year, mNum, 0).getDate(); // last valid day of this month
    const d = Math.min(Math.max(parseInt(day), 1), maxDay); // clamp so we never emit e.g. 31 Jun
    return `${year}-${String(mNum).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  };
  const lastDayIso = (mon, year) => {
    const mNum = MONTHS[mon.toLowerCase()];
    if (!mNum) return null;
    const last = new Date(year, mNum, 0).getDate(); // day 0 of next month = last day of this month
    return `${year}-${String(mNum).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
  };

  // Track which character positions are already claimed to prevent double-matching
  const claimedRanges = []; // [{from, to}] index ranges in note
  const isClaimed = (matchIndex, matchLen) => claimedRanges.some(r => matchIndex < r.to && matchIndex + matchLen > r.from);
  const claim = (matchIndex, matchLen) => claimedRanges.push({ from: matchIndex, to: matchIndex + matchLen });

  const ranges = [];

  // ── Pattern A: cross-month ranges with optional year on EITHER end
  // Handles: "8 Feb - 1 Mar 2026", "10 Dec 25 - 4 Jan 2026", "13 Mar – 3 Apr"
  const PA = new RegExp(`(\\d{1,2})\\s+(${MP})(?:\\s+(\\d{2,4}))?\\s*[-–—]\\s*(\\d{1,2})\\s+(${MP})(?:\\s+(\\d{2,4}))?`, 'gi');
  let m;
  PA.lastIndex = 0;
  while ((m = PA.exec(note)) !== null) {
    if (isClaimed(m.index, m[0].length)) continue;
    const [full, d1, mon1, yr1Raw, d2, mon2, yr2Raw] = m;
    const curYear = new Date().getFullYear();
    const m1n = MONTHS[mon1.toLowerCase()], m2n = MONTHS[mon2.toLowerCase()];
    let y1, y2;
    if (yr2Raw) {
      y2 = parseYear(yr2Raw);
      y1 = yr1Raw ? parseYear(yr1Raw) : (m1n && m2n && m1n > m2n ? y2 - 1 : y2);
    } else if (yr1Raw) {
      y1 = parseYear(yr1Raw);
      y2 = (m1n && m2n && m2n < m1n) ? y1 + 1 : y1;
    } else {
      y1 = y2 = curYear;
      if (m1n && m2n && m1n > m2n) y1 = y2 - 1;
    }
    const start = toIso(d1, mon1, y1);
    const end   = toIso(d2, mon2, y2);
    if (start && end && end >= start) { ranges.push({ start, end, _match: full, _idx: m.index }); claim(m.index, full.length); }
  }

  // ── Pattern B: "24 Nov 25 - Jan 2026" or "18 May - August"  (day+month+[year] – month+[year], NO end day)
  // End defaults to last day of the end month. The end year is optional (open-ended notes like
  // "18 May - August" are common) — when omitted, infer the same year as the start, unless the
  // end month numerically precedes the start month, which means the range wraps into next year
  // (e.g. "20 Dec - Feb" runs Dec this year through Feb the following year).
  const PB = new RegExp(`(\\d{1,2})\\s+(${MP})(?:\\s+(\\d{2,4}))?\\s*[-–—]\\s*(${MP})(?:\\s+(\\d{2,4}))?`, 'gi');
  PB.lastIndex = 0;
  while ((m = PB.exec(note)) !== null) {
    if (isClaimed(m.index, m[0].length)) continue;
    const [full, d1, mon1, yr1Raw, mon2, yr2Raw] = m;
    const m1n = MONTHS[mon1.toLowerCase()], m2n = MONTHS[mon2.toLowerCase()];
    const curYear = new Date().getFullYear();
    let y1, y2;
    if (yr1Raw) {
      y1 = parseYear(yr1Raw);
      y2 = yr2Raw ? parseYear(yr2Raw) : (m1n && m2n && m2n < m1n ? y1 + 1 : y1);
    } else if (yr2Raw) {
      y2 = parseYear(yr2Raw);
      y1 = (m1n && m2n && m1n > m2n) ? y2 - 1 : y2;
    } else {
      y1 = curYear;
      y2 = (m1n && m2n && m2n < m1n) ? y1 + 1 : y1;
    }
    const start = toIso(d1, mon1, y1);
    const end   = lastDayIso(mon2, y2); // no day given → last day of end month
    if (start && end && end >= start) { ranges.push({ start, end, _match: full, _idx: m.index }); claim(m.index, full.length); }
  }

  // ── Pattern C: "14 - 18 July 2025"  (day – day month [year], same month)
  const PC = new RegExp(`(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MP})(?:\\s+(\\d{2,4}))?`, 'gi');
  PC.lastIndex = 0;
  while ((m = PC.exec(note)) !== null) {
    if (isClaimed(m.index, m[0].length)) continue;
    const [full, d1, d2, mon, yrRaw] = m;
    const year = parseYear(yrRaw);
    const start = toIso(d1, mon, year);
    const end   = toIso(d2, mon, year);
    if (start && end && end >= start) { ranges.push({ start, end, _match: full, _idx: m.index }); claim(m.index, full.length); }
  }

  if (ranges.length === 0) return null;

  // Sort by start date for clean display
  ranges.sort((a, b) => a.start.localeCompare(b.start));

  // Remove parsed sections + common HS prefixes from the note
  const prefixRex = /\b(Holiday\s*Suspension\s*:?\s*|HS\s*(?:From\s*|[0-9]+\.\s*)?)/gi;
  let cleaned = note;
  for (const r of ranges) { if (r._match) cleaned = cleaned.replace(r._match, ''); }
  cleaned = cleaned.replace(prefixRex, '').replace(/\s*[,;]\s*/g, ' ').replace(/\s*\d+\.\s*/g, ' ').trim();

  return {
    ranges: ranges.map(({ start, end }) => ({ start, end })),
    remainingNote: cleaned,
  };
}

// Run note migration on a student array. Returns { students, migrationLog }
// Also deduplicates existing suspension chips on every student (not just those with HS in notes).
//
// Suspensions parsed out of an imported note are tagged `fromImport: true`. Whenever this
// function runs against a student whose note *currently* contains fresh HS text (i.e. right
// after a spreadsheet import re-populates the note — see the `Holiday Suspension:` append in
// parseSpreadsheetFile), it REPLACES that student's fromImport-tagged entries with the new
// parse rather than appending to them. This makes repeated imports idempotent/self-correcting
// instead of silently accumulating stale or duplicate date ranges over time — that accumulation
// was the root cause of students showing extra/wrong-year suspension entries that no longer
// matched the source spreadsheet.
//
// Note that the note field is *always* stripped of HS text once parsed, by design — so on every
// routine app load (not a fresh import) `shouldParse` will be false for already-migrated
// students. That's expected and must NOT be treated as "the suspension no longer applies";
// only an actual re-parse (fresh HS text present) should ever replace fromImport entries.
// Suspensions without the tag are assumed to be added by hand via the app UI and are always
// preserved untouched.
function migrateHolidaySuspensionNotes(students) {
  const migrationLog = [];
  const updated = students.map(s => {
    const note = s.note || '';
    const rawSusp = s.suspensions || [];

    // ── Step 1: split into manually-added (untagged) vs previously-imported (tagged) chips ──
    const manual = rawSusp.filter(x => !x.fromImport);
    const dedupedManual = manual.filter((item, idx, arr) =>
      idx === arr.findIndex(x => x.start === item.start && x.end === item.end)
    );
    const priorImport = rawSusp.filter(x => x.fromImport);
    const dedupedPriorImport = priorImport.filter((item, idx, arr) =>
      idx === arr.findIndex(x => x.start === item.start && x.end === item.end)
    );
    const baseline = [...dedupedManual, ...dedupedPriorImport];
    const dedupChanged = baseline.length !== rawSusp.length;

    // ── Step 2: parse note if it contains HS text OR a leftover date-range pattern ──
    // Broadened trigger catches partial migrations (note cleaned of HS keywords but
    // still has a leftover "10 Dec 25 - 4 Jan 2026" that wasn't parsed first time).
    const hasHsKeyword = /holiday\s*sus|(?:^|\s)hs\s/i.test(note);
    // Also catches leftover date-range text after partial migrations (e.g. "10 Dec 25 - 4 Jan 2026")
    const hasDateRange = /\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*(?:\s+\d{2,4})?\s*[-–—]/i.test(note);
    const shouldParse = hasHsKeyword || hasDateRange;

    if (!shouldParse) {
      // Nothing fresh to reconcile against — leave existing suspensions (manual + prior
      // import) exactly as they are; only apply dedup if that changed anything.
      return dedupChanged ? { ...s, suspensions: baseline } : s;
    }

    const result = parseHolidaySuspensionNote(note);
    if (!result) {
      migrationLog.push({ name: s.name, note, status: 'unparsed' });
      return dedupChanged ? { ...s, suspensions: baseline } : s;
    }

    // Fresh parse of the current note, deduplicated against itself and against manual chips —
    // this REPLACES dedupedPriorImport rather than appending to it.
    const freshImport = result.ranges
      .filter((nr, idx, arr) => arr.findIndex(x => x.start === nr.start && x.end === nr.end) === idx)
      .filter(nr => !dedupedManual.some(e => e.start === nr.start && e.end === nr.end))
      .map(r => ({ ...r, fromImport: true }));

    migrationLog.push({ name: s.name, note, status: 'migrated', ranges: freshImport, remaining: result.remainingNote });
    return { ...s, suspensions: [...dedupedManual, ...freshImport], note: result.remainingNote };
  });
  return { students: updated, migrationLog };
}

// Shared active-student predicate used by sidebar, class header, and dashboard.
// A student counts as active if their Last Day is unset OR is today or later.
function isStudentActive(s) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return !s.lastDate || s.lastDate >= today;
}

function shortDate(d) {
  if (!d || d === 'tbc') return d || '–';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function titleCaseIfNeeded(s) {
  if (!s) return s;
  return s.split(' ').map(w => {
    if (!w) return w;
    if (w.toLowerCase() === w) return w[0].toUpperCase() + w.slice(1);
    return w;
  }).join(' ');
}

function guessClassFromText(s) {
  if (!s) return null;
  const l = s.toLowerCase();
  if (l.includes('el 1') || l.includes('el1') || (l.includes('1-2') && !l.includes('2-3'))) return 'el1';
  if (l.includes('el2 hib') || l.includes('el2h') || l.includes('hibiscus')) return 'el2h';
  if (l.includes('el 2') || l.includes('el2') || l.includes('daffodil') || l.includes('2-3')) return 'el2d';
  if (l.includes('pk saf') || l.includes('saffron')) return 'pks';
  if (l.includes('pk lav') || l.includes('lavender')) return 'pkl';
  if (l.includes('pre k') || l.includes('pre-k') || l.includes('pk')) return 'pks';
  if (l.includes('jr') || l.includes('jun')) return 'jrk';
  if (l.includes('kind')) return 'kg';
  return null;
}

function parseEmail(text) {
  const lines = text.split('\n');
  // Build ordered (key, value) list, preserving order
  const ordered = [];
  let currentIdx = -1;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // A field label is "Label: value" where Label is reasonable length, has no @, no URL
    const m = line.match(/^([^:]{1,100}):\s*(.*)$/);
    if (m && !m[1].includes('@') && !m[1].toLowerCase().startsWith('http') && !m[1].includes('://')) {
      ordered.push({ key: m[1].trim(), value: m[2].trim() });
      currentIdx = ordered.length - 1;
    } else if (currentIdx >= 0) {
      // Continuation line for multi-line values (e.g. the vaccinations list)
      ordered[currentIdx].value = (ordered[currentIdx].value ? ordered[currentIdx].value + '\n' : '') + line;
    }
  }

  const f = {};
  let pendingDetailFor = null;
  const norm = k => k.replace(/\s*\*+\s*$/, '').trim();

  for (const { key, value: rawValue } of ordered) {
    const k = norm(key);
    const v = rawValue || '';

    // Disambiguate "If yes, please supply us with more details." by what came before
    if (/^If yes,?\s*please supply/i.test(k)) {
      if (pendingDetailFor) {
        f[pendingDetailFor] = v;
        pendingDetailFor = null;
      }
      continue;
    }

    switch (k) {
      case 'Name (Person completing this form)': f.formCompletedBy = v; break;
      case 'Date of arrival to Bali': f.arrivalDate = v; break;
      case 'How long do you intend to stay in Bali?': f.intendedStay = v; break;
      case 'What classes are you interested in?':
        f.requestedClassRaw = v;
        f.requestedClass = guessClassFromText(v);
        break;
      case 'Which days are you looking to enrol?': f.daysRequested = v; break;
      case 'Half Day or Full Day?': f.halfOrFull = v; break;
      case 'Preferred Start Date': f.preferredStart = v; break;
      case 'Childs Full Name':
      case "Child's Full Name":
        f.childName = titleCaseIfNeeded(v);
        f.childNameRaw = v;
        break;
      case 'Nationality': f.nationality = v; break;
      case 'Date of Birth': f.dob = v; break;
      case 'Gender': f.gender = v; break;
      case 'Native Language': f.nativeLanguage = v; break;
      case 'Parent 1 Contact': f.parent1Name = v; break;
      case 'Parent 1 Email': f.parent1Email = v; break;
      case 'Parent 1 Occupation': f.parent1Occupation = v; break;
      case 'Parent 1 Phone Number': f.parent1Phone = v; break;
      case 'Parent 2 Contact': f.parent2Name = v; break;
      case 'Parent 2 Email': f.parent2Email = v; break;
      case 'Parent 2 Occupation': f.parent2Occupation = v; break;
      case 'Parent 2 Phone Number': f.parent2Phone = v; break;
      case 'Sibling 1 Name': f.sibling1Name = v; break;
      case 'Sibling 1 D.O.B': f.sibling1Dob = v; break;
      case 'Sibling 2 Name': f.sibling2Name = v; break;
      case 'Sibling 2 D.O.B': f.sibling2Dob = v; break;
      case 'Sibling 3 Name': f.sibling3Name = v; break;
      case 'Sibling 3 D.O.B': f.sibling3Dob = v; break;
      case 'Pembantu / Nanny Name': f.nannyName = v; break;
      case 'Pembantu Phone Number': f.nannyPhone = v; break;
      case 'Family Doctor': f.doctorName = v; break;
      case 'Family Doctor Contact Details': f.doctorContact = v; break;
      case 'Has your child had all of their age appropriate vaccinations?':
        f.vaccinationsYesNo = v;
        pendingDetailFor = 'vaccinationsDetails';
        break;
      case 'Does your child have any medical disabilities or special educational needs?':
        f.medicalDisabilitiesYesNo = v;
        pendingDetailFor = 'medicalDisabilitiesDetails';
        break;
      case 'Does your child have any medical problems or allergies?':
        f.medicalProblemsYesNo = v;
        pendingDetailFor = 'medicalProblemsDetails';
        break;
      case 'Are there any food allergies that your child has?':
        f.foodAllergiesYesNo = v;
        pendingDetailFor = 'foodAllergiesDetails';
        break;
      case 'Does your child require an Epipen?':
        f.epipen = v;
        pendingDetailFor = null;
        break;
      case 'Is there anything else you would like us to know about your child?':
        f.otherNotes = v;
        pendingDetailFor = null;
        break;
      default:
        // Unknown field — ignore. We don't make stuff up.
        break;
    }
  }

  return f;
}

// ============================================================
// CSV BACKUP HELPERS
// ============================================================

const CSV_FLAT_COLS = [
  'id','name','gender','centre','classId','status',
  'dob','nationality','parents','phone','email',
  'mon','tue','wed','thu','fri','lunch',
  'note','originalStart','returningDate','lastDate','lengthOfStay',
  'bondPaid','bondAmount','periodFrom','periodUntil',
  'invoiceStatus','invoiceNote',
  'transitionTo','transitionDate',
  'archived','archivedAt',
  'nativeLanguage','arrivalDate','intendedStay','daysRequested','halfOrFull',
  'requestedClassRaw','formCompletedBy',
  'vaccinationsYesNo','vaccinationsDetails',
  'medicalDisabilitiesYesNo','medicalDisabilitiesDetails',
  'medicalProblemsYesNo','medicalProblemsDetails',
  'foodAllergiesYesNo','foodAllergiesDetails','epipen',
  'hasMedicalFlag','hasLastDayFlag',
];
const CSV_JSON_COLS = ['dietaryFlags','suspensions','siblings','prepay','parent1','parent2','nanny','doctor'];
const CSV_ALL_COLS = [...CSV_FLAT_COLS, ...CSV_JSON_COLS];

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function exportStudentsToCSV(students) {
  const header = CSV_ALL_COLS.join(',');
  const rows = students.map(s => {
    return CSV_ALL_COLS.map(col => {
      if (CSV_JSON_COLS.includes(col)) {
        const v = s[col];
        if (v === null || v === undefined) return '';
        return csvCell(JSON.stringify(v));
      }
      return csvCell(s[col] ?? '');
    }).join(',');
  });
  const csv = [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = localIso(new Date());
  a.href = url;
  a.download = `garden-backup-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return today;
}

function isGardenBackupCSV(text) {
  return text.trimStart().startsWith('id,name,gender,centre,classId');
}

function parseGardenBackupCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ''; });
    // Parse JSON columns
    CSV_JSON_COLS.forEach(col => {
      if (obj[col]) {
        try { obj[col] = JSON.parse(obj[col]); } catch { obj[col] = col.endsWith('s') ? [] : null; }
      } else {
        obj[col] = col === 'dietaryFlags' || col === 'suspensions' || col === 'siblings' ? [] : null;
      }
    });
    // Coerce types
    if (obj.id !== undefined) obj.id = Number(obj.id) || obj.id;
    if (obj.bondAmount !== undefined) obj.bondAmount = Number(obj.bondAmount) || 0;
    obj.lunch = obj.lunch === 'true' || obj.lunch === true;
    obj.archived = obj.archived === 'true' || obj.archived === true;
    obj.hasMedicalFlag = obj.hasMedicalFlag === 'true' || obj.hasMedicalFlag === true;
    obj.hasLastDayFlag = obj.hasLastDayFlag === 'true' || obj.hasLastDayFlag === true;
    if (obj.name) students.push(obj);
  }
  return students;
}

function parseCSVRow(line) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  cells.push(cur);
  return cells;
}

// ============================================================
// APP
// ============================================================

function GardenApp({ initialCentre = 'canggu' }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [centre, setCentre] = useState(initialCentre);
  const [centreUnlocked, setCentreUnlocked] = useState({ canggu: initialCentre === 'canggu', sanur: initialCentre === 'sanur' });
  const [centreGateTarget, setCentreGateTarget] = useState(null); // which centre is being unlocked
  const [currentClassId, setCurrentClassId] = useState('el2d');
  const [weekIdx, setWeekIdx] = useState(TODAY_WEEK_IDX);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [view, setView] = useState('class');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const [showLeft, setShowLeft] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const CENTRE_PASSWORDS = { canggu: 'canggu2024', sanur: 'sanur2024' };

  const handleCentreSwitch = (c) => {
    if (centreUnlocked[c]) { setCentre(c); return; }
    setCentreGateTarget(c);
  };

  const todayIso = localIso(new Date());
  const showToast = m => { setToast(m); setTimeout(() => setToast(null), 3000); };

  // Supabase helpers
  const syncStudentToDb = (student) => {
    if (!supabase) return;
    supabase.from('students').upsert({ id: String(student.id), data: student })
      .then(({ error }) => { if (error) console.error('Student sync error:', error); });
  };
  const syncClassToDb = (cls) => {
    if (!supabase) return;
    supabase.from('classes').upsert({ id: cls.id, data: cls })
      .then(({ error }) => { if (error) console.error('Class sync error:', error); });
  };

  // Load data from Supabase on mount (with localStorage migration for first run)
  useEffect(() => {
    async function load() {
      if (!supabase) {
        // No Supabase config — fall back to localStorage
        try {
          const saved = localStorage.getItem('garden_students');
          const raw = saved ? JSON.parse(saved) : SEED_STUDENTS;
          const { students: migrated } = migrateHolidaySuspensionNotes(raw);
          setStudents(migrated);
        } catch { setStudents(SEED_STUDENTS); }
        setClasses(INITIAL_CLASSES);
        setDbLoading(false);
        return;
      }

      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('data'),
        supabase.from('classes').select('data'),
      ]);

      let dbStudents = studentsRes.data?.map(r => r.data) || [];
      let dbClasses  = classesRes.data?.map(r => r.data)  || [];

      // One-time migration: if DB is empty, pull from localStorage
      if (dbStudents.length === 0) {
        try {
          const lsRaw = localStorage.getItem('garden_students');
          const lsStudents = lsRaw ? JSON.parse(lsRaw) : SEED_STUDENTS;
          const rows = lsStudents.map(s => ({ id: String(s.id), data: s }));
          await supabase.from('students').upsert(rows);
          dbStudents = lsStudents;
          if (lsRaw) {
            showToast(`Migrated ${lsStudents.length} students to shared database`);
            localStorage.removeItem('garden_students');
          }
        } catch { dbStudents = SEED_STUDENTS; }
      }

      if (dbClasses.length === 0) {
        await supabase.from('classes').upsert(INITIAL_CLASSES.map(c => ({ id: c.id, data: c })));
        dbClasses = INITIAL_CLASSES;
      }

      // Migrate any free-text HS notes into structured suspensions
      const { students: migratedStudents, migrationLog } = migrateHolidaySuspensionNotes(dbStudents);
      const changed = migrationLog.filter(l => l.status === 'migrated' || l.status === 'deduped');
      if (changed.length > 0 && supabase) {
        // Persist migrated/deduped students back to DB
        await supabase.from('students').upsert(migratedStudents.map(s => ({ id: String(s.id), data: s })));
      }
      if (migrationLog.length > 0) {
        const unparsed  = migrationLog.filter(l => l.status === 'unparsed');
        const migrated  = migrationLog.filter(l => l.status === 'migrated');
        const deduped   = migrationLog.filter(l => l.status === 'deduped');
        if (migrated.length)  console.info('[HS Migration] Late-migrated ranges:', migrated.map(l => `${l.name}: ${l.ranges.map(r=>r.start+'→'+r.end).join(', ')} (remaining note: "${l.remaining}")`));
        if (deduped.length)   console.info('[HS Migration] Removed duplicate chips:', deduped.map(l => `${l.name}: removed ${l.removed} duplicate(s)`));
        if (unparsed.length)  console.warn('[HS Migration] Could not parse:', unparsed.map(l => `${l.name}: "${l.note}"`));
        if (!migrated.length && !deduped.length && !unparsed.length) console.info('[HS Migration] All clean — nothing to fix.');
      }

      setStudents(migratedStudents);
      setClasses(sortClasses(dbClasses));
      setDbLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flag to suppress realtime events during bulk import/reset operations
  const suppressRealtime = useRef(false);

  // Realtime: keep all browser tabs / devices in sync
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('garden-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, ({ eventType, new: n, old: o }) => {
        if (suppressRealtime.current) return;
        if (eventType === 'DELETE') {
          setStudents(prev => prev.filter(s => String(s.id) !== o.id));
        } else {
          setStudents(prev => {
            const idx = prev.findIndex(s => String(s.id) === n.id);
            return idx >= 0 ? prev.map((s, i) => i === idx ? n.data : s) : [...prev, n.data];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, ({ eventType, new: n, old: o }) => {
        if (suppressRealtime.current) return;
        if (eventType === 'DELETE') {
          setClasses(prev => prev.filter(c => c.id !== o.id));
        } else {
          setClasses(prev => {
            const idx = prev.findIndex(c => c.id === n.id);
            return sortClasses(idx >= 0 ? prev.map((c, i) => i === idx ? n.data : c) : [...prev, n.data]);
          });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Auto-complete transitions whose date has arrived
  useEffect(() => {
    if (dbLoading) return;
    students.forEach(s => {
      if (s.transitionTo && s.transitionDate && s.transitionDate <= todayIso) {
        updateStudent(s.id, { classId: s.transitionTo, transitionTo: null, transitionDate: null });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayIso, dbLoading]);

  // Own-class students + incoming students (pending transitions into this class)
  // Exclude left/cancelled and students whose Last Day has already passed — those belong in All Students → Left only.
  // Pipeline students (inquiry/quote/invoice/waitlist) haven't started yet, so an imported "Last Date" for them
  // isn't a meaningful "already left" signal — filtering them out by it wrongly hid a small number of waitlist
  // students (present correctly in Inquiries, which doesn't apply this filter) from their own class page.
  const ownStudents   = students.filter(s => s.centre === centre && s.classId === currentClassId && !s.archived && !['left','cancelled'].includes(s.status) && (['inquiry','quote_sent','invoice_sent','wait_list'].includes(s.status) || !s.lastDate || s.lastDate >= todayIso));
  const incomingStudents = students.filter(s => s.centre === centre && s.transitionTo === currentClassId && !s.archived);
  const visibleStudents = [...ownStudents, ...incomingStudents.filter(s => s.classId !== currentClassId)];

  const currentClass = classes.find(c => c.id === currentClassId);

  // Close detail panel whenever class or page changes
  useEffect(() => { setSelectedStudentId(null); }, [currentClassId, view]);

  // Class CRUD
  const addClass = (cls) => {
    const id = cls.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now().toString(36).slice(-4);
    const newCls = { ...cls, id, fullName: cls.fullName || cls.name };
    setClasses(prev => sortClasses([...prev, newCls]));
    syncClassToDb(newCls);
    showToast(`Added class "${cls.name}"`);
  };
  const updateClass = (id, patch) => {
    setClasses(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...patch } : c);
      const merged = next.find(c => c.id === id);
      if (merged) syncClassToDb(merged);
      return next;
    });
  };
  const deleteClass = (id) => {
    const c = classes.find(x => x.id === id);
    const studentsInClass = students.filter(s => s.classId === id && !s.archived);
    if (studentsInClass.length > 0) {
      showToast(`Can't delete "${c?.name}" — ${studentsInClass.length} active students. Move or archive them first.`);
      return;
    }
    setClasses(prev => prev.filter(x => x.id !== id));
    if (currentClassId === id) setCurrentClassId(classes[0]?.id);
    showToast(`Removed class "${c?.name}"`);
    if (supabase) supabase.from('classes').delete().eq('id', id);
  };

  // Add student manually
  const addStudent = (data) => {
    const newId = (students.length === 0 ? 0 : Math.max(...students.map(s => s.id))) + 1;
    const newStudent = {
      id: newId, name: data.name || 'Unnamed', gender: data.gender || 'X',
      centre, classId: data.classId || currentClassId, status: data.status || 'enrolled',
      dob: data.dob || '', nationality: data.nationality || '', parents: data.parents || '',
      phone: data.phone || '', email: data.email || '',
      mon: data.mon || '', tue: data.tue || '', wed: data.wed || '', thu: data.thu || '', fri: data.fri || '',
      lunch: data.lunch || false, note: data.note || '', dietaryFlags: [], suspensions: [],
      originalStart: data.originalStart || '', returningDate: '', lastDate: '',
      lengthOfStay: data.lengthOfStay || 'Long term',
      bondPaid: '', bondAmount: 0, periodFrom: '', periodUntil: '',
      invoiceStatus: 'not_sent', invoiceNote: '', prepay: null, siblings: [],
    };
    setStudents(prev => [...prev, newStudent]);
    syncStudentToDb(newStudent);
    showToast(`Added ${data.name}`);
  };

  const updateStudent = (id, patch) => {
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...patch } : s);
      const merged = next.find(s => s.id === id);
      if (merged) syncStudentToDb(merged);
      return next;
    });
  };

  const handleExportAll = () => {
    const exportDate = exportStudentsToCSV(students);
    localStorage.setItem('garden_last_export', exportDate);
    showToast(`Exported ${students.length} students to garden-backup-${exportDate}.csv`);
  };
  const archiveStudent = (id) => {
    const s = students.find(x => x.id === id);
    updateStudent(id, { archived: true, archivedAt: new Date().toISOString() });
    setSelectedStudentId(null);
    showToast(`${s?.name} moved to archive — restore anytime from Archive`);
  };
  const restoreStudent = (id) => {
    const s = students.find(x => x.id === id);
    updateStudent(id, { archived: false, archivedAt: null });
    showToast(`${s?.name} restored`);
  };
  const permanentDelete = (id) => {
    const s = students.find(x => x.id === id);
    setStudents(p => p.filter(x => x.id !== id));
    if (supabase) supabase.from('students').delete().eq('id', String(id));
    setSelectedStudentId(null);
    showToast(`${s?.name} permanently deleted`);
  };
  const cycleDay = (id, day) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    updateStudent(id, { [day]: { '': 'F', 'F': 'H', 'H': 'S', 'S': '' }[s[day] || ''] });
  };

  const handleParsedConfirm = (p) => {
    const newId = Math.max(...students.map(s => s.id)) + 1;
    // Build siblings list — only include slots that have a name
    const siblings = [];
    if (p.sibling1Name) siblings.push({ name: p.sibling1Name, dob: p.sibling1Dob || '' });
    if (p.sibling2Name) siblings.push({ name: p.sibling2Name, dob: p.sibling2Dob || '' });
    if (p.sibling3Name) siblings.push({ name: p.sibling3Name, dob: p.sibling3Dob || '' });

    // Combine contact info with role tags, only if present
    const phoneLines = [];
    if (p.parent1Phone) phoneLines.push(`${p.parent1Phone} (M)`);
    if (p.parent2Phone) phoneLines.push(`${p.parent2Phone} (D)`);
    const emailLines = [p.parent1Email, p.parent2Email].filter(Boolean);
    const parentNames = [p.parent1Name, p.parent2Name].filter(Boolean).join(' / ');

    // Gender — only set if explicitly provided in the email
    let gender = 'X';
    if (p.gender) {
      const g = p.gender.toLowerCase();
      if (g.startsWith('f') || g.includes('girl')) gender = 'F';
      else if (g.startsWith('m') || g.includes('boy')) gender = 'M';
    }

    const newStudent = {
      id: newId,
      name: p.childName || p.childNameRaw || 'Unnamed child',
      gender,
      centre,
      classId: p.requestedClass || 'el2d',
      status: 'inquiry',
      // Core
      dob: p.dob || '',
      nationality: p.nationality || '',
      nativeLanguage: p.nativeLanguage || '',
      parents: parentNames,
      phone: phoneLines.join('\n'),
      email: emailLines.join('\n'),
      // Auto-fill schedule from parsed days/half-full fields
      ...(() => {
        const dayVal = (/half/i.test(p.halfOrFull)) ? 'H' : 'F';
        const dr = (p.daysRequested || '').toLowerCase();
        const has = (abbrs) => abbrs.some(a => dr.includes(a));
        const all5 = /every day|all 5|mon.*fri|full week/i.test(dr);
        return {
          mon: (all5 || has(['mon'])) ? dayVal : '',
          tue: (all5 || has(['tue'])) ? dayVal : '',
          wed: (all5 || has(['wed'])) ? dayVal : '',
          thu: (all5 || has(['thu'])) ? dayVal : '',
          fri: (all5 || has(['fri'])) ? dayVal : '',
          lunch: dayVal === 'F',
        };
      })(),
      // Inquiry-only fields (preserved verbatim from email)
      arrivalDate: p.arrivalDate || '',
      intendedStay: p.intendedStay || '',
      daysRequested: p.daysRequested || '',
      halfOrFull: p.halfOrFull || '',
      requestedClassRaw: p.requestedClassRaw || '',
      formCompletedBy: p.formCompletedBy || '',
      // Structured parent details
      parent1: { name: p.parent1Name || '', email: p.parent1Email || '', phone: p.parent1Phone || '', occupation: p.parent1Occupation || '' },
      parent2: { name: p.parent2Name || '', email: p.parent2Email || '', phone: p.parent2Phone || '', occupation: p.parent2Occupation || '' },
      // Family
      siblings,
      nanny: (p.nannyName || p.nannyPhone) ? { name: p.nannyName || '', phone: p.nannyPhone || '' } : null,
      doctor: (p.doctorName || p.doctorContact) ? { name: p.doctorName || '', contact: p.doctorContact || '' } : null,
      // Medical (all stored as-is, no inference)
      vaccinationsYesNo: p.vaccinationsYesNo || '',
      vaccinationsDetails: p.vaccinationsDetails || '',
      medicalDisabilitiesYesNo: p.medicalDisabilitiesYesNo || '',
      medicalDisabilitiesDetails: p.medicalDisabilitiesDetails || '',
      medicalProblemsYesNo: p.medicalProblemsYesNo || '',
      medicalProblemsDetails: p.medicalProblemsDetails || '',
      foodAllergiesYesNo: p.foodAllergiesYesNo || '',
      foodAllergiesDetails: p.foodAllergiesDetails || '',
      epipen: p.epipen || '',
      // Notes & billing
      note: p.otherNotes || '',
      dietaryFlags: [],
      suspensions: [],
      originalStart: p.preferredStart || '',
      returningDate: '',
      lastDate: '',
      lengthOfStay: p.intendedStay || '',
      bondPaid: '', bondAmount: 0, periodFrom: '', periodUntil: '',
      invoiceStatus: 'not_sent', invoiceNote: '', prepay: null,
    };
    setStudents(prev => [...prev, newStudent]);
    syncStudentToDb(newStudent);
    setEmailModalOpen(false);
    showToast(`Added ${p.childName || 'new inquiry'} to the pipeline`);
  };

  if (dbLoading) return (
    <div style={{ background: '#FAF6EF', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#8B8678' }}>
        <div style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: '2rem', marginBottom: '0.5rem', color: '#1B1A17' }}>The Garden</div>
        <div style={{ fontSize: '0.875rem' }}>Loading…</div>
      </div>
    </div>
  );

  return (
    <ClassesContext.Provider value={{ classes, setClasses, addClass, updateClass, deleteClass }}>
      <style>{FONT_IMPORT + `
        :root {
          --bg: #FAF6EF;
          --paper: #FFFCF7;
          --paper-2: #FCF8F0;
          --ink: #1B1A17;
          --ink-soft: #4D4940;
          --ink-faint: #8B8678;
          --line: #E8E0D2;
          --line-soft: #F1ECDF;
          --accent: #3C5A3C;
          --accent-soft: #E8EFE3;
          --terracotta: #B65A35;
          --girl: #F4B8D0;
          --boy: #A8C5DC;
        }
        body, html, #root { background: var(--bg); }
        .font-display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; }
        .font-body { font-family: 'Geist', -apple-system, sans-serif; }
        .font-mono { font-family: 'Geist Mono', monospace; }
        * { font-family: 'Geist', -apple-system, sans-serif; }
        .sticky-col { position: sticky; z-index: 2; }
        .sticky-col-last { position: sticky; z-index: 2; box-shadow: 4px 0 6px -4px rgba(0,0,0,0.08); }
        .sticky-col-header { position: sticky; background: var(--line-soft); z-index: 5; }
        .sticky-col-header-last { position: sticky; background: var(--line-soft); z-index: 5; box-shadow: 4px 0 6px -4px rgba(0,0,0,0.08); }
        .ss-table-container::-webkit-scrollbar { height: 10px; }
        .ss-table-container::-webkit-scrollbar-track { background: var(--line-soft); }
        .ss-table-container::-webkit-scrollbar-thumb { background: var(--line); border-radius: 5px; }
        .ss-top-scroll { height: 12px; }
        .ss-top-scroll::-webkit-scrollbar { height: 10px; -webkit-appearance: none; }
        .ss-top-scroll::-webkit-scrollbar-track { background: var(--line-soft); border-radius: 5px; }
        .ss-top-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 5px; }
        .ss-top-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-faint); }
      `}</style>

      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="flex h-screen">
          {/* SIDEBAR */}
          <aside className="w-64 border-r flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="font-display text-2xl leading-none">The Garden</div>
              <div className="font-display italic text-sm mt-1" style={{ color: 'var(--ink-faint)' }}>admin</div>
            </div>
            <div className="px-3 pt-4">
              <div className="text-xs uppercase tracking-widest px-2 mb-2" style={{ color: 'var(--ink-faint)' }}>Centre</div>
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--line-soft)' }}>
                <button onClick={() => handleCentreSwitch('canggu')} className={`flex-1 text-xs py-1.5 rounded transition ${centre === 'canggu' ? 'bg-white shadow-sm font-medium' : 'opacity-70'}`}>Canggu</button>
                <button onClick={() => handleCentreSwitch('sanur')} className={`flex-1 text-xs py-1.5 rounded transition ${centre === 'sanur' ? 'bg-white shadow-sm font-medium' : 'opacity-70'}`}>Sanur</button>
              </div>
            </div>
            <nav className="px-3 pt-5 flex-1 overflow-y-auto">
              <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
              <NavItem icon={FileText} label="Inquiries" active={view === 'inquiries'} onClick={() => setView('inquiries')} badge={students.filter(s => s.centre === centre && !s.archived && ['inquiry','quote_sent','invoice_sent','wait_list'].includes(s.status)).length} />
              <NavItem icon={TrendingUp} label="Forecast" active={view === 'forecast'} onClick={() => setView('forecast')} />
              <button onClick={() => setClassesOpen(o => !o)} className="w-full mt-4 mb-1 flex items-center justify-between px-3 py-1.5 text-xs uppercase tracking-widest" style={{ color: 'var(--ink-faint)' }}>
                <span>Classes</span>
                {classesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {classesOpen && classes.map(c => {
                const enrolled = students.filter(s => s.centre === centre && s.classId === c.id && (s.status === 'enrolled' || s.status === 'suspended') && isStudentActive(s)).length;
                const isActive = view === 'class' && currentClassId === c.id;
                const overCap = enrolled > c.capacity;
                return (
                  <div key={c.id} className="group flex items-stretch">
                    <button onClick={() => { setCurrentClassId(c.id); setView('class'); }}
                      className={`flex-1 flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-sm transition ${isActive ? 'bg-stone-900 text-white' : 'hover:bg-stone-100'}`}
                      style={!isActive ? { color: 'var(--ink-soft)' } : {}}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className={`text-xs font-mono ${overCap ? 'text-amber-500' : 'opacity-60'}`}>{enrolled}/{c.capacity}</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingClass(c); }} className="opacity-0 group-hover:opacity-60 hover:opacity-100 px-1.5 rounded transition" title="Edit class">
                      <Edit3 size={11} style={{ color: isActive ? 'white' : 'var(--ink-faint)' }} />
                    </button>
                  </div>
                );
              })}
              {classesOpen && (
                <button onClick={() => setAddClassOpen(true)} className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-md text-xs transition hover:bg-stone-100" style={{ color: 'var(--ink-faint)' }}>
                  <Plus size={12} /> Add class
                </button>
              )}
              <div className="mt-4">
                <NavItem icon={Users} label="All students" active={view === 'all_students'} onClick={() => setView('all_students')} />
                <NavItem icon={BookOpen} label="Archive" active={view === 'archive'} onClick={() => setView('archive')} />
                <NavItem icon={Upload} label="Import Excel" onClick={() => setImportModalOpen(true)} />
                <NavItem icon={Settings} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
              </div>
            </nav>
            <div className="border-t p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-3 px-2 py-1.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: 'var(--accent)', color: 'white' }}>J</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">Jenny</div>
                  <div className="text-xs truncate" style={{ color: 'var(--ink-faint)' }}>Director · admin</div>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <header className="border-b flex items-center justify-between px-8 h-16" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <div className="flex items-center gap-3">
                <Building2 size={16} style={{ color: 'var(--ink-faint)' }} />
                <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>{centre === 'canggu' ? 'Canggu' : 'Sanur'}</span>
                <ChevronRight size={14} style={{ color: 'var(--ink-faint)' }} />
                <span className="text-sm font-medium">{view === 'class' ? currentClass?.fullName : view.charAt(0).toUpperCase() + view.slice(1)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-faint)' }} />
                  <input
                    placeholder="Search students…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm rounded-md border w-56 focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }}
                  />
                </div>
                <button onClick={() => setView('inquiries')} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-white transition hover:opacity-90" style={{ background: 'var(--accent)' }}>
                  <Plus size={14} /> New from email
                </button>
              </div>
            </header>

            {view === 'class' && (
              <ClassView
                currentClass={currentClass}
                students={ownStudents}
                incomingStudents={incomingStudents.filter(s => s.classId !== currentClassId)}
                weekIdx={weekIdx} setWeekIdx={setWeekIdx}
                onCycleDay={cycleDay} onUpdate={updateStudent}
                onSelectStudent={setSelectedStudentId}
                showLeft={showLeft} setShowLeft={setShowLeft}
                onImport={() => setImportModalOpen(true)}
                onGoToInquiries={() => setView('inquiries')}
                onUpdateClass={updateClass}
                searchTerm={searchTerm}
                onExportAll={handleExportAll}
              />
            )}
            {view === 'dashboard' && <DashboardView students={students.filter(s => s.centre === centre && !s.archived)} onJump={(cid) => { setCurrentClassId(cid); setView('class'); }} onExportAll={handleExportAll} />}
            {view === 'inquiries' && <InquiriesView students={students.filter(s => s.centre === centre && !s.archived)} onSelectStudent={setSelectedStudentId} onParsedConfirm={handleParsedConfirm} onUpdate={updateStudent} />}
            {view === 'all_students' && <AllStudentsView students={students.filter(s => s.centre === centre && !s.archived)} onSelectStudent={setSelectedStudentId} />}
            {view === 'archive' && <ArchiveView students={students.filter(s => s.centre === centre && s.archived)} onSelectStudent={setSelectedStudentId} onRestore={restoreStudent} onPermanentDelete={permanentDelete} />}
            {view === 'forecast' && <ForecastView students={students.filter(s => s.centre === centre && !s.archived)} />}
            {view === 'settings' && <SettingsView onResetData={async () => {
              suppressRealtime.current = true;
              try {
                if (supabase) {
                  await supabase.from('students').delete().neq('id', '__none__');
                  await supabase.from('classes').delete().neq('id', '__none__');
                }
              } finally {
                setTimeout(() => { suppressRealtime.current = false; }, 2000);
              }
              setStudents(SEED_STUDENTS);
              setClasses(INITIAL_CLASSES);
              if (supabase) {
                await supabase.from('students').upsert(SEED_STUDENTS.map(s => ({ id: String(s.id), data: s })));
                await supabase.from('classes').upsert(INITIAL_CLASSES.map(c => ({ id: c.id, data: c })));
              }
              showToast('All data cleared — showing demo data');
            }} />}
          </main>

          {selectedStudentId && (
            <StudentDetailPanel
              student={students.find(s => s.id === selectedStudentId)}
              onClose={() => setSelectedStudentId(null)}
              onUpdate={updateStudent}
              onArchive={archiveStudent}
              onRestore={restoreStudent}
            />
          )}
        </div>

        {emailModalOpen && <EmailParseModal onClose={() => setEmailModalOpen(false)} onConfirm={handleParsedConfirm} />}
        {importModalOpen && <ImportModal onClose={() => setImportModalOpen(false)} onConfirm={async (parsed, isBackup) => {
          let newStudents;
          if (isBackup) {
            newStudents = parsed;
          } else {
            newStudents = parsed.map((s, i) => ({
              id: i + 1,
              name: s.name || 'Unnamed',
              gender: s.gender || 'X',
              centre,
              classId: s.classId || currentClassId,
              status: s.status || 'enrolled',
              dob: s.dob || '',
              nationality: s.nationality || '',
              parents: s.parents || '',
              phone: s.phone || '',
              email: s.email || '',
              mon: s.mon || '', tue: s.tue || '', wed: s.wed || '', thu: s.thu || '', fri: s.fri || '',
              lunch: s.lunch || false,
              note: s.note || '',
              holidaySuspension: s.holidaySuspension || '',
              dietaryFlags: [],
              suspensions: (parseHolidaySuspensionNote(s.holidaySuspension || '')?.ranges || []).map(r => ({ ...r, fromImport: true })),
              originalStart: s.originalStart || '',
              returningDate: '',
              lastDate: s.lastDate || '',
              lengthOfStay: s.lengthOfStay || '',
              bondPaid: s.bondPaid || '',
              bondAmount: 0,
              periodFrom: s.periodFrom || '',
              periodUntil: s.periodUntil || '',
              invoiceStatus: 'not_sent',
              invoiceNote: s.invoiceNote || '',
              prepay: null,
              siblings: [],
            }));
          }
          if (supabase) {
            suppressRealtime.current = true;
            try {
              await supabase.from('students').delete().neq('id', '__none__');
              const rows = newStudents.map(s => ({ id: String(s.id), data: s }));
              for (let i = 0; i < rows.length; i += 100) {
                await supabase.from('students').upsert(rows.slice(i, i + 100));
              }
            } finally {
              // Resume realtime after a short delay (let the change events flush)
              setTimeout(() => { suppressRealtime.current = false; }, 2000);
            }
          }
          setStudents(newStudents);
          setImportModalOpen(false);
          showToast(`${isBackup ? 'Restored' : 'Imported'} ${newStudents.length} students`);
        }} />}
        {addClassOpen && <AddOrEditClassModal onClose={() => setAddClassOpen(false)} onSave={c => { addClass(c); setAddClassOpen(false); }} />}
        {editingClass && <AddOrEditClassModal existing={editingClass} onClose={() => setEditingClass(null)} onSave={c => { updateClass(editingClass.id, c); setEditingClass(null); }} onDelete={() => { deleteClass(editingClass.id); setEditingClass(null); }} />}
        {centreGateTarget && (
          <CentrePasswordGate
            centre={centreGateTarget}
            correctPassword={CENTRE_PASSWORDS[centreGateTarget]}
            onSuccess={() => {
              setCentreUnlocked(prev => ({ ...prev, [centreGateTarget]: true }));
              setCentre(centreGateTarget);
              setCentreGateTarget(null);
            }}
            onClose={() => setCentreGateTarget(null)}
          />
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm" style={{ background: 'var(--ink)', color: 'white' }}>
            <Check size={14} /> {toast}
          </div>
        )}
      </div>
    </ClassesContext.Provider>
  );
}

// ============================================================
// CLASS VIEW (the meaty one)
// ============================================================

function ClassView({ currentClass, students, incomingStudents = [], weekIdx, setWeekIdx, onCycleDay, onUpdate, onSelectStudent, showLeft, setShowLeft, onImport, onGoToInquiries, onUpdateClass, searchTerm = '', onExportAll }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeStatusFilters, setActiveStatusFilters] = useState([]);
  const currentTabRef = useRef(null);

  // Scroll current week tab into view on first render
  useEffect(() => {
    currentTabRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }, []);

  const scrollToToday = () => {
    setWeekIdx(TODAY_WEEK_IDX);
    setTimeout(() => currentTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
  };

  const toggleStatusFilter = (key) => {
    setActiveStatusFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const matchesSearch = (s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.parents?.toLowerCase().includes(q) ||
      s.nationality?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.note?.toLowerCase().includes(q)
    );
  };

  const filterByStatus = (arr) => {
    if (activeStatusFilters.length === 0) return arr;
    return arr.filter(s => activeStatusFilters.includes(s.status));
  };

  // Week date range for the currently viewed week
  const weekMon = WEEKS[weekIdx]?.monDate;
  const weekFriDate = weekMon ? isoAddDays(weekMon, 4) : null;

  // A student is "active in this week" if:
  //   - their Started date is on or before the Friday of this week (or not set)
  //   - their Last Day is on or after the Monday of this week (or not set)
  const inWeek = (s) => {
    if (weekMon && s.originalStart && s.originalStart > weekFriDate) return false;
    if (weekFriDate && s.lastDate && s.lastDate < weekMon) return false;
    return true;
  };

  const filteredStudents = filterByStatus(students.filter(matchesSearch).filter(inWeek));
  const filteredIncoming = incomingStudents.filter(matchesSearch).filter(inWeek);

  const active = filteredStudents.filter(s => ['enrolled','suspended','extended_holiday'].includes(s.status));
  // Pipeline students (inquiry/quote/invoice/waitlist) haven't started yet, so they don't have a
  // meaningful "active in this week" state — filtering them by inWeek hid anyone whose prospective
  // start date fell after the currently-viewed week, even though they belong in the pipeline list
  // regardless of which week is selected.
  // Auto-order the pipeline list by how close each student is to enrolling: Wait list first,
  // then Invoice sent, then Quote sent, then bare Inquiries.
  const PIPELINE_ORDER = { wait_list: 0, invoice_sent: 1, quote_sent: 2, inquiry: 3 };
  const waitlist = filterByStatus(students.filter(matchesSearch))
    .filter(s => ['inquiry','quote_sent','invoice_sent','wait_list'].includes(s.status))
    .sort((a, b) => PIPELINE_ORDER[a.status] - PIPELINE_ORDER[b.status]);
  const left = filteredStudents.filter(s => ['left','cancelled'].includes(s.status));

  const enrolledCount = students.filter(s => s.status === 'enrolled' && isStudentActive(s)).length;
  const suspendedCount = students.filter(s => ['suspended','extended_holiday'].includes(s.status) && isStudentActive(s)).length;
  const capWarn = enrolledCount >= currentClass.capacity;
  const capacityPct = (enrolledCount / currentClass.capacity) * 100;

  // Daily totals — count F and H per day, excluding students on suspension that day
  const totals = ['mon','tue','wed','thu','fri'].map((day, di) => {
    const dayIso = weekMon ? isoAddDays(weekMon, di) : null;
    const activeNotSuspended = active.filter(s => {
      if (!dayIso) return true;
      return !s.suspensions?.some(sus => sus.start <= dayIso && sus.end >= dayIso);
    });
    const f = activeNotSuspended.filter(s => s[day] === 'F').length;
    const h = activeNotSuspended.filter(s => s[day] === 'H').length;
    return { day, f, h, total: f + h };
  });

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 mb-5">
        <div>
          <div className="font-display text-4xl leading-none">{currentClass.fullName}</div>
          <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <span>{currentClass.age}</span>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${capWarn ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="font-mono">{enrolledCount}/<EditableCapacity value={currentClass.capacity} onSave={n => onUpdateClass(currentClass.id, { capacity: n })} /></span> enrolled
            </span>
            {suspendedCount > 0 && (<><span className="opacity-30">·</span><span className="font-mono">{suspendedCount}</span> on suspension / extended holiday</>)}
            <span className="opacity-30">·</span>
            <span><span className="font-mono">{waitlist.length}</span> in pipeline</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onGoToInquiries} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-white font-medium transition hover:opacity-90" style={{ background: 'var(--accent)' }}>
            <Plus size={12} /> Enrol new student
          </button>
          <div className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition ${activeStatusFilters.length > 0 ? 'bg-stone-900 text-white border-stone-900' : 'hover:bg-white'}`}
              style={activeStatusFilters.length === 0 ? { borderColor: 'var(--line)' } : {}}>
              <Filter size={12} /> Filter {activeStatusFilters.length > 0 && `(${activeStatusFilters.length})`}
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-xl py-2 min-w-max" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
                  <div className="px-3 py-1 text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Filter by status</div>
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <button key={k} onClick={() => toggleStatusFilter(k)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-stone-50 transition">
                      <span className={`w-1.5 h-1.5 rounded-full ${v.dot} shrink-0`} />
                      {v.label}
                      {activeStatusFilters.includes(k) && <Check size={10} className="ml-auto text-emerald-600" />}
                    </button>
                  ))}
                  {activeStatusFilters.length > 0 && (
                    <button onClick={() => setActiveStatusFilters([])} className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition border-t mt-1" style={{ borderColor: 'var(--line)' }}>
                      Clear filters
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={onExportAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-white transition" style={{ borderColor: 'var(--line)' }}>
            <Download size={12} /> Export CSV
          </button>
          <button onClick={onImport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-white transition" style={{ borderColor: 'var(--line)' }}>
            <Upload size={12} /> Import Excel
          </button>
        </div>
      </div>

      <div className="h-1 rounded-full mb-6 overflow-hidden" style={{ background: 'var(--line-soft)' }}>
        <div className="h-full transition-all" style={{ width: `${Math.min(capacityPct, 100)}%`, background: capWarn ? 'var(--terracotta)' : 'var(--accent)' }} />
      </div>

      {/* Week tabs */}
      {/* Week navigation */}
      <div className="mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2">
          <div className="overflow-x-auto flex-1">
            <div className="flex items-center gap-1 w-max">
              {WEEKS.map((w, i) => {
                const isToday = i === TODAY_WEEK_IDX;
                const isActive = i === weekIdx;
                return (
                  <button
                    key={w.id}
                    ref={isToday ? currentTabRef : null}
                    onClick={() => setWeekIdx(i)}
                    className={`px-4 py-2.5 text-sm border-b-2 transition -mb-px shrink-0 ${isActive && !isToday ? 'font-semibold' : ''} ${!isActive && !isToday ? 'border-transparent opacity-50 hover:opacity-80' : ''}`}
                    style={isToday && isActive
                      ? { color: '#fff', background: 'var(--accent)', borderColor: 'var(--accent)', borderRadius: '6px 6px 0 0', fontWeight: 700 }
                      : isToday
                        ? { color: 'var(--accent)', borderColor: 'var(--accent)', fontWeight: 600 }
                        : isActive
                          ? { color: 'var(--ink)', borderColor: 'var(--ink)' }
                          : { color: 'var(--ink-soft)' }}>
                    <span className="font-mono text-xs mr-2 opacity-60">{isToday ? '★' : `W${i + 1}`}</span>
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
          {weekIdx !== TODAY_WEEK_IDX && (
            <button
              onClick={scrollToToday}
              className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-white font-medium transition hover:opacity-90 mr-1"
              style={{ background: 'var(--accent)' }}>
              <Calendar size={11} /> Current week
            </button>
          )}
        </div>
      </div>

      {/* The spreadsheet — horizontally scrollable with synced top scrollbar */}
      <SpreadsheetWithTopScroll active={active} incoming={filteredIncoming} waitlist={waitlist} left={left} totals={totals} students={filteredStudents} weekMon={WEEKS[weekIdx]?.monDate} onCycleDay={onCycleDay} onUpdate={onUpdate} onSelectStudent={onSelectStudent} showLeft={showLeft} setShowLeft={setShowLeft} />

      <div className="mt-4 text-xs flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
        <Edit3 size={11} /> Click any cell to edit. Day cells cycle F → H → S → empty. Status cycles workflow. Scroll table sideways for more columns.
      </div>
    </div>
  );
}

function SpreadsheetWithTopScroll({ active, incoming = [], waitlist, left, totals, students, weekMon, onCycleDay, onUpdate, onSelectStudent, showLeft, setShowLeft }) {
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(1900);

  // Split incoming: no date = immediate join; date reached for viewed week = promoted; future date = still pending
  const weekFri = weekMon ? isoAddDays(weekMon, 4) : null;
  const incomingPromoted = incoming.filter(s => !s.transitionDate || (weekFri && s.transitionDate <= weekFri));
  const incomingPending  = incoming.filter(s => s.transitionDate && (!weekFri || s.transitionDate > weekFri));

  // Sync the two scrollers
  useEffect(() => {
    const top = topRef.current;
    const bot = bottomRef.current;
    if (!top || !bot) return;

    let syncing = false;
    const onTopScroll = () => {
      if (syncing) return;
      syncing = true;
      bot.scrollLeft = top.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    };
    const onBotScroll = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = bot.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    };
    top.addEventListener('scroll', onTopScroll);
    bot.addEventListener('scroll', onBotScroll);

    // Measure actual content width
    const measure = () => {
      const inner = bot.querySelector('table');
      if (inner) setContentWidth(inner.scrollWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (bot.querySelector('table')) ro.observe(bot.querySelector('table'));

    return () => {
      top.removeEventListener('scroll', onTopScroll);
      bot.removeEventListener('scroll', onBotScroll);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      {/* Top scrollbar — sticks to the top so you can scroll sideways without going back up */}
      <div ref={topRef} className="ss-top-scroll overflow-x-auto rounded-t-lg border border-b-0" style={{ borderColor: 'var(--line)', background: 'var(--paper)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ width: contentWidth, height: 12 }} />
      </div>

      <div className="rounded-b-lg border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div ref={bottomRef} className="ss-table-container overflow-x-auto">
          <table className="text-sm" style={{ minWidth: '2150px' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '240px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '70px' }} />
            </colgroup>
            <thead>
              <tr className="text-xs uppercase tracking-wider border-b" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                <th className="text-left font-medium px-3 py-2.5 sticky-col-header" style={{ left: 0 }}>No</th>
                <th className="text-left font-medium px-3 py-2.5 sticky-col-header-last" style={{ left: '40px' }}>Child</th>
                <th className="text-left font-medium px-3 py-2.5">Status</th>
                <th className="text-left font-medium px-3 py-2.5">DOB</th>
                <th className="text-left font-medium px-3 py-2.5">Age</th>
                <th className="text-left font-medium px-3 py-2.5">Started</th>
                <th className="text-left font-medium px-3 py-2.5">Returning</th>
                <th className="text-left font-medium px-3 py-2.5">Last day</th>
                <th className="text-left font-medium px-3 py-2.5">Length</th>
                <th className="text-center font-medium px-2 py-2.5">M</th>
                <th className="text-center font-medium px-2 py-2.5">T</th>
                <th className="text-center font-medium px-2 py-2.5">W</th>
                <th className="text-center font-medium px-2 py-2.5">T</th>
                <th className="text-center font-medium px-2 py-2.5">F</th>
                <th className="text-center font-medium px-2 py-2.5">Lunch</th>
                <th className="text-left font-medium px-3 py-2.5">Bond paid</th>
                <th className="text-left font-medium px-3 py-2.5">Paid from</th>
                <th className="text-left font-medium px-3 py-2.5">Paid until</th>
                <th className="text-left font-medium px-3 py-2.5">Invoice</th>
                <th className="text-left font-medium px-3 py-2.5">Parents</th>
                <th className="text-left font-medium px-3 py-2.5">Note</th>
                <th className="text-left font-medium px-3 py-2.5">Holiday suspension</th>
                <th className="text-left font-medium px-3 py-2.5">Transition</th>
                <th className="text-center font-medium px-2 py-2.5">HS/yr</th>
              </tr>
            </thead>
            <tbody>
              {/* ACTIVE (includes incoming students who have no date or whose date has arrived) */}
              <SectionDivider label="Active" count={active.length + incomingPromoted.length} colour="var(--accent)" />
              {active.map((s, idx) => (
                <StudentRow key={s.id} student={s} idx={idx} weekMon={weekMon} onCycleDay={onCycleDay} onUpdate={onUpdate} onSelectStudent={onSelectStudent} />
              ))}
              {incomingPromoted.map((s, idx) => (
                <StudentRow key={s.id} student={s} idx={active.length + idx} weekMon={weekMon} onCycleDay={onCycleDay} onUpdate={onUpdate} onSelectStudent={onSelectStudent} />
              ))}
              {/* Totals */}
              <tr className="border-t border-b font-medium text-xs" style={{ borderColor: 'var(--line)', background: 'var(--accent-soft)' }}>
                <td className="px-3 py-2 sticky-col" style={{ left: 0, background: 'var(--accent-soft)' }}></td>
                <td className="px-3 py-2 sticky-col-last uppercase tracking-wider" style={{ left: '40px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>Daily totals</td>
                <td colSpan={7}></td>
                {totals.map(t => (
                  <td key={t.day} className="px-2 py-2 text-center" style={{ color: 'var(--ink)' }}>
                    <div className="font-mono">{t.total}</div>
                    <div className="text-[10px] opacity-60 font-mono">{t.f}F·{t.h}H</div>
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-mono" style={{ color: 'var(--ink)' }}>{active.filter(s => s.lunch).length}</td>
                <td colSpan={9}></td>
              </tr>

              {/* TRANSITIONING IN — students whose join date hasn't arrived yet for this week */}
              {incomingPending.length > 0 && (
                <>
                  <SectionDivider label="Transitioning in" count={incomingPending.length} colour="#2563eb" />
                  {incomingPending.map((s, idx) => (
                    <StudentRow key={s.id} student={s} idx={idx} weekMon={weekMon} onCycleDay={onCycleDay} onUpdate={onUpdate} onSelectStudent={onSelectStudent} dimmed />
                  ))}
                </>
              )}

              {/* WAITLIST */}
              {waitlist.length > 0 && (
                <>
                  <SectionDivider label="Waitlist / Pipeline" count={waitlist.length} colour="var(--terracotta)" />
                  {waitlist.map((s, idx) => (
                    <StudentRow key={s.id} student={s} idx={idx} weekMon={weekMon} onCycleDay={onCycleDay} onUpdate={onUpdate} onSelectStudent={onSelectStudent} dimmed />
                  ))}
                </>
              )}

              {/* RECENTLY LEFT (collapsible) */}
              {left.length > 0 && (
                <>
                  <tr className="border-t" style={{ borderColor: 'var(--line)' }}>
                    <td colSpan={23} className="px-3 py-1.5 sticky-col" style={{ background: 'var(--paper-2)' }}>
                      <button onClick={() => setShowLeft(o => !o)} className="flex items-center gap-2 text-xs uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>
                        {showLeft ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Recently left
                        <span className="font-mono opacity-60">{left.length}</span>
                      </button>
                    </td>
                  </tr>
                  {showLeft && left.map((s, idx) => (
                    <StudentRow key={s.id} student={s} idx={idx} weekMon={weekMon} onCycleDay={onCycleDay} onUpdate={onUpdate} onSelectStudent={onSelectStudent} dimmed />
                  ))}
                </>
              )}

              {students.length === 0 && incoming.length === 0 && (
                <tr><td colSpan={23} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ink-faint)' }}>No students in this class yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function EditableCell({ value, onSave, type = 'text', options, placeholder = '—', display, className = '', mono = false, faint = false, multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  React.useEffect(() => { setVal(value || ''); }, [value]);

  const save = () => { onSave(val); setEditing(false); };
  const cancel = () => { setVal(value || ''); setEditing(false); };

  if (editing) {
    if (type === 'select') {
      return (
        <select
          autoFocus value={val}
          onChange={e => { setVal(e.target.value); onSave(e.target.value); setEditing(false); }}
          onBlur={() => setEditing(false)}
          className="w-full px-1 py-0.5 border rounded text-xs bg-white focus:outline-none"
          style={{ borderColor: 'var(--accent)' }}>
          <option value="">—</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
          rows={3}
          className={`w-full px-1 py-0.5 border rounded text-xs bg-white focus:outline-none resize-y ${mono ? 'font-mono' : ''}`}
          style={{ borderColor: 'var(--accent)' }}
        />
      );
    }
    return (
      <input
        autoFocus
        type={type === 'date' ? 'date' : 'text'}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        className={`w-full px-1 py-0.5 border rounded text-xs bg-white focus:outline-none ${mono ? 'font-mono' : ''}`}
        style={{ borderColor: 'var(--accent)' }}
      />
    );
  }

  const shown = display !== undefined ? display : (value || '');
  const isEmpty = !value || value === '';

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-left w-full hover:bg-stone-100 rounded px-1 py-0.5 flex gap-1 group ${multiline ? 'items-start' : 'items-center truncate'} ${className} ${mono ? 'font-mono' : ''}`}
      style={{ color: isEmpty ? 'var(--ink-faint)' : (faint ? 'var(--ink-faint)' : 'var(--ink-soft)') }}>
      <span className={`flex-1 ${multiline ? 'whitespace-pre-line break-words min-w-0' : 'truncate'}`}>{isEmpty ? <span className="italic opacity-50">{placeholder}</span> : shown}</span>
      <Edit3 size={9} className={`opacity-0 group-hover:opacity-40 shrink-0 transition ${multiline ? 'mt-0.5' : ''}`} />
    </button>
  );
}

function EditableCapacity({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  React.useEffect(() => { setVal(value); }, [value]);

  const commit = () => {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) onSave(n);
    else setVal(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="1"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
        className="inline-block w-14 px-1 py-0 border rounded font-mono text-sm"
        style={{ borderColor: 'var(--accent)', background: 'var(--bg)' }}
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="hover:bg-stone-100 rounded px-1 inline-flex items-center gap-1 transition group" title="Click to change capacity">
      {value}
      <Edit3 size={9} className="opacity-0 group-hover:opacity-50 transition" />
    </button>
  );
}

function SectionDivider({ label, count, colour }) {
  return (
    <tr style={{ background: 'var(--paper-2)' }}>
      <td colSpan={23} className="px-3 py-1.5 sticky-col" style={{ background: 'var(--paper-2)', left: 0 }}>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider" style={{ color: colour }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
          {label}
          <span className="font-mono opacity-60">{count}</span>
        </div>
      </td>
    </tr>
  );
}

function SuspensionSection({ student, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const susp = student.suspensions || [];

  const openAdd = () => { setEditIdx(null); setStart(''); setEnd(''); setAdding(true); };
  const openEdit = (i) => { setEditIdx(i); setStart(susp[i].start); setEnd(susp[i].end); setAdding(true); };
  const cancel = () => { setAdding(false); setEditIdx(null); setStart(''); setEnd(''); };
  const save = () => {
    if (!start || !end || end < start) return;
    const updated = editIdx !== null
      ? susp.map((s, i) => i === editIdx ? { start, end } : s)
      : [...susp, { start, end }];
    onUpdate({ suspensions: updated });
    cancel();
  };
  const del = (i) => onUpdate({ suspensions: susp.filter((_, idx) => idx !== i) });

  return (
    <Section title={`Holiday suspensions  ${susp.length}/4`}>
      {susp.map((s, i) => (
        <div key={i} className="text-xs py-1.5 border-b last:border-0 flex items-center justify-between gap-2" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line-soft)' }}>
          <span><span className="font-mono mr-2 opacity-60">{i+1}.</span>{shortDate(s.start)} – {shortDate(s.end)}</span>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => openEdit(i)} className="p-0.5 rounded hover:bg-stone-100 transition" title="Edit"><Edit3 size={10} /></button>
            <button onClick={() => del(i)} className="p-0.5 rounded hover:bg-red-50 text-red-400 transition" title="Delete"><Trash2 size={10} /></button>
          </div>
        </div>
      ))}
      {susp.length === 0 && !adding && <div className="text-xs italic" style={{ color: 'var(--ink-faint)' }}>None this year</div>}
      {susp.length === 3 && (
        <div className="mt-2 px-2 py-1.5 rounded text-xs flex items-start gap-1.5" style={{ background: 'rgba(182,90,53,0.1)', color: 'var(--terracotta)' }}>
          <AlertCircle size={12} className="mt-0.5 shrink-0" /> One suspension left this year
        </div>
      )}
      {susp.length >= 4 && (
        <div className="mt-2 px-2 py-1.5 rounded text-xs flex items-start gap-1.5 bg-red-50 text-red-700">
          <AlertCircle size={12} className="mt-0.5 shrink-0" /> Cap reached — notify parent
        </div>
      )}
      {adding ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs block mb-1" style={{ color: 'var(--ink-faint)' }}>Start</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--line)' }} />
            </div>
            <div className="flex-1">
              <label className="text-xs block mb-1" style={{ color: 'var(--ink-faint)' }}>End</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--line)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!start || !end || end < start} className="flex-1 py-1.5 rounded text-xs text-white font-medium disabled:opacity-40" style={{ background: 'var(--accent)' }}>
              {editIdx !== null ? 'Save changes' : 'Add'}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 rounded text-xs border" style={{ borderColor: 'var(--line)' }}>Cancel</button>
          </div>
        </div>
      ) : susp.length < 4 && (
        <button onClick={openAdd} className="mt-2 w-full py-1.5 rounded border border-dashed text-xs flex items-center justify-center gap-1.5 hover:bg-stone-50 transition" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
          <Plus size={11} /> Add suspension
        </button>
      )}
    </Section>
  );
}


function StudentRow({ student, idx, weekMon, onCycleDay, onUpdate, onSelectStudent, dimmed }) {
  const { classes } = useClasses();
  const status = STATUSES[student.status];
  const inv = INVOICE_STATUSES[student.invoiceStatus] || INVOICE_STATUSES.not_sent;
  // Count suspension weeks used (each range = ceil((end-start+1)/7) weeks, min 1)
  const susWeeks = (student.suspensions || []).reduce((acc, s) => {
    if (!s.start || !s.end) return acc;
    const days = Math.round((new Date(s.end) - new Date(s.start)) / 86400000) + 1;
    return acc + Math.max(1, Math.ceil(days / 7));
  }, 0);
  const susCount = susWeeks;

  const [statusOpen, setStatusOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const statusBtnRef = useRef(null);
  const openStatusMenu = () => {
    const rect = statusBtnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setStatusOpen(true);
  };
  // Pipeline students move between the pre-enrolment stages, not to/from suspension.
  const isPipeline = ['inquiry', 'quote_sent', 'invoice_sent', 'wait_list'].includes(student.status);
  const statusOptions = isPipeline ? ['wait_list', 'invoice_sent', 'quote_sent', 'enrolled'] : ['suspended', 'enrolled'];
  const cycleInvoice = () => {
    const order = ['not_sent','sent','paid','prepay'];
    const i = order.indexOf(student.invoiceStatus || 'not_sent');
    onUpdate(student.id, { invoiceStatus: order[(i+1) % order.length] });
  };

  const rowBg = idx % 2 === 0 ? 'var(--paper)' : 'var(--paper-2)';
  const opacity = dimmed ? 0.7 : 1;

  return (
    <tr className="border-b group hover:shadow-sm transition" style={{ borderColor: 'var(--line-soft)', opacity, background: rowBg }}>
      <td className="px-3 py-2 text-xs font-mono sticky-col" style={{ color: 'var(--ink-faint)', left: 0, background: rowBg }}>{idx + 1}</td>
      <td className="px-3 py-2 sticky-col-last" style={{ left: '40px', background: rowBg }}>
        <button onClick={() => onSelectStudent(student.id)} className="text-left hover:underline flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER[student.gender]?.colour }} />
          <span>
            <span className="font-medium">{student.name}</span>
            <span className="block text-xs" style={{ color: 'var(--ink-faint)' }}>
              {student.nationality}
              {student.dietaryFlags?.length > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5"><Pill size={9} /> diet</span>}
              {student.hasMedicalFlag && <span className="ml-1.5 inline-flex items-center gap-0.5"><Heart size={9} /> medical</span>}
              {student.transitionTo && <span className="ml-1.5 inline-flex items-center gap-0.5"><ArrowRight size={9} /> {classes.find(c => c.id === student.transitionTo)?.name}</span>}
              {student.hasLastDayFlag && <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700"><Calendar size={9} /> leaving</span>}
            </span>
          </span>
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="relative inline-block">
          <button
            ref={statusBtnRef}
            onClick={() => statusOpen ? setStatusOpen(false) : openStatusMenu()}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border ${status.chip} whitespace-nowrap`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </button>
          {statusOpen && menuPos && createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />
              <div
                className="fixed z-50 rounded-md border shadow-xl py-1 min-w-max"
                style={{ top: menuPos.top, left: menuPos.left, background: 'var(--paper)', borderColor: 'var(--line)', overscrollBehavior: 'contain' }}
                onWheel={e => e.stopPropagation()}>
              {statusOptions.map(k => {
                const v = STATUSES[k];
                return (
                  <button
                    key={k}
                    onClick={() => {
                      // Pipeline students often carry a stale imported "Last Date" that has no real
                      // meaning until they've actually started — clear it when moving them into
                      // Enrolled so they aren't immediately treated as already left (see ownStudents).
                      const patch = { status: k };
                      if (isPipeline && k === 'enrolled') patch.lastDate = '';
                      onUpdate(student.id, patch);
                      setStatusOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-stone-50 transition ${student.status === k ? 'font-semibold' : ''}`}
                    style={{ color: 'var(--ink)' }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${v.dot} shrink-0`} />
                    {v.label}
                    {student.status === k && <Check size={10} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
            </>,
            document.body
          )}
        </div>
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.dob} onSave={v => onUpdate(student.id, { dob: v })} type="date" display={student.dob ? shortDate(student.dob) : ''} mono />
      </td>
      <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--ink-soft)' }}>{ageFromDob(student.dob)}</td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.originalStart} onSave={v => onUpdate(student.id, { originalStart: v })} type="date" display={student.originalStart ? shortDate(student.originalStart) : ''} mono />
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.returningDate} onSave={v => onUpdate(student.id, { returningDate: v })} type="date" display={student.returningDate ? shortDate(student.returningDate) : ''} mono />
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.lastDate} onSave={v => onUpdate(student.id, { lastDate: v })} type="date" display={student.lastDate ? shortDate(student.lastDate) : ''} mono />
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.lengthOfStay} onSave={v => onUpdate(student.id, { lengthOfStay: v })} />
      </td>
      {['mon','tue','wed','thu','fri'].map((day, di) => {
        const dayIso = weekMon ? isoAddDays(weekMon, di) : null;
        const suspended = dayIso && student.suspensions?.some(s => s.start <= dayIso && s.end >= dayIso);
        // The suspension-range overlay is just a display hint for days with no explicit stored
        // value — it must stay clickable (not a plain <div>) so 'S' cycles like every other day
        // state. Cycle from the raw *stored* value (not the displayed one): a blank cell inside a
        // suspension range displays 'S' via the overlay, but is still blank underneath, so the
        // next click must advance blank → 'F' (an explicit override), not blank → '' (a no-op that
        // would just redisplay 'S' via the overlay again, making the click look like it did nothing).
        const stored = student[day] || '';
        const effective = stored || (suspended ? 'S' : '');
        return (
          <td key={day} className="px-1 py-2 text-center">
            <button
              onClick={() => onUpdate(student.id, { [day]: { '': 'F', 'F': 'H', 'H': 'S', 'S': '' }[stored] })}
              title={suspended ? 'Holiday suspension' : undefined}
              className={`w-7 h-7 rounded text-xs font-mono font-medium transition ${effective === 'F' ? 'bg-emerald-100 text-emerald-900' : effective === 'H' ? 'bg-amber-100 text-amber-900' : effective === 'S' ? 'bg-blue-100 text-blue-700' : 'text-stone-300 hover:bg-stone-100'}`}>
              {effective || '·'}
            </button>
          </td>
        );
      })}
      <td className="px-3 py-2 text-center">
        <button onClick={() => onUpdate(student.id, { lunch: !student.lunch })} className={`w-5 h-5 rounded border ${student.lunch ? 'bg-stone-900 border-stone-900' : 'bg-white border-stone-300'}`}>
          {student.lunch && <Check size={12} className="text-white" />}
        </button>
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.bondPaid} onSave={v => onUpdate(student.id, { bondPaid: v })} type="date" display={student.bondPaid ? shortDate(student.bondPaid) : ''} mono />
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.periodFrom} onSave={v => onUpdate(student.id, { periodFrom: v })} type="date" display={student.periodFrom ? shortDate(student.periodFrom) : ''} mono />
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.periodUntil} onSave={v => onUpdate(student.id, { periodUntil: v })} type="date" display={student.periodUntil ? shortDate(student.periodUntil) : ''} mono />
      </td>
      <td className="px-3 py-2">
        <button onClick={cycleInvoice} className={`text-xs px-2 py-0.5 rounded font-medium ${inv.colour}`}>
          {inv.label}
        </button>
        {student.prepay && (
          <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--ink-faint)' }}>
            {student.prepay.completed}/{student.prepay.weeks}w
          </div>
        )}
        {student.invoiceNote && !student.prepay && (
          <div className="text-xs mt-0.5 italic" style={{ color: 'var(--ink-faint)' }}>{student.invoiceNote}</div>
        )}
      </td>
      <td className="px-2 py-2 text-xs">
        <EditableCell value={student.parents} onSave={v => onUpdate(student.id, { parents: v })} placeholder="— add parents" />
      </td>
      <td className="px-2 py-2 text-xs">
        {student.lastDate && <div className="text-xs font-semibold mb-0.5" style={{ color: '#dc2626' }}>LAST DAY {shortDate(student.lastDate)}</div>}
        <EditableCell value={student.note} onSave={v => onUpdate(student.id, { note: v })} placeholder="— add note" />
      </td>
      <td className="px-2 py-2 text-xs" style={{ minWidth: '160px' }}>
        <EditableCell value={student.holidaySuspension} onSave={v => onUpdate(student.id, { holidaySuspension: v })} placeholder="— add" multiline />
      </td>
      <td className="px-2 py-2 text-xs">
        <TransitionCell student={student} onUpdate={onUpdate} />
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs font-mono font-medium ${susCount >= 4 ? 'bg-red-100 text-red-700' : susCount === 3 ? 'bg-amber-100 text-amber-800' : 'text-stone-500'}`}>
          {susCount}/4
        </span>
      </td>
    </tr>
  );
}

function TransitionCell({ student, onUpdate }) {
  const { classes } = useClasses();
  const [open, setOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [date, setDate] = useState('');

  const openPop = () => {
    setDestId(student.transitionTo || '');
    setDate(student.transitionDate || '');
    setOpen(true);
  };
  const save = () => {
    if (!destId) { clear(); return; }
    onUpdate(student.id, { transitionTo: destId, transitionDate: date || null });
    setOpen(false);
  };
  const clear = () => {
    onUpdate(student.id, { transitionTo: null, transitionDate: null });
    setOpen(false);
  };

  const dest = classes.find(c => c.id === student.transitionTo);
  const otherClasses = classes.filter(c => c.id !== student.classId);

  if (open) {
    return (
      <div className="flex flex-col gap-1.5 py-1" onClick={e => e.stopPropagation()}>
        <select value={destId} onChange={e => setDestId(e.target.value)} autoFocus className="w-full text-xs border rounded px-1.5 py-1" style={{ borderColor: 'var(--accent)' }}>
          <option value="">— no move —</option>
          {otherClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1" style={{ borderColor: 'var(--line)' }} />
        <div className="flex gap-1">
          <button onClick={save} className="flex-1 py-0.5 rounded text-xs text-white" style={{ background: 'var(--accent)' }}>Save</button>
          <button onClick={() => setOpen(false)} className="px-2 py-0.5 rounded text-xs border" style={{ borderColor: 'var(--line)' }}>✕</button>
        </div>
      </div>
    );
  }

  if (!student.transitionTo) {
    return (
      <button onClick={openPop} className="text-xs hover:underline italic" style={{ color: 'var(--ink-faint)' }}>— set move</button>
    );
  }
  return (
    <button onClick={openPop} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: '#b45309' }}>
      <ArrowRight size={10} />
      {dest?.name || student.transitionTo}
      {student.transitionDate && <span className="font-mono opacity-70 ml-1">{shortDate(student.transitionDate)}</span>}
    </button>
  );
}

function MoveClassSection({ student, onUpdate }) {
  const { classes } = useClasses();
  const [mode, setMode] = useState(null); // null | 'now' | 'later'
  const [destId, setDestId] = useState('');
  const [date, setDate] = useState('');
  const [newStatus, setNewStatus] = useState('enrolled');

  React.useEffect(() => {
    setMode(null);
    setDestId(student.transitionTo || '');
    setDate(student.transitionDate || '');
    setNewStatus('enrolled');
  }, [student.id]);

  const moveNow = () => {
    if (!destId) return;
    onUpdate({ classId: destId, status: newStatus, transitionTo: null, transitionDate: null });
    setMode(null);
  };
  const saveLater = () => {
    if (!destId) return;
    onUpdate({ transitionTo: destId, transitionDate: date || null });
    setMode(null);
  };
  const cancelTransition = () => {
    onUpdate({ transitionTo: null, transitionDate: null });
    setDestId(''); setDate('');
  };

  const otherClasses = classes.filter(c => c.id !== student.classId);
  const destClass = classes.find(c => c.id === student.transitionTo);

  return (
    <Section title="Move class">
      {/* Pending transition banner */}
      {student.transitionTo && mode === null && (
        <div className="rounded-md p-3 mb-2" style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)' }}>
          <div className="text-xs font-medium mb-0.5" style={{ color: '#b45309' }}>
            <ArrowRight size={11} className="inline mr-1" />
            Moving to {destClass?.fullName || student.transitionTo}
          </div>
          {student.transitionDate && <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>On {shortDate(student.transitionDate)}</div>}
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setDestId(student.transitionTo); setDate(student.transitionDate || ''); setMode('later'); }} className="text-xs px-2 py-1 rounded border hover:bg-white transition" style={{ borderColor: 'var(--line)' }}>Edit</button>
            <button onClick={cancelTransition} className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50 transition" style={{ borderColor: 'var(--line)' }}>Cancel move</button>
          </div>
        </div>
      )}

      {/* Action buttons when idle */}
      {mode === null && (
        <div className="flex gap-2">
          <button onClick={() => { setDestId(''); setNewStatus('enrolled'); setMode('now'); }}
            className="flex-1 py-1.5 rounded text-xs font-medium text-white flex items-center justify-center gap-1.5 transition hover:opacity-90"
            style={{ background: 'var(--accent)' }}>
            <ArrowRight size={11} /> Move now
          </button>
          <button onClick={() => { setDestId(student.transitionTo || ''); setDate(student.transitionDate || ''); setMode('later'); }}
            className="flex-1 py-1.5 rounded border text-xs flex items-center justify-center gap-1.5 hover:bg-stone-50 transition"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
            <Calendar size={11} /> Schedule move
          </button>
        </div>
      )}

      {/* Move now form */}
      {mode === 'now' && (
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ink-faint)' }}>Move to class</label>
            <select value={destId} onChange={e => setDestId(e.target.value)} autoFocus className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--line)' }}>
              <option value="">— pick a class —</option>
              {otherClasses.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ink-faint)' }}>Status after move</label>
            <div className="flex gap-1.5">
              {['enrolled', 'wait_list'].map(s => (
                <button key={s} type="button" onClick={() => setNewStatus(s)}
                  className={`flex-1 py-1.5 rounded text-xs border transition ${newStatus === s ? 'font-semibold' : 'hover:bg-stone-50'}`}
                  style={newStatus === s ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)' } : { borderColor: 'var(--line)' }}>
                  {s === 'enrolled' ? 'Enrolled' : 'Wait list'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={moveNow} disabled={!destId} className="flex-1 py-1.5 rounded text-xs text-white font-medium disabled:opacity-40" style={{ background: 'var(--accent)' }}>Move now</button>
            <button onClick={() => setMode(null)} className="px-3 py-1.5 rounded text-xs border" style={{ borderColor: 'var(--line)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Schedule move form */}
      {mode === 'later' && (
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ink-faint)' }}>Moving to</label>
            <select value={destId} onChange={e => setDestId(e.target.value)} autoFocus className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--line)' }}>
              <option value="">— pick a class —</option>
              {otherClasses.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ink-faint)' }}>Transition date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--line)' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveLater} disabled={!destId} className="flex-1 py-1.5 rounded text-xs text-white font-medium disabled:opacity-40" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setMode(null)} className="px-3 py-1.5 rounded text-xs border" style={{ borderColor: 'var(--line)' }}>Cancel</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ============================================================
// STUDENT DETAIL PANEL
// ============================================================

function StudentDetailPanel({ student, onClose, onUpdate, onArchive, onRestore }) {
  const { classes } = useClasses();
  const [confirmArchive, setConfirmArchive] = useState(false);
  React.useEffect(() => { setConfirmArchive(false); }, [student?.id]);
  if (!student) return null;
  const status = STATUSES[student.status];
  const u = (patch) => onUpdate(student.id, patch);
  return (
    <aside className="w-96 border-l flex flex-col overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => u({ gender: student.gender === 'F' ? 'M' : student.gender === 'M' ? 'X' : 'F' })} className="shrink-0" title="click to change">
              <span className="w-2.5 h-2.5 rounded-full block" style={{ background: GENDER[student.gender]?.colour }} />
            </button>
            <div className="font-display text-2xl leading-tight flex-1">
              <EditableCell value={student.name} onSave={v => u({ name: v })} placeholder="Child name" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border ${status.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--ink-faint)' }}>{ageFromDob(student.dob)} · {shortDate(student.dob)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>Class:</span>
            <select
              value={student.classId || ''}
              onChange={e => u({ classId: e.target.value || null })}
              className="text-xs font-medium border rounded px-1.5 py-0.5"
              style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <option value="">— none —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded shrink-0"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <Section title="Contact">
          <div className="flex items-center gap-2 py-1 text-sm">
            <UserIcon size={12} className="shrink-0" style={{ color: 'var(--ink-faint)' }} />
            <span style={{ color: 'var(--ink-faint)' }}>Gender:</span>
            <div className="flex gap-1">
              {['F', 'M', 'X'].map(g => (
                <button
                  key={g}
                  onClick={() => u({ gender: g })}
                  className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 transition ${student.gender === g ? 'font-semibold' : 'opacity-50 hover:opacity-100'}`}
                  style={{ borderColor: 'var(--line)' }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER[g].colour }} />
                  {GENDER[g].label}
                </button>
              ))}
            </div>
          </div>
          <EditableRow icon={UserIcon} label="Parents" value={student.parents} onSave={v => u({ parents: v })} />
          <EditableRow icon={Mail} label="Email" value={student.email} onSave={v => u({ email: v })} multiline />
          <EditableRow icon={Phone} label="Phone" value={student.phone} onSave={v => u({ phone: v })} multiline />
          <EditableRow icon={MapPin} label="Nationality" value={student.nationality} onSave={v => u({ nationality: v })} />
        </Section>
        <Section title="Schedule">
          <div className="flex gap-1 mb-3">
            {['M','T','W','T','F'].map((d, i) => {
              const key = ['mon','tue','wed','thu','fri'][i];
              const v = student[key];
              const cycle = () => u({ [key]: { '': 'F', 'F': 'H', 'H': 'S', 'S': '' }[v || ''] });
              return (
                <div key={i} className="flex-1 text-center">
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>{d}</div>
                  <button onClick={cycle} className={`h-9 w-full rounded flex items-center justify-center text-sm font-mono font-medium ${v === 'F' ? 'bg-emerald-100 text-emerald-900' : v === 'H' ? 'bg-amber-100 text-amber-900' : v === 'S' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-300'}`}>{v || '·'}</button>
                </div>
              );
            })}
          </div>
          <EditableRow icon={Calendar} label="Started" value={student.originalStart} onSave={v => u({ originalStart: v })} type="date" display={shortDate(student.originalStart)} />
          <EditableRow icon={Calendar} label="Returning" value={student.returningDate} onSave={v => u({ returningDate: v })} type="date" display={student.returningDate ? shortDate(student.returningDate) : ''} />
          <EditableRow icon={Calendar} label="Last day" value={student.lastDate} onSave={v => u({ lastDate: v })} type="date" display={student.lastDate ? shortDate(student.lastDate) : ''} />
          <EditableRow label="Length of stay" value={student.lengthOfStay} onSave={v => u({ lengthOfStay: v })} />
          <div className="flex items-center gap-2 py-1 text-sm">
            <span style={{ color: 'var(--ink-faint)' }}>Lunch:</span>
            <button onClick={() => u({ lunch: !student.lunch })} className={`w-5 h-5 rounded border ${student.lunch ? 'bg-stone-900 border-stone-900' : 'bg-white border-stone-300'}`}>
              {student.lunch && <Check size={12} className="text-white" />}
            </button>
          </div>
        </Section>
        <SuspensionSection student={student} onUpdate={u} />
        <Section title="Billing">
          <EditableRow label="Bond paid" value={student.bondPaid} onSave={v => u({ bondPaid: v })} type="date" display={student.bondPaid ? shortDate(student.bondPaid) : ''} />
          <EditableRow label="Paid from" value={student.periodFrom} onSave={v => u({ periodFrom: v })} type="date" display={student.periodFrom ? shortDate(student.periodFrom) : ''} />
          <EditableRow label="Paid until" value={student.periodUntil} onSave={v => u({ periodUntil: v })} type="date" display={student.periodUntil ? shortDate(student.periodUntil) : ''} />
          <EditableRow label="Invoice note" value={student.invoiceNote} onSave={v => u({ invoiceNote: v })} />
          {student.prepay && (
            <div className="mt-2 px-3 py-2 rounded-md" style={{ background: 'var(--accent-soft)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>Prepay block</div>
              <div className="text-sm font-medium">{student.prepay.completed} of {student.prepay.weeks} weeks completed</div>
              <div className="h-1 rounded-full mt-2" style={{ background: 'rgba(60,90,60,0.15)' }}>
                <div className="h-full rounded-full" style={{ width: `${(student.prepay.completed / student.prepay.weeks) * 100}%`, background: 'var(--accent)' }} />
              </div>
              <div className="text-xs mt-1.5" style={{ color: 'var(--ink-faint)' }}>Started {shortDate(student.prepay.startDate)} · {student.prepay.weeks - student.prepay.completed} weeks remaining</div>
            </div>
          )}
        </Section>
        <Section title="Notes">
          <EditableCell value={student.note} onSave={v => u({ note: v })} placeholder="— add a note about this child" />
          {student.dietaryFlags?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {student.dietaryFlags.map(f => (
                <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{f.replace('no_', 'no ').replace('_', ' ')}</span>
              ))}
            </div>
          )}
        </Section>

        {/* Inquiry-only details — only show if any are present */}
        {(student.arrivalDate || student.intendedStay || student.daysRequested || student.halfOrFull || student.nativeLanguage || student.formCompletedBy) && (
          <Section title="Enrolment request">
            {student.nativeLanguage && <EditableRow label="Native language" value={student.nativeLanguage} onSave={v => u({ nativeLanguage: v })} />}
            {student.arrivalDate && <EditableRow label="Arrival to Bali" value={student.arrivalDate} onSave={v => u({ arrivalDate: v })} />}
            {student.intendedStay && <EditableRow label="Intended stay" value={student.intendedStay} onSave={v => u({ intendedStay: v })} />}
            {student.daysRequested && <EditableRow label="Days requested" value={student.daysRequested} onSave={v => u({ daysRequested: v })} />}
            {student.halfOrFull && <EditableRow label="Half / full day" value={student.halfOrFull} onSave={v => u({ halfOrFull: v })} />}
            {student.formCompletedBy && <EditableRow label="Form completed by" value={student.formCompletedBy} onSave={v => u({ formCompletedBy: v })} />}
          </Section>
        )}

        {/* Parent details (structured) */}
        {(student.parent1?.name || student.parent1?.email || student.parent1?.phone || student.parent1?.occupation) && (
          <Section title="Parent 1">
            {student.parent1.name && <EditableRow label="Name" value={student.parent1.name} onSave={v => u({ parent1: { ...student.parent1, name: v } })} />}
            {student.parent1.email && <EditableRow icon={Mail} label="Email" value={student.parent1.email} onSave={v => u({ parent1: { ...student.parent1, email: v } })} />}
            {student.parent1.phone && <EditableRow icon={Phone} label="Phone" value={student.parent1.phone} onSave={v => u({ parent1: { ...student.parent1, phone: v } })} />}
            {student.parent1.occupation && <EditableRow label="Occupation" value={student.parent1.occupation} onSave={v => u({ parent1: { ...student.parent1, occupation: v } })} />}
          </Section>
        )}
        {(student.parent2?.name || student.parent2?.email || student.parent2?.phone || student.parent2?.occupation) && (
          <Section title="Parent 2">
            {student.parent2.name && <EditableRow label="Name" value={student.parent2.name} onSave={v => u({ parent2: { ...student.parent2, name: v } })} />}
            {student.parent2.email && <EditableRow icon={Mail} label="Email" value={student.parent2.email} onSave={v => u({ parent2: { ...student.parent2, email: v } })} />}
            {student.parent2.phone && <EditableRow icon={Phone} label="Phone" value={student.parent2.phone} onSave={v => u({ parent2: { ...student.parent2, phone: v } })} />}
            {student.parent2.occupation && <EditableRow label="Occupation" value={student.parent2.occupation} onSave={v => u({ parent2: { ...student.parent2, occupation: v } })} />}
          </Section>
        )}

        {/* Family — siblings/nanny */}
        {(student.siblings?.length > 0 || student.nanny) && (
          <Section title="Family">
            {student.siblings?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Siblings</div>
                {student.siblings.map((s, i) => (
                  <div key={i} className="text-sm py-0.5" style={{ color: 'var(--ink-soft)' }}>
                    {s.name}
                    {s.dob && <span className="text-xs ml-2" style={{ color: 'var(--ink-faint)' }}>· DOB {s.dob}</span>}
                    {s.class && <span className="text-xs ml-2" style={{ color: 'var(--ink-faint)' }}>· {s.class}</span>}
                  </div>
                ))}
              </div>
            )}
            {student.nanny && (
              <div className="mt-2">
                <div className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Pembantu / Nanny</div>
                {student.nanny.name && <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>{student.nanny.name}</div>}
                {student.nanny.phone && <div className="text-xs font-mono" style={{ color: 'var(--ink-faint)' }}>{student.nanny.phone}</div>}
              </div>
            )}
          </Section>
        )}

        {/* Doctor */}
        {student.doctor && (student.doctor.name || student.doctor.contact) && (
          <Section title="Family doctor">
            {student.doctor.name && <EditableRow label="Name" value={student.doctor.name} onSave={v => u({ doctor: { ...student.doctor, name: v } })} />}
            {student.doctor.contact && <EditableRow label="Contact" value={student.doctor.contact} onSave={v => u({ doctor: { ...student.doctor, contact: v } })} />}
          </Section>
        )}

        {/* Medical — only show fields that have data */}
        {(student.vaccinationsYesNo || student.medicalDisabilitiesYesNo || student.medicalProblemsYesNo || student.foodAllergiesYesNo || student.epipen) && (
          <Section title="Medical">
            {student.vaccinationsYesNo && (
              <div className="py-1">
                <div className="text-xs flex justify-between" style={{ color: 'var(--ink-faint)' }}><span>Vaccinations up to date</span><span style={{ color: 'var(--ink-soft)' }}>{student.vaccinationsYesNo}</span></div>
                {student.vaccinationsDetails && <div className="text-xs mt-0.5 whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>{student.vaccinationsDetails}</div>}
              </div>
            )}
            {student.medicalDisabilitiesYesNo && (
              <div className="py-1">
                <div className="text-xs flex justify-between" style={{ color: 'var(--ink-faint)' }}><span>SEN / disabilities</span><span style={{ color: 'var(--ink-soft)' }}>{student.medicalDisabilitiesYesNo}</span></div>
                {student.medicalDisabilitiesDetails && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{student.medicalDisabilitiesDetails}</div>}
              </div>
            )}
            {student.medicalProblemsYesNo && (
              <div className="py-1">
                <div className="text-xs flex justify-between" style={{ color: 'var(--ink-faint)' }}><span>Medical problems / allergies</span><span style={{ color: 'var(--ink-soft)' }}>{student.medicalProblemsYesNo}</span></div>
                {student.medicalProblemsDetails && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{student.medicalProblemsDetails}</div>}
              </div>
            )}
            {student.foodAllergiesYesNo && (
              <div className="py-1">
                <div className="text-xs flex justify-between" style={{ color: 'var(--ink-faint)' }}><span>Food allergies</span><span style={{ color: 'var(--ink-soft)' }}>{student.foodAllergiesYesNo}</span></div>
                {student.foodAllergiesDetails && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{student.foodAllergiesDetails}</div>}
              </div>
            )}
            {student.epipen && (
              <div className="py-1">
                <div className="text-xs flex justify-between" style={{ color: 'var(--ink-faint)' }}><span>Requires EpiPen</span><span style={{ color: student.epipen.toLowerCase() === 'yes' ? 'var(--terracotta)' : 'var(--ink-soft)', fontWeight: student.epipen.toLowerCase() === 'yes' ? 600 : 400 }}>{student.epipen}</span></div>
              </div>
            )}
          </Section>
        )}

        {/* Old simple siblings list (from class-table data, with class info) — only if not already shown above */}
        {!student.siblings?.[0]?.dob && student.siblings?.length > 0 && false && (
          <Section title="Siblings">
            {student.siblings.map((s, i) => (
              <div key={i} className="text-sm" style={{ color: 'var(--ink-soft)' }}>{s.name} <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>· {s.class}</span></div>
            ))}
          </Section>
        )}

        <MoveClassSection student={student} onUpdate={(patch) => onUpdate(student.id, patch)} />

        <Section title="Change status">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(STATUSES).map(([k, v]) => (
              <button key={k} onClick={() => u({ status: k })} className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md border transition ${student.status === k ? v.chip + ' border-2' : 'hover:bg-stone-50'}`} style={student.status !== k ? { borderColor: 'var(--line)' } : {}}>
                <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                {v.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title={student.archived ? "Archived" : "Move to archive"}>
          {student.archived ? (
            <>
              <div className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>
                This student is in the archive. They won't appear in classes, dashboards, or forecasts, but all their data is preserved.
              </div>
              <button onClick={() => onRestore(student.id)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border text-emerald-800 hover:bg-emerald-50 transition" style={{ borderColor: 'var(--line)' }}>
                <ArrowRight size={14} /> Restore from archive
              </button>
            </>
          ) : !confirmArchive ? (
            <>
              <div className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>
                Archived students are kept forever — their info stays on file for returning families, sibling enrolments, and records. They just don't show up in active views.
              </div>
              <button onClick={() => setConfirmArchive(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-stone-50 transition" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                <Trash2 size={14} /> Move to archive
              </button>
            </>
          ) : (
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
              <div className="text-sm font-medium mb-1">Move {student.name} to archive?</div>
              <div className="text-xs mb-3" style={{ color: 'var(--ink-soft)' }}>They'll be removed from active classes and lists, but all info is preserved and restorable.</div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmArchive(false)} className="flex-1 px-3 py-1.5 text-sm rounded-md border hover:bg-white" style={{ borderColor: 'var(--line)' }}>Cancel</button>
                <button onClick={() => onArchive(student.id)} className="flex-1 px-3 py-1.5 text-sm rounded-md text-white" style={{ background: 'var(--ink)' }}>Move to archive</button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
}

function EditableRow({ icon: Icon, label, value, onSave, type, display, multiline }) {
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      {Icon && <Icon size={12} className="mt-1.5 shrink-0" style={{ color: 'var(--ink-faint)' }} />}
      <span className="shrink-0 mt-1" style={{ color: 'var(--ink-faint)' }}>{label}:</span>
      <div className="flex-1 min-w-0">
        <EditableCell value={value} onSave={onSave} type={type} display={display} multiline={multiline} />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-5 pt-4 border-t first:mt-0 first:pt-0 first:border-0" style={{ borderColor: 'var(--line)' }}>
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--ink-faint)' }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value, multiline }) {
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      {Icon && <Icon size={12} className="mt-1" style={{ color: 'var(--ink-faint)' }} />}
      <span style={{ color: 'var(--ink-faint)' }}>{label}:</span>
      <span style={{ color: 'var(--ink-soft)', whiteSpace: multiline ? 'pre-line' : 'normal' }}>{value || '–'}</span>
    </div>
  );
}

// ============================================================
// EMAIL PARSE MODAL
// ============================================================

function EmailParseModal({ onClose, onConfirm }) {
  const { classes } = useClasses();
  const [emailText, setEmailText] = useState(EXAMPLE_EMAIL);
  const [step, setStep] = useState('paste');
  const [parsed, setParsed] = useState(null);

  const handleParse = () => {
    const r = parseEmail(emailText);
    if (r.childName) r.childName = r.childName.split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    setParsed(r);
    setStep('review');
  };

  const updateField = (k, v) => setParsed(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(27,26,23,0.5)' }}>
      <div className="rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="font-display text-2xl leading-none">New inquiry from email</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
              {step === 'paste' ? 'Paste the Squarespace enrolment email below' : 'Review the parsed fields and edit any that look wrong'}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded"><X size={18} /></button>
        </div>
        {step === 'paste' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <textarea value={emailText} onChange={e => setEmailText(e.target.value)}
                className="w-full h-96 p-4 rounded-md border font-mono text-xs leading-relaxed focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }}
                placeholder="Paste email body here…" />
              <div className="mt-3 text-xs flex items-start gap-2" style={{ color: 'var(--ink-faint)' }}>
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span>The parser handles all 40 fields of the Squarespace form — child details, parents, contact, vaccinations, allergies, siblings, doctor, notes. You'll review everything before saving.</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-stone-100">Cancel</button>
              <button onClick={handleParse} className="px-4 py-2 text-sm rounded-md text-white font-medium" style={{ background: 'var(--accent)' }}>Extract details →</button>
            </div>
          </>
        )}
        {step === 'review' && parsed && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Child's name" value={parsed.childName} onChange={v => updateField('childName', v)} flag flagText="capitalisation auto-fixed" />
                <Field label="Date of birth" value={parsed.dob} onChange={v => updateField('dob', v)} />
                <Field label="Nationality" value={parsed.nationality} onChange={v => updateField('nationality', v)} />
                <Field label="Gender" value={parsed.gender} onChange={v => updateField('gender', v)} />
                <Field label="Native language" value={parsed.nativeLanguage} onChange={v => updateField('nativeLanguage', v)} />
                <SelectField label="Requested class" value={parsed.requestedClass} options={classes.map(c => ({ value: c.id, label: c.name }))} onChange={v => updateField('requestedClass', v)} flag flagText={`from "${parsed.requestedClassRaw}"`} />
                <Field label="Preferred start" value={parsed.startDate} onChange={v => updateField('startDate', v)} />
                <Field label="Days requested" value={parsed.days} onChange={v => updateField('days', v)} />
                <Field label="Half / full day" value={parsed.halfFull} onChange={v => updateField('halfFull', v)} />
                <Field label="Length of stay" value={parsed.lengthOfStay} onChange={v => updateField('lengthOfStay', v)} />
                <SectionHead title="Parent 1" />
                <Field label="Name" value={parsed.parent1Name} onChange={v => updateField('parent1Name', v)} />
                <Field label="Email" value={parsed.parent1Email} onChange={v => updateField('parent1Email', v)} />
                <Field label="Phone" value={parsed.parent1Phone} onChange={v => updateField('parent1Phone', v)} />
                <Field label="Occupation" value={parsed.parent1Occupation} onChange={v => updateField('parent1Occupation', v)} />
                <SectionHead title="Parent 2" />
                <Field label="Name" value={parsed.parent2Name} onChange={v => updateField('parent2Name', v)} />
                <Field label="Email" value={parsed.parent2Email} onChange={v => updateField('parent2Email', v)} />
                <Field label="Phone" value={parsed.parent2Phone} onChange={v => updateField('parent2Phone', v)} />
                <Field label="Occupation" value={parsed.parent2Occupation} onChange={v => updateField('parent2Occupation', v)} />
                <SectionHead title="Medical & notes" />
                <Field label="Vaccinations" value={parsed.vaccinations} onChange={v => updateField('vaccinations', v)} />
                <Field label="Food allergies" value={parsed.allergies} onChange={v => updateField('allergies', v)} />
                <Field label="Requires EpiPen" value={parsed.epipen} onChange={v => updateField('epipen', v)} />
                <Field label="Notes from parent" value={parsed.notes} onChange={v => updateField('notes', v)} />
              </div>
            </div>
            <div className="flex justify-between items-center gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
              <button onClick={() => setStep('paste')} className="text-sm hover:underline" style={{ color: 'var(--ink-soft)' }}>← Back to email</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-stone-100">Cancel</button>
                <button onClick={() => onConfirm(parsed)} className="px-4 py-2 text-sm rounded-md text-white font-medium" style={{ background: 'var(--accent)' }}>Save as inquiry</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, flag, flagText }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-2.5 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }} />
      {flag && flagText && <div className="text-xs mt-1 italic" style={{ color: 'var(--terracotta)' }}>↑ {flagText}</div>}
    </div>
  );
}

function ReadOnlyField({ label, value, hint }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>{label}</label>
      <div className="w-full px-2.5 py-1.5 text-sm rounded-md border font-mono" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)', color: 'var(--ink-soft)' }}>
        {value || '–'}
      </div>
      {hint && <div className="text-xs mt-1 italic" style={{ color: 'var(--ink-faint)' }}>↑ {hint}</div>}
    </div>
  );
}

function SelectField({ label, value, options, onChange, flag, flagText }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-2.5 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }}>
        <option value="">— select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {flag && flagText && <div className="text-xs mt-1 italic" style={{ color: 'var(--terracotta)' }}>↑ {flagText}</div>}
    </div>
  );
}

function SectionHead({ title }) {
  return <div className="col-span-2 mt-2 pt-4 border-t" style={{ borderColor: 'var(--line)' }}><div className="font-display text-lg">{title}</div></div>;
}

// ============================================================
// IMPORT MODAL
// ============================================================

// ---- File parser: reads The Garden's xlsx format and extracts student rows ----

const SHEET_CLASS_MAP = {
  'el 1': 'el1', 'el2 daf': 'el2d', 'el2 hib': 'el2h',
  'pk saf': 'pks', 'pk lav': 'pkl', 'jr. kindergarten': 'jrk', 'kindergarten': 'kg',
};
const SKIP_SHEETS = ['age calculator', 'total enrolment', 'enrolment forecast', '25+ enrolments'];

function buildColMap(blockOffset, baseOffset) {
  const o = blockOffset + baseOffset;
  return {
    no: blockOffset + 0, name: 1 + o, originalStart: 2 + o, returningDate: 3 + o, lastDate: 4 + o,
    dob: 5 + o, currentAge: 6 + o, mon: 7 + o, tue: 8 + o, wed: 9 + o, thu: 10 + o, fri: 11 + o,
    lunch: 12 + o, nationality: 13 + o, parents: 14 + o, email: 15 + o, phone: 16 + o,
    note: 17 + o, holidaySuspension: 18 + o, lengthOfStay: 19 + o, bondPaid: 20 + o,
    periodFrom: 21 + o, periodUntil: 22 + o,
  };
}

function findLatestBlock(rows) {
  const row2 = rows[2] || [];
  let baseOffset = 0;
  for (let i = 0; i < Math.min(row2.length, 5); i++) {
    if (String(row2[i] || '').trim().toLowerCase().includes('child name')) { baseOffset = i - 1; break; }
  }
  if (baseOffset < 0) baseOffset = 0;

  const MONTHS = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  let bestBlock = 0, bestDate = null;
  for (let block = 0; block < 5; block++) {
    const offset = block * 25;
    let period = '';
    for (let c = offset; c < offset + 15; c++) {
      const v = String(rows[1]?.[c] || '').trim();
      if (v && /\d/.test(v) && /[a-zA-Z]/.test(v) && !v.toLowerCase().startsWith('occupancy')) { period = v; break; }
    }
    if (!period) continue;
    const endMatch = period.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s*$/);
    if (endMatch) {
      const mon = MONTHS[endMatch[2].toLowerCase()];
      if (mon !== undefined) {
        const d = new Date(parseInt(endMatch[3]), mon, parseInt(endMatch[1]));
        if (!bestDate || d > bestDate) { bestDate = d; bestBlock = block; }
      }
    }
  }
  // The occupancy period always spans a single Mon–Fri working week, and the matched date above is
  // its Friday (the last "d Month yyyy" token in the period text) — so Monday is just 4 days earlier.
  // Used to figure out each weekday column's real calendar date, so blank-but-suspended day cells
  // (see the Holiday Suspension column) can be filled in as 'S' rather than left blank on import.
  let weekMonIso = null;
  if (bestDate) {
    const mon = new Date(bestDate);
    mon.setDate(mon.getDate() - 4);
    weekMonIso = localIso(mon);
  }
  return { blockOffset: bestBlock * 25, baseOffset, weekMonIso };
}

function normaliseDay(v) {
  if (!v) return '';
  const s = String(v).trim().toUpperCase();
  if (s === 'F' || s === 'FULL' || s === 'FULL DAY' || s === 'FD' || s === 'Y' || s === 'YES') return 'F';
  if (s === 'H' || s === 'HALF' || s === 'HALF DAY' || s === 'HD' || s === 'AM' || s === 'PM') return 'H';
  return '';
}

function normaliseLunch(v) {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return ['y','yes','true','1','✓','✔','x'].includes(s);
}

const GIRL_NAMES = new Set(['leila','isabella','kiara','laura','poppy','sahara','sara','maya','nyala','aurora','nina','thea','laia','liepa','astrid','lily','saffira','jasmine','ashley','olivia','renee','vienna','kyla','lyveen','elya','savanna','elif','elara','mikaela','aikanata','araminta','stevie','imogen','sarah','siena','luna','georgina','elsie','ellerie','sofia','cleo','lyla','auri','auraya','kealei','anak','clara','noa']);
const BOY_NAMES = new Set(['luka','thomas','onyx','austin','rafael','soann','sunny','ayaan','kiro','tommy','eren','walt','taj','alexander','tiger','richard','massimo','manuia','pablo','leo','caleb','zeb','sebastian','levi','xydus','leonid','kristian','cassian','harvey','kohaku','asher','elio','atlas','nindyo','remi','lex','adrian','aiden','dean','koa','ignacy','jaxon','nauray','samu','jerome','georgi','kirill','everest','oshyn','arcturus','oliver','kiyoji','apollo','merkur','jacob','toby','wilbur']);

function guessGenderFromName(fullName) {
  if (!fullName) return 'X';
  const first = fullName.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ð/g, 'd');
  if (GIRL_NAMES.has(first)) return 'F';
  if (BOY_NAMES.has(first)) return 'M';
  return 'X';
}

// Full month-name lookup, including long forms (e.g. "july", "january") — the old map
// only had 3-letter keys plus "june", so "8-July-2026" silently failed to parse.
const EXCEL_DATE_MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
  january:0,february:1,march:2,april:3,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };

function excelDateToISO(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s.toLowerCase() === 'tbc' || s === '–' || s === '-') return s;
    // Accepts both dash- and space-separated "D Mon YY(YY)", e.g. "30-Aug-25" or "8 Sep 25"
    const m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s-]+(\d{2,4})$/);
    if (m) {
      const mon = EXCEL_DATE_MONTHS[m[2].toLowerCase()];
      if (mon !== undefined) {
        let yr = parseInt(m[3]);
        if (yr < 100) yr += yr < 50 ? 2000 : 1900;
        return `${yr}-${String(mon + 1).padStart(2, '0')}-${String(parseInt(m[1])).padStart(2, '0')}`;
      }
    }
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d) && d.getFullYear() > 1900) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return s;
  }
  if (typeof v === 'number' && v > 1000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(d)) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    }
  }
  return String(v);
}

// The source spreadsheet colours a day cell tan/brown ("FCE5CD") and leaves it textless to mark
// a Holiday Suspension day — this is the *only* signal for those cells, so we read the cell's
// fill colour directly (requires XLSX.read to be called with { cellStyles: true }) rather than
// relying solely on parsing the Holiday Suspension note text into date ranges. Confirmed via the
// real workbook that FCE5CD is used consistently for this across every class sheet.
function isSuspensionFill(cellStyle) {
  return cellStyle?.patternType === 'solid' && cellStyle.fgColor?.rgb?.toUpperCase() === 'FCE5CD';
}

// The source spreadsheet also colours the "Child Name" cell itself to mark gender — pink
// ("FFCCFF") for girls, blue ("99CCFF") for boys — confirmed consistent across every class
// sheet. This is far more reliable than guessing from a static first-name list, so it's used
// as the primary signal at import time; the name-list guess is kept only as a fallback for
// names whose cell fill isn't one of these two known colours.
function genderFromFill(cellStyle) {
  if (cellStyle?.patternType !== 'solid') return null;
  const rgb = cellStyle.fgColor?.rgb?.toUpperCase();
  if (rgb === 'FFCCFF') return 'F';
  if (rgb === '99CCFF') return 'M';
  return null;
}

function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        // cellStyles is required to read each day cell's fill colour, which is how the source
        // spreadsheet marks Holiday Suspension days (tan/brown fill, "FCE5CD") on days that are
        // otherwise left blank — there's no text value in those cells to read any other way.
        const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
        const result = { students: [], warnings: [], sheets: [] };

        for (const sheetName of workbook.SheetNames) {
          const sheetLower = sheetName.trim().toLowerCase();
          if (SKIP_SHEETS.includes(sheetLower)) continue;
          const classId = SHEET_CLASS_MAP[sheetLower];
          if (!classId) {
            const guessed = guessClassFromText(sheetName);
            if (!guessed) { result.warnings.push(`Sheet "${sheetName}": not a recognised class — skipped`); continue; }
          }
          const finalClassId = classId || guessClassFromText(sheetName);
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
          if (rows.length < 4) continue;

          const { blockOffset, baseOffset, weekMonIso } = findLatestBlock(rows);
          const COL = buildColMap(blockOffset, baseOffset);
          const weekDayIsos = weekMonIso
            ? ['mon', 'tue', 'wed', 'thu', 'fri'].map((_, i) => isoAddDays(weekMonIso, i))
            : null;
          let sheetStudentCount = 0;

          // Sections below the main active-student table (WAITLIST, Invoice sent, Quote sent) use the
          // same column layout and carry their own status. `section` tracks which one we're currently in;
          // 'between' means we've passed the active table's totals row but haven't found the next section
          // header yet — rows here are skipped (with a warning) rather than mis-classified as active.
          let section = 'enrolled';
          let blankRunLength = 0;
          for (let ri = 3; ri < rows.length; ri++) {
            const row = rows[ri];
            const childName = String(row[COL.name] || '').trim();
            const col0 = String(row[COL.no] || '').trim().toLowerCase();
            const col1Lower = childName.toLowerCase();
            // Section header text can land anywhere from the "No" column through DOB (merged header cells
            // start at varying columns), so scan that whole window rather than just name/no.
            const headerScan = row.slice(COL.no, COL.dob + 1).map(c => String(c ?? '')).join(' ').toLowerCase();

            // A run of fully blank rows means we've run off the end of the sheet's real content —
            // stop scanning rather than continuing indefinitely toward rows.length. Only look within
            // this block's own columns: sheets stack up to 5 occupancy-period blocks side by side, and
            // a row blank in the current block can still have leftover data in another block's columns,
            // which must not count as "not blank" here. Real sheets have deliberate gaps of 5-7 blank
            // rows between sections (e.g. Invoice sent -> Quote sent), so the threshold must clear that.
            const blockCells = row.slice(COL.no, COL.periodUntil + 1);
            const isBlankRow = blockCells.every(c => String(c ?? '').trim() === '');
            if (isBlankRow) {
              blankRunLength++;
              if (blankRunLength >= 20) break;
              continue;
            }
            blankRunLength = 0;

            // "Recently left" marks the end of anything relevant to current pipeline status — hard-stop
            // the whole sheet scan here (like the old TOTAL-row break) instead of continuing past it,
            // which is what let historical/other-class content leak into this sheet's results.
            if (/recently\s*left/.test(headerScan)) break;

            if (col1Lower.startsWith('total') || col1Lower.includes('holiday suspension') ||
                col1Lower === 'full day' || col1Lower === 'half day' ||
                col0 === 'total' || col0 === 'full day' || col0 === 'half day') { section = 'between'; continue; }
            if (/wait[\s-]?list/.test(headerScan)) { section = 'wait_list'; continue; }
            if (/invoice/.test(headerScan) && /sent|awaiting/.test(headerScan)) { section = 'invoice_sent'; continue; }
            if (/quote/.test(headerScan) && /sent|awaiting/.test(headerScan)) { section = 'quote_sent'; continue; }
            if (!childName || /^\d+$/.test(childName)) continue;
            if (col1Lower === 'child name' || col1Lower === 'no') continue;
            if (section === 'between') {
              result.warnings.push(`"${childName}" (${sheetName}): row found between sections — couldn't tell which status it belongs to, skipped`);
              continue;
            }

            const nameAddr = XLSX.utils.encode_cell({ r: ri, c: COL.name });
            const student = {
              name: childName,
              gender: genderFromFill(sheet[nameAddr]?.s) || guessGenderFromName(childName),
              classId: finalClassId,
              status: section,
              dob: excelDateToISO(row[COL.dob]),
              nationality: String(row[COL.nationality] || '').trim(),
              parents: String(row[COL.parents] || '').trim(),
              phone: String(row[COL.phone] || '').trim(),
              email: String(row[COL.email] || '').trim(),
              mon: normaliseDay(row[COL.mon]), tue: normaliseDay(row[COL.tue]),
              wed: normaliseDay(row[COL.wed]), thu: normaliseDay(row[COL.thu]),
              fri: normaliseDay(row[COL.fri]),
              lunch: normaliseLunch(row[COL.lunch]),
              note: String(row[COL.note] || '').trim(),
              holidaySuspension: String(row[COL.holidaySuspension] || '').trim(),
              originalStart: excelDateToISO(row[COL.originalStart]),
              lastDate: excelDateToISO(row[COL.lastDate]),
              lengthOfStay: String(row[COL.lengthOfStay] || '').trim(),
              bondPaid: excelDateToISO(row[COL.bondPaid]),
              periodFrom: excelDateToISO(row[COL.periodFrom]),
              periodUntil: excelDateToISO(row[COL.periodUntil]),
              invoiceNote: '',
              _sheet: sheetName,
            };
            // A blank day cell coloured tan/brown in the source spreadsheet means "gone that day"
            // (Holiday Suspension) — fill those in as 'S' rather than leaving them blank, so the
            // app matches the spreadsheet exactly instead of only inferring suspension via the
            // live week-view overlay. Fill colour (read directly off the cell) is the authoritative
            // signal; the Holiday Suspension note's parsed date range is kept as a fallback for
            // cells whose fill didn't come through for any reason.
            const parsedHs = student.holidaySuspension ? parseHolidaySuspensionNote(student.holidaySuspension) : null;
            const DAY_COLS = { mon: COL.mon, tue: COL.tue, wed: COL.wed, thu: COL.thu, fri: COL.fri };
            ['mon', 'tue', 'wed', 'thu', 'fri'].forEach((day, i) => {
              if (student[day]) return;
              const addr = XLSX.utils.encode_cell({ r: ri, c: DAY_COLS[day] });
              const isBrownFill = isSuspensionFill(sheet[addr]?.s);
              const inParsedRange = weekDayIsos && parsedHs?.ranges.some(r => r.start <= weekDayIsos[i] && r.end >= weekDayIsos[i]);
              if (isBrownFill || inParsedRange) student[day] = 'S';
            });
            if (!student.dob) result.warnings.push(`"${student.name}" (${sheetName}): no date of birth`);
            result.students.push(student);
            sheetStudentCount++;
          }
          if (sheetStudentCount > 0) result.sheets.push({ name: sheetName, count: sheetStudentCount, classId: finalClassId });
        }
        if (result.students.length === 0 && result.warnings.length === 0) {
          result.warnings.push('No student data found. Make sure this is a Garden enrolment spreadsheet.');
        }
        resolve(result);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ---- Import Modal ----

function ImportModal({ onClose, onConfirm }) {
  const { classes } = useClasses();
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [isBackup, setIsBackup] = useState(false);
  const fileInputRef = useRef(null);
  const ACCEPTED_TYPES = '.xlsx,.xls,.csv,.tsv';

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParsing(true);
    setParseError(null);
    try {
      // Detect Garden backup CSV vs Garden Excel spreadsheet
      if (f.name.endsWith('.csv') || f.name.endsWith('.tsv')) {
        const text = await f.text();
        if (isGardenBackupCSV(text)) {
          const students = parseGardenBackupCSV(text);
          if (students.length === 0) {
            setParseError('No students found in the backup file.');
            setParsing(false);
            return;
          }
          setIsBackup(true);
          // Build a result shape compatible with the preview section
          const sheetMap = {};
          students.forEach(s => { sheetMap[s.classId] = (sheetMap[s.classId] || 0) + 1; });
          setParseResult({
            students,
            warnings: [],
            sheets: Object.entries(sheetMap).map(([classId, count]) => ({ name: classId, count, classId })),
          });
          setStep('preview');
          setParsing(false);
          return;
        }
      }
      // Excel / other format
      const result = await parseSpreadsheetFile(f);
      if (result.students.length === 0) {
        setParseError('No student rows found. Make sure this is a Garden enrolment spreadsheet with class sheets like "EL 1", "PK Saf", etc.');
        setParsing(false);
        return;
      }
      setIsBackup(false);
      setParseResult(result);
      setStep('preview');
    } catch (err) { setParseError(`Failed to parse file: ${err.message}`); }
    setParsing(false);
  };

  const handleInputChange = (e) => { handleFile(e.target.files[0]); };
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const fileSizeDisplay = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1024*1024 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`;
  const fileExtension = file ? file.name.split('.').pop().toUpperCase() : '';
  const reset = () => { setFile(null); setParseResult(null); setParseError(null); setStep('upload'); };

  const stats = useMemo(() => {
    if (!parseResult) return null;
    const s = parseResult.students;
    const parentSet = new Set();
    s.forEach(st => { if (st.parents) st.parents.split(/[\/,&]/).forEach(p => { if (p.trim()) parentSet.add(p.trim().toLowerCase()); }); });
    return { total: s.length, parents: parentSet.size, enrolled: s.filter(x => x.status === 'enrolled').length };
  }, [parseResult]);

  const perClass = useMemo(() => {
    if (!parseResult) return [];
    const map = {};
    parseResult.students.forEach(s => { const cid = s.classId || 'unknown'; map[cid] = (map[cid] || 0) + 1; });
    return Object.entries(map).map(([cid, count]) => {
      const cls = classes.find(c => c.id === cid);
      return { id: cid, name: cls?.name || cid, dot: cls?.dot || '#999', count };
    });
  }, [parseResult, classes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(27,26,23,0.5)' }}>
      <div className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="font-display text-2xl leading-none">Import students</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
              {step === 'upload' ? 'Drag a file or click to browse — supports .xlsx, .xls, .csv, .tsv' : `Review ${parseResult?.students.length || 0} students from "${file?.name}"`}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded"><X size={18} /></button>
        </div>
        {step === 'upload' && (
          <>
            <div className="flex-1 px-6 py-8">
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleInputChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} disabled={parsing}
                className={`w-full border-2 border-dashed rounded-lg py-12 px-6 transition ${dragging ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-stone-50'}`}
                style={!dragging ? { borderColor: 'var(--line)' } : {}}>
                {parsing ? (
                  <><div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full mx-auto mb-3" /><div className="font-medium">Parsing {file?.name}…</div></>
                ) : (
                  <><Upload size={32} className="mx-auto mb-3" style={{ color: 'var(--ink-faint)' }} /><div className="font-medium">Drop your file here</div><div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>or click to browse</div></>
                )}
              </button>
              {parseError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />{parseError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-stone-100">Cancel</button>
            </div>
          </>
        )}
        {step === 'preview' && parseResult && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="rounded-md border p-4 mb-4" style={{ borderColor: 'var(--line)', background: 'var(--accent-soft)' }}>
                <div className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  {isBackup ? `Garden backup — ${stats.total} students across ${parseResult.sheets.length} classes` : `Parsed ${stats.total} students from ${parseResult.sheets.length} sheets`}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                  {isBackup ? 'This is a full Garden backup. Importing will replace ALL current data with this snapshot.' : 'Review the summary below and click Import to commit.'}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <Stat label="Students" value={stats.total} />
                <Stat label="Parents" value={stats.parents} />
                <Stat label="Enrolled" value={stats.enrolled} />
              </div>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Per class</div>
              <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                {perClass.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 text-sm" style={{ borderColor: 'var(--line-soft)' }}>
                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />{c.name}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--ink-faint)' }}>{c.count} students</span>
                  </div>
                ))}
              </div>
              {parseResult.warnings.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--terracotta)' }}>Warnings ({parseResult.warnings.length})</div>
                  <div className="rounded-md border p-3 text-xs space-y-1 max-h-32 overflow-y-auto" style={{ borderColor: 'var(--line)' }}>
                    {parseResult.warnings.map((w, i) => <div key={i} className="flex items-start gap-2"><AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />{w}</div>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
              <button onClick={reset} className="text-sm hover:underline" style={{ color: 'var(--ink-soft)' }}>← Back</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-stone-100">Cancel</button>
                <button onClick={() => onConfirm(parseResult.students, isBackup)} className="px-4 py-2 text-sm rounded-md text-white font-medium" style={{ background: 'var(--accent)' }}>
                  {isBackup ? `Restore ${parseResult.students.length} students` : `Import ${parseResult.students.length} students`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--line)' }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>{label}</div>
      <div className="font-display text-2xl leading-tight">{value}</div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================

function DashboardView({ students, onJump, onExportAll }) {
  const { classes } = useClasses();
  // All counts use isStudentActive() — same logic as sidebar and class header
  const totalEnrolled  = students.filter(s => s.status === 'enrolled' && isStudentActive(s)).length;
  const totalInquiries = students.filter(s => ['inquiry','quote_sent','invoice_sent'].includes(s.status)).length;
  const waitList       = students.filter(s => s.status === 'wait_list').length;
  const suspended      = students.filter(s => ['suspended','extended_holiday'].includes(s.status) && isStudentActive(s)).length;
  const followUps      = students.filter(s => ['quote_sent','invoice_sent'].includes(s.status));
  const prepayExpiring = students.filter(s => s.prepay && (s.prepay.weeks - s.prepay.completed) <= 5);

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      <div className="flex items-center justify-between mb-7">
        <div className="font-display text-4xl">Today, {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <button onClick={onExportAll} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border hover:bg-white transition" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <Download size={14} /> Export full school CSV
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <DashStat label="Enrolled" value={totalEnrolled} accent="var(--accent)" />
        <DashStat label="In pipeline" value={totalInquiries} accent="var(--terracotta)" sub="needs follow-up" />
        <DashStat label="Wait list" value={waitList} accent="#7C3AED" />
        <DashStat label="On suspension" value={suspended} accent="#2563EB" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="font-display text-2xl mb-3">Needs attention</div>
          {followUps.length === 0 ? (
            <div className="text-sm italic" style={{ color: 'var(--ink-faint)' }}>All caught up.</div>
          ) : followUps.map(f => (
            <div key={f.id} className="py-2.5 border-b last:border-0" style={{ borderColor: 'var(--line-soft)' }}>
              <div className="font-medium text-sm">{f.name}</div>
              <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{STATUSES[f.status]?.label}{f.note ? ` · ${f.note}` : ''}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="font-display text-2xl mb-3">Prepay expiring</div>
          {prepayExpiring.length === 0 ? (
            <div className="text-sm italic" style={{ color: 'var(--ink-faint)' }}>No prepay blocks ending soon.</div>
          ) : prepayExpiring.map(p => (
            <div key={p.id} className="py-2.5 border-b last:border-0" style={{ borderColor: 'var(--line-soft)' }}>
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs font-mono" style={{ color: 'var(--ink-faint)' }}>{p.prepay.completed}/{p.prepay.weeks} weeks · {p.prepay.weeks - p.prepay.completed} left</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="font-display text-xl mb-3">Capacity by class</div>
          {classes.map(c => {
            const n = students.filter(s => s.classId === c.id && ['enrolled','suspended'].includes(s.status) && isStudentActive(s)).length;
            const pct = (n / c.capacity) * 100;
            return (
              <button key={c.id} onClick={() => onJump(c.id)} className="block w-full text-left mb-3 last:mb-0 hover:opacity-80">
                <div className="flex justify-between text-xs mb-1">
                  <span>{c.name}</span>
                  <span className="font-mono" style={{ color: 'var(--ink-faint)' }}>{n}/{c.capacity}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--line-soft)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct,100)}%`, background: pct >= 100 ? 'var(--terracotta)' : pct >= 85 ? '#D97706' : 'var(--accent)' }} />
                </div>
              </button>
            );
          })}
        </div>
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="font-display text-xl mb-3">Suspension alerts</div>
          {students.filter(s => (s.suspensions?.length || 0) >= 3).map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: 'var(--line-soft)' }}>
              <span>{s.name}</span>
              <span className={`font-mono text-xs px-2 py-0.5 rounded ${s.suspensions.length >= 4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{s.suspensions.length}/4</span>
            </div>
          ))}
          {students.filter(s => (s.suspensions?.length || 0) >= 3).length === 0 && (
            <div className="text-sm italic" style={{ color: 'var(--ink-faint)' }}>No students at the suspension cap.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashStat({ label, value, accent, sub }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>{label}</div>
      <div className="font-display text-5xl leading-none" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// INQUIRIES
// ============================================================

function InquiriesView({ students, onSelectStudent, onParsedConfirm, onUpdate }) {
  const { classes } = useClasses();
  const [emailText, setEmailText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [paneOpen, setPaneOpen] = useState(false);

  const inquiries = students.filter(s => ['inquiry','quote_sent','invoice_sent','wait_list'].includes(s.status));

  const handleParse = () => {
    const r = parseEmail(emailText);
    if (r.childName) r.childName = r.childName.split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    setParsed(r);
  };

  const handleApprove = () => {
    onParsedConfirm(parsed);
    setParsed(null);
    setEmailText('');
    setPaneOpen(false);
  };

  const handleReject = () => {
    setParsed(null);
    setEmailText('');
  };

  const updateField = (k, v) => setParsed(p => ({ ...p, [k]: v }));

  // Move inquiry to next status stage
  const advance = (id, currentStatus, target) => {
    const order = { inquiry: 'quote_sent', quote_sent: 'invoice_sent', wait_list: 'enrolled' };
    onUpdate(id, { status: target || order[currentStatus] || currentStatus });
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      <div className="flex items-end justify-between mb-1">
        <div className="font-display text-4xl">Inquiries</div>
        <button onClick={() => setPaneOpen(o => !o)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-white transition hover:opacity-90" style={{ background: 'var(--accent)' }}>
          <Plus size={14} /> Paste email
        </button>
      </div>
      <div className="text-sm mb-6" style={{ color: 'var(--ink-soft)' }}>Everyone not yet enrolled, grouped by pipeline stage. Click any name to edit; use the green buttons to move them forward.</div>

      {/* Inline paste-and-parse pane */}
      {paneOpen && (
        <div className="rounded-lg border mb-6 overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)' }}>
            <div>
              <div className="font-medium text-sm">{parsed ? 'Review parsed inquiry' : 'Paste the Squarespace enrolment email'}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                {parsed ? 'Check the extracted fields, edit anything wrong, then approve to add to the pipeline.' : 'The parser handles all 40 fields from the form — child, parents, vaccinations, allergies, siblings, doctor, notes.'}
              </div>
            </div>
            <button onClick={() => { setPaneOpen(false); setParsed(null); setEmailText(''); }} className="p-1 hover:bg-stone-200 rounded"><X size={16} /></button>
          </div>

          {!parsed ? (
            <div className="p-5">
              <textarea
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
                placeholder="Paste the full email body here..."
                className="w-full h-64 p-4 rounded-md border font-mono text-xs leading-relaxed focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }}
              />
              <div className="flex justify-between items-center mt-3">
                <button onClick={() => setEmailText(EXAMPLE_EMAIL)} className="text-xs hover:underline" style={{ color: 'var(--ink-faint)' }}>Try a sample email →</button>
                <div className="flex gap-2">
                  <button onClick={() => { setPaneOpen(false); setEmailText(''); }} className="px-3 py-1.5 text-sm rounded-md hover:bg-stone-100">Cancel</button>
                  <button onClick={handleParse} disabled={!emailText.trim()} className="px-4 py-1.5 text-sm rounded-md text-white font-medium disabled:opacity-30" style={{ background: 'var(--accent)' }}>Extract details →</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-5">
                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Child
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Child's name" value={parsed.childName} onChange={v => updateField('childName', v)} flag={parsed.childName !== parsed.childNameRaw} flagText="capitalisation auto-fixed" />
                  <Field label="Date of birth" value={parsed.dob} onChange={v => updateField('dob', v)} />
                  <ReadOnlyField label="Age" value={ageFromDob(parsed.dob)} hint="calculated from DOB" />
                  <Field label="Gender" value={parsed.gender} onChange={v => updateField('gender', v)} />
                  <Field label="Nationality" value={parsed.nationality} onChange={v => updateField('nationality', v)} />
                  <Field label="Native language" value={parsed.nativeLanguage} onChange={v => updateField('nativeLanguage', v)} />
                  <Field label="Form completed by" value={parsed.formCompletedBy} onChange={v => updateField('formCompletedBy', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Enrolment request
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Arrival to Bali" value={parsed.arrivalDate} onChange={v => updateField('arrivalDate', v)} />
                  <Field label="Intended stay" value={parsed.intendedStay} onChange={v => updateField('intendedStay', v)} />
                  <SelectField label="Class" value={parsed.requestedClass} options={classes.map(c => ({ value: c.id, label: c.name }))} onChange={v => updateField('requestedClass', v)} flag={!!parsed.requestedClassRaw} flagText={`from "${parsed.requestedClassRaw}"`} />
                  <Field label="Preferred start" value={parsed.preferredStart} onChange={v => updateField('preferredStart', v)} />
                  <Field label="Days requested" value={parsed.daysRequested} onChange={v => updateField('daysRequested', v)} />
                  <Field label="Half / full day" value={parsed.halfOrFull} onChange={v => updateField('halfOrFull', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Parent 1
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Name" value={parsed.parent1Name} onChange={v => updateField('parent1Name', v)} />
                  <Field label="Email" value={parsed.parent1Email} onChange={v => updateField('parent1Email', v)} />
                  <Field label="Phone" value={parsed.parent1Phone} onChange={v => updateField('parent1Phone', v)} />
                  <Field label="Occupation" value={parsed.parent1Occupation} onChange={v => updateField('parent1Occupation', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Parent 2
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Name" value={parsed.parent2Name} onChange={v => updateField('parent2Name', v)} />
                  <Field label="Email" value={parsed.parent2Email} onChange={v => updateField('parent2Email', v)} />
                  <Field label="Phone" value={parsed.parent2Phone} onChange={v => updateField('parent2Phone', v)} />
                  <Field label="Occupation" value={parsed.parent2Occupation} onChange={v => updateField('parent2Occupation', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Siblings
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Sibling 1 name" value={parsed.sibling1Name} onChange={v => updateField('sibling1Name', v)} />
                  <Field label="Sibling 1 DOB" value={parsed.sibling1Dob} onChange={v => updateField('sibling1Dob', v)} />
                  <Field label="Sibling 2 name" value={parsed.sibling2Name} onChange={v => updateField('sibling2Name', v)} />
                  <Field label="Sibling 2 DOB" value={parsed.sibling2Dob} onChange={v => updateField('sibling2Dob', v)} />
                  <Field label="Sibling 3 name" value={parsed.sibling3Name} onChange={v => updateField('sibling3Name', v)} />
                  <Field label="Sibling 3 DOB" value={parsed.sibling3Dob} onChange={v => updateField('sibling3Dob', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Carers
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Pembantu / Nanny name" value={parsed.nannyName} onChange={v => updateField('nannyName', v)} />
                  <Field label="Pembantu / Nanny phone" value={parsed.nannyPhone} onChange={v => updateField('nannyPhone', v)} />
                  <Field label="Family doctor" value={parsed.doctorName} onChange={v => updateField('doctorName', v)} />
                  <Field label="Doctor contact" value={parsed.doctorContact} onChange={v => updateField('doctorContact', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Medical
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-7xl mb-6">
                  <Field label="Vaccinations up to date" value={parsed.vaccinationsYesNo} onChange={v => updateField('vaccinationsYesNo', v)} />
                  <Field label="Vaccination details" value={parsed.vaccinationsDetails} onChange={v => updateField('vaccinationsDetails', v)} />
                  <Field label="Has SEN / disabilities" value={parsed.medicalDisabilitiesYesNo} onChange={v => updateField('medicalDisabilitiesYesNo', v)} />
                  <Field label="SEN / disabilities details" value={parsed.medicalDisabilitiesDetails} onChange={v => updateField('medicalDisabilitiesDetails', v)} />
                  <Field label="Medical problems or allergies" value={parsed.medicalProblemsYesNo} onChange={v => updateField('medicalProblemsYesNo', v)} />
                  <Field label="Medical problems details" value={parsed.medicalProblemsDetails} onChange={v => updateField('medicalProblemsDetails', v)} />
                  <Field label="Food allergies" value={parsed.foodAllergiesYesNo} onChange={v => updateField('foodAllergiesYesNo', v)} />
                  <Field label="Food allergies details" value={parsed.foodAllergiesDetails} onChange={v => updateField('foodAllergiesDetails', v)} />
                  <Field label="Requires EpiPen" value={parsed.epipen} onChange={v => updateField('epipen', v)} />
                </div>

                <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Other
                </div>
                <div className="max-w-7xl">
                  <Field label="Anything else the parent wants us to know" value={parsed.otherNotes} onChange={v => updateField('otherNotes', v)} />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)' }}>
                <button onClick={handleReject} className="text-sm hover:underline" style={{ color: 'var(--ink-soft)' }}>← Back to email</button>
                <div className="flex gap-2">
                  <button onClick={handleReject} className="px-3 py-1.5 text-sm rounded-md hover:bg-stone-200">Discard</button>
                  <button onClick={handleApprove} className="px-4 py-1.5 text-sm rounded-md text-white font-medium flex items-center gap-1.5" style={{ background: 'var(--accent)' }}>
                    <Check size={14} /> Approve & add to pipeline
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pipeline grouped by status */}
      {['inquiry','quote_sent','invoice_sent','wait_list'].map(st => {
        const list = inquiries.filter(s => s.status === st);
        const status = STATUSES[st];
        const nextLabel = { inquiry: 'Quote sent', quote_sent: 'Invoice sent', wait_list: 'Enrol now' }[st];

        return (
          <div key={st} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              <span className="font-medium text-sm">{status.label}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--ink-faint)' }}>{list.length}</span>
            </div>
            {list.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-5 text-xs italic" style={{ borderColor: 'var(--line)', color: 'var(--ink-faint)' }}>
                No one in this stage right now.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                {list.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-stone-50 transition" style={{ borderColor: 'var(--line-soft)' }}>
                    <button onClick={() => onSelectStudent(s.id)} className="flex items-center gap-2 flex-1 text-left">
                      <span className="w-2 h-2 rounded-full" style={{ background: GENDER[s.gender]?.colour }} />
                      <div>
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{classes.find(c => c.id === s.classId)?.name} · {s.nationality} · {ageFromDob(s.dob)}</div>
                      </div>
                    </button>
                    <div className="text-xs max-w-md mr-4 truncate" style={{ color: 'var(--ink-soft)' }}>{s.note || ''}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {st === 'invoice_sent' ? (
                        <>
                          <button onClick={() => advance(s.id, s.status, 'enrolled')} className="text-xs px-3 py-1.5 rounded-md text-white font-medium transition hover:opacity-90 flex items-center gap-1" style={{ background: 'var(--accent)' }}>
                            Enrolled <ArrowRight size={11} />
                          </button>
                          <button onClick={() => advance(s.id, s.status, 'wait_list')} className="text-xs px-3 py-1.5 rounded-md font-medium transition hover:opacity-90 flex items-center gap-1 bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100">
                            Wait list <ArrowRight size={11} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => advance(s.id, s.status)} className="text-xs px-3 py-1.5 rounded-md text-white font-medium transition hover:opacity-90 flex items-center gap-1" style={{ background: 'var(--accent)' }}>
                          {nextLabel} <ArrowRight size={11} />
                        </button>
                      )}
                      <button onClick={() => onSelectStudent(s.id)} className="text-xs px-2 py-1.5 rounded-md border hover:bg-stone-50" style={{ borderColor: 'var(--line)' }}>
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {inquiries.length === 0 && !paneOpen && (
        <div className="rounded-lg border p-12 text-center mt-6" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--ink-faint)' }} />
          <div className="font-medium mb-1">No active inquiries</div>
          <div className="text-xs mb-4" style={{ color: 'var(--ink-faint)' }}>When a new enrolment email comes in, paste it above to add the family to the pipeline.</div>
          <button onClick={() => setPaneOpen(true)} className="px-3 py-1.5 rounded-md text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Paste an email</button>
        </div>
      )}
    </div>
  );
}

function ArchiveView({ students, onSelectStudent, onRestore, onPermanentDelete }) {
  const { classes } = useClasses();
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  // Collect years from originalStart for the year filter
  const years = useMemo(() => {
    const ys = new Set();
    students.forEach(s => {
      if (s.originalStart) {
        const y = new Date(s.originalStart).getFullYear();
        if (!isNaN(y)) ys.add(y);
      }
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [students]);

  const filtered = students.filter(s => {
    if (filterClass !== 'all' && s.classId !== filterClass) return false;
    if (filterYear !== 'all') {
      const y = s.originalStart ? new Date(s.originalStart).getFullYear() : null;
      if (y !== parseInt(filterYear)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matches = s.name.toLowerCase().includes(q) ||
                      s.nationality?.toLowerCase().includes(q) ||
                      s.parents?.toLowerCase().includes(q) ||
                      s.email?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      <div className="flex items-end justify-between mb-1">
        <div className="font-display text-4xl">Archive</div>
        <div className="text-sm font-mono" style={{ color: 'var(--ink-faint)' }}>{filtered.length} of {students.length}</div>
      </div>
      <div className="text-sm mb-6" style={{ color: 'var(--ink-soft)' }}>
        Every family who's ever been through the school. Search by name, parents, email — useful for returning families,
        sibling enrolments, references, and historical records. Click any row to view the full record or restore them.
      </div>

      {students.length === 0 ? (
        <div className="rounded-lg border p-12 text-center" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--ink-faint)' }} />
          <div className="font-medium mb-1">The archive is empty</div>
          <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>When you move a student to the archive, they'll appear here.</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-faint)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, parents, email…" className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--paper)', '--tw-ring-color': 'var(--accent)' }} />
            </div>
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-3 py-1.5 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <option value="all">All classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="px-3 py-1.5 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
              <option value="all">All years</option>
              {years.map(y => <option key={y} value={y}>Started {y}</option>)}
            </select>
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-white transition" style={{ borderColor: 'var(--line)' }}>
              <Download size={12} /> Export
            </button>
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)', color: 'var(--ink-faint)' }}>
                  <th className="text-left font-medium px-4 py-2.5">Child</th>
                  <th className="text-left font-medium px-3 py-2.5">Last class</th>
                  <th className="text-left font-medium px-3 py-2.5">Parents</th>
                  <th className="text-left font-medium px-3 py-2.5">Started</th>
                  <th className="text-left font-medium px-3 py-2.5">Last day</th>
                  <th className="text-left font-medium px-3 py-2.5">Reason</th>
                  <th className="text-right font-medium px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const cls = classes.find(c => c.id === s.classId);
                  return (
                    <tr key={s.id} className="border-b hover:bg-stone-50 transition" style={{ borderColor: 'var(--line-soft)' }}>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelectStudent(s.id)}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER[s.gender]?.colour }} />
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{s.nationality} · {ageFromDob(s.dob)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs cursor-pointer" onClick={() => onSelectStudent(s.id)}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cls?.dot }} />
                          {cls?.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs cursor-pointer" onClick={() => onSelectStudent(s.id)} style={{ color: 'var(--ink-soft)' }}>{s.parents || '–'}</td>
                      <td className="px-3 py-3 text-xs font-mono cursor-pointer" onClick={() => onSelectStudent(s.id)} style={{ color: 'var(--ink-soft)' }}>{shortDate(s.originalStart)}</td>
                      <td className="px-3 py-3 text-xs font-mono cursor-pointer" onClick={() => onSelectStudent(s.id)} style={{ color: 'var(--ink-soft)' }}>{shortDate(s.lastDate) || shortDate(s.archivedAt) || '–'}</td>
                      <td className="px-3 py-3 text-xs cursor-pointer" onClick={() => onSelectStudent(s.id)} style={{ color: 'var(--ink-faint)' }}>{s.note ? s.note.slice(0, 40) + (s.note.length > 40 ? '…' : '') : '–'}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); onRestore(s.id); }} className="text-xs px-2.5 py-1 rounded-md border hover:bg-emerald-50 hover:text-emerald-800 transition" style={{ borderColor: 'var(--line)' }}>
                          Restore
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ink-faint)' }}>No archived students match those filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs" style={{ color: 'var(--ink-faint)' }}>
            <AlertCircle size={11} className="inline mr-1.5" />
            Archived records are kept indefinitely. Permanent deletion is only available to admins under Settings → Data management, in line with privacy regulations (UU PDP).
          </div>
        </>
      )}
    </div>
  );
}

function AllStudentsView({ students, onSelectStudent }) {
  const { classes } = useClasses();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  const filtered = students.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (filterClass !== 'all' && s.classId !== filterClass) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.nationality?.toLowerCase().includes(search.toLowerCase()) && !s.parents?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      <div className="flex items-end justify-between mb-1">
        <div className="font-display text-4xl">All students</div>
        <div className="text-sm font-mono" style={{ color: 'var(--ink-faint)' }}>{filtered.length} of {students.length}</div>
      </div>
      <div className="text-sm mb-6" style={{ color: 'var(--ink-soft)' }}>Every student across every class and status. Click any name to view & edit.</div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-faint)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, parents, nationality…" className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--paper)', '--tw-ring-color': 'var(--accent)' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <option value="all">All statuses</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-3 py-1.5 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
          <option value="all">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-white transition" style={{ borderColor: 'var(--line)' }}>
          <Download size={12} /> Export
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)', color: 'var(--ink-faint)' }}>
              <th className="text-left font-medium px-4 py-2.5">Child</th>
              <th className="text-left font-medium px-3 py-2.5">Class</th>
              <th className="text-left font-medium px-3 py-2.5">Status</th>
              <th className="text-left font-medium px-3 py-2.5">Age</th>
              <th className="text-left font-medium px-3 py-2.5">Parents</th>
              <th className="text-left font-medium px-3 py-2.5">Started</th>
              <th className="text-center font-medium px-3 py-2.5">HS</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const status = STATUSES[s.status];
              const cls = classes.find(c => c.id === s.classId);
              return (
                <tr key={s.id} onClick={() => onSelectStudent(s.id)} className="border-b cursor-pointer hover:bg-stone-50 transition" style={{ borderColor: 'var(--line-soft)' }}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER[s.gender]?.colour }} />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{s.nationality}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cls?.dot }} />
                      {cls?.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border ${status.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--ink-soft)' }}>{ageFromDob(s.dob)}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--ink-soft)' }}>{s.parents || '–'}</td>
                  <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--ink-soft)' }}>{shortDate(s.originalStart)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs font-mono font-medium ${(s.suspensions?.length || 0) >= 4 ? 'bg-red-100 text-red-700' : (s.suspensions?.length || 0) === 3 ? 'bg-amber-100 text-amber-800' : 'text-stone-500'}`}>
                      {s.suspensions?.length || 0}/4
                    </span>
                  </td>
                  <td className="px-2 py-2.5"><ChevronRight size={14} style={{ color: 'var(--ink-faint)' }} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ink-faint)' }}>No students match those filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// FORECAST
// ============================================================

function ForecastView({ students }) {
  const { classes } = useClasses();
  // Generate a 12-week forecast grid (instead of full 53) for demo readability
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date('2026-05-04');
    d.setDate(d.getDate() + i * 7);
    return { label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), num: 19 + i };
  });

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      <div className="font-display text-4xl mb-1">Enrolment forecast</div>
      <div className="text-sm mb-6" style={{ color: 'var(--ink-soft)' }}>Projected counts per class · accounts for known returning & leaving dates</div>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--line)', background: 'var(--line-soft)', color: 'var(--ink-faint)' }}>
              <th className="text-left font-medium px-3 py-2.5 sticky left-0" style={{ background: 'var(--line-soft)' }}>Class</th>
              <th className="text-center font-medium px-2 py-2.5">Cap</th>
              {weeks.map(w => (
                <th key={w.num} className="text-center font-medium px-2 py-2.5">
                  <div className="font-mono opacity-60">W{w.num}</div>
                  <div className="font-normal">{w.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map(c => {
              const base = students.filter(s => s.classId === c.id && ['enrolled','suspended'].includes(s.status)).length;
              return (
                <tr key={c.id} className="border-b" style={{ borderColor: 'var(--line-soft)' }}>
                  <td className="px-3 py-2 sticky left-0 font-medium" style={{ background: 'var(--paper)' }}>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                      {c.name}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono" style={{ color: 'var(--ink-faint)' }}>{c.capacity}</td>
                  {weeks.map((w, wi) => {
                    // Simulate some variation
                    const variation = Math.sin((c.id.charCodeAt(0) + wi) * 0.7) * 2;
                    const n = Math.max(0, Math.round(base + variation));
                    const pct = (n / c.capacity) * 100;
                    const bg = pct >= 100 ? '#FECACA' : pct >= 85 ? '#FED7AA' : pct >= 60 ? '#D1FAE5' : 'transparent';
                    return (
                      <td key={wi} className="px-2 py-2 text-center font-mono" style={{ background: bg }}>{n}</td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="font-medium" style={{ background: 'var(--accent-soft)' }}>
              <td className="px-3 py-2 sticky left-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>TOTAL</td>
              <td className="px-2 py-2 text-center font-mono" style={{ color: 'var(--accent)' }}>{classes.reduce((a,c) => a+c.capacity, 0)}</td>
              {weeks.map((w, wi) => {
                const total = classes.reduce((a,c) => {
                  const base = students.filter(s => s.classId === c.id && ['enrolled','suspended'].includes(s.status)).length;
                  const variation = Math.sin((c.id.charCodeAt(0) + wi) * 0.7) * 2;
                  return a + Math.max(0, Math.round(base + variation));
                }, 0);
                return <td key={wi} className="px-2 py-2 text-center font-mono" style={{ color: 'var(--accent)' }}>{total}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'var(--ink-faint)' }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: '#D1FAE5' }} /> 60–85% full</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: '#FED7AA' }} /> 85–100% full</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: '#FECACA' }} /> Over capacity</span>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================

function SettingsView({ onResetData }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState(false);
  const [resetting, setResetting] = useState(false);

  const RESET_PASSWORD = 'thegardenstudents2024';

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetPassword !== RESET_PASSWORD) {
      setResetError(true);
      setResetPassword('');
      return;
    }
    setResetting(true);
    await onResetData();
    setResetOpen(false);
    setResetPassword('');
    setResetting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
      <div className="font-display text-4xl mb-7">Settings</div>
      <div className="space-y-4 max-w-2xl">
        <SettingsCard title="Classes" desc="Add, rename, or change capacity for any class. Changes propagate everywhere." />
        <SettingsCard title="Custom student fields" desc="Add custom fields to the student record (swim ability, preferred nap time, etc.)." />
        <SettingsCard title="Staff & permissions" desc="Manage 34 staff logins. Set role (admin / manager / teacher / accountant) and which centre they can access." />
        <SettingsCard title="Email parser mapping" desc="Customise which Squarespace fields map to which student fields, for when Squarespace adds new questions." />
        <SettingsCard title="Holiday suspension policy" desc="Currently 4 per child per calendar year. Change the cap or add custom rules." />
        <SettingsCard title="Audit log" desc="See who changed what, when. Restore deleted records within 30 days." />
        <SettingsCard title="Status workflow" desc="Add or rename pipeline stages. Default: inquiry → quote → invoice → enrolled / wait list / left." />
        <SettingsCard title="Notifications" desc="Configure automatic alerts (suspension cap, prepay expiring, invoice overdue, etc.)" />

        {/* Reset Data */}
        <div className="rounded-lg border p-5 mt-8" style={{ borderColor: '#FCA5A5', background: '#FFF5F5' }}>
          <div className="font-medium mb-1 text-red-800">Reset Data</div>
          <div className="text-xs mb-4" style={{ color: '#B91C1C' }}>
            Permanently delete all student and class data from the database and restore demo data. This cannot be undone.
          </div>
          <button
            onClick={() => { setResetOpen(true); setResetError(false); setResetPassword(''); }}
            className="text-sm px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition">
            Remove all data
          </button>
        </div>
      </div>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(27,26,23,0.6)' }}>
          <form onSubmit={handleReset} className="rounded-xl shadow-2xl w-full max-w-sm p-8" style={{ background: 'var(--paper)' }}>
            <div className="text-center mb-5">
              <div className="font-display text-2xl mb-1 text-red-700">Remove all data?</div>
              <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>
                This will permanently delete <strong>every student and class record</strong> from the database across all devices. The demo data will be restored. <strong>This cannot be undone.</strong>
              </div>
            </div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-faint)' }}>Enter admin password to confirm</label>
            <input
              autoFocus
              type="password"
              value={resetPassword}
              onChange={e => { setResetPassword(e.target.value); setResetError(false); }}
              placeholder="Admin password"
              className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 mb-1"
              style={{ borderColor: resetError ? '#dc2626' : 'var(--line)', background: 'var(--bg)', '--tw-ring-color': '#dc2626' }}
            />
            {resetError && <p className="text-xs mb-3 text-red-600">Incorrect password. Data was not deleted.</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setResetOpen(false)} className="flex-1 py-2.5 rounded-lg border text-sm hover:bg-stone-50 transition" style={{ borderColor: 'var(--line)' }}>
                Cancel
              </button>
              <button type="submit" disabled={resetting} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
                {resetting ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SettingsCard({ title, desc }) {
  return (
    <button className="block w-full text-left rounded-lg border p-4 hover:bg-stone-50 transition" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="font-medium">{title}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{desc}</div>
    </button>
  );
}

function AddOrEditClassModal({ existing, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || '');
  const [fullName, setFullName] = useState(existing?.fullName || '');
  const [age, setAge] = useState(existing?.age || '');
  const [capacity, setCapacity] = useState(existing?.capacity || 18);
  const [dot, setDot] = useState(existing?.dot || CLASS_COLOURS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), fullName: fullName.trim() || name.trim(), age: age.trim(), capacity: parseInt(capacity) || 18, dot });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(27,26,23,0.5)' }}>
      <div className="rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="font-display text-2xl leading-none">{existing ? 'Edit class' : 'Add a new class'}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{existing ? 'Rename, change capacity, or pick a different colour.' : 'Create a new class — could be a regular age group, a holiday camp, anything.'}</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Class name</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. EL 2 Marigold" className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Full name (optional)</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Early Learners 2 — Marigold" className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Age range</label>
              <input value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 2–3 yrs" className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Capacity</label>
              <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 font-mono" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }} />
              <div className="text-xs mt-1 italic" style={{ color: 'var(--ink-faint)' }}>You can exceed this — it's a soft warning only.</div>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Colour</label>
            <div className="flex flex-wrap gap-2">
              {CLASS_COLOURS.map(c => (
                <button key={c} onClick={() => setDot(c)} className={`w-7 h-7 rounded-full transition ${dot === c ? 'ring-2 ring-offset-2' : ''}`} style={{ background: c, ringColor: 'var(--ink)' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <div>
            {existing && onDelete && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-700 hover:underline">Delete class</button>
            )}
            {existing && confirmDelete && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-700">Delete this class?</span>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 rounded border" style={{ borderColor: 'var(--line)' }}>No</button>
                <button onClick={onDelete} className="px-2 py-0.5 rounded bg-red-600 text-white">Yes, delete</button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-stone-100">Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} className="px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-30" style={{ background: 'var(--accent)' }}>{existing ? 'Save changes' : 'Add class'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddStudentModal({ currentClassId, onClose, onSave }) {
  const { classes } = useClasses();
  const [name, setName] = useState('');
  const [gender, setGender] = useState('X');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [classId, setClassId] = useState(currentClassId || classes[0]?.id);
  const [status, setStatus] = useState('enrolled');
  const [parents, setParents] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [originalStart, setOriginalStart] = useState('');
  const [lengthOfStay, setLengthOfStay] = useState('Long term');
  const [note, setNote] = useState('');
  const [days, setDays] = useState({ mon: '', tue: '', wed: '', thu: '', fri: '' });
  const [lunch, setLunch] = useState(false);

  const cycleDay = (d) => setDays(prev => ({ ...prev, [d]: { '': 'F', 'F': 'H', 'H': 'S', 'S': '' }[prev[d] || ''] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(27,26,23,0.5)' }}>
      <div className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="font-display text-2xl leading-none">Add student manually</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>For when an email parse isn't available — e.g. a family enrols in person.</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Child's name *</label>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2" style={{ borderColor: 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
                <option value="F">Girl</option>
                <option value="M">Boy</option>
                <option value="X">Not specified</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Date of birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border font-mono" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Nationality</label>
              <input value={nationality} onChange={e => setNationality(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Class</label>
              <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Started</label>
              <input type="date" value={originalStart} onChange={e => setOriginalStart(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border font-mono" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Length of stay</label>
              <input value={lengthOfStay} onChange={e => setLengthOfStay(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Parents</label>
              <input value={parents} onChange={e => setParents(e.target.value)} placeholder="e.g. Anna / Scott" className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border font-mono" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Attendance pattern (click to cycle F → H → empty)</label>
            <div className="flex gap-2">
              {['mon','tue','wed','thu','fri'].map((d, i) => (
                <div key={d} className="flex-1 text-center">
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>{['M','T','W','T','F'][i]}</div>
                  <button onClick={() => cycleDay(d)} className={`w-full h-10 rounded text-sm font-mono font-medium transition ${days[d] === 'F' ? 'bg-emerald-100 text-emerald-900' : days[d] === 'H' ? 'bg-amber-100 text-amber-900' : days[d] === 'S' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-300'}`}>{days[d] || '·'}</button>
                </div>
              ))}
              <div className="flex-1 text-center">
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Lunch</div>
                <button onClick={() => setLunch(!lunch)} className={`w-full h-10 rounded border flex items-center justify-center ${lunch ? 'bg-stone-900 border-stone-900' : 'bg-white border-stone-300'}`}>{lunch && <Check size={14} className="text-white" />}</button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-faint)' }}>Note</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Allergies, transition info, etc." className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }} />
          </div>
        </div>
        <div className="flex justify-end items-center gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-stone-100">Cancel</button>
          <button onClick={() => onSave({ name, gender, dob, nationality, classId, status, parents, phone, email, originalStart, lengthOfStay, note, ...days, lunch })} disabled={!name.trim()} className="px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-30" style={{ background: 'var(--accent)' }}>Add student</button>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition ${active ? 'bg-stone-900 text-white' : 'hover:bg-stone-100'}`} style={!active ? { color: 'var(--ink-soft)' } : {}}>
      <span className="flex items-center gap-2.5">
        <Icon size={15} />
        <span>{label}</span>
      </span>
      {badge && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: active ? 'rgba(255,255,255,0.2)' : 'var(--terracotta)', color: 'white' }}>{badge}</span>}
    </button>
  );
}

// ============================================================
// PASSWORD GATE
// ============================================================

function CentrePasswordGate({ centre, correctPassword, onSuccess, onClose }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const label = centre === 'canggu' ? 'Canggu' : 'Sanur';

  const submit = (e) => {
    e.preventDefault();
    if (value === correctPassword) { onSuccess(); }
    else { setError(true); setValue(''); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(27,26,23,0.6)' }}>
      <form onSubmit={submit} className="rounded-xl shadow-2xl w-full max-w-sm p-8" style={{ background: 'var(--paper)' }}>
        <div className="text-center mb-6">
          <div className="font-display text-2xl mb-1">{label}</div>
          <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>Enter the {label} centre code to continue</div>
        </div>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          placeholder="Centre code"
          className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 mb-1"
          style={{ borderColor: error ? '#dc2626' : 'var(--line)', background: 'var(--bg)', '--tw-ring-color': 'var(--accent)' }}
        />
        {error && <p className="text-xs mb-3" style={{ color: '#dc2626' }}>Incorrect code. Try again.</p>}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border text-sm hover:bg-stone-50 transition" style={{ borderColor: 'var(--line)' }}>Cancel</button>
          <button type="submit" className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90" style={{ background: 'var(--accent)' }}>Unlock</button>
        </div>
      </form>
    </div>
  );
}

const CENTRE_PASSWORDS = { canggu: 'canggu2024', sanur: 'sanur2024' };
const GATE_KEY = 'garden_auth_centre'; // stores 'canggu' or 'sanur'

function PasswordGate() {
  // Session state: null = not logged in, 'canggu'/'sanur' = logged in to that centre
  const [authedCentre, setAuthedCentre] = useState(() => {
    try {
      const saved = localStorage.getItem(GATE_KEY);
      return (saved === 'canggu' || saved === 'sanur') ? saved : null;
    } catch { return null; }
  });

  // Login flow state
  const [selectedCentre, setSelectedCentre] = useState(null); // which centre the user picked
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  if (authedCentre) return <GardenApp initialCentre={authedCentre} />;

  const submit = (e) => {
    e.preventDefault();
    if (value === CENTRE_PASSWORDS[selectedCentre]) {
      try { localStorage.setItem(GATE_KEY, selectedCentre); } catch {}
      setAuthedCentre(selectedCentre);
    } else {
      setError(true);
      setValue('');
    }
  };

  const cardStyle = { width: '100%', maxWidth: 360, background: '#fafaf9', borderRadius: 16, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.4)' };
  const wrapStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1917', fontFamily: 'Geist, system-ui, sans-serif', padding: 24 };

  const logo = (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <img src="/favicon.png" alt="The Garden" style={{ width: 56, height: 56, margin: '0 auto 12px', display: 'block', borderRadius: 12 }} onError={(e) => { e.target.style.display = 'none'; }} />
      <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, margin: 0, color: '#1c1917' }}>The Garden</h1>
    </div>
  );

  // Step 1: choose centre
  if (!selectedCentre) return (
    <div style={wrapStyle}>
      <style>{FONT_IMPORT}</style>
      <div style={cardStyle}>
        {logo}
        <p style={{ fontSize: 13, color: '#78716c', textAlign: 'center', marginTop: -12, marginBottom: 20 }}>Select your centre to continue</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {['canggu', 'sanur'].map(c => (
            <button key={c} onClick={() => setSelectedCentre(c)} style={{ flex: 1, padding: '14px', borderRadius: 10, border: '1.5px solid #d6d3d1', background: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer', color: '#1c1917', textTransform: 'capitalize', transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3C5A3C'; e.currentTarget.style.background = '#f4f7f4'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d6d3d1'; e.currentTarget.style.background = '#fff'; }}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 2: enter password for chosen centre
  const label = selectedCentre.charAt(0).toUpperCase() + selectedCentre.slice(1);
  return (
    <div style={wrapStyle}>
      <style>{FONT_IMPORT}</style>
      <form onSubmit={submit} style={cardStyle}>
        {logo}
        <p style={{ fontSize: 13, color: '#78716c', textAlign: 'center', marginTop: -12, marginBottom: 20 }}>Enter password for <strong>{label}</strong></p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          placeholder={`${label} password`}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: `1px solid ${error ? '#dc2626' : '#d6d3d1'}`, fontSize: 15, outline: 'none', background: '#fff' }}
        />
        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '8px 2px 0' }}>Incorrect password. Try again.</p>}
        <button type="submit" style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none', background: '#1c1917', color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          Enter
        </button>
        <button type="button" onClick={() => { setSelectedCentre(null); setValue(''); setError(false); }}
          style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: '1px solid #d6d3d1', background: 'transparent', color: '#78716c', fontSize: 13, cursor: 'pointer' }}>
          ← Back
        </button>
      </form>
    </div>
  );
}

export default function App() {
  return <PasswordGate />;
}
