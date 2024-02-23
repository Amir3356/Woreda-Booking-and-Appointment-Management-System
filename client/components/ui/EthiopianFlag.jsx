export default function EthiopianFlag({ className = "w-5 h-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 20"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        borderRadius: "3px",
        overflow: "hidden",
        display: "inline-block",
        verticalAlign: "middle",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        flexShrink: 0,
      }}
      aria-label="Ethiopian Flag"
      title="Ethiopia (+251)"
    >
      {/* Green stripe */}
      <rect width="32" height="6.666" fill="#078930" />
      {/* Yellow stripe */}
      <rect y="6.666" width="32" height="6.666" fill="#FCDD09" />
      {/* Red stripe */}
      <rect y="13.333" width="32" height="6.667" fill="#DA121A" />
      {/* Center blue circle */}
      <circle cx="16" cy="10" r="4.2" fill="#0F47AF" />
      {/* Yellow star with radiating emblem */}
      <path
        d="M16 6.8L16.9 9.5H19.8L17.4 11.2L18.3 13.9L16 12.2L13.7 13.9L14.6 11.2L12.2 9.5H15.1L16 6.8Z"
        fill="#FCDD09"
      />
      <line x1="16" y1="6.3" x2="16" y2="7.2" stroke="#FCDD09" strokeWidth="0.5" />
      <line x1="19.5" y1="8.8" x2="18.6" y2="9.3" stroke="#FCDD09" strokeWidth="0.5" />
      <line x1="18.2" y1="13.1" x2="17.6" y2="12.3" stroke="#FCDD09" strokeWidth="0.5" />
      <line x1="13.8" y1="13.1" x2="14.4" y2="12.3" stroke="#FCDD09" strokeWidth="0.5" />
      <line x1="12.5" y1="8.8" x2="13.4" y2="9.3" stroke="#FCDD09" strokeWidth="0.5" />
    </svg>
  );
}

