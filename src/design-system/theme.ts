export const theme = {
  colors: {
    primary: '#FF6B35',    // Brand Saffron Orange (warm, friendly)
    secondary: '#FFB627',  // Amber/Yellow (bids, timers)
    success: '#2EC4B6',    // Cardamom green (success, deal completion)
    warning: '#FF9F1C',    // Warning Mustard
    error: '#E71D36',      // Chili Red (outbid warning, error alerts)
    background: '#FDFBF7', // Off-white cream (premium, minimal background)
    surface: '#FFFFFF',    // Surface white (cards, modals)
    text: '#1A1A1A',       // Charcoal (high-contrast, readable text)
    muted: '#7F8C8D',      // Cool Muted Grey
    border: '#E5E7EB',     // Light grey border
    white: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  typography: {
    fontFamily: {
      display: 'Spline Sans',
      mono: 'Courier New',
    },
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
  },
};

export type Theme = typeof theme;
