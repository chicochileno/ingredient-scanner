// Pure: derive the persistent header's content from the current path. No IO.
const TAB_TITLES = { '/home': 'IngredientScan', '/history': 'History', '/profiles': 'Profiles', '/lists': 'Lists' };
const EXACT = {
  '/results': { title: 'Results', backTo: '/home' },
  '/menu-results': { title: 'Menu Results', backTo: '/home' },
  '/support': { title: 'Support', backTo: '/home' },
  '/upgrade': { title: 'Upgrade', backTo: '/home' },
  '/upgrade/success': { title: 'Upgrade', backTo: '/home' },
};

export function headerForRoute(pathname) {
  if (TAB_TITLES[pathname]) return { title: TAB_TITLES[pathname], showLogo: true, backTo: null };
  if (EXACT[pathname]) return { title: EXACT[pathname].title, showLogo: false, backTo: EXACT[pathname].backTo };
  if (pathname.startsWith('/history/')) return { title: 'Scan', showLogo: false, backTo: '/history' };
  if (pathname.startsWith('/lists/')) return { title: 'List', showLogo: false, backTo: '/lists' };
  if (pathname.startsWith('/profiles/')) return { title: 'Edit Profile', showLogo: false, backTo: '/profiles' };
  return { title: '', showLogo: true, backTo: null };
}
