/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			plataforma: {
  				naranja: '#E55302',
  				amarillo: '#F4AA00',
  				turquesa: '#0098AA',
  				rojo: '#C13832',
  				'rojo-oscuro': '#7A2531',
  				'gris-oscuro': '#36424A',
  				beige: '#C4C1A0',
  				'verde-oscuro': '#106470',
  				azul: '#0072B1'
  			},
  			// Claude Design tokens (oklch-based, via CSS vars)
  			bg:           'var(--bg)',
  			'bg-elev':    'var(--bg-elev)',
  			'bg-muted':   'var(--bg-muted)',
  			'bg-inset':   'var(--bg-inset)',
  			'border-soft': 'var(--border-soft)',
  			'border-strong': 'var(--border-strong)',
  			ink:          'var(--ink)',
  			'ink-2':      'var(--ink-2)',
  			'ink-muted':  'var(--ink-muted)',
  			'ink-muted-soft': 'var(--ink-muted-soft)',
  			'ck-primary': {
  				DEFAULT: 'var(--primary-ck)',
  				hover:   'var(--primary-h)',
  				soft:    'var(--primary-soft)',
  				ink:     'var(--primary-ink)',
  				fg:      'var(--primary-fg)',
  			},
  			success:      'var(--success-ck)',
  			'success-soft': 'var(--success-soft)',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			roboto: [
  				'Roboto',
  				'sans-serif'
  			],
  			montserrat: [
  				'Montserrat',
  				'sans-serif'
  			],
  			display: ['Montserrat', 'system-ui', 'sans-serif'],
  			mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  		},
  		boxShadow: {
  			ck:  '0 1px 0 oklch(0.92 0.005 250 / 1), 0 1px 2px oklch(0.18 0.02 255 / 0.04)',
  			pop: '0 10px 30px -10px oklch(0.18 0.02 255 / 0.18), 0 4px 12px -4px oklch(0.18 0.02 255 / 0.08)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
