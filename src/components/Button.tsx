interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function Button({ children, loading, disabled, className = "", ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors ${className}`}
      {...props}
    >
      {loading ? "处理中..." : children}
    </button>
  );
}
