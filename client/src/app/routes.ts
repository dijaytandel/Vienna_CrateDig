export type Access = 'guest' | 'collector' | 'store_manager';

export interface ScreenRoute {
  path: string;
  title: string;
  stories: string[];
  access: Access;
}

// Mirrors docs/SITEMAP.md §4.
export const SCREEN_ROUTES: ScreenRoute[] = [
  { path: '/discover', title: 'Discover', stories: ['US-01'], access: 'guest' },
  { path: '/welcome', title: 'Welcome to CrateDig', stories: ['US-01'], access: 'guest' },
  { path: '/login', title: 'Log In', stories: ['US-01'], access: 'guest' },
  { path: '/signup', title: 'Create Account', stories: ['US-01'], access: 'guest' },
  { path: '/search', title: 'Search', stories: ['US-05'], access: 'guest' },
  {
    path: '/sightings/:id',
    title: 'Sighting Details',
    stories: ['US-05', 'US-06', 'US-09'],
    access: 'guest',
  },
  { path: '/broadcasts/:id', title: 'Store Broadcast', stories: ['US-08'], access: 'guest' },
  { path: '/stores', title: 'Record Stores', stories: ['US-07'], access: 'guest' },
  { path: '/stores/:id', title: 'Store Profile', stories: ['US-07'], access: 'guest' },
  {
    path: '/albums/:id',
    title: 'Album Details',
    stories: ['US-02', 'US-03', 'US-05'],
    access: 'guest',
  },
  { path: '/report', title: 'Report a Sighting', stories: ['US-06'], access: 'collector' },
  { path: '/crate', title: 'My Crate', stories: ['US-02', 'US-03'], access: 'collector' },
  { path: '/crate/add', title: 'Add a Record', stories: ['US-02', 'US-03'], access: 'collector' },
  { path: '/crate/items/:id', title: 'Crate Item', stories: ['US-04'], access: 'collector' },
  { path: '/profile', title: 'Profile & Preferences', stories: ['US-10'], access: 'collector' },
  { path: '/merchant/verify', title: 'Verify as Store Manager', stories: [], access: 'collector' },
  {
    path: '/merchant',
    title: 'Merchant Dashboard',
    stories: ['US-08', 'US-09'],
    access: 'store_manager',
  },
  {
    path: '/merchant/sightings',
    title: 'Sighting Verification',
    stories: ['US-09'],
    access: 'store_manager',
  },
  {
    path: '/merchant/broadcasts',
    title: 'Broadcasts',
    stories: ['US-08'],
    access: 'store_manager',
  },
  {
    path: '/merchant/broadcasts/new',
    title: 'New Broadcast',
    stories: ['US-08'],
    access: 'store_manager',
  },
  {
    path: '/merchant/store',
    title: 'Edit Store Profile',
    stories: ['US-07'],
    access: 'store_manager',
  },
];

export const TABS = [
  { to: '/discover', label: 'Discover', icon: '◉' },
  { to: '/search', label: 'Search', icon: '⌕' },
  { to: '/report', label: 'Report', icon: '+' },
  { to: '/stores', label: 'Stores', icon: '▦' },
  { to: '/crate', label: 'My Crate', icon: '▤' },
] as const;
