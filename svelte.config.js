import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		experimental: {
			// Enable remote functions for type-safe client-server communication
			remoteFunctions: true
		}
	},
	compilerOptions: {
		experimental: {
			// Enable async components with top-level await
			async: true
		}
	}
};

export default config;
