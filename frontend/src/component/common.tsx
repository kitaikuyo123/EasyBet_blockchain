interface InputFieldProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  step?: string;
  required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
  step,
  required = false
}) => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
        {label} {required && <span style={{ color: 'red' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
        required={required}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};


interface ChoiceInputProps {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export const ChoiceInput: React.FC<ChoiceInputProps> = ({
  index,
  value,
  onChange,
  onRemove,
  canRemove
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      marginBottom: '0.5rem', 
      alignItems: 'center' 
    }}>
      <span style={{ marginRight: '0.5rem', minWidth: '20px' }}>
        {index + 1}.
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`选项 ${index + 1}`}
        style={{
          flex: 1,
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          marginRight: '0.5rem'
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        style={{
          padding: '0.5rem',
          backgroundColor: !canRemove ? '#ccc' : '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: !canRemove ? 'not-allowed' : 'pointer'
        }}
      >
        删除
      </button>
    </div>
  );
};

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  loading = false
}) => {
  const getBackgroundColor = () => {
    if (disabled || loading) return '#ccc';
    switch (variant) {
      case 'secondary': return '#6c757d';
      case 'success': return '#28a745';
      case 'danger': return '#dc3545';
      default: return '#007bff';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: getBackgroundColor(),
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.6 : 1
      }}
    >
      {loading ? '处理中...' : children}
    </button>
  );
};