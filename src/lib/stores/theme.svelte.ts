import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

class ThemeStore {
	current = $state<Theme>('light');

	constructor() {
		if (browser) {
			const stored = localStorage.getItem('theme') as Theme | null;
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			this.current = stored || (prefersDark ? 'dark' : 'light');
			document.documentElement.setAttribute('data-theme', this.current);
		}
	}

	set(value: Theme) {
		this.current = value;
		if (browser) {
			localStorage.setItem('theme', value);
			document.documentElement.setAttribute('data-theme', value);
		}
	}

	toggle() {
		this.set(this.current === 'light' ? 'dark' : 'light');
	}
}

export const theme = new ThemeStore();
