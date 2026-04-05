export default function Input({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
      {label && <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', color: '#003366', fontSize: '14px' }}>{label}</label>}
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{ 
          width: '100%', padding: '12px 16px', 
          border: '1px solid #e2e8f0', borderRadius: '12px',
          boxSizing: 'border-box', outline: 'none',
          fontSize: '16px', fontWeight: '500', color: '#334155',
          transition: 'border-color 0.2s'
        }}
        onFocus={(e) => e.target.style.borderColor = '#003366'}
        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
      />
    </div>
  );
}