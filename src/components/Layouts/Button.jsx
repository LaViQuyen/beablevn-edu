export default function Button({ children, onClick, type = "button", variant = "primary", style, disabled }) {
  const variants = {
    primary: { backgroundColor: '#003366', color: 'white' }, // Xanh dương đậm chủ đạo
    outline: { backgroundColor: 'transparent', color: '#003366', border: '1px solid #003366' },
    danger: { backgroundColor: '#dc2626', color: 'white' },
    disabled: { backgroundColor: '#cbd5e1', color: '#f8fafc', cursor: 'not-allowed' }
  };

  const currentVariant = disabled ? variants.disabled : variants[variant];

  const baseStyle = {
    padding: '12px 24px',
    border: variant === 'outline' ? currentVariant.border : 'none',
    borderRadius: '6px', // Góc bo nhẹ, tối giản
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: '600',
    fontSize: '15px',
    fontFamily: "'Josefin Sans', sans-serif",
    transition: 'all 0.2s ease',
    ...currentVariant,
    ...style
  };

  return (
    <button 
      type={type} 
      onClick={disabled ? null : onClick} 
      style={baseStyle}
      onMouseOver={(e) => !disabled && (e.currentTarget.style.opacity = '0.85')}
      onMouseOut={(e) => !disabled && (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  );
}