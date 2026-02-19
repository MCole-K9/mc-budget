import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
	let current = $state<Theme>('light');

	if (browser) {
		const stored = localStorage.getItem('theme') as Theme | null;
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		current = stored || (prefersDark ? 'dark' : 'light');
		document.documentElement.setAttribute('data-theme', current);
	}

	return {
		get current() {
			return current;
		},
		set current(value: Theme) {
			current = value;
			if (browser) {
				localStorage.setItem('theme', value);
				document.documentElement.setAttribute('data-theme', value);
			}
		}
	};
}

export const theme = createThemeStore();

export function toggleTheme() {
	theme.current = theme.current === 'light' ? 'dark' : 'light';
}

export function setTheme(newTheme: Theme) {
	theme.current = newTheme;
}
