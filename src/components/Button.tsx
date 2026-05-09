interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function Button({ children, loading, disabled, className = "", ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 transition-all duration-200 cursor-pointer font-display ${className}`}
      {...props}
    >
      {loading ? "处理中..." : children}
    </button>
  );
}
