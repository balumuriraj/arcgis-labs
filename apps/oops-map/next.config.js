/** @type {import('next').NextConfig} */
const nextConfig = {
	turbopack: {
		rules: {
			"*.md": {
				loaders: ["raw-loader"],
				as: "*.js",
			},
		},
	},

	webpack(config) {
		config.module.rules.push({
			test: /\.md$/,
			type: "asset/source",
		});

		return config;
	},
};

export default nextConfig;
