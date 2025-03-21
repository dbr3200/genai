function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      ...require("@amorphic/amorphic-ui-core").tailwindThemeConfig.theme, // Tailwind wasn't generating few styles when the config was used as a preset
      fontSize: {
        "4xl": ["2.5rem", "2.5rem"], // font-size: 40px
        3: ["12px"],
        4: ["14px"],
        5: ["16px"]
      },
      fontFamily: {
        ...require("@amorphic/amorphic-ui-core").tailwindThemeConfig.theme.fontFamily,
        poppins: ['Poppins', 'sans'],
      },
      colors: {
        ...require("@amorphic/amorphic-ui-core").tailwindThemeConfig.theme.colors,
        primary: withOpacity('--color-primary'),
        "primary-50": withOpacity('--color-primary-50'),
        "primary-100": withOpacity('--color-primary-100'),
        "primary-150": withOpacity('--color-primary-150'),
        "primary-200": withOpacity('--color-primary-200'),
        "primary-250": withOpacity('--color-primary-250'),
        "primary-300": withOpacity('--color-primary-300'),
        "primary-400": withOpacity('--color-primary-400'),
        secondary: withOpacity('--color-secondary'),
        "secondary-50": withOpacity('--color-secondary-50'),
        "secondary-100": withOpacity('--color-secondary-100'),
        "secondary-150": withOpacity('--color-secondary-150'),
        "secondary-200": withOpacity('--color-secondary-200'),
        "secondary-250": withOpacity('--color-secondary-250'),
        "secondary-300": withOpacity('--color-secondary-300'),
        "secondary-350": withOpacity('--color-secondary-350'),
        "secondary-400": withOpacity('--color-secondary-400'),
        "secondary-450": withOpacity('--color-secondary-450'),
        "secondary-500": withOpacity('--color-secondary-500'),
        success: withOpacity('--color-success'),
        "success-50": withOpacity('--color-success-50'),
        "success-100": withOpacity('--color-success-100'),
        danger: withOpacity('--color-danger'),
        "danger-50": withOpacity('--color-danger-50'),
        warning: withOpacity('--color-warning'),
        dark: withOpacity('--color-dark'),
        "dark-100": withOpacity('--color-dark-100'),
        "dark-200": withOpacity('--color-dark-200'),
        "dark-300": withOpacity('--color-dark-300'),
        "snow" : withOpacity('--snow'),
        "icy-blue" : withOpacity('--icy-blue'),
        "azure-white" : withOpacity('--azure-white'),
        "ghost-white" : withOpacity('--ghost-white'),
        "light-gray" : withOpacity('--light-gray'),
        "light-steel-blue" : withOpacity('--light-steel-blue'),
        "light-sky-blue" : withOpacity('--light-sky-blue'),
        "sky-blue" : withOpacity('--sky-blue'),
        "dark-gray" : withOpacity('--dark-gray'),
        "dim-gray" : withOpacity('--dim-gray'),
        "charcoal" : withOpacity('--charcoal'),
        "ebony" : withOpacity('--ebony'),
        "black" : withOpacity('--black'),
        "royal-blue" : withOpacity('--royal-blue'),
        "eerie-black" : withOpacity('--eerie-black'),
        "jet-black" : withOpacity('--jet-black'),
        "dodger-blue" : withOpacity('--dodger-blue'),
        "turquoise" : withOpacity('--turquoise'),
        "forest-green" : withOpacity('--forest-green'),
        "lime-green" : withOpacity('--lime-green'),
        "goldenrod" : withOpacity('--goldenrod'),
        "crimson-red" : withOpacity('--crimson-red'),
        "salmon" : withOpacity('--salmon')   
      },
      minWidth: {
        "1/4": "25%",
        "1/3": "33%",
        "1/2": "50%",
        "3/4": "75%",
        "25vh": "25vh",
        "50vh": "50vh",
        "75vh": "75vh",
      },
      transitionProperty: {
        width: "width",
      },
      borderWidth: {
        DEFAULT: "0.063rem",
        0: "0",
        1: "1px",
        2: "0.125rem",
        3: "0.188rem",
        5: "0.3125rem",
      },
    },
  },
  plugins: [require("tailwindcss-rtl")],
};
