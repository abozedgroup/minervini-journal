export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const base = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50';
  const variants = {
    primary: 'bg-gold text-black hover:bg-gold/90',
    secondary: 'bg-s2 border border-border text-fg hover:border-gold/50',
    danger: 'bg-red/20 text-red border border-red/50 hover:bg-red/30',
  };
  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
