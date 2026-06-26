// Centralized mock data for the Groundswell preview.
// Real Aurora DSQL + DynamoDB wiring happens in the next phase.

export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN'

export type CountryResult = {
  code: string
  flag: string
  name: string
  yes: number
  no: number
  players: number
}

export type AgeResult = {
  bucket: string
  yes: number
}

export const TODAY_QUESTION = {
  id: 'q-2026-06-26',
  category: 'Technology',
  text: 'Should AI-generated content be required to carry a disclosure label?',
  participants: 14847,
  globalYes: 67,
  globalNo: 28,
  globalAbstain: 5,
  status: 'Active' as const,
  date: 'June 26, 2026',
}

export const COUNTRY_RESULTS: CountryResult[] = [
  { code: 'US', flag: '🇺🇸', name: 'United States', yes: 63, no: 31, players: 3891 },
  { code: 'DE', flag: '🇩🇪', name: 'Germany', yes: 74, no: 22, players: 2341 },
  { code: 'IN', flag: '🇮🇳', name: 'India', yes: 78, no: 18, players: 2107 },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil', yes: 81, no: 14, players: 1876 },
  { code: 'JP', flag: '🇯🇵', name: 'Japan', yes: 41, no: 52, players: 1654 },
  { code: 'PK', flag: '🇵🇰', name: 'Pakistan', yes: 69, no: 26, players: 1203 },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', yes: 71, no: 25, players: 987 },
  { code: 'FR', flag: '🇫🇷', name: 'France', yes: 68, no: 27, players: 876 },
  { code: 'KR', flag: '🇰🇷', name: 'South Korea', yes: 55, no: 39, players: 743 },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria', yes: 84, no: 12, players: 654 },
]

export const AGE_RESULTS: AgeResult[] = [
  { bucket: '18–24', yes: 79 },
  { bucket: '25–34', yes: 71 },
  { bucket: '35–49', yes: 63 },
  { bucket: '50–64', yes: 54 },
  { bucket: '65+', yes: 43 },
]

export const CURRENT_USER = {
  username: 'Hafiz',
  initial: 'H',
  flag: '🇵🇰',
  country: 'Pakistan',
  streak: 7,
  empathyToday: 88,
  joined: 'March 2026',
  betterThan: 73,
  predictions: [
    { label: 'Europe', predicted: 64, actual: 68, error: 4, rating: 'Strong' as const },
    { label: 'Age 18–24', predicted: 75, actual: 79, error: 4, rating: 'Strong' as const },
  ],
}

export type LeaderboardEntry = {
  rank: number
  username: string
  flag: string
  country: string
  questions: number
  avgError: number
  empathyScore: number
  bestSegment: string
  isCurrentUser?: boolean
}

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: 'sofia_r', flag: '🇩🇪', country: 'Germany', questions: 132, avgError: 3.2, empathyScore: 847, bestSegment: 'Western Europe' },
  { rank: 2, username: 'kim_taeyong', flag: '🇰🇷', country: 'South Korea', questions: 128, avgError: 3.7, empathyScore: 841, bestSegment: 'East Asia' },
  { rank: 3, username: 'alejandro_v', flag: '🇲🇽', country: 'Mexico', questions: 125, avgError: 4.1, empathyScore: 829, bestSegment: 'Latin America' },
  { rank: 4, username: 'priya_n', flag: '🇮🇳', country: 'India', questions: 121, avgError: 4.9, empathyScore: 812, bestSegment: 'South Asia' },
  { rank: 5, username: 'Hafiz', flag: '🇵🇰', country: 'Pakistan', questions: 119, avgError: 5.8, empathyScore: 793, bestSegment: 'Southeast Asia', isCurrentUser: true },
  { rank: 6, username: 'liang_w', flag: '🇨🇳', country: 'China', questions: 117, avgError: 6.0, empathyScore: 781, bestSegment: 'East Asia' },
  { rank: 7, username: 'amara_o', flag: '🇳🇬', country: 'Nigeria', questions: 114, avgError: 6.3, empathyScore: 768, bestSegment: 'West Africa' },
  { rank: 8, username: 'lucas_m', flag: '🇧🇷', country: 'Brazil', questions: 110, avgError: 6.6, empathyScore: 754, bestSegment: 'Latin America' },
  { rank: 9, username: 'emma_t', flag: '🇬🇧', country: 'United Kingdom', questions: 108, avgError: 6.9, empathyScore: 742, bestSegment: 'Western Europe' },
  { rank: 10, username: 'yuki_s', flag: '🇯🇵', country: 'Japan', questions: 105, avgError: 7.2, empathyScore: 730, bestSegment: 'East Asia' },
  { rank: 11, username: 'noah_k', flag: '🇺🇸', country: 'United States', questions: 102, avgError: 7.5, empathyScore: 718, bestSegment: 'North America' },
  { rank: 12, username: 'aino_v', flag: '🇫🇮', country: 'Finland', questions: 99, avgError: 7.8, empathyScore: 705, bestSegment: 'Nordics' },
]

export const DEMOGRAPHIC_STRENGTHS = [
  { rank: 1, label: 'Southeast Asia', error: 3.1, rating: 'Excellent' as const, accuracy: 95 },
  { rank: 2, label: 'Europe', error: 5.4, rating: 'Strong' as const, accuracy: 85 },
  { rank: 3, label: 'Age 18–24', error: 6.8, rating: 'Good' as const, accuracy: 76 },
  { rank: 4, label: 'Latin America', error: 11.2, rating: 'Room to grow' as const, accuracy: 55 },
  { rank: 5, label: 'East Asia', error: 14.7, rating: 'Blind spot' as const, accuracy: 38 },
]

export type RecentQuestion = {
  date: string
  topic: string
  question: string
  vote: VoteChoice
  empathyScore: number
  predictionError: number
  breakdown: { label: string; predicted: number; actual: number }[]
}

export const RECENT_QUESTIONS: RecentQuestion[] = [
  {
    date: 'Jun 25',
    topic: 'Society',
    question: 'Should remote work be a legally protected right?',
    vote: 'YES',
    empathyScore: 91,
    predictionError: 4.5,
    breakdown: [
      { label: 'Europe', predicted: 72, actual: 75 },
      { label: 'Age 25–34', predicted: 80, actual: 86 },
    ],
  },
  {
    date: 'Jun 24',
    topic: 'Environment',
    question: 'Should single-use plastics be banned globally by 2030?',
    vote: 'YES',
    empathyScore: 84,
    predictionError: 7.0,
    breakdown: [
      { label: 'Latin America', predicted: 68, actual: 79 },
      { label: 'Age 50–64', predicted: 55, actual: 58 },
    ],
  },
  {
    date: 'Jun 23',
    topic: 'Economics',
    question: 'Is a universal basic income a realistic policy for this decade?',
    vote: 'NO',
    empathyScore: 76,
    predictionError: 9.5,
    breakdown: [
      { label: 'North America', predicted: 41, actual: 52 },
      { label: 'Age 18–24', predicted: 70, actual: 62 },
    ],
  },
  {
    date: 'Jun 22',
    topic: 'Healthcare',
    question: 'Should mental health days be mandatory paid leave?',
    vote: 'YES',
    empathyScore: 88,
    predictionError: 5.5,
    breakdown: [
      { label: 'East Asia', predicted: 60, actual: 66 },
      { label: 'Age 35–49', predicted: 64, actual: 69 },
    ],
  },
  {
    date: 'Jun 21',
    topic: 'Geopolitics',
    question: 'Should there be a global tax on cross-border carbon emissions?',
    vote: 'ABSTAIN',
    empathyScore: 72,
    predictionError: 10.0,
    breakdown: [
      { label: 'Africa', predicted: 75, actual: 61 },
      { label: 'Age 65+', predicted: 38, actual: 44 },
    ],
  },
]

export const TOPICS = [
  'Technology',
  'Society',
  'Environment',
  'Culture',
  'Economics',
  'Healthcare',
  'Geopolitics',
] as const

export type Topic = (typeof TOPICS)[number]

export type Candidate = {
  id: string
  text: string
  category: Topic
  divergence: number
  segments: string[]
  rationale: string
}

export const CANDIDATE_QUESTIONS: Record<string, Candidate[]> = {
  Technology: [
    {
      id: 'c1',
      text: 'Should social media platforms be legally required to let users turn off algorithmic feeds?',
      category: 'Technology',
      divergence: 8.2,
      segments: ['🌏 East Asia vs 🌍 Europe', '🧓 65+ vs 🧑 18–24'],
      rationale:
        'Attitudes toward platform regulation diverge sharply between high-trust European markets and engagement-driven East Asian markets.',
    },
    {
      id: 'c2',
      text: 'Should facial recognition in public spaces be banned outright?',
      category: 'Technology',
      divergence: 7.6,
      segments: ['🇨🇳 East Asia vs 🇩🇪 Europe', '🧓 50+ vs 🧑 18–24'],
      rationale:
        'Public-safety framing resonates differently across regions with varying surveillance norms.',
    },
    {
      id: 'c3',
      text: 'Should children under 16 be banned from social media accounts?',
      category: 'Technology',
      divergence: 6.9,
      segments: ['🧓 65+ vs 🧑 18–24', '🌎 Americas vs 🌏 Asia'],
      rationale:
        'Generational gap is the dominant divider; older cohorts strongly favor restrictions.',
    },
    {
      id: 'c4',
      text: 'Is it acceptable for employers to monitor staff productivity with software?',
      category: 'Technology',
      divergence: 5.4,
      segments: ['🌍 Europe vs 🌏 South Asia', '🧑 25–34 vs 🧓 50–64'],
      rationale:
        'Labor-protection cultures split from high-growth markets where monitoring is normalized.',
    },
    {
      id: 'c5',
      text: 'Should AI companions be marketed as a solution to loneliness?',
      category: 'Technology',
      divergence: 4.1,
      segments: ['🇯🇵 East Asia vs 🇺🇸 North America', '🧑 18–24 vs 🧓 65+'],
      rationale:
        'Cultural acceptance of synthetic companionship is far higher in some East Asian markets.',
    },
  ],
}
