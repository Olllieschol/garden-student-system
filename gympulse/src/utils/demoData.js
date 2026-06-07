import { format, subDays, subMinutes, subHours } from 'date-fns'

const d = (daysAgo) => format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')

// 25 realistic Australian members — 8 green, 10 amber, 7 red
export const DEMO_MEMBERS = [
  // ── GREEN (8) ────────────────────────────────────────────────────────
  {
    member_id: 'M001', member_name: 'Jake Morrison', email: 'jake.morrison@gmail.com',
    phone: '0412 345 678', membership_type: 'Founding Member',
    join_date: '2022-03-15', last_visit_date: d(3),
    visits_last_30_days: 18, visits_prev_30_days: 16, visits_last_7_days: 4,
    bookings_last_30_days: 20, cancellations_last_30_days: 1, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Loves HIIT classes. Morning regular.',
  },
  {
    member_id: 'M002', member_name: 'Tom Nguyen', email: 'tom.nguyen@outlook.com',
    phone: '0423 456 789', membership_type: 'Student Membership',
    join_date: '2023-08-01', last_visit_date: d(1),
    visits_last_30_days: 20, visits_prev_30_days: 19, visits_last_7_days: 5,
    bookings_last_30_days: 21, cancellations_last_30_days: 0, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Visits 5x/week. Never misses.',
  },
  {
    member_id: 'M003', member_name: 'Priya Sharma', email: 'priya.sharma@gmail.com',
    phone: '0434 567 890', membership_type: 'Monthly Unlimited',
    join_date: '2023-01-10', last_visit_date: d(2),
    visits_last_30_days: 14, visits_prev_30_days: 13, visits_last_7_days: 3,
    bookings_last_30_days: 15, cancellations_last_30_days: 1, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Pilates and yoga focus.',
  },
  {
    member_id: 'M004', member_name: 'Liam O\'Brien', email: 'liam.obrien@icloud.com',
    phone: '0445 678 901', membership_type: 'Premium Unlimited',
    join_date: '2021-11-22', last_visit_date: d(4),
    visits_last_30_days: 16, visits_prev_30_days: 15, visits_last_7_days: 4,
    bookings_last_30_days: 17, cancellations_last_30_days: 0, no_shows_last_30_days: 1,
    membership_status: 'active', notes: 'Strength focus. Long-term member.',
  },
  {
    member_id: 'M005', member_name: 'Chloe Watkins', email: 'chloe.watkins@gmail.com',
    phone: '0456 789 012', membership_type: 'Monthly Unlimited',
    join_date: '2023-05-14', last_visit_date: d(1),
    visits_last_30_days: 12, visits_prev_30_days: 11, visits_last_7_days: 3,
    bookings_last_30_days: 13, cancellations_last_30_days: 0, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Evening classes only.',
  },
  {
    member_id: 'M006', member_name: 'Ethan Clarke', email: 'ethan.clarke@hotmail.com',
    phone: '0467 890 123', membership_type: 'Founding Member',
    join_date: '2022-01-05', last_visit_date: d(5),
    visits_last_30_days: 10, visits_prev_30_days: 12, visits_last_7_days: 2,
    bookings_last_30_days: 11, cancellations_last_30_days: 1, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'OG member. Very engaged with community.',
  },
  {
    member_id: 'M007', member_name: 'Mei Lin', email: 'mei.lin@gmail.com',
    phone: '0478 901 234', membership_type: 'Premium Unlimited',
    join_date: '2023-03-20', last_visit_date: d(3),
    visits_last_30_days: 15, visits_prev_30_days: 14, visits_last_7_days: 4,
    bookings_last_30_days: 16, cancellations_last_30_days: 0, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'CrossFit enthusiast.',
  },
  {
    member_id: 'M008', member_name: 'Ryan Fitzgerald', email: 'ryan.fitz@gmail.com',
    phone: '0489 012 345', membership_type: 'Monthly Unlimited',
    join_date: '2023-09-01', last_visit_date: d(2),
    visits_last_30_days: 9, visits_prev_30_days: 8, visits_last_7_days: 2,
    bookings_last_30_days: 10, cancellations_last_30_days: 1, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Still building routine.',
  },

  // ── AMBER (10) ───────────────────────────────────────────────────────
  {
    member_id: 'M009', member_name: 'Sophie Chen', email: 'sophie.chen@gmail.com',
    phone: '0490 123 456', membership_type: 'Monthly Unlimited',
    join_date: '2022-07-19', last_visit_date: d(18),
    visits_last_30_days: 5, visits_prev_30_days: 9, visits_last_7_days: 0,
    bookings_last_30_days: 7, cancellations_last_30_days: 2, no_shows_last_30_days: 1,
    membership_status: 'active', notes: 'Visits dropped 45% this month.',
  },
  {
    member_id: 'M010', member_name: 'Daniel Park', email: 'daniel.park@outlook.com',
    phone: '0401 234 567', membership_type: '10-Class Pack',
    join_date: '2023-06-11', last_visit_date: d(16),
    visits_last_30_days: 3, visits_prev_30_days: 7, visits_last_7_days: 0,
    bookings_last_30_days: 5, cancellations_last_30_days: 2, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Class pack running low.',
  },
  {
    member_id: 'M011', member_name: 'Natalie Hughes', email: 'nat.hughes@icloud.com',
    phone: '0412 345 670', membership_type: 'Monthly Unlimited',
    join_date: '2022-11-30', last_visit_date: d(14),
    visits_last_30_days: 4, visits_prev_30_days: 10, visits_last_7_days: 1,
    bookings_last_30_days: 8, cancellations_last_30_days: 3, no_shows_last_30_days: 1,
    membership_status: 'active', notes: 'Work commitments impacting attendance.',
  },
  {
    member_id: 'M012', member_name: 'Jordan Bailey', email: 'j.bailey@gmail.com',
    phone: '0423 456 780', membership_type: 'Student Membership',
    join_date: '2023-02-14', last_visit_date: d(15),
    visits_last_30_days: 4, visits_prev_30_days: 8, visits_last_7_days: 1,
    bookings_last_30_days: 6, cancellations_last_30_days: 2, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Exam period — may be busy.',
  },
  {
    member_id: 'M013', member_name: 'Isabelle Dupont', email: 'isabelle.d@gmail.com',
    phone: '0434 567 891', membership_type: 'Premium Unlimited',
    join_date: '2022-05-08', last_visit_date: d(17),
    visits_last_30_days: 3, visits_prev_30_days: 8, visits_last_7_days: 0,
    bookings_last_30_days: 5, cancellations_last_30_days: 2, no_shows_last_30_days: 1,
    membership_status: 'active', notes: '',
  },
  {
    member_id: 'M014', member_name: 'Connor Walsh', email: 'c.walsh@hotmail.com',
    phone: '0445 678 902', membership_type: 'Monthly Unlimited',
    join_date: '2023-04-22', last_visit_date: d(14),
    visits_last_30_days: 6, visits_prev_30_days: 10, visits_last_7_days: 2,
    bookings_last_30_days: 8, cancellations_last_30_days: 2, no_shows_last_30_days: 0,
    membership_status: 'active', notes: '',
  },
  {
    member_id: 'M015', member_name: 'Emily Rodriguez', email: 'emily.r@gmail.com',
    phone: '0456 789 013', membership_type: '10-Class Pack',
    join_date: '2023-07-03', last_visit_date: d(16),
    visits_last_30_days: 2, visits_prev_30_days: 6, visits_last_7_days: 0,
    bookings_last_30_days: 4, cancellations_last_30_days: 2, no_shows_last_30_days: 1,
    membership_status: 'active', notes: '4 classes remaining on pack.',
  },
  {
    member_id: 'M016', member_name: 'Oliver Thompson', email: 'oli.t@icloud.com',
    phone: '0467 890 124', membership_type: 'Founding Member',
    join_date: '2021-12-15', last_visit_date: d(19),
    visits_last_30_days: 3, visits_prev_30_days: 7, visits_last_7_days: 0,
    bookings_last_30_days: 5, cancellations_last_30_days: 2, no_shows_last_30_days: 0,
    membership_status: 'active', notes: '',
  },
  {
    member_id: 'M017', member_name: 'Zara Ahmed', email: 'zara.ahmed@gmail.com',
    phone: '0478 901 235', membership_type: 'Monthly Unlimited',
    join_date: '2023-08-19', last_visit_date: d(14),
    visits_last_30_days: 5, visits_prev_30_days: 9, visits_last_7_days: 1,
    bookings_last_30_days: 7, cancellations_last_30_days: 2, no_shows_last_30_days: 0,
    membership_status: 'active', notes: '',
  },
  {
    member_id: 'M018', member_name: 'Ben Stevenson', email: 'ben.steve@gmail.com',
    phone: '0489 012 346', membership_type: 'Student Membership',
    join_date: '2024-01-10', last_visit_date: d(15),
    visits_last_30_days: 3, visits_prev_30_days: 7, visits_last_7_days: 0,
    bookings_last_30_days: 5, cancellations_last_30_days: 1, no_shows_last_30_days: 1,
    membership_status: 'active', notes: '',
  },

  // ── RED (7) ──────────────────────────────────────────────────────────
  {
    member_id: 'M019', member_name: 'Marcus Webb', email: 'marcus.webb@gmail.com',
    phone: '0490 123 457', membership_type: '10-Class Pack',
    join_date: '2022-09-14', last_visit_date: d(31),
    visits_last_30_days: 1, visits_prev_30_days: 8, visits_last_7_days: 0,
    bookings_last_30_days: 3, cancellations_last_30_days: 2, no_shows_last_30_days: 1,
    membership_status: 'active', notes: 'Hasn\'t been in over a month.',
  },
  {
    member_id: 'M020', member_name: 'Aisha Patel', email: 'aisha.patel@outlook.com',
    phone: '0401 234 568', membership_type: 'Premium Unlimited',
    join_date: '2022-04-01', last_visit_date: d(24),
    visits_last_30_days: 2, visits_prev_30_days: 12, visits_last_7_days: 0,
    bookings_last_30_days: 6, cancellations_last_30_days: 3, no_shows_last_30_days: 2,
    membership_status: 'active', notes: '3 cancellations, visits down 83%.',
  },
  {
    member_id: 'M021', member_name: 'Tyler Brooks', email: 'tyler.b@icloud.com',
    phone: '0412 345 671', membership_type: 'Monthly Unlimited',
    join_date: '2023-03-08', last_visit_date: d(28),
    visits_last_30_days: 1, visits_prev_30_days: 9, visits_last_7_days: 0,
    bookings_last_30_days: 2, cancellations_last_30_days: 1, no_shows_last_30_days: 2,
    membership_status: 'active', notes: '',
  },
  {
    member_id: 'M022', member_name: 'Grace Kim', email: 'grace.kim@gmail.com',
    phone: '0423 456 781', membership_type: 'Monthly Unlimited',
    join_date: '2022-10-17', last_visit_date: d(22),
    visits_last_30_days: 2, visits_prev_30_days: 11, visits_last_7_days: 0,
    bookings_last_30_days: 4, cancellations_last_30_days: 3, no_shows_last_30_days: 1,
    membership_status: 'active', notes: 'Was very engaged — sudden drop.',
  },
  {
    member_id: 'M023', member_name: 'Jack Harrison', email: 'jack.h@hotmail.com',
    phone: '0434 567 892', membership_type: 'Founding Member',
    join_date: '2021-10-03', last_visit_date: d(35),
    visits_last_30_days: 0, visits_prev_30_days: 7, visits_last_7_days: 0,
    bookings_last_30_days: 1, cancellations_last_30_days: 1, no_shows_last_30_days: 0,
    membership_status: 'active', notes: 'Founding member — needs urgent follow-up.',
  },
  {
    member_id: 'M024', member_name: 'Olivia Nguyen', email: 'olivia.ng@gmail.com',
    phone: '0445 678 903', membership_type: 'Student Membership',
    join_date: '2023-11-20', last_visit_date: d(26),
    visits_last_30_days: 1, visits_prev_30_days: 8, visits_last_7_days: 0,
    bookings_last_30_days: 3, cancellations_last_30_days: 2, no_shows_last_30_days: 2,
    membership_status: 'active', notes: '',
  },
  {
    member_id: 'M025', member_name: 'Sam Kowalski', email: 'sam.k@gmail.com',
    phone: '0456 789 014', membership_type: '10-Class Pack',
    join_date: '2023-12-05', last_visit_date: d(29),
    visits_last_30_days: 1, visits_prev_30_days: 6, visits_last_7_days: 0,
    bookings_last_30_days: 2, cancellations_last_30_days: 1, no_shows_last_30_days: 1,
    membership_status: 'active', notes: '2 classes left on pack.',
  },
]

// Demo leads for the CRM pipeline
export const DEMO_LEADS = [
  { id: 'L001', name: 'Jessica Moore', phone: '0411 111 001', email: 'jessica.moore@gmail.com', source: 'Instagram', stage: 'enquiry', added: format(subDays(new Date(), 2), 'yyyy-MM-dd'), notes: 'Interested in morning classes' },
  { id: 'L002', name: 'Nathan Reid', phone: '0422 222 002', email: 'n.reid@outlook.com', source: 'Referral', stage: 'trial_booked', added: format(subDays(new Date(), 5), 'yyyy-MM-dd'), notes: 'Referred by Jake Morrison' },
  { id: 'L003', name: 'Amy Chang', phone: '0433 333 003', email: 'amy.chang@gmail.com', source: 'Google', stage: 'trial_completed', added: format(subDays(new Date(), 8), 'yyyy-MM-dd'), notes: 'Loved the session' },
  { id: 'L004', name: 'Derek Santos', phone: '0444 444 004', email: 'derek.s@icloud.com', source: 'Walk-in', stage: 'follow_up_sent', added: format(subDays(new Date(), 11), 'yyyy-MM-dd'), notes: 'Considering Monthly Unlimited' },
  { id: 'L005', name: 'Rachel Liu', phone: '0455 555 005', email: 'rachel.liu@gmail.com', source: 'Instagram', stage: 'enquiry', added: format(subDays(new Date(), 1), 'yyyy-MM-dd'), notes: '' },
  { id: 'L006', name: 'Brad Wilson', phone: '0466 666 006', email: 'brad.w@hotmail.com', source: 'Referral', stage: 'converted', added: format(subDays(new Date(), 14), 'yyyy-MM-dd'), notes: 'Signed up for Premium Unlimited' },
]

// Demo inbox conversations
export const DEMO_CONVERSATIONS = [
  {
    id: 'CV001',
    member_id: 'M019',
    member_name: 'Marcus Webb',
    risk_level: 'red',
    status: 'awaiting', // gym needs to follow up
    unread: false,
    preferred_class: 'Boxing — Mon/Wed evenings',
    messages: [
      {
        id: 1, from: 'gym',
        text: "Hey Marcus! We noticed you haven't been in for a while — hope everything's going okay. Your spot is always here when you're ready. Is there anything we can do to help?",
        time: format(subDays(new Date(), 3), 'MMM d, h:mm a'),
      },
      {
        id: 2, from: 'member',
        text: "Thanks for checking in! Been super hectic with work lately. Planning to get back next week for sure.",
        time: format(subDays(new Date(), 2), 'MMM d, h:mm a'),
      },
    ],
  },
  {
    id: 'CV002',
    member_id: 'M023',
    member_name: 'Jack Harrison',
    risk_level: 'red',
    status: 'awaiting',
    unread: false,
    preferred_class: 'CrossFit — Tue/Thu 6am',
    messages: [
      {
        id: 1, from: 'gym',
        text: "Jack! As one of our founding members your commitment has always inspired the community. We've missed you over the last month — is there anything going on we should know about?",
        time: format(subDays(new Date(), 5), 'MMM d, h:mm a'),
      },
      {
        id: 2, from: 'member',
        text: "Hey, yeah I've been dealing with a knee injury. Physio says I should be right to train again in a couple of weeks.",
        time: format(subDays(new Date(), 4), 'MMM d, h:mm a'),
      },
    ],
  },
  {
    id: 'CV003',
    member_id: 'M020',
    member_name: 'Aisha Patel',
    risk_level: 'red',
    status: 'unread',
    unread: true,
    preferred_class: 'HIIT — Wed/Fri 5:30pm',
    messages: [
      {
        id: 1, from: 'gym',
        text: "Hi Aisha! We've noticed your attendance has dropped recently and wanted to reach out personally. You were such a regular at our HIIT sessions — we'd love to have you back. Is there anything we can help with?",
        time: format(subDays(new Date(), 1), 'MMM d, h:mm a'),
      },
    ],
  },
  {
    id: 'CV004',
    member_id: 'M022',
    member_name: 'Grace Kim',
    risk_level: 'red',
    status: 'unread',
    unread: true,
    preferred_class: 'Pilates — Mon/Wed 9am',
    messages: [
      {
        id: 1, from: 'gym',
        text: "Grace, we've been thinking about you! You were so consistent with your Pilates sessions earlier this year. We're running a special recovery program — would love to get you back on track. Let us know if there's anything going on.",
        time: format(subHours(new Date(), 18), 'MMM d, h:mm a'),
      },
    ],
  },
  {
    id: 'CV005',
    member_id: 'M011',
    member_name: 'Natalie Hughes',
    risk_level: 'amber',
    status: 'archived',
    unread: false,
    preferred_class: 'Yoga — Tue/Thu 7pm',
    messages: [
      {
        id: 1, from: 'gym',
        text: "Hey Natalie! Just checking in — we noticed your attendance has dipped a bit this month. Everything okay?",
        time: format(subDays(new Date(), 10), 'MMM d, h:mm a'),
      },
      {
        id: 2, from: 'member',
        text: "Hi! Yeah work has been crazy. I'll be back this week I promise!",
        time: format(subDays(new Date(), 9), 'MMM d, h:mm a'),
      },
      {
        id: 3, from: 'gym',
        text: "No worries at all — life happens! We'll see you soon. We've saved your usual Tuesday spot.",
        time: format(subDays(new Date(), 9), 'MMM d, h:mm a'),
      },
    ],
  },
  {
    id: 'CV006',
    member_id: 'M009',
    member_name: 'Sophie Chen',
    risk_level: 'amber',
    status: 'unread',
    unread: true,
    preferred_class: 'Pilates — Mon/Wed/Fri 9am',
    messages: [
      {
        id: 1, from: 'gym',
        text: "Hi Sophie! We noticed you've only made it in a few times this month — we know life gets busy. Just wanted to let you know we're here and happy to adjust your schedule or find a class time that works better for you.",
        time: format(subMinutes(new Date(), 90), 'MMM d, h:mm a'),
      },
    ],
  },
]

// Demo outreach log
export const DEMO_OUTREACH = [
  { id: 'O001', member_id: 'M019', member_name: 'Marcus Webb', date_contacted: format(subDays(new Date(), 3), 'yyyy-MM-dd'), risk_level: 'red', message_type: 'SMS', outcome: 'pending', notes: '' },
  { id: 'O002', member_id: 'M009', member_name: 'Sophie Chen', date_contacted: format(subDays(new Date(), 5), 'yyyy-MM-dd'), risk_level: 'amber', message_type: 'Email', outcome: 'returned', notes: '' },
  { id: 'O003', member_id: 'M022', member_name: 'Grace Kim', date_contacted: format(subDays(new Date(), 2), 'yyyy-MM-dd'), risk_level: 'red', message_type: 'Email', outcome: 'pending', notes: '' },
]
